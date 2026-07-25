import React, { useState } from 'react';

interface DgiInvoice {
  id: string;
  invoiceNo: string;
  clientName: string;
  clientNinea: string;
  amountHT: number;
  tvaAmount: number;
  amountTTC: number;
  status: 'NORMALIZED' | 'DRAFT' | 'CANCELLED';
  normalizedCode?: string; // DGI NIM code
  createdAt: string;
}

export const DgiInvoicesView: React.FC = () => {
  const [invoices, setInvoices] = useState<DgiInvoice[]>([
    {
      id: '1',
      invoiceNo: 'FAC-2026-0001',
      clientName: 'SENELEC SA',
      clientNinea: '0012345 2G3',
      amountHT: 1500000,
      tvaAmount: 270000,
      amountTTC: 1770000,
      status: 'NORMALIZED',
      normalizedCode: 'NIM-0192837465-20260725',
      createdAt: '2026-07-20T10:00:00Z'
    },
    {
      id: '2',
      invoiceNo: 'FAC-2026-0002',
      clientName: 'SONATEL Orange',
      clientNinea: '0056789 2F2',
      amountHT: 3200000,
      tvaAmount: 576000,
      amountTTC: 3776000,
      status: 'NORMALIZED',
      normalizedCode: 'NIM-0987654321-20260724',
      createdAt: '2026-07-24T14:30:00Z'
    },
    {
      id: '3',
      invoiceNo: 'FAC-2026-0003',
      clientName: 'CSE Entreprise',
      clientNinea: '0098765 1A3',
      amountHT: 850000,
      tvaAmount: 153000,
      amountTTC: 1003000,
      status: 'DRAFT',
      createdAt: '2026-07-25T11:15:00Z'
    }
  ]);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const [form, setForm] = useState({
    clientName: '',
    clientNinea: '',
    amountHT: ''
  });

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName || !form.amountHT) {
      alert('Veuillez remplir les champs obligatoires.');
      return;
    }

    const ht = Number(form.amountHT);
    const tva = ht * 0.18; // Standard 18% Senegal TVA
    const ttc = ht + tva;

    const newInvoice: DgiInvoice = {
      id: String(invoices.length + 1),
      invoiceNo: `FAC-2026-000${invoices.length + 1}`,
      clientName: form.clientName,
      clientNinea: form.clientNinea || 'N/A',
      amountHT: ht,
      tvaAmount: tva,
      amountTTC: ttc,
      status: 'DRAFT',
      createdAt: new Date().toISOString()
    };

    setInvoices([newInvoice, ...invoices]);
    setIsOpen(false);
    setForm({ clientName: '', clientNinea: '', amountHT: '' });
  };

  const handleNormalize = (id: string) => {
    setInvoices(invoices.map(inv => {
      if (inv.id === id) {
        return {
          ...inv,
          status: 'NORMALIZED',
          normalizedCode: `NIM-${Math.floor(1000000000 + Math.random() * 9000000000)}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
        };
      }
      return inv;
    }));
  };

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(val);
  };

  const totalHT = invoices.filter(i => i.status === 'NORMALIZED').reduce((sum, i) => sum + i.amountHT, 0);
  const totalTVA = invoices.filter(i => i.status === 'NORMALIZED').reduce((sum, i) => sum + i.tvaAmount, 0);
  const totalTTC = invoices.filter(i => i.status === 'NORMALIZED').reduce((sum, i) => sum + i.amountTTC, 0);

  const filteredInvoices = invoices.filter(i => 
    i.clientName.toLowerCase().includes(search.toLowerCase()) || 
    i.invoiceNo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="fade-in">
      
      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Facturé ce mois (HT)</span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '8px 0 0 0', color: 'var(--text-primary)' }}>{formatPrice(totalHT)}</h2>
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TVA Collectée (18%)</span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '8px 0 0 0', color: '#6366f1' }}>{formatPrice(totalTVA)}</h2>
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total TTC</span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '8px 0 0 0', color: '#22c55e' }}>{formatPrice(totalTTC)}</h2>
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Factures Normalisées DGI</span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '8px 0 0 0', color: '#eab308' }}>
            {invoices.filter(i => i.status === 'NORMALIZED').length} / {invoices.length}
          </h2>
        </div>
      </div>

      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.25rem 0.75rem', width: '300px' }}>
          <i className="ph ph-magnifying-glass" style={{ color: 'var(--text-muted)' }}></i>
          <input 
            type="text" 
            placeholder="Rechercher client ou N° facture..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%', padding: '6px' }}
          />
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="btn-primary"
          style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #15803d)', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <i className="ph ph-plus" /> Créer une Facture
        </button>
      </div>

      {/* Main Table */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>📄 Registre des Factures Client Normalisées DGI</strong>
          <span style={{ fontSize: '0.75rem', color: '#22c55e', background: 'rgba(34,197,94,0.15)', padding: '2px 10px', borderRadius: '50px', fontWeight: 700 }}>
            ⚡ Connexion DGI Active
          </span>
        </div>
        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 20px' }}>N° Facture</th>
                <th>Client / NINEA</th>
                <th>Montant HT</th>
                <th>TVA (18%)</th>
                <th>Montant TTC</th>
                <th>Code NIM DGI</th>
                <th>État</th>
                <th style={{ textAlign: 'right', padding: '12px 20px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Aucune facture enregistrée.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                    <td style={{ padding: '12px 20px', fontWeight: 700 }}>{inv.invoiceNo}</td>
                    <td>
                      <strong style={{ fontSize: '0.9rem' }}>{inv.clientName}</strong>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>NINEA : {inv.clientNinea}</span>
                    </td>
                    <td>{formatPrice(inv.amountHT)}</td>
                    <td>{formatPrice(inv.tvaAmount)}</td>
                    <td style={{ fontWeight: 700 }}>{formatPrice(inv.amountTTC)}</td>
                    <td style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: inv.normalizedCode ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {inv.normalizedCode || 'Non normalisée'}
                    </td>
                    <td>
                      {inv.status === 'NORMALIZED' ? (
                        <span style={{ background: '#22c55e20', color: '#22c55e', padding: '4px 10px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 700 }}>Normalisée</span>
                      ) : (
                        <span style={{ background: '#eab30820', color: '#eab308', padding: '4px 10px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 700 }}>Brouillon</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {inv.status === 'DRAFT' && (
                          <button
                            onClick={() => handleNormalize(inv.id)}
                            style={{ background: '#eab308', color: 'black', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}
                          >
                            ⚡ Normaliser
                          </button>
                        )}
                        <button
                          onClick={() => alert(`Impression PDF de la facture ${inv.invoiceNo} avec Code QR DGI...`)}
                          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}
                        >
                          🖨️ Imprimer
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

      {/* MODAL : NOUVELLE FACTURE */}
      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', width: '450px', maxWidth: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>📄 Créer une Facture Client</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>La facture sera créée à l'état Brouillon et pourra être normalisée auprès de la DGI en un clic.</p>
            
            <form onSubmit={handleCreateInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Nom du client *</label>
                <input
                  type="text"
                  placeholder="Ex: SENELEC"
                  value={form.clientName}
                  onChange={e => setForm({ ...form, clientName: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'white', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>NINEA du client</label>
                <input
                  type="text"
                  placeholder="Ex: 0012345 2G3"
                  value={form.clientNinea}
                  onChange={e => setForm({ ...form, clientNinea: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'white', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Montant HT (FCFA) *</label>
                <input
                  type="number"
                  placeholder="Ex: 1000000"
                  value={form.amountHT}
                  onChange={e => setForm({ ...form, amountHT: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'white', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #15803d)', color: 'white', cursor: 'pointer', fontWeight: 700 }}
                >
                  ✓ Créer Brouillon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
