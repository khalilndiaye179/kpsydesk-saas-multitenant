import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Seed minimal — ne crée QUE les données système transversales :
 *   1. Plans tarifaires (Starter, Pro, Enterprise)
 *   2. Compte Super-Administrateur global (legacy)
 *
 * AUCUNE donnée de test (assets, tickets, utilisateurs fictifs, fournisseurs,
 * contrats, licences, etc.) n'est insérée ici.
 * Chaque abonné commence avec un environnement 100 % vierge.
 */
async function main() {
  console.log('=== Seed système KPSyDesk (minimal) ===\n');

  // ─────────────────────────────────────────────────────────────────
  // 1. Plans tarifaires (idempotent : upsert sur le nom)
  // ─────────────────────────────────────────────────────────────────
  console.log('📦 Création des plans tarifaires...');

  await prisma.plan.upsert({
    where: { name: 'Starter' },
    update: {},
    create: {
      name: 'Starter',
      price: 15000,
      quotaAssets: 100,
      quotaUsers: 10,
      isPublic: true,
    },
  });

  await prisma.plan.upsert({
    where: { name: 'Pro' },
    update: {},
    create: {
      name: 'Pro',
      price: 45000,
      quotaAssets: 500,
      quotaUsers: 50,
      isPublic: true,
    },
  });

  await prisma.plan.upsert({
    where: { name: 'Enterprise' },
    update: {},
    create: {
      name: 'Enterprise',
      price: 120000,
      quotaAssets: 999999,
      quotaUsers: 999999,
      isPublic: true,
    },
  });

  // Plan interne legacy (non visible dans la liste publique)
  await prisma.plan.upsert({
    where: { name: 'Legacy' },
    update: {},
    create: {
      name: 'Legacy',
      price: 0,
      quotaAssets: 999999,
      quotaUsers: 999999,
      isPublic: false,
    },
  });

  console.log('   ✅ Plans : Starter, Pro, Enterprise, Legacy\n');

  // ─────────────────────────────────────────────────────────────────
  // 2. Compte Super-Administrateur global (legacy — sans tenantId)
  // ─────────────────────────────────────────────────────────────────
  console.log('👤 Création du compte Super-Admin...');

  const existingAdmin = await prisma.user.findFirst({
    where: {
      email: 'admin@entreprise.com',
      tenantId: null,
    },
  });

  if (existingAdmin) {
    console.log('   ✅ Super-Admin déjà existant, aucune modification effectuée sur son compte.\n');
  } else {
    const temporaryPassword = crypto.randomBytes(12).toString('base64url');
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    await prisma.user.create({
      data: {
        email: 'admin@entreprise.com',
        username: 'admin',
        password: hashedPassword,
        firstName: 'Super',
        lastName: 'Admin',
        role: Role.ADMIN,
        systemRole: 'Admin IT',
        status: 'Actif',
        // Pas de tenantId → utilisateur global (portail legacy)
      },
    });
    
    console.log('   ✅ Super-Admin créé : admin@entreprise.com');
    console.log(`   ⚠️  Mot de passe temporaire du Super-Admin (à changer immédiatement) : ${temporaryPassword}\n`);
  }

  // ─────────────────────────────────────────────────────────────────
  // FIN — aucune donnée métier insérée
  // Chaque abonné inscrit via /api/tenants/signup reçoit un espace vierge.
  // ─────────────────────────────────────────────────────────────────
  console.log('=== Seed terminé. Base prête pour la production. ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
