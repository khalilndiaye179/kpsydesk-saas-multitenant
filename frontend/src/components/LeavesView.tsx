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
  const [activeSubTab, setActiveSubTab] = useState<'my-leaves' | 'pending-validation' | 'payroll' | 'settings'>('my-leaves');
  
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

  // Payroll States
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(currentUser?.id || '');
  const [payrollSimulation, setPayrollSimulation] = useState<any>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);

  // Configuration States (IPRES/CSS)
  const [hrConfig, setHrConfig] = useState<any>({
    ipresGeneralRate: 5.6,
    ipresGeneralCeiling: 360000,
    ipresExecutiveRate: 5.6,
    ipresExecutiveCeiling: 1080000,
    cssFamilyRate: 3.0,
    cssFamilyCeiling: 63000,
    cssAccidentRate: 1.0,
    cssAccidentCeiling: 63000,
    employerIpresGeneralRate: 8.4,
    employerIpresExecutiveRate: 8.4
  });
  const [configSaving, setConfigSaving] = useState(false);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await api.get('/leaves');
      setLeaves(res.data || []);
    } catch (err) {
      console.warn('API error in LeavesView. Using fallback.', err);
      // Fallback for demo/dev local mode
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

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/users');
      setEmployees(res.data || []);
    } catch (err) {
      console.warn('Could not fetch employees', err);
      setEmployees([
        { id: currentUser?.id || '1', email: currentUser?.email || 'user@company.com', firstName: currentUser?.firstName || 'Fatou', lastName: currentUser?.lastName || 'Diop' }
      ]);
    }
  };

  const fetchPayrollSimulation = async (userId: string) => {
    if (!userId) return;
    setPayrollLoading(true);
    try {
      const res = await api.get(`/payroll/simulation/${userId}`);
      setPayrollSimulation(res.data);
    } catch (err: any) {
      console.warn('API error in payroll simulation. Using fallback.', err);
      // Fallback simulation for offline mode
      setPayrollSimulation({
        userId,
        firstName: 'Collaborateur',
        lastName: 'Sélectionné',
        isExecutive: false,
        baseSalary: 450000,
        transportAllowance: 25000,
        contributionBase: 455000, // base + (25000 - 20000 taxable)
        taxableTransport: 5000,
        ipres: {
          rgBase: 360000,
          rcBase: 0,
          employeeGeneral: 20160,
          employerGeneral: 30240,
          employeeExecutive: 0,
          employerExecutive: 0,
          totalEmployee: 20160,
          totalEmployer: 30240
        },
        css: {
          base: 63000,
          familyEmployer: 1890,
          accidentEmployer: 630,
          totalEmployer: 2520
        },
        summary: {
          brutSalary: 475000,
          totalChargesEmployee: 20160,
          totalChargesEmployer: 32760,
          netSalaryBeforeTax: 454840,
          employerTotalCost: 507760
        },
        config: hrConfig
      });
    } finally {
      setPayrollLoading(false);
    }
  };

  const fetchHrConfig = async () => {
    try {
      const res = await api.get('/payroll/config');
      if (res.data) setHrConfig(res.data);
    } catch (err) {
      console.warn('Could not fetch hrConfig', err);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'my-leaves' || activeSubTab === 'pending-validation') {
      fetchLeaves();
    } else if (activeSubTab === 'payroll') {
      if (isAdmin) {
        fetchEmployees();
      }
      fetchPayrollSimulation(selectedEmployeeId || currentUser?.id);
    } else if (activeSubTab === 'settings') {
      fetchHrConfig();
    }
  }, [activeSubTab, selectedEmployeeId]);

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

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    try {
      await api.post('/payroll/config', hrConfig);
      alert('Configuration des cotisations IPRES / CSS enregistrée avec succès !');
    } catch (err: any) {
      alert(`Erreur lors de l'enregistrement de la config: ${err.response?.data?.message || err.message}`);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleResetConfigToDefault = () => {
    if (confirm('Voulez-vous réinitialiser tous les taux de cotisations aux valeurs réglementaires standards du Sénégal ?')) {
      setHrConfig({
        ipresGeneralRate: 5.6,
        ipresGeneralCeiling: 360000,
        ipresExecutiveRate: 5.6,
        ipresExecutiveCeiling: 1080000,
        cssFamilyRate: 3.0,
        cssFamilyCeiling: 63000,
        cssAccidentRate: 1.0,
        cssAccidentCeiling: 63000,
        employerIpresGeneralRate: 8.4,
        employerIpresExecutiveRate: 8.4
      });
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

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(val);
  };

  const listToDisplay = activeSubTab === 'my-leaves' 
    ? leaves.filter(l => l.user.id === currentUser?.id)
    : leaves.filter(l => l.status === 'PENDING');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="fade-in">
      
      {/* Tab Menu Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveSubTab('my-leaves')}
            className={`btn-primary ${activeSubTab === 'my-leaves' ? '' : 'btn-outline'}`}
            style={{ padding: '8px 16px', borderRadius: '8px', border: activeSubTab === 'my-leaves' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            🌴 Mes Demandes
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveSubTab('pending-validation')}
              className={`btn-primary ${activeSubTab === 'pending-validation' ? '' : 'btn-outline'}`}
              style={{ padding: '8px 16px', borderRadius: '8px', border: activeSubTab === 'pending-validation' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              ⚖️ Congés À Valider ({leaves.filter(l => l.status === 'PENDING').length})
            </button>
          )}
          <button
            onClick={() => setActiveSubTab('payroll')}
            className={`btn-primary ${activeSubTab === 'payroll' ? '' : 'btn-outline'}`}
            style={{ padding: '8px 16px', borderRadius: '8px', border: activeSubTab === 'payroll' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            🧮 Simuler Cotisations Paie
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveSubTab('settings')}
              className={`btn-primary ${activeSubTab === 'settings' ? '' : 'btn-outline'}`}
              style={{ padding: '8px 16px', borderRadius: '8px', border: activeSubTab === 'settings' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              ⚙️ Barèmes IPRES / CSS
            </button>
          )}
        </div>

        {/* Action button inside leaves view */}
        {(activeSubTab === 'my-leaves' || activeSubTab === 'pending-validation') && (
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
        )}
      </div>

      {/* RENDER TAB: LEAVES */}
      {(activeSubTab === 'my-leaves' || activeSubTab === 'pending-validation') && (
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
      )}

      {/* RENDER TAB: PAYROLL SIMULATION */}
      {activeSubTab === 'payroll' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* User selector for Admin */}
          {isAdmin && (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Sélectionner le collaborateur :</label>
              <select
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none' }}
              >
                <option value="">-- Choisissez --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.position || 'n/a'})</option>
                ))}
              </select>
            </div>
          )}

          {payrollLoading ? (
            <div style={{ textAlign: 'center', padding: '50px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', color: 'var(--text-muted)' }}>
              <i className="ph ph-circle-notch spin-animation" style={{ fontSize: '2rem', marginBottom: '10px' }} /><br />
              Simulation des cotisations en cours...
            </div>
          ) : payrollSimulation ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', alignItems: 'start' }}>
              
              {/* Receipt / Grid summary */}
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>🗂️ Détail des Cotisations IPRES & CSS</span>
                  <span style={{ fontSize: '0.8rem', background: 'rgba(99,102,241,0.15)', color: '#6366f1', padding: '2px 10px', borderRadius: '50px' }}>
                    {payrollSimulation.isExecutive ? '💼 Cadre' : '👥 Non-Cadre'}
                  </span>
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  
                  {/* Bases */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-tertiary)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Salaire de Base</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{formatPrice(payrollSimulation.baseSalary)}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Indemnité de Transport</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{formatPrice(payrollSimulation.transportAllowance)}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Assiette brute cotisable (excluant transport exonéré &lt; 20 000 F) : <strong>{formatPrice(payrollSimulation.contributionBase)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Table details */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 0' }}>Régime Social (Sénégal)</th>
                        <th>Assiette</th>
                        <th style={{ textAlign: 'right' }}>Part Salariale</th>
                        <th style={{ textAlign: 'right' }}>Part Patronale</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 0', fontWeight: 600 }}>IPRES Régime Général (RG)</td>
                        <td>{formatPrice(payrollSimulation.ipres.rgBase)}</td>
                        <td style={{ textAlign: 'right', color: '#ef4444' }}>-{formatPrice(payrollSimulation.ipres.employeeGeneral)} ({payrollSimulation.config.ipresGeneralRate}%)</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatPrice(payrollSimulation.ipres.employerGeneral)} ({payrollSimulation.config.employerIpresGeneralRate}%)</td>
                      </tr>
                      {payrollSimulation.isExecutive && (
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 0', fontWeight: 600 }}>IPRES Régime Cadres (RC)</td>
                          <td>{formatPrice(payrollSimulation.ipres.rcBase)}</td>
                          <td style={{ textAlign: 'right', color: '#ef4444' }}>-{formatPrice(payrollSimulation.ipres.employeeExecutive)} ({payrollSimulation.config.ipresExecutiveRate}%)</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatPrice(payrollSimulation.ipres.employerExecutive)} ({payrollSimulation.config.employerIpresExecutiveRate}%)</td>
                        </tr>
                      )}
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 0', fontWeight: 600 }}>CSS Prestations Familiales</td>
                        <td>{formatPrice(payrollSimulation.css.base)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Exonéré</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatPrice(payrollSimulation.css.familyEmployer)} ({payrollSimulation.config.cssFamilyRate}%)</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 0', fontWeight: 600 }}>CSS Accidents du Travail</td>
                        <td>{formatPrice(payrollSimulation.css.base)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Exonéré</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatPrice(payrollSimulation.css.accidentEmployer)} ({payrollSimulation.config.cssAccidentRate}%)</td>
                      </tr>
                    </tbody>
                  </table>

                </div>
              </div>

              {/* Cost card summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Salarié */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '15px', fontWeight: 700 }}>💰 Côté Employé</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Salaire Brut :</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{formatPrice(payrollSimulation.summary.brutSalary)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px' }}>
                      <span style={{ color: '#ef4444' }}>Retenues IPRES :</span>
                      <strong style={{ color: '#ef4444' }}>-{formatPrice(payrollSimulation.summary.totalChargesEmployee)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '5px' }}>
                      <span style={{ color: '#22c55e', fontWeight: 700 }}>Net Estimé (Avant Impôt) :</span>
                      <strong style={{ color: '#22c55e', fontSize: '1.25rem', fontWeight: 900 }}>{formatPrice(payrollSimulation.summary.netSalaryBeforeTax)}</strong>
                    </div>
                  </div>
                </div>

                {/* Employeur */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '15px', fontWeight: 700 }}>🏢 Côté Employeur</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Salaire Brut :</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{formatPrice(payrollSimulation.summary.brutSalary)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Charges Patronales (IPRES+CSS) :</span>
                      <strong style={{ color: 'var(--text-primary)' }}>+{formatPrice(payrollSimulation.summary.totalChargesEmployer)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '5px' }}>
                      <span style={{ color: '#6366f1', fontWeight: 700 }}>Coût Total Entreprise :</span>
                      <strong style={{ color: '#6366f1', fontSize: '1.25rem', fontWeight: 900 }}>{formatPrice(payrollSimulation.summary.employerTotalCost)}</strong>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
              Aucun collaborateur éligible à la simulation.
            </div>
          )}

        </div>
      )}

      {/* RENDER TAB: CONFIGURATION BARÈMES */}
      {activeSubTab === 'settings' && isAdmin && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>⚙️ Paramètres des cotisations sociales (Sénégal)</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>Configurez les taux et plafonds officiels de l'IPRES et de la Caisse de Sécurité Sociale (CSS).</p>
            </div>
            <button
              type="button"
              onClick={handleResetConfigToDefault}
              className="btn-outline"
              style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)' }}
            >
              Réinitialiser standards
            </button>
          </div>

          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* Box IPRES */}
              <div style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>🌴 Institution de Prévoyance Retraite (IPRES)</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Taux Salarial Régime Général (%)</label>
                    <input 
                      type="number" step="0.01" 
                      value={hrConfig.ipresGeneralRate} 
                      onChange={e => setHrConfig({ ...hrConfig, ipresGeneralRate: Number(e.target.value) })}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Plafond Régime Général (FCFA / mois)</label>
                    <input 
                      type="number" 
                      value={hrConfig.ipresGeneralCeiling} 
                      onChange={e => setHrConfig({ ...hrConfig, ipresGeneralCeiling: Number(e.target.value) })}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Taux Patronal Régime Général (%)</label>
                    <input 
                      type="number" step="0.01" 
                      value={hrConfig.employerIpresGeneralRate} 
                      onChange={e => setHrConfig({ ...hrConfig, employerIpresGeneralRate: Number(e.target.value) })}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    />
                  </div>
                  <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '10px', marginTop: '5px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Taux Régime Complémentaire Cadres (%)</label>
                    <input 
                      type="number" step="0.01" 
                      value={hrConfig.ipresExecutiveRate} 
                      onChange={e => setHrConfig({ ...hrConfig, ipresExecutiveRate: Number(e.target.value) })}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Plafond Régime Cadres (FCFA / mois)</label>
                    <input 
                      type="number" 
                      value={hrConfig.ipresExecutiveCeiling} 
                      onChange={e => setHrConfig({ ...hrConfig, ipresExecutiveCeiling: Number(e.target.value) })}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Taux Patronal Régime Cadres (%)</label>
                    <input 
                      type="number" step="0.01" 
                      value={hrConfig.employerIpresExecutiveRate} 
                      onChange={e => setHrConfig({ ...hrConfig, employerIpresExecutiveRate: Number(e.target.value) })}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Box CSS */}
              <div style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>🏥 Caisse de Sécurité Sociale (CSS)</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Taux Prestations Familiales (%)</label>
                    <input 
                      type="number" step="0.01" 
                      value={hrConfig.cssFamilyRate} 
                      onChange={e => setHrConfig({ ...hrConfig, cssFamilyRate: Number(e.target.value) })}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Taux Accidents du Travail (%)</label>
                    <select
                      value={hrConfig.cssAccidentRate}
                      onChange={e => setHrConfig({ ...hrConfig, cssAccidentRate: Number(e.target.value) })}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    >
                      <option value={1.0}>1.0% (Risque faible)</option>
                      <option value={3.0}>3.0% (Risque moyen)</option>
                      <option value={5.0}>5.0% (Risque élevé)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Plafond Cotisations CSS (FCFA / mois)</label>
                    <input 
                      type="number" 
                      value={hrConfig.cssFamilyCeiling} 
                      onChange={e => setHrConfig({ ...hrConfig, cssFamilyCeiling: Number(e.target.value), cssAccidentCeiling: Number(e.target.value) })}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    />
                  </div>
                  <div style={{ background: 'rgba(99,102,241,0.06)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.15)', marginTop: '20px' }}>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      💡 <strong>Note réglementaire :</strong> Au Sénégal, les cotisations à la Caisse de Sécurité Sociale (CSS) sont entièrement à la charge exclusive de l'employeur (patronat) et sont plafonnées à 63 000 FCFA par mois (soit 756 000 FCFA par an).
                    </p>
                  </div>
                </div>
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                type="submit"
                disabled={configSaving}
                className="btn-primary"
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #15803d)', color: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                {configSaving ? 'Enregistrement...' : '✓ Sauvegarder les barèmes'}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* MODAL : SOUVELLE DEMANDE */}
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
