import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';

interface Activity {
  id: string;
  action: string;
  inventoryCode: string;
  assetName: string;
  userName: string;
  performedBy: string;
  date: string;
}

interface TreasurySummary {
  period: { startDate: string | null; endDate: string | null };
  summary: {
    totalSales: number;
    totalPurchases: number;
    netResult: number;
    salesCount: number;
    purchasesCount: number;
  };
  details: {
    salesByStatus: { status: string; amount: number }[];
    purchasesByStatus: { status: string; amount: number }[];
    chargesBySupplier: { supplierName: string; amount: number }[];
  };
  trend: { date: string; receipts: number; expenses: number }[];
}

type PeriodPreset = 'month' | 'quarter' | 'year' | 'custom';

const formatXOF = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(value);
};

const getPeriodDates = (preset: PeriodPreset, customStart?: string, customEnd?: string) => {
  const now = new Date();
  if (preset === 'custom') {
    return { startDate: customStart || '', endDate: customEnd || '' };
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    };
  }
  if (preset === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    };
  }
  // year
  const start = new Date(now.getFullYear(), 0, 1);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
  };
};

export const DashboardView: React.FC = () => {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    broken: 0,
    tickets: 0,
    users: 0,
    licensesSeats: '0/0',
    contracts: 0,
    lowStock: 0,
    visitorsToday: 0
  });
  const [activities, setActivities] = useState<Activity[]>([]);

  // Treasury state
  const [hasTreasury, setHasTreasury] = useState(false);
  const [treasuryData, setTreasuryData] = useState<TreasurySummary | null>(null);
  const [treasuryLoading, setTreasuryLoading] = useState(false);
  const [treasuryError, setTreasuryError] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [exportLoading, setExportLoading] = useState<'excel' | 'pdf' | null>(null);

  const statusChartRef = useRef<any>(null);
  const deptChartRef = useRef<any>(null);
  const trendChartRef = useRef<any>(null);

  const currentUserStr = localStorage.getItem('currentUser');
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const isAdmin = currentUser?.role === 'ADMIN';

  // Vérifier si le plan a la fonctionnalité trésorerie via l'API /tenants/me
  useEffect(() => {
    api.get('/tenants/me')
      .then(res => {
        const feats: Record<string, boolean> =
          res.data?.subscription?.featuresIncluded ||
          res.data?.plan?.featuresIncluded ||
          {};
        setHasTreasury(feats.treasury_dashboard === true);
      })
      .catch(() => setHasTreasury(false));
  }, []);

  const fetchTreasuryData = useCallback(async () => {
    if (!hasTreasury) return;

    const { startDate, endDate } = getPeriodDates(periodPreset, customStart, customEnd);
    setTreasuryLoading(true);
    setTreasuryError(null);

    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await api.get(`/dashboard/treasury-summary?${params.toString()}`);
      setTreasuryData(res.data);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setTreasuryError('Accès refusé : Cette fonctionnalité n\'est pas incluse dans votre plan actuel.');
        setHasTreasury(false);
      } else {
        setTreasuryError('Erreur lors du chargement des données de trésorerie.');
      }
    } finally {
      setTreasuryLoading(false);
    }
  }, [hasTreasury, periodPreset, customStart, customEnd]);

  useEffect(() => {
    if (hasTreasury) {
      fetchTreasuryData();
    }
  }, [hasTreasury, fetchTreasuryData]);

  // Render trend chart when data changes
  useEffect(() => {
    if (!treasuryData || !hasTreasury) return;

    const Chart = (window as any).Chart;
    if (!Chart) return;

    if (trendChartRef.current) trendChartRef.current.destroy();

    const canvas = document.getElementById('treasuryTrendChart') as HTMLCanvasElement;
    if (!canvas) return;

    const labels = treasuryData.trend.map(t =>
      new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    );
    const receipts = treasuryData.trend.map(t => t.receipts);
    const expenses = treasuryData.trend.map(t => t.expenses);

    trendChartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Produits (Cl. 7)',
            data: receipts,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.3,
            fill: true,
            pointRadius: 3,
          },
          {
            label: 'Charges (Cl. 6)',
            data: expenses,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            tension: 0.3,
            fill: true,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#cbd5e1', font: { size: 12 } },
          },
        },
        scales: {
          y: {
            ticks: { color: '#94a3b8', callback: (v: number) => formatXOF(v) },
            grid: { color: '#1e293b' },
          },
          x: {
            ticks: { color: '#94a3b8' },
            grid: { display: false },
          },
        },
      },
    });
  }, [treasuryData, hasTreasury]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [
          assetsRes,
          ticketsRes,
          movementsRes,
          usersRes,
          licensesRes,
          consumablesRes,
          contractsRes
        ] = await Promise.all([
          api.get('/assets'),
          api.get('/tickets'),
          api.get('/movements'),
          api.get('/users'),
          api.get('/licenses'),
          api.get('/consumables'),
          api.get('/contracts')
        ]);

        const assets = assetsRes.data || [];
        const tickets = ticketsRes.data || [];
        const movements = movementsRes.data || [];
        const users = usersRes.data || [];
        const licenses = licensesRes.data || [];
        const consumables = consumablesRes.data || [];
        const contracts = contractsRes.data || [];

        const total = assets.length;
        const active = assets.filter((a: any) => a.status === 'ASSIGNED').length;
        const broken = assets.filter((a: any) => a.status === 'BROKEN' || a.status === 'IN_MAINTENANCE').length;
        const openTickets = tickets.filter((t: any) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;

        const totalUsers = users.length;
        const totalSeats = licenses.reduce((sum: number, l: any) => sum + (l.seats || 0), 0);
        const usedSeats = licenses.reduce((sum: number, l: any) => sum + (l.used || 0), 0);
        const licensesSeats = `${usedSeats}/${totalSeats}`;

        const activeContracts = contracts.filter((c: any) => c.status === 'Actif').length;
        const lowStock = consumables.filter((c: any) => c.quantity <= c.alertThreshold).length;

        let visitorsToday = 0;
        if (currentUser?.role === 'ADMIN') {
          try {
            const analyticsRes = await api.get('/tenants/me/analytics/stats');
            visitorsToday = analyticsRes.data?.uniqueVisitorsToday ?? 0;
          } catch (analyticsErr) {
            console.warn('Could not load tenant analytics:', analyticsErr);
          }
        }

        setStats({
          total,
          active,
          broken,
          tickets: openTickets,
          users: totalUsers,
          licensesSeats,
          contracts: activeContracts,
          lowStock,
          visitorsToday
        });
        setActivities(movements.slice(0, 5));
        renderCharts(assets);
      } catch (err) {
        console.warn('API error in dashboard.', err);
        setStats({
          total: 0,
          active: 0,
          broken: 0,
          tickets: 0,
          users: 0,
          licensesSeats: '0/0',
          contracts: 0,
          lowStock: 0,
          visitorsToday: 0
        });
        setActivities([]);
        renderCharts([]);
      }
    };

    fetchDashboardData();

    return () => {
      if (statusChartRef.current) statusChartRef.current.destroy();
      if (deptChartRef.current) deptChartRef.current.destroy();
      if (trendChartRef.current) trendChartRef.current.destroy();
    };
  }, []);

  const renderCharts = (assets: any[]) => {
    const Chart = (window as any).Chart;
    if (!Chart) return;

    if (statusChartRef.current) statusChartRef.current.destroy();
    if (deptChartRef.current) deptChartRef.current.destroy();

    const statusLabelsOrder = ['ASSIGNED', 'IN_STOCK', 'BROKEN', 'IN_MAINTENANCE', 'OBSOLETE', 'RETIRED', 'LOST'];

    const labelMapping: Record<string, string> = {
      'ASSIGNED': 'Assigné',
      'IN_STOCK': 'En Stock',
      'BROKEN': 'En Panne',
      'IN_MAINTENANCE': 'En Maintenance',
      'OBSOLETE': 'Obsolète',
      'RETIRED': 'Réformé',
      'LOST': 'Perdu'
    };

    const statusColors: Record<string, string> = {
      'ASSIGNED': '#5A2A82',
      'IN_STOCK': '#7ED957',
      'BROKEN': '#ef4444',
      'IN_MAINTENANCE': '#f59e0b',
      'OBSOLETE': '#94a3b8',
      'RETIRED': '#64748b',
      'LOST': '#475569'
    };

    const statusCounts = assets.reduce((acc: any, curr: any) => {
      const label = curr.status || 'IN_STOCK';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

    const finalLabels: string[] = [];
    const finalData: number[] = [];
    const finalColors: string[] = [];

    statusLabelsOrder.forEach(statusKey => {
      const count = statusCounts[statusKey] || 0;
      if (count > 0) {
        finalLabels.push(labelMapping[statusKey] || statusKey);
        finalData.push(count);
        finalColors.push(statusColors[statusKey]);
      }
    });

    Object.keys(statusCounts).forEach(statusKey => {
      if (!statusLabelsOrder.includes(statusKey)) {
        finalLabels.push(statusKey);
        finalData.push(statusCounts[statusKey]);
        finalColors.push('#cbd5e1');
      }
    });

    const statusCanvas = document.getElementById('statusChart') as HTMLCanvasElement;
    if (statusCanvas) {
      statusChartRef.current = new Chart(statusCanvas, {
        type: 'doughnut',
        data: {
          labels: finalLabels,
          datasets: [{
            data: finalData,
            backgroundColor: finalColors,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: '#cbd5e1' }
            }
          },
          cutout: '70%'
        }
      });
    }

    const deptCanvas = document.getElementById('deptChart') as HTMLCanvasElement;
    if (deptCanvas) {
      deptChartRef.current = new Chart(deptCanvas, {
        type: 'bar',
        data: {
          labels: ['IT', 'RH', 'Marketing', 'Finance', 'Direction'],
          datasets: [{
            label: 'Équipements',
            data: [5, 2, 3, 1, 2],
            backgroundColor: '#5A2A82',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { ticks: { color: '#cbd5e1' }, grid: { color: '#334155' } },
            x: { ticks: { color: '#cbd5e1' }, grid: { display: false } }
          }
        }
      });
    }
  };

  const handleExport = async (type: 'excel' | 'pdf') => {
    setExportLoading(type);
    try {
      const { startDate, endDate } = getPeriodDates(periodPreset, customStart, customEnd);
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const endpoint = type === 'excel' ? 'treasury-export-excel' : 'treasury-export-pdf';
      const mimeType = type === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';
      const extension = type === 'excel' ? 'xlsx' : 'pdf';

      const res = await api.get(`/dashboard/${endpoint}?${params.toString()}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([res.data], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Tresorerie_${new Date().toISOString().slice(0, 10)}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Erreur export ${type}:`, err);
    } finally {
      setExportLoading(null);
    }
  };

  const netResultColor = treasuryData
    ? (treasuryData.summary.netResult >= 0 ? '#22c55e' : '#ef4444')
    : 'var(--text-primary)';

  const presetLabels: { id: PeriodPreset; label: string }[] = [
    { id: 'month', label: 'Mois en cours' },
    { id: 'quarter', label: 'Trimestre' },
    { id: 'year', label: 'Année' },
    { id: 'custom', label: 'Personnalisé' },
  ];

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tableau de Bord</h1>
          <p style={{ color: 'var(--text-muted)' }}>Vue d'ensemble du parc informatique</p>
        </div>
        <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', fontSize: '0.875rem' }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <h3>Total Équipements</h3>
          <p className="stat-value">{stats.total}</p>
        </div>
        <div className="stat-card">
          <h3>Actifs assignés</h3>
          <p className="stat-value success">{stats.active}</p>
        </div>
        <div className="stat-card">
          <h3>En Panne / Maintenance</h3>
          <p className="stat-value danger">{stats.broken}</p>
        </div>
        <div className="stat-card">
          <h3>Tickets Ouverts</h3>
          <p className="stat-value warning">{stats.tickets}</p>
        </div>
        <div className="stat-card">
          <h3>Collaborateurs</h3>
          <p className="stat-value">{stats.users}</p>
        </div>
        <div className="stat-card">
          <h3>Licences Logiciels</h3>
          <p className="stat-value">{stats.licensesSeats}</p>
        </div>
        <div className="stat-card">
          <h3>Contrats Actifs</h3>
          <p className="stat-value success">{stats.contracts}</p>
        </div>
        <div className="stat-card">
          <h3>Alertes Stock</h3>
          <p className={`stat-value ${stats.lowStock > 0 ? 'warning' : ''}`}>{stats.lowStock}</p>
        </div>
        {isAdmin && (
          <div className="stat-card" style={{ position: 'relative' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Visiteurs Aujourd'hui
              <span style={{ cursor: 'pointer', color: 'var(--text-muted)' }} title="Estimation basée sur les adresses IP uniques accédant à cet espace.">
                <i className="ph ph-info" />
              </span>
            </h3>
            <p className="stat-value info" style={{ color: 'var(--primary)' }}>{stats.visitorsToday}</p>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="module-container" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Répartition par Statut</h3>
          <div style={{ flex: 1, position: 'relative' }}>
            <canvas id="statusChart"></canvas>
          </div>
        </div>
        <div className="module-container" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Équipements par Département</h3>
          <div style={{ flex: 1, position: 'relative' }}>
            <canvas id="deptChart"></canvas>
          </div>
        </div>
      </div>

      <div className="module-container" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Mouvements Récents</h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Code</th>
                <th>Équipement</th>
                <th>Utilisateur</th>
                <th>Effectué par</th>
              </tr>
            </thead>
            <tbody>
              {activities.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun mouvement récent</td>
                </tr>
              ) : (
                activities.map((act) => (
                  <tr key={act.id}>
                    <td>{new Date(act.date).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-badge ${act.action.toLowerCase() === 'assignation' ? 'success' : 'warning'}`}>
                        {act.action}
                      </span>
                    </td>
                    <td><strong>{act.inventoryCode}</strong></td>
                    <td>{act.assetName}</td>
                    <td>{act.userName}</td>
                    <td>{act.performedBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Widget Trésorerie (SYSCOHADA) — affiché uniquement si feature activée ── */}
      {hasTreasury && (
        <div className="module-container" style={{ marginBottom: '2rem' }}>
          {/* Header du widget */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                <i className="ph ph-chart-line-up" style={{ marginRight: '8px', color: '#22c55e' }} />
                Dashboard Trésorerie
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                Synthèse simplifiée inspirée norme SYSCOHADA — Données extra-comptables à titre indicatif
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                id="btn-export-excel"
                disabled={exportLoading !== null || !treasuryData}
                onClick={() => handleExport('excel')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '8px', border: '1px solid #16a34a',
                  background: exportLoading === 'excel' ? '#14532d' : 'rgba(22,163,74,0.1)',
                  color: '#22c55e', cursor: exportLoading !== null ? 'not-allowed' : 'pointer',
                  fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.2s'
                }}
              >
                <i className={`ph ${exportLoading === 'excel' ? 'ph-circle-notch' : 'ph-file-xls'}`}
                  style={{ animation: exportLoading === 'excel' ? 'spin 1s linear infinite' : undefined }} />
                {exportLoading === 'excel' ? 'Génération...' : 'Export Excel'}
              </button>
              <button
                id="btn-export-pdf"
                disabled={exportLoading !== null || !treasuryData}
                onClick={() => handleExport('pdf')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '8px', border: '1px solid #dc2626',
                  background: exportLoading === 'pdf' ? '#450a0a' : 'rgba(220,38,38,0.1)',
                  color: '#ef4444', cursor: exportLoading !== null ? 'not-allowed' : 'pointer',
                  fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.2s'
                }}
              >
                <i className={`ph ${exportLoading === 'pdf' ? 'ph-circle-notch' : 'ph-file-pdf'}`}
                  style={{ animation: exportLoading === 'pdf' ? 'spin 1s linear infinite' : undefined }} />
                {exportLoading === 'pdf' ? 'Génération...' : 'Export PDF'}
              </button>
            </div>
          </div>

          {/* Filtres de période */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {presetLabels.map(p => (
              <button
                key={p.id}
                id={`period-btn-${p.id}`}
                onClick={() => setPeriodPreset(p.id)}
                style={{
                  padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
                  border: periodPreset === p.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  background: periodPreset === p.id ? 'var(--primary)' : 'var(--bg-secondary)',
                  color: periodPreset === p.id ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {p.label}
              </button>
            ))}

            {periodPreset === 'custom' && (
              <>
                <input
                  type="date"
                  id="treasury-custom-start"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>au</span>
                <input
                  type="date"
                  id="treasury-custom-end"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                />
                <button
                  id="btn-apply-custom-period"
                  onClick={fetchTreasuryData}
                  style={{
                    padding: '6px 14px', borderRadius: '8px', border: 'none',
                    background: 'var(--primary)', color: '#fff', fontSize: '0.82rem',
                    fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Appliquer
                </button>
              </>
            )}
          </div>

          {/* Contenu du widget */}
          {treasuryLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <i className="ph ph-circle-notch" style={{ fontSize: '2rem', animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '1rem' }}>Chargement des données de trésorerie...</p>
            </div>
          ) : treasuryError ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444', background: 'rgba(239,68,68,0.06)', borderRadius: '12px' }}>
              <i className="ph ph-warning-circle" style={{ fontSize: '2rem' }} />
              <p style={{ marginTop: '0.5rem' }}>{treasuryError}</p>
            </div>
          ) : treasuryData ? (
            <>
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '2rem' }}>
                {/* Produits Cl.7 */}
                <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0.04) 100%)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '14px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ color: '#86efac', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px 0' }}>
                        Produits — Classe 7
                      </p>
                      <p style={{ fontSize: '1.6rem', fontWeight: 800, color: '#22c55e', margin: 0, lineHeight: 1 }}>
                        {formatXOF(treasuryData.summary.totalSales)}
                      </p>
                      <p style={{ color: '#86efac', fontSize: '0.75rem', marginTop: '6px' }}>
                        {treasuryData.summary.salesCount} vente(s) / cession(s)
                      </p>
                    </div>
                    <div style={{ background: 'rgba(34,197,94,0.15)', borderRadius: '10px', padding: '10px' }}>
                      <i className="ph ph-trend-up" style={{ fontSize: '1.5rem', color: '#22c55e' }} />
                    </div>
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    {treasuryData.details.salesByStatus.map(s => (
                      <div key={s.status} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#86efac', marginTop: '4px' }}>
                        <span>{s.status}</span>
                        <span style={{ fontWeight: 600 }}>{formatXOF(s.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Charges Cl.6 */}
                <div style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.04) 100%)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '14px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ color: '#fca5a5', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px 0' }}>
                        Charges — Classe 6
                      </p>
                      <p style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444', margin: 0, lineHeight: 1 }}>
                        {formatXOF(treasuryData.summary.totalPurchases)}
                      </p>
                      <p style={{ color: '#fca5a5', fontSize: '0.75rem', marginTop: '6px' }}>
                        {treasuryData.summary.purchasesCount} commande(s) fournisseur
                      </p>
                    </div>
                    <div style={{ background: 'rgba(239,68,68,0.12)', borderRadius: '10px', padding: '10px' }}>
                      <i className="ph ph-trend-down" style={{ fontSize: '1.5rem', color: '#ef4444' }} />
                    </div>
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    {treasuryData.details.purchasesByStatus.map(p => (
                      <div key={p.status} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#fca5a5', marginTop: '4px' }}>
                        <span>{p.status}</span>
                        <span style={{ fontWeight: 600 }}>{formatXOF(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Résultat Net */}
                <div style={{ background: `linear-gradient(135deg, ${treasuryData.summary.netResult >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'} 0%, rgba(0,0,0,0) 100%)`, border: `1px solid ${treasuryData.summary.netResult >= 0 ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`, borderRadius: '14px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px 0' }}>
                        Résultat Net de Trésorerie
                      </p>
                      <p style={{ fontSize: '1.6rem', fontWeight: 800, color: netResultColor, margin: 0, lineHeight: 1 }}>
                        {treasuryData.summary.netResult >= 0 ? '+' : ''}{formatXOF(treasuryData.summary.netResult)}
                      </p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.73rem', marginTop: '8px' }}>
                        Solde indicatif extra-comptable (SYSCOHADA)
                      </p>
                    </div>
                    <div style={{ background: treasuryData.summary.netResult >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', borderRadius: '10px', padding: '10px' }}>
                      <i className={`ph ${treasuryData.summary.netResult >= 0 ? 'ph-piggy-bank' : 'ph-warning'}`} style={{ fontSize: '1.5rem', color: netResultColor }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Graphique de tendance */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '20px', alignItems: 'start' }}>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Évolution Produits vs Charges
                  </h4>
                  <div style={{ height: '220px', position: 'relative' }}>
                    {treasuryData.trend.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Aucune donnée sur la période sélectionnée
                      </div>
                    ) : (
                      <canvas id="treasuryTrendChart" />
                    )}
                  </div>
                </div>

                {/* Top fournisseurs */}
                {treasuryData.details.chargesBySupplier.length > 0 && (
                  <div style={{ minWidth: '200px' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      Top Fournisseurs (Charges)
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {treasuryData.details.chargesBySupplier
                        .sort((a, b) => b.amount - a.amount)
                        .slice(0, 5)
                        .map((s, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '0.78rem' }}>
                            <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '110px' }} title={s.supplierName}>
                              {s.supplierName}
                            </span>
                            <span style={{ color: '#ef4444', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {formatXOF(s.amount)}
                            </span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <i className="ph ph-info" style={{ marginRight: '4px' }} />
                Ce tableau de bord fournit une vue indicative extra-comptable conforme aux grands principes de classification SYSCOHADA (Produits Cl. 7 / Charges Cl. 6). Il ne se substitue pas à une comptabilité certifiée. Consultez votre expert-comptable pour toute déclaration officielle.
              </p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};
