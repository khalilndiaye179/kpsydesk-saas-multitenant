import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface TenantInvoice {
  id: string;
  invoiceNo: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientNinea?: string;
  clientRc?: string;
  amountHT: number;
  tvaRate: number;
  tvaAmount: number;
  amountTTC: number;
  status: string; // DRAFT, ISSUED, PAID, CANCELLED
  notes?: string;
  createdAt: string;
  items: InvoiceItem[];
}

export const TenantInvoiceView: React.FC = () => {
  const [invoices, setInvoices] = useState<TenantInvoice[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientNinea, setClientNinea] = useState('');
  const [clientRc, setClientRc] = useState('');
  const [tvaRate, setTvaRate] = useState(18);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }
  ]);

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/tenant-invoices');
      setInvoices(res.data || []);
    } catch (err) {
      console.error("Failed to fetch tenant invoices:", err);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleAddItemRow = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === 'description') {
      item.description = value;
    } else if (field === 'quantity') {
      item.quantity = Math.max(1, Number(value));
    } else if (field === 'unitPrice') {
      item.unitPrice = Math.max(0, Number(value));
    }

    item.totalPrice = item.quantity * item.unitPrice;
    updated[index] = item;
    setItems(updated);
  };

  // Calculs en temps réel pour l'UI du formulaire
  const totalHT = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalTVA = totalHT * (tvaRate / 100);
  const totalTTC = totalHT + totalTVA;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some(item => !item.description.trim() || item.unitPrice <= 0)) {
      alert("Veuillez renseigner toutes les désignations et des prix valides supérieurs à 0.");
      return;
    }

    setLoading(true);
    try {
      await api.post('/tenant-invoices', {
        clientName,
        clientEmail: clientEmail.trim() ? clientEmail : undefined,
        clientPhone: clientPhone.trim() ? clientPhone : undefined,
        clientNinea: clientNinea.trim() ? clientNinea : undefined,
        clientRc: clientRc.trim() ? clientRc : undefined,
        tvaRate,
        notes: notes.trim() ? notes : undefined,
        items: items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      });

      // Reset form
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setClientNinea('');
      setClientRc('');
      setTvaRate(18);
      setNotes('');
      setItems([{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
      
      setIsOpen(false);
      fetchInvoices();
    } catch (err: any) {
      alert("Erreur de création : " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (id: string, invoiceNo: string) => {
    try {
      const response = await api.get(`/tenant-invoices/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Facture_${invoiceNo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Impossible de télécharger le fichier PDF.");
    }
  };

  const handleChangeStatus = async (id: string, newStatus: string) => {
    try {
      await api.put(`/tenant-invoices/${id}/status`, { status: newStatus });
      fetchInvoices();
    } catch (err: any) {
      alert("Erreur lors du changement de statut : " + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette facture brouillon ?")) return;
    try {
      await api.delete(`/tenant-invoices/${id}`);
      fetchInvoices();
    } catch (err: any) {
      alert("Erreur de suppression : " + (err.response?.data?.message || err.message));
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PAID':
        return { bg: '#d1fae5', text: '#065f46', label: 'Payée' };
      case 'ISSUED':
        return { bg: '#dbeafe', text: '#1e40af', label: 'Émise' };
      case 'CANCELLED':
        return { bg: '#fee2e2', text: '#991b1b', label: 'Annulée' };
      default:
        return { bg: '#f3f4f6', text: '#374151', label: 'Brouillon' };
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Factures Client DGI</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Générez des factures de vente conformes avec calcul de TVA et numérotation séquentielle</p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          style={{
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 12px -1px rgba(37, 99, 235, 0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(37, 99, 235, 0.2)';
          }}
        >
          + Nouvelle Facture DGI
        </button>
      </div>

      {/* Liste des factures */}
      <div style={{
        background: 'var(--bg-secondary, #fff)',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.1))',
        border: '1px solid var(--border-color, #e5e7eb)'
      }}>
        {invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '1.1rem', margin: 0 }}>Aucune facture DGI enregistrée pour le moment.</p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Cliquez sur le bouton ci-dessus pour générer votre première facture conforme.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color, #e5e7eb)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Numéro</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Client</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Date d'émission</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Montant HT</th>
                  <th style={{ padding: '0.75rem 1rem' }}>TVA ({18}%)</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Total TTC</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Statut</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const style = getStatusStyle(inv.status);
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)', color: 'var(--text-primary)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{inv.invoiceNo}</td>
                      <td style={{ padding: '1rem' }}>
                        <div>{inv.clientName}</div>
                        {inv.clientEmail && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{inv.clientEmail}</div>}
                      </td>
                      <td style={{ padding: '1rem' }}>{new Date(inv.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '1rem' }}>{inv.amountHT.toLocaleString('fr-FR')} FCFA</td>
                      <td style={{ padding: '1rem' }}>{inv.tvaAmount.toLocaleString('fr-FR')} FCFA</td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{inv.amountTTC.toLocaleString('fr-FR')} FCFA</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          backgroundColor: style.bg,
                          color: style.text,
                          padding: '0.25rem 0.6rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>{style.label}</span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            onClick={() => handleDownloadPDF(inv.id, inv.invoiceNo)}
                            style={{
                              padding: '0.4rem 0.8rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color, #e5e7eb)',
                              background: 'var(--bg-primary, #f9fafb)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                              cursor: 'pointer'
                            }}
                          >
                            Télécharger PDF
                          </button>

                          <select
                            value={inv.status}
                            onChange={(e) => handleChangeStatus(inv.id, e.target.value)}
                            style={{
                              padding: '0.4rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color, #e5e7eb)',
                              fontSize: '0.85rem',
                              background: '#fff',
                              color: '#374151'
                            }}
                          >
                            <option value="DRAFT">Brouillon</option>
                            <option value="ISSUED">Émise</option>
                            <option value="PAID">Payée</option>
                            <option value="CANCELLED">Annulée</option>
                          </select>

                          {inv.status === 'DRAFT' && (
                            <button
                              onClick={() => handleDelete(inv.id)}
                              style={{
                                padding: '0.4rem 0.8rem',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#fee2e2',
                                color: '#991b1b',
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                              }}
                            >
                              Supprimer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal - Création Facture */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          overflowY: 'auto',
          padding: '2rem 1rem'
        }}>
          <div style={{
            background: 'var(--bg-secondary, #fff)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '850px',
            padding: '2rem',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Créer une facture conforme DGI</h3>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Informations Client */}
              <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>1. Coordonnées de l'Acheteur</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nom complet / Raison Sociale *</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Adresse e-mail client</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Numéro de téléphone</label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>NINEA Client</label>
                    <input
                      type="text"
                      placeholder="ex: 00984392"
                      value={clientNinea}
                      onChange={(e) => setClientNinea(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>R.C. Client</label>
                    <input
                      type="text"
                      placeholder="ex: SN-DKR-..."
                      value={clientRc}
                      onChange={(e) => setClientRc(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Lignes d'articles */}
              <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>2. Détails des articles</h4>
              <div style={{ marginBottom: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Désignation / Description *</th>
                      <th style={{ width: '100px', textAlign: 'center', paddingBottom: '0.5rem' }}>Quantité</th>
                      <th style={{ width: '150px', textAlign: 'right', paddingBottom: '0.5rem' }}>P.U. HT (FCFA) *</th>
                      <th style={{ width: '150px', textAlign: 'right', paddingBottom: '0.5rem' }}>Total HT</th>
                      <th style={{ width: '50px', paddingBottom: '0.5rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index}>
                        <td style={{ padding: '0.5rem 0' }}>
                          <input
                            type="text"
                            required
                            placeholder="Désignation du service ou matériel"
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            style={{ width: '95%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            style={{ width: '80px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'center' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice || ''}
                            placeholder="0"
                            onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                            style={{ width: '130px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.totalPrice.toLocaleString('fr-FR')} FCFA
                        </td>
                        <td style={{ padding: '0.5rem 0', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(index)}
                            disabled={items.length === 1}
                            style={{
                              border: 'none',
                              background: 'none',
                              fontSize: '1.2rem',
                              cursor: items.length === 1 ? 'not-allowed' : 'pointer',
                              color: items.length === 1 ? '#d1d5db' : '#ef4444'
                            }}
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  style={{
                    background: 'none',
                    border: '1px dashed #2563eb',
                    color: '#2563eb',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  + Ajouter un article
                </button>
              </div>

              {/* Paramètres Additionnels & Totaux */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Taux de TVA (%) *</label>
                    <select
                      value={tvaRate}
                      onChange={(e) => setTvaRate(Number(e.target.value))}
                      style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', width: '120px' }}
                    >
                      <option value="18">18% (Sénégal DGI)</option>
                      <option value="0">0% (Exonéré / Export)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Notes et conditions de paiement</label>
                    <textarea
                      placeholder="Indiquez ici vos coordonnées bancaires ou délais de paiement"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical' }}
                    />
                  </div>
                </div>

                <div style={{
                  background: 'var(--bg-primary, #f9fafb)',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                    <span>Total HT :</span>
                    <span style={{ fontWeight: 600 }}>{totalHT.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                    <span>TVA ({tvaRate}%) :</span>
                    <span style={{ fontWeight: 600 }}>{totalTVA.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    borderTop: '2px solid var(--border-color)',
                    paddingTop: '0.75rem',
                    color: '#2563eb'
                  }}>
                    <span>Total TTC :</span>
                    <span>{totalTTC.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                </div>
              </div>

              {/* Soumission */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-primary)'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Création...' : 'Générer Facture DGI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
