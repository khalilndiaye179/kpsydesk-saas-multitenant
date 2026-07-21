import React, { useState, useEffect } from 'react';
import { api } from '../api';

export const TenantSettingsView: React.FC = () => {
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    companyTaxId: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [editingMethod, setEditingMethod] = useState<any>(null);
  const [savingPaymentMethod, setSavingPaymentMethod] = useState(false);

  useEffect(() => {
    fetchTenantDetails();
  }, []);

  const fetchTenantDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tenants/me');
      if (res.data && res.data.tenant) {
        setTenant(res.data.tenant);
        setFormData({
          companyAddress: res.data.tenant.companyAddress || '',
          companyPhone: res.data.tenant.companyPhone || '',
          companyEmail: res.data.tenant.companyEmail || '',
          companyTaxId: res.data.tenant.companyTaxId || '',
        });
        if (res.data.tenant.logoUrl) {
          // Si le backend est sur un autre port en dev, on utilise VITE_API_URL,
          // sinon le chemin absolu /uploads/... passera par le proxy ou la même URL
          const baseUrl = (import.meta as any).env?.VITE_API_URL || '';
          setLogoPreview(`${baseUrl}${res.data.tenant.logoUrl}`);
        }
      }
      
      // Fetch payment methods
      const pmRes = await api.get('/tenant-payment/methods');
      setPaymentMethods(pmRes.data || []);
    } catch (err) {
      console.error("Erreur lors de la récupération des détails du tenant:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePaymentMethod = async (method: any, newStatus: string) => {
    try {
      await api.put(`/tenant-payment/methods/${method.id}/status`, { status: newStatus });
      fetchTenantDetails();
    } catch (err: any) {
      alert("Erreur lors du changement de statut: " + (err.response?.data?.message || err.message));
    }
  };

  const handleSavePaymentMethodConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMethod) return;
    setSavingPaymentMethod(true);
    try {
      await api.put(`/tenant-payment/methods/${editingMethod.id}/config`, {
        configOverrides: editingMethod.configOverrides
      });
      setEditingMethod(null);
      fetchTenantDetails();
    } catch (err: any) {
      alert("Erreur lors de la sauvegarde de la configuration: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingPaymentMethod(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        alert("La taille du logo ne doit pas dépasser 2 Mo.");
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const data = new FormData();
      if (logoFile) {
        data.append('logo', logoFile);
      }
      data.append('companyAddress', formData.companyAddress);
      data.append('companyPhone', formData.companyPhone);
      data.append('companyEmail', formData.companyEmail);
      data.append('companyTaxId', formData.companyTaxId);

      const res = await api.patch('/tenants/me/branding', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      alert("Paramètres d'entreprise mis à jour avec succès ! Les documents exportés utiliseront désormais ces informations.");
      
      if (res.data && res.data.logoUrl) {
        const baseUrl = (import.meta as any).env?.VITE_API_URL || '';
        setLogoPreview(`${baseUrl}${res.data.logoUrl}`);
        setLogoFile(null); // On reset le fichier après upload
      }
      
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Erreur inconnue";
      alert("Erreur lors de la mise à jour : " + msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Chargement des paramètres...</div>;
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Personnalisation & Entreprise</h1>
        <p style={{ color: 'var(--text-muted)' }}>Configurez le logo et les coordonnées de votre entreprise qui apparaîtront sur vos exports (PDF, Excel).</p>
      </div>

      <div className="module-container" style={{ maxWidth: '800px' }}>
        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          Identité Visuelle & Coordonnées
        </h3>

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', marginBottom: '2rem' }}>
            
            {/* Section Logo */}
            <div>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 600 }}>Logo de l'entreprise</label>
              <div style={{ 
                border: '2px dashed var(--border-color)', 
                borderRadius: '8px', 
                padding: '1rem', 
                textAlign: 'center',
                background: 'var(--bg-primary)',
                marginBottom: '10px'
              }}>
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo Preview" style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain' }} />
                ) : (
                  <div style={{ padding: '2rem 0', color: 'var(--text-muted)' }}>
                    <i className="ph ph-image" style={{ fontSize: '2rem', marginBottom: '10px' }}></i>
                    <div>Aucun logo</div>
                  </div>
                )}
              </div>
              <input 
                type="file" 
                accept="image/png, image/jpeg, image/svg+xml" 
                id="logo-upload"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="logo-upload" className="btn-secondary" style={{ display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                Choisir une image (Max 2 Mo)
              </label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>Formats : PNG, JPG, SVG</p>
            </div>

            {/* Section Coordonnées */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Nom de l'entreprise</label>
                <input 
                  type="text" 
                  value={tenant?.name || ''} 
                  disabled
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '6px', opacity: 0.7 }}
                />
                <small style={{ color: 'var(--text-muted)' }}>Le nom est défini par votre abonnement.</small>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Adresse complète</label>
                <textarea 
                  value={formData.companyAddress}
                  onChange={e => setFormData({...formData, companyAddress: e.target.value})}
                  rows={2}
                  placeholder="Ex: 123 Avenue des Champs-Élysées, 75008 Paris"
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Téléphone</label>
                  <input 
                    type="text" 
                    value={formData.companyPhone}
                    onChange={e => setFormData({...formData, companyPhone: e.target.value})}
                    placeholder="Ex: +33 1 23 45 67 89"
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Email de contact</label>
                  <input 
                    type="email" 
                    value={formData.companyEmail}
                    onChange={e => setFormData({...formData, companyEmail: e.target.value})}
                    placeholder="Ex: contact@entreprise.com"
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Identifiant Fiscal / NINEA / RC</label>
                <input 
                  type="text" 
                  value={formData.companyTaxId}
                  onChange={e => setFormData({...formData, companyTaxId: e.target.value})}
                  placeholder="Ex: NINEA 123456789"
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                />
              </div>
            </div>

          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </div>

      {/* PAYMENT METHODS SECTION */}
      <div className="module-container" style={{ maxWidth: '800px', marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          Moyens de Paiement
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Activez ou désactivez les moyens de paiement proposés par la plateforme, et configurez vos propres paramètres (ex: frais à la charge du client) si autorisé.
        </p>

        {paymentMethods.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>Aucun moyen de paiement configuré sur la plateforme.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {paymentMethods.map((pm: any) => (
              <div key={pm.id} style={{ padding: '15px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0' }}>{pm.providerCode}</h4>
                    <span className={`status-badge ${pm.status === 'ACTIVE' ? 'success' : 'warning'}`}>
                      {pm.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      className="btn-outline" 
                      onClick={() => setEditingMethod(pm)}
                    >
                      Configurer
                    </button>
                    {pm.status === 'ACTIVE' ? (
                      <button 
                        className="btn-primary" 
                        style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                        onClick={() => handleTogglePaymentMethod(pm, 'INACTIVE')}
                      >
                        Désactiver
                      </button>
                    ) : (
                      <button 
                        className="btn-primary" 
                        onClick={() => handleTogglePaymentMethod(pm, 'ACTIVE')}
                      >
                        Activer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingMethod && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="module-container" style={{ width: '400px' }}>
            <h3 style={{ marginBottom: '15px' }}>Configuration: {editingMethod.providerCode}</h3>
            <form onSubmit={handleSavePaymentMethodConfig}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="checkbox" 
                    checked={editingMethod.configOverrides?.customerPaysFee || false}
                    onChange={(e) => setEditingMethod({
                      ...editingMethod, 
                      configOverrides: { ...editingMethod.configOverrides, customerPaysFee: e.target.checked }
                    })}
                  />
                  Le client paie les frais de transaction
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-outline" onClick={() => setEditingMethod(null)} disabled={savingPaymentMethod}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={savingPaymentMethod}>
                  {savingPaymentMethod ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
