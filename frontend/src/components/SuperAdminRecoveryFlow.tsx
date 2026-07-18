import React, { useState } from 'react';
import { api } from '../api';

interface Props {
  onBack: () => void;
}

type Step = 'request' | 'otp' | 'reset' | 'success';
type Method = 'email' | 'phone';

export function SuperAdminRecoveryFlow({ onBack }: Props) {
  const [step, setStep] = useState<Step>('request');
  const [method, setMethod] = useState<Method>('email');

  const [recoveryEmail, setRecoveryEmail] = useState('neguinho.ndiaye@gmail.com');
  const [recoveryPhone, setRecoveryPhone] = useState('+221 77 803 47 56');
  const [otpInput, setOtpInput] = useState('');
  const [otpReceived, setOtpReceived] = useState(''); // Code reçu du serveur (demo)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Étape 1 : Demander l'OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const payload: any = {};
      if (method === 'email') payload.recoveryEmail = recoveryEmail.trim();
      else payload.recoveryPhone = recoveryPhone.trim();

      const res = await api.post('/auth/super-admin/request-reset', payload, {
        headers: { 'X-Tenant-ID': 'legacy' }
      });

      const { otp, message } = res.data;

      if (otp === '------') {
        setError(message);
      } else {
        setOtpReceived(otp);
        setInfo(message);
        setStep('otp');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Erreur lors de l'envoi de la demande.");
    } finally {
      setLoading(false);
    }
  };

  // Étape 2 : Vérifier l'OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/super-admin/verify-otp', { otp: otpInput }, {
        headers: { 'X-Tenant-ID': 'legacy' }
      });
      setStep('reset');
    } catch (err: any) {
      setError(err.response?.data?.message || "Code OTP invalide ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  // Étape 3 : Nouveau mot de passe
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/super-admin/reset-password', { otp: otpInput, newPassword }, {
        headers: { 'X-Tenant-ID': 'legacy' }
      });
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.message || "Erreur lors de la réinitialisation.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: '10px',
    border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.78rem', fontWeight: 600,
    color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px',
  };

  const btnPrimary: React.CSSProperties = {
    width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', color: 'white',
    fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', marginTop: '8px',
    opacity: loading ? 0.7 : 1,
  };

  const btnSecondary: React.CSSProperties = {
    width: '100%', padding: '11px', borderRadius: '10px',
    border: '1px solid var(--border-color)', background: 'transparent',
    color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem',
    cursor: 'pointer', marginTop: '8px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px',
        }}>
          <i className="ph-fill ph-shield-check" style={{ fontSize: '1.6rem', color: 'white' }}></i>
        </div>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          Console SaaS — Récupération
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Réinitialisation du mot de passe Super-Admin
        </p>
      </div>

      {/* Barre de progression */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
        {(['request', 'otp', 'reset', 'success'] as Step[]).map((s, i) => (
          <div key={s} style={{
            flex: 1, height: '4px', borderRadius: '2px',
            background: ['request', 'otp', 'reset', 'success'].indexOf(step) >= i
              ? 'linear-gradient(90deg, #8b5cf6, #3b82f6)'
              : 'var(--border-color)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Messages */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 14px', color: '#ef4444', fontSize: '0.82rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <i className="ph-bold ph-warning-circle"></i> {error}
        </div>
      )}
      {info && !error && (
        <div style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '10px', padding: '10px 14px', color: '#3b82f6', fontSize: '0.82rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <i className="ph-bold ph-info"></i> {info}
        </div>
      )}

      {/* ── ÉTAPE 1 : SAISIR LE CONTACT DE RÉCUPÉRATION ─────────────────────── */}
      {step === 'request' && (
        <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Choix méthode */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['email', 'phone'] as Method[]).map(m => (
              <button key={m} type="button" onClick={() => setMethod(m)} style={{
                flex: 1, padding: '9px', borderRadius: '10px', border: 'none',
                background: method === m ? 'linear-gradient(135deg, #8b5cf6, #3b82f6)' : 'var(--bg-tertiary)',
                color: method === m ? 'white' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
                <i className={`ph-bold ph-${m === 'email' ? 'envelope' : 'device-mobile'}`} style={{ marginRight: '5px' }}></i>
                {m === 'email' ? 'Email' : 'Téléphone'}
              </button>
            ))}
          </div>

          {method === 'email' ? (
            <div>
              <label style={labelStyle}>Email de récupération</label>
              <input
                type="email" style={{ ...inputStyle, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                value={recoveryEmail}
                readOnly
              />
              <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Adresse email sécurisée pour le compte Super-Admin
              </p>
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Téléphone de récupération</label>
              <input
                type="tel" style={{ ...inputStyle, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                value={recoveryPhone}
                readOnly
              />
              <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Numéro sécurisé pour le compte Super-Admin
              </p>
            </div>
          )}

          <button type="submit" style={btnPrimary} disabled={loading}>
            {loading ? 'Vérification...' : 'Obtenir le code OTP →'}
          </button>
        </form>
      )}

      {/* ── ÉTAPE 2 : SAISIR L'OTP ──────────────────────────────────────────── */}
      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Le mode démo a été supprimé, l'OTP est envoyé par email/SMS */}
          <div style={{
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: '10px', padding: '10px 14px', color: '#3b82f6', fontSize: '0.82rem',
            display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px'
          }}>
            <i className="ph-bold ph-paper-plane-tilt"></i>
            Un code a été envoyé. Veuillez vérifier vos messages.
          </div>

          <div>
            <label style={labelStyle}>Entrez le code OTP à 6 chiffres</label>
            <input
              type="text" style={{ ...inputStyle, textAlign: 'center', letterSpacing: '8px', fontSize: '1.4rem', fontWeight: 800 }}
              placeholder="000000"
              maxLength={6}
              value={otpInput}
              onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>

          <button type="submit" style={btnPrimary} disabled={loading}>
            {loading ? 'Vérification...' : 'Vérifier le code →'}
          </button>
          <button type="button" style={btnSecondary} onClick={() => { setStep('request'); setError(''); }}>
            ← Retour
          </button>
        </form>
      )}

      {/* ── ÉTAPE 3 : NOUVEAU MOT DE PASSE ─────────────────────────────────── */}
      {step === 'reset' && (
        <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '10px 14px', color: '#22c55e', fontSize: '0.82rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <i className="ph-bold ph-check-circle"></i> Code OTP vérifié. Définissez votre nouveau mot de passe.
          </div>

          <div>
            <label style={labelStyle}>Nouveau mot de passe</label>
            <input
              type="password" style={inputStyle}
              placeholder="Minimum 6 caractères"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Confirmer le mot de passe</label>
            <input
              type="password" style={inputStyle}
              placeholder="Saisir à nouveau"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" style={btnPrimary} disabled={loading}>
            {loading ? 'Mise à jour...' : 'Modifier le mot de passe →'}
          </button>
        </form>
      )}

      {/* ── SUCCÈS ──────────────────────────────────────────────────────────── */}
      {step === 'success' && (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <i className="ph-bold ph-check" style={{ fontSize: '1.8rem', color: 'white' }}></i>
          </div>
          <h4 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Mot de passe réinitialisé !
          </h4>
          <p style={{ margin: '0 0 16px', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
            Vous pouvez maintenant vous connecter à la Console SaaS avec votre nouveau mot de passe.
          </p>
          <button onClick={onBack} style={btnPrimary}>
            Retour à la connexion →
          </button>
        </div>
      )}

      {/* Retour */}
      {step !== 'success' && (
        <button onClick={onBack} style={btnSecondary}>
          Retour à la connexion
        </button>
      )}
    </div>
  );
}
