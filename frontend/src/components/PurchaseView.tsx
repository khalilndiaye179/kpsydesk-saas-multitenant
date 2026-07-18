import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
}

interface PurchaseOrder {
  id: string;
  orderNo: string;
  supplierId: string;
  supplier?: Supplier;
  date: string;
  amount: number;
  status: string; // En cours, Livrée, Annulée
}

export const PurchaseView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  // Modals
  const [isSupOpen, setIsSupOpen] = useState(false);
  const [isOrdOpen, setIsOrdOpen] = useState(false);

  // Form Fields - Supplier
  const [supFields, setSupFields] = useState({
    name: '',
    contact: '',
    email: '',
    phone: ''
  });

  // Form Fields - Order
  const [ordFields, setOrdFields] = useState({
    orderNo: '',
    supplierId: '',
    date: '',
    amount: 100000,
    status: 'En cours'
  });

  const fetchData = async () => {
    try {
      const [supsRes, ordsRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/orders')
      ]);
      setSuppliers(supsRes.data || []);
      setOrders(ordsRes.data || []);
    } catch (err) {
      console.warn('API error in PurchaseView.', err);
      setSuppliers([]);
      setOrders([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/suppliers', { ...supFields, performedBy: 'admin' });
      setIsSupOpen(false);
      fetchData();
    } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur lors de l'enregistrement du fournisseur : " + msg); }
  };

  const handleOrdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const createdRes = await api.post('/orders', {
        ...ordFields,
        amount: Number(ordFields.amount),
        performedBy: 'admin'
      });

      // Automatiquement générer et télécharger le Bon de Commande PDF
      const selectedSup = suppliers.find(s => s.id === ordFields.supplierId);
      downloadOrderPDF(ordFields.orderNo, selectedSup?.name || 'Fournisseur', ordFields.date, ordFields.amount);

      setIsOrdOpen(false);
      fetchData();
    } catch (err) {
      // Si API en échec, simuler le PDF et ajouter localement
      console.warn("API order creation failed, calculating locally.");
      const selectedSup = suppliers.find(s => s.id === ordFields.supplierId);
      downloadOrderPDF(ordFields.orderNo, selectedSup?.name || 'Fournisseur', ordFields.date, ordFields.amount);
      
      const newOrd: PurchaseOrder = {
        id: Date.now().toString(),
        orderNo: ordFields.orderNo,
        supplierId: ordFields.supplierId,
        supplier: selectedSup,
        date: ordFields.date,
        amount: Number(ordFields.amount),
        status: ordFields.status
      };
      setOrders(prev => [newOrd, ...prev]);
      setIsOrdOpen(false);
    }
  };

  const downloadOrderPDF = (orderNo: string, supplierName: string, date: string, amount: number) => {
    const jspdf = (window as any).jspdf;
    if (!jspdf) return;

    const doc = new jspdf.jsPDF();

    import('../pdfUtils').then(async ({ addBrandingToPdf }) => {
      let startY = await addBrandingToPdf(doc, 20, `Bon de Commande ${orderNo}`);

      doc.setFontSize(11);
      doc.text(`Fournisseur : ${supplierName}`, 14, startY + 10);
      doc.text(`Date : ${new Date(date).toLocaleDateString().replace(/\//g, ' ')}`, 14, startY + 17);

      const formattedAmount = amount.toLocaleString('fr-FR').replace(/[\u202f\u00a0\s]/g, ' ');

      (doc as any).autoTable({
        head: [["Description", "Quantité", "Prix Unitaire", "Total"]],
        body: [
          ["Matériels et équipements informatiques divers", "1", `${formattedAmount} FCFA`, `${formattedAmount} FCFA`]
        ],
        startY: startY + 30,
        theme: 'grid'
      });

      const finalY = (doc as any).lastAutoTable.finalY || startY + 60;
      doc.text(`Total TTC : ${amount.toLocaleString()} FCFA`, 14, finalY + 10);

      doc.save(`Bon_Commande_${orderNo}.pdf`);
    });
  };

  const toggleOrderStatus = async (item: PurchaseOrder) => {
    const nextStatus = item.status === 'En cours' ? 'Livrée' : 'En cours';
    try {
      await api.put(`/orders/${item.id}`, {
        status: nextStatus,
        performedBy: 'admin'
      });
      fetchData();
    } catch (err) {
      console.warn("Failed to toggle status via API. Updating locally.");
      setOrders(prev => prev.map(o => o.id === item.id ? { ...o, status: nextStatus } : o));
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Achats & Fournisseurs</h1>
          <p style={{ color: 'var(--text-muted)' }}>Suivi logistique des bons de commande et contacts fournisseurs</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-icon" onClick={() => setIsSupOpen(true)}>
            <i className="ph ph-plus"></i> Nouveau Fournisseur
          </button>
          <button className="btn-primary" onClick={() => {
            setOrdFields({
              orderNo: `CMD-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
              supplierId: suppliers[0]?.id || '',
              date: new Date().toISOString().split('T')[0],
              amount: 1500000,
              status: 'En cours'
            });
            setIsOrdOpen(true);
          }}>
            <i className="ph ph-plus"></i> Nouvelle Commande
          </button>
        </div>
      </div>

      <div className="module-container" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem' }}>Fournisseurs</h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Téléphone</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun fournisseur enregistré</td>
                </tr>
              ) : (
                suppliers.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.contact}</td>
                    <td>{s.email}</td>
                    <td>{s.phone}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="module-container">
        <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem' }}>Bons de Commande</h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>N° Commande</th>
                <th>Fournisseur</th>
                <th>Date</th>
                <th>Montant</th>
                <th>Statut (Cliquez pour livrer)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune commande enregistrée</td>
                </tr>
              ) : (
                orders.map(o => (
                  <tr key={o.id}>
                    <td><strong>{o.orderNo}</strong></td>
                    <td>{o.supplier ? o.supplier.name : 'Fournisseur Inconnu'}</td>
                    <td>{new Date(o.date).toLocaleDateString()}</td>
                    <td>{o.amount.toLocaleString('fr-FR')} FCFA</td>
                    <td>
                      <span 
                        className={`status-badge ${o.status === 'Livrée' ? 'success' : o.status === 'En cours' ? 'warning' : 'danger'}`}
                        onClick={() => toggleOrderStatus(o)}
                        style={{ cursor: 'pointer' }}
                        title="Bascule rapide Livrée / En cours"
                      >
                        {o.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-icon" onClick={() => downloadOrderPDF(o.orderNo, o.supplier?.name || 'Fournisseur', o.date, o.amount)}>
                        <i className="ph ph-download-simple"></i> PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isSupOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '400px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Nouveau Fournisseur</h2>
            <form onSubmit={handleSupSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Nom</label>
                  <input 
                    type="text" 
                    value={supFields.name} 
                    onChange={e => setSupFields({...supFields, name: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Contact principal</label>
                  <input 
                    type="text" 
                    value={supFields.contact} 
                    onChange={e => setSupFields({...supFields, contact: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Email</label>
                  <input 
                    type="email" 
                    value={supFields.email} 
                    onChange={e => setSupFields({...supFields, email: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Téléphone</label>
                  <input 
                    type="text" 
                    value={supFields.phone} 
                    onChange={e => setSupFields({...supFields, phone: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => setIsSupOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isOrdOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '450px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Nouvelle Commande</h2>
            <form onSubmit={handleOrdSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>N° de Commande</label>
                  <input 
                    type="text" 
                    value={ordFields.orderNo} 
                    onChange={e => setOrdFields({...ordFields, orderNo: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Fournisseur</label>
                  <select 
                    value={ordFields.supplierId} 
                    onChange={e => setOrdFields({...ordFields, supplierId: e.target.value})} 
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
                  <label style={{ display: 'block', marginBottom: '5px' }}>Date</label>
                  <input 
                    type="date" 
                    value={ordFields.date} 
                    onChange={e => setOrdFields({...ordFields, date: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Montant Total (FCFA)</label>
                  <input 
                    type="number" 
                    value={ordFields.amount} 
                    onChange={e => setOrdFields({...ordFields, amount: Number(e.target.value)})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    min={0}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Statut</label>
                  <select 
                    value={ordFields.status} 
                    onChange={e => setOrdFields({...ordFields, status: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="En cours">En cours</option>
                    <option value="Livrée">Livrée</option>
                    <option value="Annulée">Annulée</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => setIsOrdOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Enregistrer & Télécharger PDF</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


