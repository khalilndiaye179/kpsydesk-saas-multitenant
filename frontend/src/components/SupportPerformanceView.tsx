import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface SupportPerformance {
  id: string;
  name: string;
  email: string;
  role: string;
  totalTickets: number;
  resolvedTickets: number;
  openTickets: number;
  avgResolutionTime: number;
  slaRate: number;
  reopenedTickets: string;
}

export const SupportPerformanceView: React.FC = () => {
  const [data, setData] = useState<SupportPerformance[]>([]);
  const [period, setPeriod] = useState<string>('30j');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/tenants/me/support-performance`, {
        params: { period }
      });
      setData(response.data || []);
    } catch (err: any) {
      console.error('Error fetching support performance', err);
      setError('Impossible de charger les statistiques de performance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  // Find the top performer based on resolved tickets and SLA rate
  const getTopPerformer = () => {
    if (data.length === 0) return null;
    // Filter to technicians who have resolved at least 1 ticket
    const activeTechs = data.filter(t => t.resolvedTickets > 0);
    if (activeTechs.length === 0) return null;

    // Sort by resolvedTickets (desc), then by slaRate (desc)
    return [...activeTechs].sort((a, b) => {
      if (b.resolvedTickets !== a.resolvedTickets) {
        return b.resolvedTickets - a.resolvedTickets;
      }
      return b.slaRate - a.slaRate;
    })[0];
  };

  const topPerformer = getTopPerformer();

  const getSlaBadgeClass = (rate: number) => {
    if (rate >= 90) return 'status-badge success';
    if (rate >= 70) return 'status-badge warning';
    return 'status-badge danger';
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {/* Header and Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Suivi analytique et respect des engagements de service de l'équipe support.
          </p>
        </div>
        
        {/* Period Selector */}
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          {['7j', '30j', '90j', 'tout'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                background: period === p ? 'linear-gradient(135deg, var(--primary), #3b82f6)' : 'transparent',
                color: period === p ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                transition: 'all 0.2s ease'
              }}
            >
              {p === 'tout' ? 'Toutes' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Top Performer Card (Constructive Highlight) */}
      {topPerformer && (
        <div className="module-container" style={{
          marginBottom: '2rem',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(59, 130, 246, 0.03))',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '1.5rem',
          borderRadius: '16px',
          animation: 'slideUp 0.5s ease-out'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6366f1',
            fontSize: '1.8rem'
          }}>
            <i className="ph ph-trophy"></i>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Félicitations à l'équipe et focus sur {topPerformer.name}
            </h4>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Avec <strong>{topPerformer.resolvedTickets} tickets résolus</strong> sur la période et un taux de respect SLA de <strong>{topPerformer.slaRate}%</strong>, 
              {topPerformer.name} illustre l'efficacité opérationnelle de notre support de proximité. Bravo pour l'engagement !
            </p>
          </div>
        </div>
      )}

      {/* Performance Table */}
      <div className="module-container">
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="ph-duotone ph-users" style={{ color: 'var(--primary)' }}></i>
          Tableau de Performance Support
        </h3>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className="ph ph-spinner-gap" style={{ fontSize: '2rem', animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 10px' }}></i>
            Chargement des performances...
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
            <i className="ph ph-warning-circle" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}></i>
            {error}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Technicien</th>
                  <th style={{ textAlign: 'center' }}>Tickets Assignés (Période)</th>
                  <th style={{ textAlign: 'center' }}>Tickets Résolus (Période)</th>
                  <th style={{ textAlign: 'center' }}>Charge de Travail (En cours)</th>
                  <th style={{ textAlign: 'center' }}>Temps Résolution Moyen</th>
                  <th style={{ textAlign: 'center' }}>Taux de Respect SLA</th>
                  <th style={{ textAlign: 'center' }}>Réouvertures</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      Aucun technicien ou ticket trouvé pour cette sélection.
                    </td>
                  </tr>
                ) : (
                  data.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{row.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.email}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.totalTickets}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--success)' }}>{row.resolvedTickets}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: row.openTickets > 5 ? 'var(--warning)' : 'inherit' }}>
                        {row.openTickets}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {row.resolvedTickets > 0 ? `${row.avgResolutionTime}h` : '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={getSlaBadgeClass(row.slaRate)}>
                          {row.slaRate}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {row.reopenedTickets}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
