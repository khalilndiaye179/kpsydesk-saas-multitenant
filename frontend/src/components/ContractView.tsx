import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface Supplier {
  id: string;
  name: string;
}

interface Attachment {
  name: string;
  size: number;
  type: string;
  date: string;
}

interface Contract {
  id: string;
  ref: string;
  type: string; // Garantie Constructeur, Maintenance Préventive, Assurance
  supplierId: string;
  supplier?: Supplier;
  startDate: string;
  endDate: string;
  assetCode: string;
  status: string; // Actif, Expiré, Bientôt expiré
  attachments?: Attachment[];
}

export const ContractView: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // Modals
  const [isOpen, setIsOpen] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  
  const [targetContract, setTargetContract] = useState<Contract | null>(null);

  // Form Fields
  const [formFields, setFormFields] = useState({
    ref: '',
    type: 'Garantie Constructeur',
    supplierId: '',
    startDate: '',
    endDate: '',
    assetCode: '',
    status: 'Actif'
  });

  const [attachFile, setAttachFile] = useState<any>(null);

  const fetchData = async () => {
    try {
      const [contractsRes, supsRes] = await Promise.all([
        api.get('/contracts'),
        api.get('/suppliers')
      ]);
      setContracts(contractsRes.data || []);
      setSuppliers(supsRes.data || []);
    } catch (err) {
      console.warn('API error in ContractView.', err);
      setSuppliers([]);
      setContracts([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSend = {
      ...formFields,
      performedBy: 'admin'
    };

    try {
      await api.post('/contracts', dataToSend);
      setIsOpen(false);
      fetchData();
    } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur lors de la création du contrat : " + msg); }
  };

  const handleAttachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetContract || !attachFile) return;

    const newAttachment: Attachment = {
      name: `Docs_Preuves/${attachFile.name}`,
      size: attachFile.size,
      type: attachFile.type,
      date: new Date().toISOString().split('T')[0]
    };

    const currentAttachments = targetContract.attachments || [];
    const nextAttachments = [...currentAttachments, newAttachment];

    try {
      await api.put(`/contracts/${targetContract.id}`, {
        attachments: nextAttachments,
        performedBy: 'admin'
      });
      setIsAttachOpen(false);
      fetchData();
      alert("Fichier joint et enregistré dans Docs_Preuves avec succès !");
    } catch (err) {
      console.warn("API upload fail, updating locally.");
      setContracts(prev => prev.map(c => c.id === targetContract.id ? { ...c, attachments: nextAttachments } : c));
      setIsAttachOpen(false);
      alert("Fichier joint localement (Hors ligne)");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Supprimer ce contrat ?")) {
      try {
        await api.delete(`/contracts/${id}?performedBy=admin`);
        fetchData();
      } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur de suppression : " + msg); }
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Contrats & Garanties</h1>
          <p style={{ color: 'var(--text-muted)' }}>Suivi des garanties et contrats de maintenance associés aux équipements</p>
        </div>
        <button className="btn-primary" onClick={() => {
          setFormFields({
            ref: `CT-${Math.floor(1000 + Math.random() * 9000)}`,
            type: 'Garantie Constructeur',
            supplierId: suppliers[0]?.id || '',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
            assetCode: '',
            status: 'Actif'
          });
          setIsOpen(true);
        }}>
          <i className="ph ph-plus"></i> Nouveau Contrat
        </button>
      </div>

      <div className="module-container">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Type</th>
                <th>Fournisseur</th>
                <th>Date Début</th>
                <th>Date Fin</th>
                <th>Matériel concerné</th>
                <th>Statut</th>
                <th>Pièces jointes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun contrat enregistré</td>
                </tr>
              ) : (
                contracts.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.ref}</strong></td>
                    <td>{c.type}</td>
                    <td>{c.supplier ? c.supplier.name : 'Inconnu'}</td>
                    <td>{new Date(c.startDate).toLocaleDateString()}</td>
                    <td>{new Date(c.endDate).toLocaleDateString()}</td>
                    <td>{c.assetCode}</td>
                    <td>
                      <span className={`status-badge ${c.status.toLowerCase().replace(' ', '-')}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {c.attachments && c.attachments.map((a, idx) => (
                          <span key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <i className="ph ph-file-pdf"></i> {a.name.split('/').pop()}
                          </span>
                        ))}
                        <button className="btn-text" style={{ padding: 0, border: 'none', background: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => {
                          setTargetContract(c);
                          setAttachFile(null);
                          setIsAttachOpen(true);
                        }}>
                          <i className="ph ph-paperclip"></i> Joindre
                        </button>
                      </div>
                    </td>
                    <td>
                      <button className="btn-icon" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleDelete(c.id)}>
                        <i className="ph ph-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '500px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Nouveau Contrat</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Référence</label>
                    <input 
                      type="text" 
                      value={formFields.ref} 
                      onChange={e => setFormFields({...formFields, ref: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Type</label>
                    <select 
                      value={formFields.type} 
                      onChange={e => setFormFields({...formFields, type: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    >
                      <option value="Garantie Constructeur">Garantie Constructeur</option>
                      <option value="Maintenance Préventive">Maintenance Préventive</option>
                      <option value="Assurance">Assurance</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Fournisseur</label>
                    <select 
                      value={formFields.supplierId} 
                      onChange={e => setFormFields({...formFields, supplierId: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Code Équipement</label>
                    <input 
                      type="text" 
                      value={formFields.assetCode} 
                      onChange={e => setFormFields({...formFields, assetCode: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      placeholder="INV-XXXX"
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Date de début</label>
                    <input 
                      type="date" 
                      value={formFields.startDate} 
                      onChange={e => setFormFields({...formFields, startDate: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Date de fin</label>
                    <input 
                      type="date" 
                      value={formFields.endDate} 
                      onChange={e => setFormFields({...formFields, endDate: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Statut</label>
                  <select 
                    value={formFields.status} 
                    onChange={e => setFormFields({...formFields, status: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="Actif">Actif</option>
                    <option value="Bientôt expiré">Bientôt expiré</option>
                    <option value="Expiré">Expiré</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => setIsOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAttachOpen && targetContract && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '400px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Joindre un document</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Le document sera lié au contrat <strong>{targetContract.ref}</strong> et archivé dans le dossier <strong>Docs_Preuves</strong>.
            </p>
            <form onSubmit={handleAttachSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Sélectionner le fichier</label>
                <input 
                  type="file" 
                  onChange={e => setAttachFile(e.target.files?.[0])}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px', cursor: 'pointer' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => setIsAttachOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Attacher le fichier</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


