import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface Movement {
  id: string;
  date: string;
  action: string; // Assignation, Retour
  inventoryCode: string;
  assetName: string;
  userName: string;
  performedBy: string;
}

export const MovementView: React.FC = () => {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const fetchMovements = async () => {
    try {
      const res = await api.get('/movements');
      setMovements(res.data || []);
    } catch (err) {
      console.warn('API error in MovementView, using fallback.', err);
      setMovements([
        { id: '1', date: '2026-06-19 15:30:00', action: 'Assignation', inventoryCode: 'INV-2025-001', assetName: 'Dell Latitude 5520', userName: 'Jean Dupont', performedBy: 'admin' },
        { id: '2', date: '2026-06-18 10:15:00', action: 'Retour', inventoryCode: 'INV-2023-045', assetName: 'Cisco Router 2911', userName: 'Alice Martin', performedBy: 'admin' }
      ]);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, []);

  const handleExportXLSX = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) return;

    const data = filtered.map(m => ({
      "Date & Heure": new Date(m.date).toLocaleString(),
      "Action": m.action,
      "Code Inventaire": m.inventoryCode,
      "Nom du Matériel": m.assetName,
      "Utilisateur": m.userName,
      "Effectué par": m.performedBy
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mouvements");
    XLSX.writeFile(wb, "Historique_Mouvements_IT.xlsx");
  };

  const filtered = movements.filter(m => {
    const term = search.toLowerCase();
    const matchesSearch = m.inventoryCode.toLowerCase().includes(term) || 
                          m.assetName.toLowerCase().includes(term) || 
                          m.userName.toLowerCase().includes(term);
    const matchesAction = filterAction === '' || m.action === filterAction;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Historique des Mouvements</h1>
          <p style={{ color: 'var(--text-muted)' }}>Traçabilité des assignations et retours du matériel</p>
        </div>
        <button className="btn-icon" onClick={handleExportXLSX} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <i className="ph ph-export"></i> Exporter Excel
        </button>
      </div>

      <div className="module-container">
        <div style={{ display: 'flex', gap: '15px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.25rem 0.75rem', width: '300px' }}>
            <i className="ph ph-magnifying-glass" style={{ color: 'var(--text-muted)' }}></i>
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%' }}
            />
          </div>
          <select 
            value={filterAction} 
            onChange={(e) => setFilterAction(e.target.value)}
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.5rem', color: 'white' }}
          >
            <option value="">Toutes les actions</option>
            <option value="Assignation">Assignation</option>
            <option value="Retour">Retour</option>
          </select>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Heure</th>
                <th>Action</th>
                <th>Code Inventaire</th>
                <th>Équipement</th>
                <th>Utilisateur</th>
                <th>Effectué par</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun mouvement enregistré</td>
                </tr>
              ) : (
                filtered.map(m => (
                  <tr key={m.id}>
                    <td>{new Date(m.date).toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${m.action.toLowerCase() === 'assignation' ? 'success' : 'warning'}`}>
                        {m.action}
                      </span>
                    </td>
                    <td><strong>{m.inventoryCode}</strong></td>
                    <td>{m.assetName}</td>
                    <td>{m.userName}</td>
                    <td>{m.performedBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


