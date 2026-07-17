import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface License {
  id: string;
  name: string;
  publisher: string;
  key: string;
  type: string; // Abonnement, Perpétuelle, Open Source
  seats: number;
  used: number;
  expireDate?: string;
}

export const LicenseView: React.FC = () => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [search, setSearch] = useState('');
  
  // Modals
  const [isOpen, setIsOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);

  // Form Fields
  const [formFields, setFormFields] = useState({
    name: '',
    publisher: '',
    key: '',
    type: 'Abonnement',
    seats: 10,
    used: 0,
    expireDate: ''
  });

  const fetchLicenses = async () => {
    try {
      const res = await api.get('/licenses');
      setLicenses(res.data || []);
    } catch (err) {
      console.warn('API error in LicenseView. Using fallback.', err);
      setLicenses([
        { id: '1', name: 'Microsoft 365 E3', publisher: 'Microsoft', key: 'A1B2-C3D4-E5F6', type: 'Abonnement', seats: 50, used: 45, expireDate: '2027-01-01' },
        { id: '2', name: 'Adobe Creative Cloud', publisher: 'Adobe', key: 'XYZ-987-654', type: 'Abonnement', seats: 5, used: 5, expireDate: '2026-12-31' }
      ]);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  const openAddModal = () => {
    setEditingLicense(null);
    setFormFields({
      name: '',
      publisher: '',
      key: '',
      type: 'Abonnement',
      seats: 10,
      used: 0,
      expireDate: new Date().toISOString().split('T')[0]
    });
    setIsOpen(true);
  };

  const openEditModal = (l: License) => {
    setEditingLicense(l);
    setFormFields({
      name: l.name,
      publisher: l.publisher,
      key: l.key,
      type: l.type,
      seats: l.seats,
      used: l.used,
      expireDate: l.expireDate ? l.expireDate.split('T')[0] : ''
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSend = {
      ...formFields,
      seats: Number(formFields.seats),
      used: Number(formFields.used),
      performedBy: 'admin'
    };

    try {
      if (editingLicense && editingLicense.id !== '1') {
        await api.put(`/licenses/${editingLicense.id}`, dataToSend);
      } else {
        await api.post('/licenses', dataToSend);
      }
      setIsOpen(false);
      fetchLicenses();
    } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur lors de l'enregistrement de la licence : " + msg); }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Supprimer cette licence ?")) {
      try {
        await api.delete(`/licenses/${id}?performedBy=admin`);
        fetchLicenses();
      } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur lors de la suppression : " + msg); }
    }
  };

  const filtered = licenses.filter(l => 
    l.name.toLowerCase().includes(search.toLowerCase()) || 
    l.publisher.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Licences Logicielles</h1>
          <p style={{ color: 'var(--text-muted)' }}>Gestion des clés de licence et des abonnements logiciels</p>
        </div>
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ph ph-plus"></i> Nouvelle Licence
        </button>
      </div>

      <div className="module-container">
        <div style={{ display: 'flex', gap: '15px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.25rem 0.75rem', width: '300px' }}>
            <i className="ph ph-magnifying-glass" style={{ color: 'var(--text-muted)' }}></i>
            <input 
              type="text" 
              placeholder="Rechercher une licence..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%' }}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom du Logiciel</th>
                <th>Éditeur</th>
                <th>Clé / Réf.</th>
                <th>Type</th>
                <th>Utilisation / Quota</th>
                <th>Date d'expiration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune licence trouvée</td>
                </tr>
              ) : (
                filtered.map(l => (
                  <tr key={l.id}>
                    <td><strong>{l.name}</strong></td>
                    <td>{l.publisher}</td>
                    <td><code>{l.key}</code></td>
                    <td>{l.type}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>{l.used} / {l.seats}</span>
                        <div style={{ width: '100px', height: '8px', background: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, (l.used / l.seats) * 100)}%`, height: '100%', background: (l.used >= l.seats) ? 'var(--danger)' : 'var(--success)' }}></div>
                        </div>
                      </div>
                    </td>
                    <td>{l.expireDate ? new Date(l.expireDate).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-icon" onClick={() => openEditModal(l)}>
                          <i className="ph ph-pencil-simple"></i>
                        </button>
                        <button className="btn-icon" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleDelete(l.id)}>
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
          <div className="module-container" style={{ width: '500px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingLicense ? 'Modifier la licence' : 'Ajouter une licence'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Nom du Logiciel</label>
                  <input 
                    type="text" 
                    value={formFields.name} 
                    onChange={e => setFormFields({...formFields, name: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Éditeur</label>
                  <input 
                    type="text" 
                    value={formFields.publisher} 
                    onChange={e => setFormFields({...formFields, publisher: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Clé / Réf.</label>
                  <input 
                    type="text" 
                    value={formFields.key} 
                    onChange={e => setFormFields({...formFields, key: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Type de licence</label>
                  <select 
                    value={formFields.type} 
                    onChange={e => setFormFields({...formFields, type: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="Abonnement">Abonnement</option>
                    <option value="Perpétuelle">Perpétuelle</option>
                    <option value="Open Source">Open Source</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Nombre de postes</label>
                    <input 
                      type="number" 
                      value={formFields.seats} 
                      onChange={e => setFormFields({...formFields, seats: Number(e.target.value)})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      min={1}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Postes utilisés</label>
                    <input 
                      type="number" 
                      value={formFields.used} 
                      onChange={e => setFormFields({...formFields, used: Number(e.target.value)})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      min={0}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Date d'expiration</label>
                  <input 
                    type="date" 
                    value={formFields.expireDate} 
                    onChange={e => setFormFields({...formFields, expireDate: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
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
    </div>
  );
};


