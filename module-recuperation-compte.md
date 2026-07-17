# Module : Récupération de compte (Password Reset & Phone OTP)

> Ce module est prêt à être inséré dans le master prompt Antigravity, dans la section "Authentification & Sécurité". Il complète le système d'auth Supabase multi-tenant déjà défini.

---

## 1. Schéma de base de données

```sql
-- Table d'audit pour les resets déclenchés manuellement par un admin tenant
create table account_recovery_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  target_user_id uuid not null references auth.users(id),
  triggered_by uuid references auth.users(id), -- null si auto-service (email/SMS)
  method text not null check (method in ('email_link', 'sms_otp', 'admin_manual')),
  ip_address text,
  user_agent text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'expired', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table account_recovery_audit enable row level security;

-- Seuls les admins du même tenant peuvent lire les logs de leur tenant
create policy "tenant_admin_read_own_audit"
  on account_recovery_audit for select
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (auth.jwt() ->> 'role') in ('tenant_admin', 'super_admin')
  );

-- Table OTP SMS (Supabase gère déjà l'OTP interne, mais on trace ici pour l'audit et le throttling custom)
create table sms_otp_requests (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  tenant_id uuid references tenants(id),
  attempts int not null default 0,
  last_sent_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  verified boolean not null default false
);

create index idx_sms_otp_phone on sms_otp_requests(phone_number, tenant_id);
```

---

## 2. Edge Function : Reset par email (throttling + audit)

```typescript
// supabase/functions/request-password-reset/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { email, tenant_slug } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Toujours répondre 200 même si l'email n'existe pas (anti énumération)
  const genericResponse = new Response(
    JSON.stringify({ message: "Si ce compte existe, un lien a été envoyé." }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );

  const { data: user } = await supabase
    .from("profiles")
    .select("id, tenant_id, last_reset_request_at")
    .eq("email", email)
    .eq("tenant_slug", tenant_slug)
    .maybeSingle();

  if (!user) return genericResponse;

  // Throttle: 1 demande / 60s par utilisateur
  if (user.last_reset_request_at &&
      Date.now() - new Date(user.last_reset_request_at).getTime() < 60_000) {
    return genericResponse;
  }

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `https://${tenant_slug}.tonapp.sn/reset-password`,
  });

  await supabase.from("account_recovery_audit").insert({
    tenant_id: user.tenant_id,
    target_user_id: user.id,
    method: "email_link",
    status: "pending",
  });

  await supabase
    .from("profiles")
    .update({ last_reset_request_at: new Date().toISOString() })
    .eq("id", user.id);

  return genericResponse;
});
```

---

## 3. Edge Function : Reset par SMS OTP

```typescript
// supabase/functions/request-sms-otp/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { phone_number, tenant_slug } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Rate limit: max 3 tentatives / 15 min par numéro
  const { data: recent } = await supabase
    .from("sms_otp_requests")
    .select("attempts, last_sent_at")
    .eq("phone_number", phone_number)
    .gte("last_sent_at", new Date(Date.now() - 15 * 60_000).toISOString())
    .maybeSingle();

  if (recent && recent.attempts >= 3) {
    return new Response(
      JSON.stringify({ error: "Trop de tentatives. Réessayez dans 15 minutes." }),
      { status: 429 }
    );
  }

  // Supabase phone auth OTP natif
  const { error } = await supabase.auth.signInWithOtp({ phone: phone_number });
  if (error) {
    return new Response(JSON.stringify({ error: "Envoi impossible." }), { status: 500 });
  }

  await supabase.from("sms_otp_requests").upsert({
    phone_number,
    tenant_id: (await supabase.from("tenants").select("id").eq("slug", tenant_slug).single()).data?.id,
    attempts: (recent?.attempts ?? 0) + 1,
    last_sent_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ message: "Code envoyé par SMS." }), { status: 200 });
});
```

> **Note fournisseur SMS** : Supabase Auth utilise par défaut Twilio/MessageBird/Vonage pour l'OTP téléphone. Pour une couverture fiable au Sénégal, prévoir un fournisseur tiers (ex. Africa's Talking) via une Edge Function custom si la délivrabilité Twilio s'avère insuffisante sur les numéros Orange/Free locaux — à tester en amont avec de vrais numéros avant mise en prod.

---

## 4. Edge Function : Reset manuel par admin tenant (fallback zones peu connectées)

```typescript
// supabase/functions/admin-manual-reset/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Vérifier que l'appelant est bien admin du tenant concerné
  const { data: { user: caller } } = await supabase.auth.getUser(
    authHeader?.replace("Bearer ", "")
  );
  const { target_user_id, tenant_id, reason } = await req.json();

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role, tenant_id")
    .eq("id", caller?.id)
    .single();

  if (
    !callerProfile ||
    callerProfile.tenant_id !== tenant_id ||
    !["tenant_admin", "super_admin"].includes(callerProfile.role)
  ) {
    return new Response(JSON.stringify({ error: "Non autorisé." }), { status: 403 });
  }

  // Génère un mot de passe temporaire (à changer obligatoirement à la connexion)
  const tempPassword = crypto.randomUUID().slice(0, 12);

  await supabase.auth.admin.updateUserById(target_user_id, {
    password: tempPassword,
    user_metadata: { must_change_password: true },
  });

  await supabase.from("account_recovery_audit").insert({
    tenant_id,
    target_user_id,
    triggered_by: caller?.id,
    method: "admin_manual",
    status: "completed",
    completed_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ temp_password: tempPassword, reason }), { status: 200 });
});
```

---

## 5. Templates (français)

**Email de reset :**
```
Objet : Réinitialisation de votre mot de passe

Bonjour,

Une demande de réinitialisation de mot de passe a été effectuée pour votre compte.
Si vous êtes à l'origine de cette demande, cliquez sur le lien ci-dessous (valable 1 heure) :

[Réinitialiser mon mot de passe]

Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe
actuel reste inchangé.

L'équipe [NomApp]
```

**SMS OTP :**
```
[NomApp] Votre code de vérification est : 123456. Valable 10 min. Ne le partagez avec personne.
```

**Notification post-reset (second canal) :**
```
Votre mot de passe [NomApp] vient d'être modifié. Si ce n'est pas vous, contactez immédiatement
le support : [numéro/email support].
```

---

## 6. Checklist de sécurité à intégrer au master prompt

- [ ] Anti-énumération : réponse générique identique que l'utilisateur existe ou non
- [ ] Throttling : 1 demande email/60s, max 3 SMS/15min par numéro
- [ ] Invalidation de toutes les sessions actives après reset réussi (`signOut({ scope: 'global' })`)
- [ ] Notification systématique sur le second canal après un reset
- [ ] Scoping strict tenant_id sur toutes les requêtes (RLS)
- [ ] Audit trail complet pour tout reset manuel admin (obligatoire pour conformité secteur santé/finance)
- [ ] `must_change_password` forcé après un reset admin manuel
- [ ] Expiration token email : 1h / OTP SMS : 10min
