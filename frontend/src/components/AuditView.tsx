import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldData: any;
  newData: any;
  performedBy: string;
  createdAt: string;
}

export const AuditView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [targetLog, setTargetLog] = useState<AuditLog | null>(null);

  const session = localStorage.getItem('currentUser');
  const currentUser = session ? JSON.parse(session) : null;
  const isAdmin = currentUser && (currentUser.role === 'ADMIN' || currentUser.systemRole === 'Admin IT');

  const fetchLogs = async () => {
    try {
      const res = await api.get('/audit-logs');
      setLogs(res.data || []);
    } catch (err) {
      console.warn('API error in AuditView.', err);
      setLogs([]);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Journal d'Audit (Traçabilité)</h1>
          <p style={{ color: 'var(--text-muted)' }}>Historique complet des modifications et suppressions du système</p>
        </div>
      </div>

      <div className="module-container">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Heure</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Module / Entité</th>
                <th>Identifiant Cible</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun log d'audit enregistré</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td><strong>{log.performedBy}</strong></td>
                    <td>
                      <span className={`status-badge ${log.action === 'CREATION' ? 'success' : log.action === 'MODIFICATION' ? 'warning' : 'danger'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>{log.entityType}</td>
                    <td><code>{log.entityId}</code></td>
                    <td>
                      <button className="btn-icon" onClick={() => setTargetLog(log)}>
                        <i className="ph ph-eye"></i> Comparer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {targetLog && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '800px', maxWidth: '95%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Détails des modifications - {targetLog.entityType} #{targetLog.entityId}</h2>
              <button className="btn-icon" onClick={() => setTargetLog(null)}>&times;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '10px', color: 'var(--danger)' }}>Anciennes valeurs (Avant)</h3>
                <pre style={{ padding: '15px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'auto', maxHeight: '300px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                  {targetLog.oldData ? JSON.stringify(targetLog.oldData, null, 2) : "Aucune donnée (Création)"}
                </pre>
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '10px', color: 'var(--success)' }}>Nouvelles valeurs (Après)</h3>
                <pre style={{ padding: '15px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'auto', maxHeight: '300px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                  {targetLog.newData ? JSON.stringify(targetLog.newData, null, 2) : "Aucune donnée (Suppression)"}
                </pre>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={() => setTargetLog(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


