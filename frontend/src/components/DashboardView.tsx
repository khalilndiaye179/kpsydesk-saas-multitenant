import React, { useEffect, useState, useRef } from 'react';
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

  const statusChartRef = useRef<any>(null);
  const deptChartRef = useRef<any>(null);

  const currentUserStr = localStorage.getItem('currentUser');
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const isAdmin = currentUser?.role === 'ADMIN';

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
              <span style={{ cursor: 'pointer', color: 'var(--text-muted)' }} title="Estimation basée sur les adresses IP uniques.">
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

      <div className="module-container">
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
    </div>
  );
};
