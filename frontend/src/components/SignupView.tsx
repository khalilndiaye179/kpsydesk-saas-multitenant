import React, { useState, useEffect } from 'react';
import { api, initSession } from '../api';

interface Plan {
  id: string;
  name: string;
  price: number;
  quotaAssets: number;
  quotaUsers: number;
}

interface SignupViewProps {
  onSignupSuccess: (token: string, user: any, subdomain: string) => void;
  onBackToLogin: () => void;
  onGoToPricing: () => void;
  preselectedPlan?: string;
}

export function SignupView({ onSignupSuccess, onBackToLogin, onGoToPricing, preselectedPlan }: SignupViewProps) {
  const [step, setStep] = useState<1 | 2 | 2.5 | 3>(1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [subdomainStatus, setSubdomainStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [selectedPlan, setSelectedPlan] = useState(preselectedPlan || '');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminCountry, setAdminCountry] = useState('');
  const [adminPosition, setAdminPosition] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // OTP Verification states (Step 2.5)
  const [pendingId, setPendingId] = useState('');
  const [verificationChannel, setVerificationChannel] = useState<'email' | 'sms'>('email');
  const [otp, setOtp] = useState('');
  const [resendSuccess, setResendSuccess] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    api.get('/tenants/plans')
      .then(res => setPlans(res.data.filter((p: Plan) => p.name !== 'Legacy')))
      .catch(() => {
        setPlans([
          { id: 'starter', name: 'Starter', price: 15000, quotaAssets: 100, quotaUsers: 10 },
          { id: 'pro', name: 'Pro', price: 45000, quotaAssets: 500, quotaUsers: 50 },
          { id: 'enterprise', name: 'Enterprise', price: 120000, quotaAssets: 99999, quotaUsers: 99999 },
        ]);
      });
  }, []);

  // Auto-génère le sous-domaine (slug) depuis le nom d'entreprise
  // Format standard SaaS : acme-corp.kpsy.com
  const handleCompanyNameChange = (val: string) => {
    setCompanyName(val);
    const slug = val
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // supprimer accents
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);
    setSubdomain(slug);
    setSubdomainStatus('idle');
  };

  const handleSubdomainChange = (val: string) => {
    // Slug pur : lettres, chiffres, tirets uniquement
    const cleaned = val.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
    setSubdomain(cleaned);
    setSubdomainStatus('idle');
  };

  // Validation du sous-domaine (check de disponibilité)
  const checkSubdomain = async () => {
    if (!subdomain || subdomain.length < 3) return;
    setSubdomainStatus('checking');
    try {
      await new Promise(r => setTimeout(r, 600));
      const taken = ['legacy', 'www', 'admin', 'api', 'demo', 'test'];
      setSubdomainStatus(taken.includes(subdomain) ? 'taken' : 'available');
    } catch {
      setSubdomainStatus('idle');
    }
  };

  const validateStep1 = () => {
    if (!companyName.trim()) { setError('Le nom de l\'entreprise est requis.'); return false; }
    if (!subdomain || subdomain.length < 3) { setError('Le sous-domaine doit faire au moins 3 caractères.'); return false; }
    if (subdomainStatus === 'taken') { setError('Ce sous-domaine est déjà pris.'); return false; }
    if (!selectedPlan) { setError('Veuillez choisir un plan.'); return false; }
    setError(''); return true;
  };

  const validateStep2 = () => {
    if (!adminFirstName.trim() || !adminLastName.trim()) { setError('Le prénom et nom sont requis.'); return false; }
    if (!adminPhone.trim() || !adminCountry.trim() || !adminPosition.trim()) { setError('Le téléphone, la zone géographique et le poste sont requis.'); return false; }
    if (!adminEmail || !adminEmail.includes('@')) { setError('Email invalide.'); return false; }
    if (adminPassword.length < 10) { setError('Le mot de passe doit comporter au moins 10 caractères.'); return false; }
    if (adminPassword !== confirmPassword) { setError('Les mots de passe ne correspondent pas.'); return false; }
    if (!acceptTerms) { setError('Vous devez accepter les conditions d\'utilisation.'); return false; }
    setError(''); return true;
  };

  // Demande initiale d'OTP (Étape 2 -> 2.5)
  const handleRequestVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;
    setLoading(true);
    setError('');
    setResendSuccess('');

    try {
      const res = await api.post('/tenants/signup/request-verification', {
        companyName,
        subdomain,
        adminEmail,
        adminPassword,
        adminFirstName,
        adminLastName,
        adminPhone,
        adminCountry,
        adminPosition,
        planName: selectedPlan,
        verificationChannel,
      });

      setPendingId(res.data.pendingId);
      setStep(2.5);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      const displayMsg = Array.isArray(msg) ? msg.join(' ') : (msg || 'Erreur lors de l\'envoi du code de vérification.');
      setError(displayMsg);
    } finally {
      setLoading(false);
    }
  };

  // Validation de l'OTP et création réelle (Étape 2.5 -> 3)
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Veuillez saisir le code de vérification à 6 chiffres.');
      return;
    }

    setLoading(true);
    setError('');
    setResendSuccess('');

    try {
      await api.post('/tenants/signup/verify', {
        pendingId,
        otp: otp.trim(),
      });

      setSuccess(true);

      // Auto-login après inscription
      const loginRes = await api.post('/auth/login', {
        email: adminEmail,
        password: adminPassword,
      }, { headers: { 'X-Tenant-ID': subdomain } });

      const { access_token, user } = loginRes.data;
      initSession(access_token, subdomain);
      setStep(3);

      setTimeout(() => onSignupSuccess(access_token, user, subdomain), 1500);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      const displayMsg = Array.isArray(msg) ? msg.join(' ') : (msg || 'Code de vérification invalide ou expiré.');
      setError(displayMsg);
    } finally {
      setLoading(false);
    }
  };

  // Renvoi du code OTP
  const handleResendCode = async () => {
    if (!pendingId) return;
    setResending(true);
    setError('');
    setResendSuccess('');

    try {
      const res = await api.post('/tenants/signup/resend-code', { pendingId });
      setResendSuccess(res.data.message || 'Nouveau code envoyé !');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      const displayMsg = Array.isArray(msg) ? msg.join(' ') : (msg || 'Erreur lors du renvoi du code.');
      setError(displayMsg);
    } finally {
      setResending(false);
    }
  };

  const formatPrice = (price: number) =>
    price === 0 ? 'Gratuit' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(price) + '/mois';

  const PLAN_COLORS: Record<string, string> = { Starter: '#3b82f6', Pro: '#8b5cf6', Enterprise: '#f59e0b' };

  // Step 3 — Success
  if (step === 3) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem', fontSize: '2.5rem',
            boxShadow: '0 0 30px #22c55e50', animation: 'pulse 1s ease-in-out'
          }}>
            <i className="ph-bold ph-check-circle" style={{ color: 'white' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
            Bienvenue sur KPSyDesk !
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Votre espace <strong style={{ color: 'var(--text-primary)' }}>{companyName}</strong> est prêt.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Connexion en cours…
          </p>
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: '40px', height: '4px', borderRadius: '2px',
              background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
              animation: 'loading-bar 1.5s ease-in-out'
            }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-layout-split" style={{ minHeight: '100vh' }}>
      {/* Left Pane */}
      <div className="login-left-pane">
        <div className="login-brand-header">
          <img src="/logo.png" alt="K'PSy Informatique Logo" className="login-brand-logo" />
          <div className="login-brand-text">
            <div className="login-brand-name">
              <span className="kpsy">K'PSY</span> <span className="informatique">INFORMATIQUE</span>
            </div>
            <div className="login-brand-desc">Khalil* Prestation Systèmes Informatiques</div>
          </div>
        </div>

        <div className="login-slogan-banner">
          <div className="login-slogan-text">Créez votre espace en 2 minutes</div>
        </div>

        {/* Steps indicator */}
        <div style={{ padding: '2rem 1.5rem' }}>
          {[
            { num: 1, label: 'Votre entreprise', desc: 'Nom, sous-domaine et plan' },
            { num: 2, label: 'Compte administrateur', desc: 'Coordonnées & mot de passe' },
            { num: 3, label: 'Vérification', desc: 'Codes OTP Email & SMS' },
          ].map(({ num, label, desc }) => {
            const currentStepNum = step === 1 ? 1 : step === 2 ? 2 : step === 2.5 ? 3 : 4;
            const isCompleted = currentStepNum > num;
            const isActive = currentStepNum === num;
            return (
              <div key={num} style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '14px 16px', marginBottom: '12px', borderRadius: '12px',
                background: isActive ? 'linear-gradient(135deg, #8b5cf620, #3b82f620)' : 'transparent',
                border: isActive ? '1px solid #8b5cf640' : '1px solid transparent',
                transition: 'all 0.3s'
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: isCompleted ? '#22c55e' : isActive ? 'linear-gradient(135deg, #8b5cf6, #3b82f6)' : 'var(--bg-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem', fontWeight: 700, color: (isCompleted || isActive) ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.3s'
                }}>
                  {isCompleted ? <i className="ph-bold ph-check" /> : num}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '0 1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <i className="ph-bold ph-shield-check" style={{ color: '#22c55e' }} /> Données isolées par entreprise
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <i className="ph-bold ph-clock" style={{ color: '#3b82f6' }} /> 7 jours d'essai gratuit
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ph-bold ph-credit-card" style={{ color: '#f59e0b' }} /> Aucune carte bancaire requise
          </div>
        </div>

        <div className="login-left-footer" style={{ marginTop: 'auto' }}>
          <div className="login-footer-copy">© 2026 K'PSY INFORMATIQUE</div>
        </div>
      </div>

      {/* Right Pane — Form */}
      <div className="login-right-pane" style={{ overflowY: 'auto' }}>
        <div style={{ maxWidth: '460px', margin: '0 auto', padding: '2rem 1.5rem' }}>

          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Étape {step === 1 ? 1 : step === 2 ? 2 : 3} sur 3
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {step === 1 ? '🏢 Créer votre espace' : step === 2 ? '👤 Compte administrateur' : '🔒 Vérification des coordonnées'}
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: '6px 0 0', fontSize: '0.9rem' }}>
              {step === 1
                ? 'Renseignez les informations de votre entreprise'
                : step === 2
                ? 'Ce compte sera l\'administrateur principal de votre espace'
                : 'Saisissez les 2 codes de vérification envoyés par Email et SMS'}
            </p>
          </div>

          {error && (
            <div className="auth-alert-error" style={{ marginBottom: '1.25rem' }}>
              <i className="ph ph-warning-circle" style={{ marginRight: '8px' }} />
              {error}
            </div>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Company Name */}
              <div className="auth-field">
                <label style={{ fontWeight: 600 }}>Nom de l'entreprise *</label>
                <div className="login-input-container">
                  <i className="ph ph-buildings" />
                  <input
                    type="text"
                    className="login-input-field"
                    placeholder="Ex: Acme Corporation"
                    value={companyName}
                    onChange={e => handleCompanyNameChange(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Subdomain */}
              <div className="auth-field">
                <label style={{ fontWeight: 600 }}>Sous-domaine *</label>
                <div style={{ position: 'relative' }}>
                  <div className="login-input-container" style={{ paddingRight: '90px' }}>
                    <i className="ph ph-globe" />
                    <input
                      type="text"
                      className="login-input-field"
                      placeholder="mon-entreprise"
                      value={subdomain}
                      onChange={e => handleSubdomainChange(e.target.value)}
                      onBlur={checkSubdomain}
                      required
                    />
                  </div>
                  <span style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap'
                  }}>
                    .kpsyinformatique.com
                  </span>
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {subdomainStatus === 'checking' && <><i className="ph ph-circle-notch" style={{ animation: 'spin 1s linear infinite' }} /> Vérification…</>}
                  {subdomainStatus === 'available' && <><i className="ph-bold ph-check-circle" style={{ color: '#22c55e' }} /> <span style={{ color: '#22c55e' }}>Disponible !</span></>}
                  {subdomainStatus === 'taken' && <><i className="ph-bold ph-x-circle" style={{ color: '#ef4444' }} /> <span style={{ color: '#ef4444' }}>Déjà utilisé</span></>}
                  {subdomainStatus === 'idle' && subdomain && <span style={{ color: 'var(--text-muted)' }}>Votre URL : <strong style={{ color: 'var(--accent-blue)' }}>{subdomain}.kpsyinformatique.com</strong></span>}
                </div>
              </div>

              {/* Plan Selection */}
              <div className="auth-field">
                <label style={{ fontWeight: 600 }}>Plan *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {plans.map(plan => {
                    const color = PLAN_COLORS[plan.name] ?? '#6b7280';
                    return (
                      <label key={plan.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                        border: selectedPlan === plan.name ? `2px solid ${color}` : '1px solid var(--border-color)',
                        background: selectedPlan === plan.name ? `${color}15` : 'var(--bg-secondary)',
                        transition: 'all 0.2s'
                      }}>
                        <input
                          type="radio"
                          name="plan"
                          value={plan.name}
                          checked={selectedPlan === plan.name}
                          onChange={() => setSelectedPlan(plan.name)}
                          style={{ accentColor: color }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{plan.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {plan.quotaAssets >= 99999 ? '∞' : plan.quotaAssets} actifs · {plan.quotaUsers >= 99999 ? '∞' : plan.quotaUsers} utilisateurs
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color, fontSize: '0.9rem' }}>{formatPrice(plan.price)}</div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                className="btn-submit-gradient"
                onClick={() => { if (validateStep1()) setStep(2); }}
              >
                Continuer →
              </button>

              <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Déjà inscrit ?{' '}
                <button type="button" onClick={onBackToLogin} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontWeight: 600 }}>
                  Se connecter
                </button>
                {' '}·{' '}
                <button type="button" onClick={onGoToPricing} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  Voir les tarifs
                </button>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <form onSubmit={handleRequestVerification} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="auth-field">
                  <label style={{ fontWeight: 600 }}>Prénom *</label>
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="Jean"
                    value={adminFirstName}
                    onChange={e => setAdminFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label style={{ fontWeight: 600 }}>Nom *</label>
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="Dupont"
                    value={adminLastName}
                    onChange={e => setAdminLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="auth-field">
                  <label style={{ fontWeight: 600 }}>Email professionnel *</label>
                  <div className="login-input-container">
                    <i className="ph ph-envelope" />
                    <input
                      type="email"
                      className="login-input-field"
                      placeholder="jean.dupont@acme.com"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="auth-field">
                  <label style={{ fontWeight: 600 }}>Téléphone *</label>
                  <div className="login-input-container">
                    <i className="ph ph-phone" />
                    <input
                      type="tel"
                      className="login-input-field"
                      placeholder="+221 77 000 00 00"
                      value={adminPhone}
                      onChange={e => setAdminPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="auth-field">
                  <label style={{ fontWeight: 600 }}>Pays / Zone géo *</label>
                  <div className="login-input-container">
                    <i className="ph ph-globe" />
                    <input
                      type="text"
                      className="login-input-field"
                      placeholder="Sénégal, France..."
                      value={adminCountry}
                      onChange={e => setAdminCountry(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="auth-field">
                  <label style={{ fontWeight: 600 }}>Poste *</label>
                  <div className="login-input-container">
                    <i className="ph ph-briefcase" />
                    <input
                      type="text"
                      className="login-input-field"
                      placeholder="DSI, Gérant..."
                      value={adminPosition}
                      onChange={e => setAdminPosition(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="auth-field">
                <label style={{ fontWeight: 600 }}>Mot de passe *</label>
                <div className="login-input-container">
                  <i className="ph ph-lock" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="login-input-field"
                    placeholder="Minimum 10 caractères"
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}>
                    <i className={`ph ${showPass ? 'ph-eye-slash' : 'ph-eye'}`} />
                  </button>
                </div>
                {adminPassword && (
                  <div style={{ marginTop: '6px', display: 'flex', gap: '4px' }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{
                        flex: 1, height: '4px', borderRadius: '2px',
                        background: adminPassword.length >= i * 2 + 2
                          ? (i <= 2 ? '#f59e0b' : '#22c55e')
                          : 'var(--border-color)',
                        transition: 'background 0.3s'
                      }} />
                    ))}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                      {adminPassword.length < 8 ? 'Faible' : adminPassword.length < 12 ? 'Moyen' : 'Fort'}
                    </span>
                  </div>
                )}
              </div>

              <div className="auth-field">
                <label style={{ fontWeight: 600 }}>Confirmer le mot de passe *</label>
                <div className="login-input-container">
                  <i className={`ph-bold ${confirmPassword && adminPassword === confirmPassword ? 'ph-check-circle' : 'ph-lock'}`}
                    style={{ color: confirmPassword && adminPassword === confirmPassword ? '#22c55e' : undefined }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="login-input-field"
                    placeholder="Répéter le mot de passe"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={e => setAcceptTerms(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: '#8b5cf6' }}
                />
                J'accepte les <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Conditions d'utilisation</span> et la <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Politique de confidentialité</span>
              </label>

              {/* Choix du canal de vérification */}
              <div className="auth-field">
                <label style={{ fontWeight: 600 }}>Recevoir le code de vérification via *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setVerificationChannel('email')}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
                      border: verificationChannel === 'email' ? '2px solid #8b5cf6' : '1px solid var(--border-color)',
                      background: verificationChannel === 'email' ? 'rgba(139,92,246,0.15)' : 'var(--bg-secondary)',
                      color: verificationChannel === 'email' ? '#8b5cf6' : 'var(--text-muted)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <i className="ph-bold ph-envelope-simple" style={{ fontSize: '1.1rem' }} />
                    Email ({adminEmail || 'Email'})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerificationChannel('sms')}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
                      border: verificationChannel === 'sms' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                      background: verificationChannel === 'sms' ? 'rgba(59,130,246,0.15)' : 'var(--bg-secondary)',
                      color: verificationChannel === 'sms' ? '#3b82f6' : 'var(--text-muted)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <i className="ph-bold ph-device-mobile" style={{ fontSize: '1.1rem' }} />
                    SMS ({adminPhone || 'SMS'})
                  </button>
                </div>
              </div>

              {/* Recap */}
              <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: '10px', padding: '12px 16px', fontSize: '0.82rem',
                display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)'
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>📋 Récapitulatif</div>
                <div><strong>Entreprise :</strong> {companyName}</div>
                <div><strong>URL :</strong> {subdomain}.kpsyinformatique.com</div>
                <div><strong>Plan :</strong> {selectedPlan}</div>
                <div style={{ color: '#22c55e', fontWeight: 600 }}><i className="ph ph-clock" /> 7 jours d'essai gratuit inclus</div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    border: '1px solid var(--border-color)', background: 'transparent',
                    color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600
                  }}
                >
                  ← Retour
                </button>
                <button
                  type="submit"
                  className="btn-submit-gradient"
                  style={{ flex: 2 }}
                  disabled={loading}
                >
                  {loading ? (
                    <><i className="ph ph-circle-notch" style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }} />Envoi du code…</>
                  ) : `📩 Envoyer le code ${verificationChannel === 'email' ? 'Email' : 'SMS'} →`}
                </button>
              </div>
            </form>
          )}

          {/* Step 2.5 — OTP Verification */}
          {step === 2.5 && (
            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.1))',
                border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: '12px', padding: '16px', fontSize: '0.85rem'
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ph-bold ph-shield-check" style={{ color: '#8b5cf6', fontSize: '1.2rem' }} />
                  Code de vérification envoyé !
                </div>
                {verificationChannel === 'email' ? (
                  <div style={{ color: 'var(--text-muted)' }}>
                    📩 Code envoyé par <strong>Email</strong> à <strong style={{ color: 'var(--text-primary)' }}>{adminEmail}</strong>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)' }}>
                    📱 Code envoyé par <strong>SMS</strong> au <strong style={{ color: 'var(--text-primary)' }}>{adminPhone}</strong>
                  </div>
                )}
              </div>

              {resendSuccess && (
                <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', color: '#22c55e', fontSize: '0.85rem', fontWeight: 600 }}>
                  <i className="ph ph-check-circle" style={{ marginRight: '6px' }} />
                  {resendSuccess}
                </div>
              )}

              {/* OTP Field */}
              <div className="auth-field">
                <label style={{ fontWeight: 600 }}>
                  Code de vérification {verificationChannel === 'email' ? 'Email' : 'SMS'} (6 chiffres) *
                </label>
                <div className="login-input-container">
                  <i className={`ph ${verificationChannel === 'email' ? 'ph-envelope-simple' : 'ph-device-mobile'}`} />
                  <input
                    type="text"
                    maxLength={6}
                    className="login-input-field"
                    placeholder="Ex: 123456"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{ letterSpacing: '4px', fontSize: '1.1rem', fontWeight: 700 }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Vous n'avez pas reçu le code ?</span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resending}
                  style={{ background: 'none', border: 'none', color: '#8b5cf6', fontWeight: 600, cursor: 'pointer' }}
                >
                  {resending ? 'Envoi en cours…' : '🔄 Renvoyer le code'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setStep(2); setError(''); }}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    border: '1px solid var(--border-color)', background: 'transparent',
                    color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600
                  }}
                >
                  ← Retour
                </button>
                <button
                  type="submit"
                  className="btn-submit-gradient"
                  style={{ flex: 2 }}
                  disabled={loading}
                >
                  {loading ? (
                    <><i className="ph ph-circle-notch" style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }} />Création du compte…</>
                  ) : '🚀 Valider et créer mon espace'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
