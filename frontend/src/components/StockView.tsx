import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface Location {
  id: string;
  name: string;
  type: string; // Stock, Bureau
  city: string;
}

interface Consumable {
  id: string;
  ref: string;
  desc: string;
  location: string;
  quantity: number;
  alertThreshold: number;
  type?: string;
  characteristics?: string;
  specifications?: string;
  purchasePrice?: number;
  sellingPrice?: number;
}

export const StockView: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  
  // Modals
  const [isLocOpen, setIsLocOpen] = useState(false);
  const [isConsOpen, setIsConsOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<Consumable | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields - Location
  const [locFields, setLocFields] = useState({
    name: '',
    type: 'Stock',
    city: 'Dakar'
  });

  // Form Fields - Consumable
  const [consFields, setConsFields] = useState({
    ref: '',
    desc: '',
    location: 'Magasin Principal',
    quantity: 10,
    alertThreshold: 5,
    type: 'Consommable',
    characteristics: '',
    specifications: '',
    purchasePrice: 0,
    sellingPrice: 0
  });

  const fetchData = async () => {
    try {
      const [locsRes, consRes] = await Promise.all([
        api.get('/locations'),
        api.get('/consumables')
      ]);
      setLocations(locsRes.data || []);
      setConsumables(consRes.data || []);
    } catch (err) {
      console.warn('API error in StockView.', err);
      setLocations([]);
      setConsumables([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/locations', { ...locFields, performedBy: 'admin' });
      setIsLocOpen(false);
      fetchData();
    } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur lors de la création du site : " + msg); }
  };

  const handleConsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...consFields,
      quantity: Number(consFields.quantity),
      alertThreshold: Number(consFields.alertThreshold),
      purchasePrice: consFields.purchasePrice ? Number(consFields.purchasePrice) : null,
      sellingPrice: consFields.sellingPrice ? Number(consFields.sellingPrice) : null,
      performedBy: 'admin'
    };
    try {
      if (editingId) {
        await api.put(`/consumables/${editingId}`, payload);
      } else {
        await api.post('/consumables', payload);
      }
      setIsConsOpen(false);
      setEditingId(null);
      setConsFields({
        ref: '', desc: '', location: 'Magasin Principal', quantity: 10,
        alertThreshold: 5, type: 'Consommable', characteristics: '',
        specifications: '', purchasePrice: 0, sellingPrice: 0
      });
      fetchData();
    } catch (err: any) {
      console.warn("API update failed, adjusting locally if possible.");
      if (editingId) {
        setConsumables(prev => prev.map(c => c.id === editingId ? { ...c, ...payload, id: editingId } as Consumable : c));
        setIsConsOpen(false);
        setEditingId(null);
      } else {
        const msg = err.response?.data?.message || err.message || "Erreur inconnue";
        alert("Erreur lors de l'enregistrement du consommable : " + msg);
      }
    }
  };

  const handleEdit = (item: Consumable) => {
    setEditingId(item.id);
    setConsFields({
      ref: item.ref,
      desc: item.desc,
      location: item.location,
      quantity: item.quantity,
      alertThreshold: item.alertThreshold,
      type: item.type || 'Consommable',
      characteristics: item.characteristics || '',
      specifications: item.specifications || '',
      purchasePrice: item.purchasePrice || 0,
      sellingPrice: item.sellingPrice || 0
    });
    setIsConsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet élément ?")) return;
    try {
      await api.delete(`/consumables/${id}`);
      fetchData();
    } catch (err) {
      console.warn("API delete failed, adjusting locally.");
      setConsumables(prev => prev.filter(c => c.id !== id));
    }
  };

  const exportExcel = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) return alert("Librairie XLSX non chargée.");
    const data = consumables.map(c => ({
      Type: c.type || 'Consommable',
      Référence: c.ref,
      Description: c.desc,
      'Caractéristiques': c.characteristics || '',
      'Spécifications': c.specifications || '',
      Emplacement: c.location,
      'Prix Achat': c.purchasePrice || 0,
      'Prix Vente': c.sellingPrice || 0,
      Quantité: c.quantity,
      'Seuil Alerte': c.alertThreshold
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock");
    XLSX.writeFile(wb, "Inventaire_Stock.xlsx");
  };

  const exportPDF = () => {
    const { jsPDF } = (window as any).jspdf;
    if (!jsPDF) return alert("Librairie jsPDF non chargée.");
    const doc = new jsPDF('landscape');

    import('../pdfUtils').then(async ({ addBrandingToPdf }) => {
      let startY = await addBrandingToPdf(doc, 15, "État du Stock des Consommables");
      
      const head = [['Type', 'Référence', 'Description', 'Emplacement', 'Achat', 'Vente', 'Qté', 'Seuil']];
      const body = consumables.map(c => [
        c.type || 'Consommable', c.ref, c.desc, c.location,
        c.purchasePrice ? `${c.purchasePrice}` : '-',
        c.sellingPrice ? `${c.sellingPrice}` : '-',
        c.quantity, c.alertThreshold
      ]);
      (doc as any).autoTable({ startY, head, body });
      doc.save("Inventaire_Stock.pdf");
    });
  };

  const adjustQty = async (item: Consumable, amount: number) => {
    const nextQty = Math.max(0, item.quantity + amount);
    try {
      await api.put(`/consumables/${item.id}`, {
        quantity: nextQty,
        performedBy: 'admin'
      });
      fetchData();
    } catch (err) {
      console.warn("API update failed, adjusting locally.");
      setConsumables(prev => prev.map(c => c.id === item.id ? { ...c, quantity: nextQty } : c));
    }
  };

  const toggleLocationType = async (loc: Location) => {
    const nextType = loc.type === 'Stock' ? 'Bureau' : 'Stock';
    try {
      await api.put(`/locations/${loc.id}`, {
        type: nextType,
        performedBy: 'admin'
      });
      fetchData();
    } catch (err) {
      console.warn("API location update failed, adjusting locally.");
      setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, type: nextType } : l));
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Stock & Emplacements</h1>
          <p style={{ color: 'var(--text-muted)' }}>Gestion multi-sites et seuils d'alerte consommables</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-icon" onClick={() => setIsLocOpen(true)}>
            <i className="ph ph-plus"></i> Nouvel Emplacement
          </button>
          <button className="btn-primary" onClick={() => setIsConsOpen(true)}>
            <i className="ph ph-plus"></i> Nouveau Produit / Article
          </button>
        </div>
      </div>

      <div className="module-container" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem' }}>Emplacements (Magasins / Sites)</h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom du site</th>
                <th>Type (Cliquez pour basculer)</th>
                <th>Ville</th>
              </tr>
            </thead>
            <tbody>
              {locations.map(loc => (
                <tr key={loc.id}>
                  <td><strong>{loc.name}</strong></td>
                  <td>
                    <span 
                      className={`status-badge ${loc.type === 'Stock' ? 'warning' : 'success'}`}
                      onClick={() => toggleLocationType(loc)}
                      style={{ cursor: 'pointer' }}
                      title="Bascule rapide Stock / Bureau"
                    >
                      {loc.type}
                    </span>
                  </td>
                  <td>{loc.city}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="module-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Articles, Produits & Consommables en Stock</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-icon" onClick={exportExcel} title="Exporter en Excel">
              <i className="ph ph-file-xls" style={{ color: '#10b981', marginRight: '5px' }}></i> Excel
            </button>
            <button className="btn-icon" onClick={exportPDF} title="Exporter en PDF">
              <i className="ph ph-file-pdf" style={{ color: '#ef4444', marginRight: '5px' }}></i> PDF
            </button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Référence</th>
                <th>Description</th>
                <th>Caractéristiques & Specs</th>
                <th>Emplacement</th>
                <th>Prix (Achat / Vente)</th>
                <th>Quantité en Stock</th>
                <th>Seuil d'Alerte</th>
                <th>Ajustement</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {consumables.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun article enregistré</td>
                </tr>
              ) : (
                consumables.map(c => {
                  const isAlert = c.quantity <= c.alertThreshold;
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className="status-badge" style={{
                          backgroundColor: c.type === 'Produit' ? 'rgba(59, 130, 246, 0.15)' :
                                           c.type === 'Article' ? 'rgba(139, 92, 246, 0.15)' :
                                           c.type === 'Service' ? 'rgba(236, 72, 153, 0.15)' :
                                           c.type === 'Consommable' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                          color: c.type === 'Produit' ? '#60a5fa' :
                                 c.type === 'Article' ? '#a78bfa' :
                                 c.type === 'Service' ? '#f472b6' :
                                 c.type === 'Consommable' ? '#fbbf24' : '#9ca3af',
                          border: '1px solid currentColor'
                        }}>
                          {c.type || 'Consommable'}
                        </span>
                      </td>
                      <td><strong>{c.ref}</strong></td>
                      <td>{c.desc}</td>
                      <td>
                        <div style={{ fontSize: '0.8rem', lineHeight: '1.2' }}>
                          {c.characteristics && <div><span style={{ color: 'var(--text-muted)' }}>Caract:</span> {c.characteristics}</div>}
                          {c.specifications && <div><span style={{ color: 'var(--text-muted)' }}>Specs:</span> {c.specifications}</div>}
                          {!c.characteristics && !c.specifications && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune</span>}
                        </div>
                      </td>
                      <td>{c.location}</td>
                      <td>
                        <div style={{ fontSize: '0.8rem', lineHeight: '1.2' }}>
                          <div><span style={{ color: 'var(--text-muted)' }}>Achat:</span> {c.purchasePrice ? `${c.purchasePrice.toLocaleString()} FCFA` : '-'}</div>
                          <div><span style={{ color: 'var(--text-muted)' }}>Vente:</span> {c.sellingPrice ? `${c.sellingPrice.toLocaleString()} FCFA` : '-'}</div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: isAlert ? 'var(--danger)' : 'var(--text-primary)' }}>
                          {c.quantity}
                        </span>
                      </td>
                      <td>{c.alertThreshold}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button className="btn-icon" style={{ padding: '2px 8px' }} onClick={() => adjustQty(c, 1)}>+</button>
                          <button className="btn-icon" style={{ padding: '2px 8px', borderColor: 'var(--warning)', color: 'var(--warning)' }} onClick={() => adjustQty(c, -1)}>-</button>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${isAlert ? 'danger' : 'success'}`}>
                          {isAlert ? 'Alerte Rouge' : 'Stock OK'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button className="btn-icon" style={{ padding: '4px' }} title="Aperçu" onClick={() => setPreviewItem(c)}>
                            <i className="ph ph-eye"></i>
                          </button>
                          <button className="btn-icon" style={{ padding: '4px' }} title="Modifier" onClick={() => handleEdit(c)}>
                            <i className="ph ph-pencil"></i>
                          </button>
                          <button className="btn-icon" style={{ padding: '4px', color: 'var(--danger)' }} title="Supprimer" onClick={() => handleDelete(c.id)}>
                            <i className="ph ph-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isLocOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '400px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Nouvel Emplacement</h2>
            <form onSubmit={handleLocSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Nom du site / magasin</label>
                  <input 
                    type="text" 
                    value={locFields.name} 
                    onChange={e => setLocFields({...locFields, name: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Type d'emplacement</label>
                  <select 
                    value={locFields.type} 
                    onChange={e => setLocFields({...locFields, type: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="Stock">Stock / Magasin</option>
                    <option value="Bureau">Bureau / Site affecté</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Ville</label>
                  <input 
                    type="text" 
                    value={locFields.city} 
                    onChange={e => setLocFields({...locFields, city: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => setIsLocOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isConsOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '500px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingId ? "Modifier l'élément" : "Nouveau Produit / Article / Service"}</h2>
            <form onSubmit={handleConsSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Type d'élément</label>
                    <select
                      value={consFields.type}
                      onChange={e => setConsFields({...consFields, type: e.target.value})}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    >
                      <option value="Produit">Produit</option>
                      <option value="Article">Article</option>
                      <option value="Consommable">Consommable</option>
                      <option value="Service">Service</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Référence / Code</label>
                    <input 
                      type="text" 
                      value={consFields.ref} 
                      onChange={e => setConsFields({...consFields, ref: e.target.value})}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      placeholder="Ex: TONER-HP-85A"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Désignation / Description</label>
                  <input 
                    type="text" 
                    value={consFields.desc} 
                    onChange={e => setConsFields({...consFields, desc: e.target.value})}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    placeholder="Ex: Toner HP LaserJet 85A noir"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Caractéristiques (Marque, modèle, etc.)</label>
                  <input 
                    type="text" 
                    value={consFields.characteristics || ''} 
                    onChange={e => setConsFields({...consFields, characteristics: e.target.value})}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    placeholder="Ex: HP, Noir, Laser"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Spécifications (Processeur, RAM, ports...)</label>
                  <textarea 
                    value={consFields.specifications || ''} 
                    onChange={e => setConsFields({...consFields, specifications: e.target.value})}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px', minHeight: '60px', fontFamily: 'inherit' }}
                    placeholder="Ex: Capacité 1600 pages, format A4"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Prix d'achat (FCFA)</label>
                    <input 
                      type="number" 
                      value={consFields.purchasePrice} 
                      onChange={e => setConsFields({...consFields, purchasePrice: Number(e.target.value)})}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      min={0}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Prix de vente (FCFA)</label>
                    <input 
                      type="number" 
                      value={consFields.sellingPrice} 
                      onChange={e => setConsFields({...consFields, sellingPrice: Number(e.target.value)})}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      min={0}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Emplacement</label>
                  <input 
                    type="text" 
                    value={consFields.location} 
                    onChange={e => setConsFields({...consFields, location: e.target.value})}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Quantité initiale</label>
                    <input 
                      type="number" 
                      value={consFields.quantity} 
                      onChange={e => setConsFields({...consFields, quantity: Number(e.target.value)})}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      min={0}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Seuil d'alerte</label>
                    <input 
                      type="number" 
                      value={consFields.alertThreshold} 
                      onChange={e => setConsFields({...consFields, alertThreshold: Number(e.target.value)})}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      min={0}
                      required
                    />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => { setIsConsOpen(false); setEditingId(null); }}>Annuler</button>
                <button type="submit" className="btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {previewItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '500px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Aperçu de l'élément
              <button className="btn-icon" onClick={() => setPreviewItem(null)} style={{ padding: '4px' }}><i className="ph ph-x"></i></button>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div><strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Type:</strong><br/>{previewItem.type || 'Consommable'}</div>
              <div><strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Référence:</strong><br/>{previewItem.ref}</div>
              <div style={{ gridColumn: 'span 2' }}><strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Description:</strong><br/>{previewItem.desc}</div>
              <div style={{ gridColumn: 'span 2' }}><strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Emplacement:</strong><br/>{previewItem.location}</div>
              <div><strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Quantité:</strong><br/>{previewItem.quantity}</div>
              <div><strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Seuil d'alerte:</strong><br/>{previewItem.alertThreshold}</div>
              <div><strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Prix d'achat:</strong><br/>{previewItem.purchasePrice ? `${previewItem.purchasePrice} FCFA` : '-'}</div>
              <div><strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Prix de vente:</strong><br/>{previewItem.sellingPrice ? `${previewItem.sellingPrice} FCFA` : '-'}</div>
              <div style={{ gridColumn: 'span 2' }}><strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Caractéristiques:</strong><br/>{previewItem.characteristics || '-'}</div>
              <div style={{ gridColumn: 'span 2' }}><strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Spécifications:</strong><br/>{previewItem.specifications || '-'}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn-primary" onClick={() => setPreviewItem(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


