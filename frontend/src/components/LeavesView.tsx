import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
}

interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: string; // PENDING, APPROVED, REJECTED
  rejectionReason?: string;
  createdAt: string;
  user: User;
  validator?: User;
}

export const LeavesView: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'my-leaves' | 'pending-validation'>('my-leaves');
  
  // Modals/Forms
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isRejectionOpen, setIsRejectionOpen] = useState(false);
  const [rejectionTargetId, setRejectionTargetId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  const [formFields, setFormFields] = useState({
    type: 'PAID',
    startDate: '',
    endDate: '',
    reason: ''
  });

  const isAdmin = currentUser?.role === 'ADMIN';

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await api.get('/leaves');
      setLeaves(res.data || []);
    } catch (err) {
      console.warn('API error in LeavesView. Using fallback.', err);
      // Fallback for demo/dev local mode without database sync
      setLeaves([
        {
          id: '1',
          type: 'PAID',
          startDate: '2026-08-01T00:00:00Z',
          endDate: '2026-08-15T00:00:00Z',
          reason: 'Congés annuels d\'été',
          status: 'APPROVED',
          createdAt: new Date().toISOString(),
          user: { id: currentUser?.id || '1', email: currentUser?.email || 'user@company.com', firstName: currentUser?.firstName || 'Fatou', lastName: currentUser?.lastName || 'Diop' },
          validator: { id: 'admin-id', email: 'admin@company.com', firstName: 'Khalil', lastName: 'NDIAYE' }
        },
        {
          id: '2',
          type: 'SICK',
          startDate: '2026-07-28T00:00:00Z',
          endDate: '2026-07-30T00:00:00Z',
          reason: 'Consultation médicale',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          user: { id: '2', email: 'collaborateur@company.com', firstName: 'Ibrahima', lastName: 'Diallo' }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFields.startDate || !formFields.endDate) {
      alert('Veuillez renseigner les dates de début et de fin.');
      return;
    }

    try {
      await api.post('/leaves', formFields);
      setIsSubmitOpen(false);
      setFormFields({ type: 'PAID', startDate: '', endDate: '', reason: '' });
      fetchLeaves();
    } catch (err: any) {
      alert(`Erreur lors de la soumission de la demande: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'APPROVED' | 'REJECTED', reasonText?: string) => {
    try {
      await api.patch(`/leaves/${id}/status`, { status, rejectionReason: reasonText });
      fetchLeaves();
      setIsRejectionOpen(false);
      setRejectionReason('');
      setRejectionTargetId(null);
    } catch (err: any) {
      alert(`Erreur lors du traitement de la demande: ${err.response?.data?.message || err.message}`);
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case 'PAID': return '🌴 Payé';
      case 'SICK': return '🤒 Maladie';
      case 'UNPAID': return '💸 Sans Solde';
      case 'MATERNITY': return '👶 Maternité';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span style={{ background: '#22c55e20', color: '#22c55e', padding: '4px 10px', borderRadius: '50px', fontSize: '0.78rem', fontWeight: 700 }}>✓ Validé</span>;
      case 'REJECTED':
        return <span style={{ background: '#ef444420', color: '#ef4444', padding: '4px 10px', borderRadius: '50px', fontSize: '0.78rem', fontWeight: 700 }}>✗ Refusé</span>;
      default:
        return <span style={{ background: '#eab30820', color: '#eab308', padding: '4px 10px', borderRadius: '50px', fontSize: '0.78rem', fontWeight: 700 }}>⏳ En attente</span>;
    }
  };

  const listToDisplay = activeSubTab === 'my-leaves' 
    ? leaves.filter(l => l.user.id === currentUser?.id)
    : leaves.filter(l => l.status === 'PENDING');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="fade-in">
      
      {/* Header & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveSubTab('my-leaves')}
            className={`btn-primary ${activeSubTab === 'my-leaves' ? '' : 'btn-outline'}`}
            style={{ padding: '8px 16px', borderRadius: '8px', border: activeSubTab === 'my-leaves' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer' }}
          >
            🌴 Mes Demandes
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveSubTab('pending-validation')}
              className={`btn-primary ${activeSubTab === 'pending-validation' ? '' : 'btn-outline'}`}
              style={{ padding: '8px 16px', borderRadius: '8px', border: activeSubTab === 'pending-validation' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              ⚖️ À Valider ({leaves.filter(l => l.status === 'PENDING').length})
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchLeaves} className="btn-outline" style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)' }} title="Rafraîchir">
            <i className="ph ph-arrows-counter-clockwise" />
          </button>
          <button
            onClick={() => setIsSubmitOpen(true)}
            className="btn-primary"
            style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <i className="ph ph-plus" /> Nouvelle Demande
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
            {activeSubTab === 'my-leaves' ? 'Historique personnel des congés' : 'Demandes en attente de validation réglementaire'}
          </strong>
        </div>
        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 20px' }}>Collaborateur</th>
                <th>Type</th>
                <th>Date Début</th>
                <th>Date Fin</th>
                <th>Motif</th>
                <th>Statut</th>
                <th>Décision / Validateur</th>
                {activeSubTab === 'pending-validation' && <th style={{ textAlign: 'right', padding: '12px 20px' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <i className="ph ph-circle-notch spin-animation" style={{ fontSize: '1.5rem', marginBottom: '8px' }} /><br />
                    Chargement en cours...
                  </td>
                </tr>
              ) : listToDisplay.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Aucune demande de congé enregistrée dans cette section.
                  </td>
                </tr>
              ) : (
                listToDisplay.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                    <td style={{ padding: '12px 20px', fontWeight: 600 }}>
                      {l.user.firstName} {l.user.lastName}
                      {l.user.position && <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>{l.user.position}</span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{getLeaveTypeLabel(l.type)}</td>
                    <td>{new Date(l.startDate).toLocaleDateString('fr-FR')}</td>
                    <td>{new Date(l.endDate).toLocaleDateString('fr-FR')}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.reason}>
                      {l.reason || '-'}
                    </td>
                    <td>{getStatusBadge(l.status)}</td>
                    <td>
                      {l.status === 'PENDING' ? (
                        <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>En attente de traitement</span>
                      ) : (
                        <div>
                          <strong style={{ fontSize: '0.85rem' }}>
                            {l.validator ? `${l.validator.firstName} ${l.validator.lastName}` : 'Système'}
                          </strong>
                          {l.rejectionReason && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#ef4444' }}>
                              Motif : {l.rejectionReason}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    {activeSubTab === 'pending-validation' && (
                      <td style={{ textAlign: 'right', padding: '12px 20px' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleUpdateStatus(l.id, 'APPROVED')}
                            style={{ background: '#22c55e', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
                          >
                            ✓ Valider
                          </button>
                          <button
                            onClick={() => { setRejectionTargetId(l.id); setIsRejectionOpen(true); }}
                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
                          >
                            ✗ Refuser
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL : SOUVELLLE DEMANDE */}
      {isSubmitOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', width: '450px', maxWidth: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>🌴 Demande de Congé</h3>
            
            <form onSubmit={handleSubmitLeave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Type de congé *</label>
                <select
                  value={formFields.type}
                  onChange={e => setFormFields({ ...formFields, type: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  required
                >
                  <option value="PAID">🌴 Congé Payé</option>
                  <option value="SICK">🤒 Congé Maladie</option>
                  <option value="UNPAID">💸 Congé Sans Solde</option>
                  <option value="MATERNITY">👶 Congé Maternité</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Date de début *</label>
                  <input
                    type="date"
                    value={formFields.startDate}
                    onChange={e => setFormFields({ ...formFields, startDate: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Date de fin *</label>
                  <input
                    type="date"
                    value={formFields.endDate}
                    onChange={e => setFormFields({ ...formFields, endDate: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Description / Motif</label>
                <textarea
                  placeholder="Expliquez brièvement le motif de votre absence..."
                  value={formFields.reason}
                  onChange={e => setFormFields({ ...formFields, reason: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem', minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsSubmitOpen(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white', cursor: 'pointer', fontWeight: 700 }}
                >
                  ✓ Soumettre la demande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL : RAISON DE REFUS */}
      {isRejectionOpen && rejectionTargetId && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', width: '400px', maxWidth: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>✗ Motif du Refus</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '15px' }}>Indiquez la raison pour laquelle cette demande de congé est rejetée.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateStatus(rejectionTargetId, 'REJECTED', rejectionReason); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <textarea
                  placeholder="Motif du refus réglementaire..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem', minHeight: '80px', resize: 'vertical' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setIsRejectionOpen(false); setRejectionReason(''); setRejectionTargetId(null); }}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 700 }}
                >
                  Confirmer le Refus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
