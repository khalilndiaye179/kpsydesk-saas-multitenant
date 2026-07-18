import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface Attachment {
  name: string;
  size: number;
  type: string;
  date: string;
}

interface Sale {
  id: string;
  assetCode: string;
  buyerName: string;
  amount: number;
  date: string;
  status: string; // En attente, Payé, Annulé
  attachments?: Attachment[];
}

export const SaleView: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [reformAssets, setReformAssets] = useState<any[]>([]);

  // Modals
  const [isOpen, setIsOpen] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  
  const [targetSale, setTargetSale] = useState<Sale | null>(null);

  // Form Fields
  const [formFields, setFormFields] = useState({
    assetCode: '',
    buyerName: '',
    date: '',
    amount: 50000,
    status: 'Payé'
  });

  const [attachFile, setAttachFile] = useState<any>(null);

  const fetchData = async () => {
    try {
      const [salesRes, assetsRes] = await Promise.all([
        api.get('/sales'),
        api.get('/assets')
      ]);
      setSales(salesRes.data || []);
      
      const allAssets = assetsRes.data || [];
      setReformAssets(allAssets.filter((a: any) => a.status === 'RETIRED' || a.status === 'OBSOLETE'));
    } catch (err) {
      console.warn('API error in SaleView.', err);
      setSales([]);
      setReformAssets([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSend = {
      ...formFields,
      amount: Number(formFields.amount),
      performedBy: 'admin'
    };

    try {
      await api.post('/sales', dataToSend);
      setIsOpen(false);
      fetchData();
    } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur lors de l'enregistrement de la cession : " + msg); }
  };

  const handleAttachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSale || !attachFile) return;

    const newAttachment: Attachment = {
      name: `Docs_Preuves/${attachFile.name}`,
      size: attachFile.size,
      type: attachFile.type,
      date: new Date().toISOString().split('T')[0]
    };

    const currentAttachments = targetSale.attachments || [];
    const nextAttachments = [...currentAttachments, newAttachment];

    try {
      await api.put(`/sales/${targetSale.id}`, {
        attachments: nextAttachments,
        performedBy: 'admin'
      });
      setIsAttachOpen(false);
      fetchData();
      alert("Pièce jointe enregistrée avec succès !");
    } catch (err) {
      console.warn("API upload fail, updating locally.");
      setSales(prev => prev.map(s => s.id === targetSale.id ? { ...s, attachments: nextAttachments } : s));
      setIsAttachOpen(false);
      alert("Pièce jointe associée localement");
    }
  };

  const handleInvoicePDF = (s: Sale) => {
    const jspdf = (window as any).jspdf;
    if (!jspdf) return;

    const doc = new jspdf.jsPDF();

    import('../pdfUtils').then(async ({ addBrandingToPdf }) => {
      let startY = await addBrandingToPdf(doc, 20, `Facture de Cession ${s.assetCode}`);

      doc.setFontSize(11);
      doc.text(`Client / Acheteur : ${s.buyerName}`, 14, startY + 10);
      doc.text(`Date de Vente : ${new Date(s.date).toLocaleDateString().replace(/\//g, ' ')}`, 14, startY + 17);

      const formattedAmount = s.amount.toLocaleString('fr-FR').replace(/[\u202f\u00a0\s]/g, ' ');

      (doc as any).autoTable({
        head: [["Code Actif", "Description", "Prix de Vente"]],
        body: [
          [s.assetCode, 'Matériel réformé', `${formattedAmount} FCFA`]
        ],
        startY: startY + 30,
        theme: 'grid'
      });

      const finalY = (doc as any).lastAutoTable.finalY || startY + 60;
      doc.text(`Total Réglé : ${formattedAmount} FCFA`, 14, finalY + 10);

      doc.save(`Facture_Cession_${s.assetCode}.pdf`);
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Supprimer cette fiche de cession ?")) {
      try {
        await api.delete(`/sales/${id}?performedBy=admin`);
        fetchData();
      } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur de suppression : " + msg); }
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Ventes & Cessions</h1>
          <p style={{ color: 'var(--text-muted)' }}>Gestion de la vente du matériel réformé ou obsolète</p>
        </div>
        <button className="btn-primary" onClick={() => {
          setFormFields({
            assetCode: reformAssets[0]?.inventoryCode || '',
            buyerName: '',
            date: new Date().toISOString().split('T')[0],
            amount: 50000,
            status: 'Payé'
          });
          setIsOpen(true);
        }}>
          <i className="ph ph-plus"></i> Nouvelle Vente
        </button>
      </div>

      <div className="module-container">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Matériel concerné</th>
                <th>Acheteur (Bénéficiaire)</th>
                <th>Date de cession</th>
                <th>Montant de cession</th>
                <th>Statut</th>
                <th>Justificatifs</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune vente enregistrée</td>
                </tr>
              ) : (
                sales.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.assetCode}</strong></td>
                    <td>{s.buyerName}</td>
                    <td>{new Date(s.date).toLocaleDateString()}</td>
                    <td>{s.amount.toLocaleString('fr-FR')} FCFA</td>
                    <td>
                      <span className={`status-badge ${s.status === 'Payé' ? 'success' : 'warning'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {s.attachments && s.attachments.map((a, idx) => (
                          <span key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <i className="ph ph-file-image"></i> {a.name.split('/').pop()}
                          </span>
                        ))}
                        <button className="btn-text" style={{ padding: 0, border: 'none', background: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => {
                          setTargetSale(s);
                          setAttachFile(null);
                          setIsAttachOpen(true);
                        }}>
                          <i className="ph ph-paperclip"></i> Joindre
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-icon" onClick={() => handleInvoicePDF(s)} title="Télécharger Facture PDF">
                          <i className="ph ph-download-simple"></i> Facture
                        </button>
                        <button className="btn-icon" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleDelete(s.id)}>
                          <i className="ph ph-trash"></i>
                        </button>
                      </div>
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
          <div className="module-container" style={{ width: '450px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Nouvelle Vente</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Matériel Réformé</label>
                  <select 
                    value={formFields.assetCode} 
                    onChange={e => setFormFields({...formFields, assetCode: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  >
                    <option value="">Sélectionner...</option>
                    {reformAssets.map(a => (
                      <option key={a.id} value={a.inventoryCode}>{`${a.inventoryCode} - ${a.name}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Acheteur (Nom / Société)</label>
                  <input 
                    type="text" 
                    value={formFields.buyerName} 
                    onChange={e => setFormFields({...formFields, buyerName: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Date</label>
                    <input 
                      type="date" 
                      value={formFields.date} 
                      onChange={e => setFormFields({...formFields, date: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Montant (FCFA)</label>
                    <input 
                      type="number" 
                      value={formFields.amount} 
                      onChange={e => setFormFields({...formFields, amount: Number(e.target.value)})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      min={0}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Statut de paiement</label>
                  <select 
                    value={formFields.status} 
                    onChange={e => setFormFields({...formFields, status: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="Payé">Payé (Définitif)</option>
                    <option value="En attente">En attente de paiement</option>
                    <option value="Annulé">Annulé</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => setIsOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Enregistrer cession</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAttachOpen && targetSale && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '400px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Joindre un document</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Le document sera associé à la vente de <strong>{targetSale.assetCode}</strong>.
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
                <button type="submit" className="btn-primary">Attacher</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


