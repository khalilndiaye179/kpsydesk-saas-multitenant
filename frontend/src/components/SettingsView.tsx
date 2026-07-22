import React, { useEffect, useState } from 'react';
import { api } from '../api';
import PasswordStrengthIndicator, { isPasswordValid } from './PasswordStrengthIndicator';

interface Account {
  id: string;
  email: string;
  username: string;
  role: string;
  systemRole?: string;
  mfaEnabled: boolean;
}

export const SettingsView: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // Profile settings
  const [newPassword, setNewPassword] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  // MFA states
  const [mfaSetupData, setMfaSetupData] = useState<any>(null);
  const [mfaSetupCode, setMfaSetupCode] = useState('');
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[] | null>(null);
  const [mfaDisablePassword, setMfaDisablePassword] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaMsg, setMfaMsg] = useState<{type: 'success'|'error', text: string} | null>(null);


  // Modals for Accounts
  const [isOpen, setIsOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form Fields - Account
  const [accFields, setAccFields] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    systemRole: 'Utilisateur Standard',
    mfaEnabled: false
  });

  const fetchUserData = async () => {
    // Current user session
    const session = localStorage.getItem('currentUser');
    if (session) {
      const parsed = JSON.parse(session);
      setCurrentUser(parsed);
      setMfaEnabled(parsed.mfaEnabled || false);
      setEmailInput(parsed.email || '');
      setPhoneInput(parsed.phone || '');
    }

    try {
      const res = await api.get('/users');
      setAccounts(res.data || []);
    } catch (err) {
      console.warn("API error fetching accounts in SettingsView.", err);
      setAccounts([]);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (newPassword && !isPasswordValid(newPassword)) {
      alert("Le mot de passe ne respecte pas les critères de sécurité.");
      return;
    }

    try {
      const payload: any = { 
        email: emailInput,
        phone: phoneInput
      };
      if (newPassword) payload.password = newPassword;

      await api.put(`/users/${currentUser.id}`, payload);
      
      const updatedUser = { ...currentUser, email: emailInput, phone: phoneInput };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      setNewPassword('');
      alert("Votre profil a été mis à jour avec succès ! Ces coordonnées serviront pour la récupération de compte par Email ou SMS OTP.");
    } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur de mise à jour : " + msg); }
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSend = {
      username: accFields.username,
      email: accFields.email,
      phone: accFields.phone,
      firstName: accFields.username.toUpperCase(),
      lastName: 'Compte',
      systemRole: accFields.systemRole,
      mfaEnabled: accFields.mfaEnabled,
      role: accFields.systemRole.toLowerCase().includes('admin') ? 'ADMIN' : accFields.systemRole.toLowerCase().includes('tech') ? 'TECHNICIAN' : 'USER'
    } as any;

    if (accFields.password) {
      if (!isPasswordValid(accFields.password)) {
        alert("Le mot de passe du compte ne respecte pas les critères de sécurité.");
        return;
      }
      dataToSend.password = accFields.password;
    }

    try {
      if (editingAccount && editingAccount.id !== '1') {
        await api.put(`/users/${editingAccount.id}`, dataToSend);
      } else {
        await api.post('/users', dataToSend);
      }
      setIsOpen(false);
      fetchUserData();
    } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur d'enregistrement : " + msg); }
  };

  const handleDeleteAccount = async (id: string) => {
    if (confirm("Supprimer ce compte utilisateur ?")) {
      try {
        await api.delete(`/users/${id}`);
        fetchUserData();
      } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur de suppression : " + msg); }
    }
  };

  const isAdmin = currentUser && (currentUser.role === 'ADMIN' || currentUser.systemRole === 'Admin IT');

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Paramètres & Sécurité</h1>
        <p style={{ color: 'var(--text-muted)' }}>Gestion des configurations globales, profils et accès système</p>
      </div>

      <div className="module-container" style={{ marginBottom: '2rem', maxWidth: '600px' }}>
        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Mon Profil</h3>
        <form onSubmit={handleProfileSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Adresse e-mail (Récupération)</label>
                <input 
                  type="email" 
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Numéro de téléphone (OTP SMS)</label>
                <input 
                  type="tel" 
                  placeholder="ex: +221 77 000 00 00"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Nouveau mot de passe</label>
              <input 
                type="password" 
                placeholder="Laisser vide pour ne pas modifier"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
              />
              {newPassword && <PasswordStrengthIndicator password={newPassword} />}
            </div>
            {/* MFA Section */}
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
              <h4 style={{ marginBottom: '10px' }}>Authentification à deux facteurs (A2F)</h4>
              
              {mfaMsg && (
                <div style={{ padding: '10px', borderRadius: '6px', marginBottom: '15px', background: mfaMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: mfaMsg.type === 'success' ? '#10b981' : '#ef4444', border: `1px solid ${mfaMsg.type === 'success' ? '#10b981' : '#ef4444'}` }}>
                  {mfaMsg.text}
                </div>
              )}

              {mfaEnabled ? (
                <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '20px', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981', marginBottom: '15px' }}>
                    <i className="ph-fill ph-check-circle" style={{ fontSize: '1.5rem' }}></i>
                    <strong style={{ fontSize: '1.1rem' }}>L'A2F est activée sur votre compte</strong>
                  </div>
                  <p style={{ margin: '0 0 15px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    Votre compte est protégé. Vous devez saisir un code généré par votre application d'authentification lors de chaque connexion.
                  </p>
                  
                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <input
                      type="password"
                      value={mfaDisablePassword}
                      onChange={e => setMfaDisablePassword(e.target.value)}
                      placeholder="Saisissez votre mot de passe"
                      style={{ flex: 1, padding: '11px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!mfaDisablePassword) {
                          setMfaMsg({ type: 'error', text: 'Mot de passe requis.' });
                          return;
                        }
                        setMfaLoading(true);
                        try {
                          await api.post('/auth/mfa/disable', { password: mfaDisablePassword });
                          const session = JSON.parse(localStorage.getItem('currentUser') || '{}');
                          session.mfaEnabled = false;
                          localStorage.setItem('currentUser', JSON.stringify(session));
                          setMfaEnabled(false);
                          setMfaDisablePassword('');
                          setMfaMsg({ type: 'success', text: 'MFA désactivé avec succès.' });
                        } catch (err: any) {
                          setMfaMsg({ type: 'error', text: err.response?.data?.message || 'Erreur.' });
                        } finally {
                          setMfaLoading(false);
                        }
                      }}
                      disabled={mfaLoading}
                      style={{ padding: '10px 24px', borderRadius: '10px', border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Désactiver l'A2F
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {!mfaSetupData && !mfaBackupCodes ? (
                    <button
                      type="button"
                      onClick={async () => {
                        setMfaLoading(true);
                        setMfaMsg(null);
                        try {
                          const res = await api.post('/auth/mfa/setup');
                          setMfaSetupData(res.data);
                        } catch (err: any) {
                          setMfaMsg({ type: 'error', text: err.response?.data?.message || 'Erreur lors de la configuration.' });
                        } finally {
                          setMfaLoading(false);
                        }
                      }}
                      disabled={mfaLoading}
                      className="btn-primary"
                      style={{ padding: '10px 24px', borderRadius: '10px', alignSelf: 'flex-start' }}
                    >
                      Configurer l'A2F
                    </button>
                  ) : mfaSetupData && !mfaBackupCodes ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px' }}>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>1. Scannez ce QR Code avec votre application (Google Authenticator, Authy...)</p>
                      <div style={{ background: 'white', padding: '16px', borderRadius: '12px', alignSelf: 'flex-start' }}>
                        <img src={mfaSetupData.qrCodeDataUrl} alt="QR Code MFA" style={{ display: 'block', width: '200px', height: '200px' }} />
                      </div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Code manuel : <code style={{ background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{mfaSetupData.secret}</code></p>
                      
                      <p style={{ margin: '10px 0 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>2. Entrez le code à 6 chiffres généré par l'application</p>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                          type="text"
                          value={mfaSetupCode}
                          onChange={e => setMfaSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Ex: 123456"
                          style={{ flex: 1, padding: '11px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', letterSpacing: '2px', fontSize: '1.2rem', fontFamily: 'monospace' }}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (mfaSetupCode.length !== 6) {
                              setMfaMsg({ type: 'error', text: 'Veuillez entrer les 6 chiffres.' });
                              return;
                            }
                            setMfaLoading(true);
                            try {
                              const res = await api.post('/auth/mfa/verify-setup', { token: mfaSetupCode });
                              setMfaBackupCodes(res.data.backupCodes);
                              setMfaMsg({ type: 'success', text: 'Authentification à deux facteurs activée avec succès !' });
                              const session = JSON.parse(localStorage.getItem('currentUser') || '{}');
                              session.mfaEnabled = true;
                              localStorage.setItem('currentUser', JSON.stringify(session));
                              setMfaEnabled(true);
                            } catch (err: any) {
                              setMfaMsg({ type: 'error', text: err.response?.data?.message || 'Code invalide.' });
                            } finally {
                              setMfaLoading(false);
                            }
                          }}
                          disabled={mfaLoading}
                          className="btn-primary"
                          style={{ padding: '10px 24px', borderRadius: '10px' }}
                        >
                          Vérifier et Activer
                        </button>
                      </div>
                    </div>
                  ) : mfaBackupCodes ? (
                    <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '20px' }}>
                      <h4 style={{ margin: '0 0 10px', color: '#f59e0b', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="ph-fill ph-warning" /> Codes de secours (IMPORTANT)
                      </h4>
                      <p style={{ margin: '0 0 15px', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                        Conservez ces codes en lieu sûr. Ils vous permettront de vous connecter si vous perdez votre appareil. <strong>Ils ne seront affichés qu'une seule fois.</strong>
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontFamily: 'monospace', fontSize: '1.1rem', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        {mfaBackupCodes.map(code => (
                          <div key={code} style={{ letterSpacing: '1px', color: 'var(--text-primary)' }}>{code}</div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMfaBackupCodes(null);
                          setMfaSetupData(null);
                          setMfaSetupCode('');
                        }}
                        className="btn-primary"
                        style={{ marginTop: '20px', padding: '10px 24px', borderRadius: '10px' }}
                      >
                        J'ai bien noté mes codes
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          <button 
            type="submit" 
            className="btn-primary"
            disabled={!!newPassword && !isPasswordValid(newPassword)}
            style={{ opacity: (newPassword && !isPasswordValid(newPassword)) ? 0.5 : 1 }}
          >
            Mettre à jour mon profil
          </button>
        </form>
      </div>

      {isAdmin && (
        <div className="module-container" style={{ marginBottom: '2rem', maxWidth: '600px' }}>
          <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ph ph-shield-check" style={{ color: 'var(--primary)' }}></i> Agent d'Inventaire Windows
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.2rem', lineHeight: '1.4' }}>
            Installez notre agent d'inventaire léger sur vos ordinateurs Windows pour les enrôler automatiquement. L'agent détecte le processeur, la RAM, les disques durs, l'adresse MAC, l'IP et le système d'exploitation et transmet ces données périodiquement.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
            <a 
              href={`${(import.meta as any).env?.VITE_API_URL || ''}/api/assets/agent/download`}
              download="KPsyITAgent.msi"
              className="btn-primary" 
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <i className="ph ph-download-simple" style={{ fontSize: '1.2rem' }}></i>
              Télécharger l'Agent (.msi)
            </a>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Taille : ~2 Mo | Version 1.0.0
            </span>
          </div>
          <div style={{ marginTop: '1rem', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem' }}>
            <code style={{ color: 'var(--text-primary)' }}>
              msiexec /i KPsyITAgent.msi SERVERURL="{window.location.origin}" TENANTID="{localStorage.getItem('tenant_subdomain') || 'votre-tenant'}" /qn
            </code>
            <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Commande d'installation silencieuse pour déploiement de masse (GPO, SCCM, etc.)
            </p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="module-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>Comptes Système</h3>
            <button className="btn-primary" onClick={() => {
              setEditingAccount(null);
              setAccFields({ username: '', email: '', phone: '', password: '', systemRole: 'Utilisateur Standard', mfaEnabled: false });
              setIsOpen(true);
            }}>
              <i className="ph ph-plus"></i> Nouveau Compte
            </button>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nom d'utilisateur</th>
                  <th>Email</th>
                  <th>Rôle Système</th>
                  <th>MFA Actif</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(acc => (
                  <tr key={acc.id}>
                    <td><strong>{acc.username}</strong></td>
                    <td>{acc.email}</td>
                    <td>{acc.systemRole || acc.role}</td>
                    <td>
                      <span className={`status-badge ${acc.mfaEnabled ? 'success' : 'warning'}`}>
                        {acc.mfaEnabled ? 'Activé' : 'Désactivé'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-icon" onClick={() => {
                          setEditingAccount(acc);
                          setAccFields({ username: acc.username, email: acc.email, phone: (acc as any).phone || '', password: '', systemRole: acc.systemRole || 'Utilisateur Standard', mfaEnabled: acc.mfaEnabled });
                          setIsOpen(true);
                        }}>
                          <i className="ph ph-pencil-simple"></i>
                        </button>
                        {acc.mfaEnabled && (
                          <button 
                            className="btn-icon" 
                            title="Réinitialiser le MFA" 
                            onClick={async () => {
                              if (confirm("Voulez-vous vraiment réinitialiser le MFA de ce collaborateur ? Il pourra se connecter sans code TOTP.")) {
                                try {
                                  await api.post(`/users/${acc.id}/reset-mfa`);
                                  alert("MFA réinitialisé avec succès.");
                                  fetchUserData();
                                } catch (err: any) {
                                  alert("Erreur: " + (err.response?.data?.message || err.message));
                                }
                              }
                            }}
                          >
                            <i className="ph ph-key" style={{ color: 'var(--warning)' }}></i>
                          </button>
                        )}
                        {acc.username !== 'admin' && (
                          <button className="btn-icon" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleDeleteAccount(acc.id)}>
                            <i className="ph ph-trash"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '450px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingAccount ? "Modifier le compte" : "Créer un compte"}</h2>
            <form onSubmit={handleAccountSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Nom d'utilisateur</label>
                  <input 
                    type="text" 
                    value={accFields.username} 
                    onChange={e => setAccFields({...accFields, username: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Email</label>
                  <input 
                    type="email" 
                    value={accFields.email} 
                    onChange={e => setAccFields({...accFields, email: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Numéro de téléphone</label>
                  <input 
                    type="tel" 
                    placeholder="ex: +221 77 000 00 00"
                    value={accFields.phone} 
                    onChange={e => setAccFields({...accFields, phone: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Mot de passe</label>
                  <input 
                    type="password" 
                    placeholder={editingAccount ? "Laisser vide pour ne pas modifier" : "Minimum 10 caractères"}
                    value={accFields.password} 
                    onChange={e => setAccFields({...accFields, password: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required={!editingAccount}
                  />
                  {accFields.password && <PasswordStrengthIndicator password={accFields.password} />}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Rôle d'accès</label>
                  <select 
                    value={accFields.systemRole} 
                    onChange={e => setAccFields({...accFields, systemRole: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="Admin IT">Admin IT (Accès Total)</option>
                    <option value="Technicien IT">Technicien IT (Matériel & Support)</option>
                    <option value="Logistique / Achat">Logistique / Achat (Stock & Approvisionnement)</option>
                    <option value="Finance">Finance (Ventes, Paiements, Contrats)</option>
                    <option value="RH">Ressources Humaines (Gestion Personnel)</option>
                    <option value="Utilisateur Standard">Utilisateur Standard (Tickets uniquement)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => setIsOpen(false)}>Annuler</button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={!!accFields.password && !isPasswordValid(accFields.password)}
                  style={{ opacity: (accFields.password && !isPasswordValid(accFields.password)) ? 0.5 : 1 }}
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


