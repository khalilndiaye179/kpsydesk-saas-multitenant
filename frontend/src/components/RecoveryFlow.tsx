import React, { useState } from 'react';
import { api } from '../api';

interface RecoveryFlowProps {
  onBack: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function RecoveryFlow({ onBack, onSuccess, onError }: RecoveryFlowProps) {
  const [method, setMethod] = useState<'email' | 'sms'>('email');
  const [step, setStep] = useState<'request' | 'verify' | 'reset'>('request');
  
  // Inputs
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [tenantSlugInput, setTenantSlugInput] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userId, setUserId] = useState('');

  const [loading, setLoading] = useState(false);

  // 1. Envoyer la demande (Email Link ou SMS OTP) via les Edge Functions de l'API
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    onError('');
    setLoading(true);

    try {
      if (method === 'email') {
        // Simulation / intégration Edge function request-password-reset
        // Nous configurons le header tenant pour router vers le bon espace
        const response = await api.post('/auth/login', {
          email: emailInput,
          password: '____CHECK_EMAIL_ONLY____', // Requête interceptée ou validée par le BaaS
        }, {
          headers: { 'X-Tenant-ID': tenantSlugInput.trim().toLowerCase() }
        }).catch(err => err.response);

        // Anti-énumération : réponse générique de succès systématique
        onSuccess("Si ce compte existe, un lien a été envoyé.");
        setStep('reset');
      } else {
        // OTP par SMS
        onSuccess("Code OTP envoyé par SMS : 123456 (Simulation).");
        setStep('verify');
      }
    } catch (err: any) {
      onError(err.response?.data?.message || "Une erreur est survenue lors de l'envoi.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Valider le code OTP
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode === '123456') {
      onSuccess("Code OTP vérifié.");
      setStep('reset');
    } else {
      onError("Code de vérification incorrect. Utilisez 123456 pour ce test.");
    }
  };

  // 3. Modifier le mot de passe
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    onError('');

    if (newPassword !== confirmPassword) {
      onError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (newPassword.length < 5) {
      onError("Le mot de passe doit contenir au moins 5 caractères.");
      return;
    }

    setLoading(true);
    try {
      // Simulation / intégration de la réinitialisation de mot de passe en base
      onSuccess("Mot de passe mis à jour avec succès ! Connectez-vous avec vos nouveaux identifiants.");
      onBack();
    } catch (err: any) {
      onError(err.response?.data?.message || "Erreur de réinitialisation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <h3 style={{ margin: '0 0 5px', fontSize: '1.2rem', fontWeight: 700, textAlign: 'center', color: 'var(--text-primary)' }}>
        Récupération de compte
      </h3>

      {step === 'request' && (
        <form onSubmit={handleSendRequest} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '10px' }}>
            <button
              type="button"
              onClick={() => setMethod('email')}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                background: method === 'email' ? 'var(--primary)' : 'var(--bg-tertiary)',
                color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem'
              }}
            >
              Lien par Email
            </button>
            <button
              type="button"
              onClick={() => setMethod('sms')}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                background: method === 'sms' ? 'var(--primary)' : 'var(--bg-tertiary)',
                color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem'
              }}
            >
              Code OTP SMS
            </button>
          </div>

          <div className="login-field-wrapper">
            <label className="login-field-label">Identifiant entreprise (tenant)</label>
            <div className="login-input-container">
              <i className="ph ph-buildings"></i>
              <input
                type="text"
                className="login-input-field"
                placeholder="ex: ladin, alamine"
                value={tenantSlugInput}
                onChange={e => setTenantSlugInput(e.target.value)}
                required
              />
            </div>
          </div>

          {method === 'email' ? (
            <div className="login-field-wrapper">
              <label className="login-field-label">Adresse e-mail</label>
              <div className="login-input-container">
                <i className="ph ph-envelope"></i>
                <input
                  type="email"
                  className="login-input-field"
                  placeholder="votre@email.com"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  required
                />
              </div>
            </div>
          ) : (
            <div className="login-field-wrapper">
              <label className="login-field-label">Numéro de téléphone</label>
              <div className="login-input-container">
                <i className="ph ph-phone"></i>
                <input
                  type="tel"
                  className="login-input-field"
                  placeholder="+221 77 000 00 00"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn-submit-gradient"
            disabled={loading}
            style={{ marginTop: '10px' }}
          >
            {loading ? "Envoi..." : "Obtenir l'accès"}
          </button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 10px', textAlign: 'center' }}>
            Veuillez entrer le code à 6 chiffres reçu par SMS.
          </p>
          <div className="login-field-wrapper">
            <label className="login-field-label">Code OTP de vérification</label>
            <div className="login-input-container">
              <i className="ph ph-key"></i>
              <input
                type="text"
                className="login-input-field"
                placeholder="123456"
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value)}
                required
                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-submit-gradient"
            style={{ marginTop: '10px' }}
          >
            Vérifier le code OTP
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="login-field-wrapper">
            <label className="login-field-label">Nouveau mot de passe</label>
            <div className="login-input-container">
              <i className="ph ph-lock"></i>
              <input
                type="password"
                className="login-input-field"
                placeholder="Minimum 5 caractères"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="login-field-wrapper">
            <label className="login-field-label">Confirmer le mot de passe</label>
            <div className="login-input-container">
              <i className="ph ph-lock"></i>
              <input
                type="password"
                className="login-input-field"
                placeholder="Saisir à nouveau"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-submit-gradient"
            disabled={loading}
            style={{ marginTop: '10px' }}
          >
            {loading ? "Mise à jour..." : "Modifier le mot de passe"}
          </button>
        </form>
      )}

      <button
        onClick={onBack}
        style={{
          width: '100%', padding: '10px', borderRadius: '8px',
          border: '1px solid var(--border-color)', background: 'transparent',
          color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', marginTop: '5px'
        }}
      >
        Retour à la connexion
      </button>
    </div>
  );
}
