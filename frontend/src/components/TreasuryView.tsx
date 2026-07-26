import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';

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

const formatXOF = (value: number): string =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(value);

const getPeriodDates = (
  preset: PeriodPreset,
  customStart?: string,
  customEnd?: string,
) => {
  const now = new Date();
  if (preset === 'custom') {
    return { startDate: customStart || '', endDate: customEnd || '' };
  }
  if (preset === 'month') {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0],
      endDate: now.toISOString().split('T')[0],
    };
  }
  if (preset === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return {
      startDate: new Date(now.getFullYear(), q * 3, 1)
        .toISOString()
        .split('T')[0],
      endDate: now.toISOString().split('T')[0],
    };
  }
  // year
  return {
    startDate: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
  };
};

export const TreasuryView: React.FC = () => {
  const [treasuryData, setTreasuryData] = useState<TreasurySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [exportLoading, setExportLoading] = useState<'excel' | 'pdf' | null>(null);

  const trendChartRef = useRef<any>(null);

  const fetchData = useCallback(async () => {
    const { startDate, endDate } = getPeriodDates(periodPreset, customStart, customEnd);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await api.get(`/dashboard/treasury-summary?${params.toString()}`);
      setTreasuryData(res.data);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setError(
          "Accès refusé : Le Dashboard Trésorerie n'est pas activé sur votre plan actuel. Contactez votre administrateur SaaS pour mettre à jour votre abonnement.",
        );
      } else {
        setError('Erreur lors du chargement des données de trésorerie.');
      }
    } finally {
      setLoading(false);
    }
  }, [periodPreset, customStart, customEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Render Chart.js trend line
  useEffect(() => {
    if (!treasuryData) return;
    const Chart = (window as any).Chart;
    if (!Chart) return;
    if (trendChartRef.current) trendChartRef.current.destroy();

    const canvas = document.getElementById('treasuryTrendChart') as HTMLCanvasElement;
    if (!canvas) return;

    trendChartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: treasuryData.trend.map(t =>
          new Date(t.date).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
          }),
        ),
        datasets: [
          {
            label: 'Produits (Cl. 7)',
            data: treasuryData.trend.map(t => t.receipts),
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34,197,94,0.1)',
            tension: 0.3,
            fill: true,
            pointRadius: 3,
          },
          {
            label: 'Charges (Cl. 6)',
            data: treasuryData.trend.map(t => t.expenses),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.08)',
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
          legend: { position: 'top', labels: { color: '#cbd5e1', font: { size: 12 } } },
        },
        scales: {
          y: {
            ticks: {
              color: '#94a3b8',
              callback: (v: number) => formatXOF(v),
            },
            grid: { color: '#1e293b' },
          },
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
        },
      },
    });

    return () => {
      if (trendChartRef.current) trendChartRef.current.destroy();
    };
  }, [treasuryData]);

  const handleExport = async (type: 'excel' | 'pdf') => {
    setExportLoading(type);
    try {
      const { startDate, endDate } = getPeriodDates(periodPreset, customStart, customEnd);
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const endpoint =
        type === 'excel' ? 'treasury-export-excel' : 'treasury-export-pdf';
      const mimeType =
        type === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf';
      const extension = type === 'excel' ? 'xlsx' : 'pdf';

      const res = await api.get(`/dashboard/${endpoint}?${params.toString()}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([res.data], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `Tresorerie_${new Date().toISOString().slice(0, 10)}.${extension}`,
      );
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
    ? treasuryData.summary.netResult >= 0
      ? '#22c55e'
      : '#ef4444'
    : 'var(--text-primary)';

  const presetLabels: { id: PeriodPreset; label: string }[] = [
    { id: 'month', label: 'Mois en cours' },
    { id: 'quarter', label: 'Trimestre' },
    { id: 'year', label: 'Année' },
    { id: 'custom', label: 'Personnalisé' },
  ];

  return (
    <div className="fade-in">
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="ph ph-chart-line-up" style={{ color: '#22c55e' }} />
            Dashboard Trésorerie
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
            Synthèse simplifiée inspirée norme SYSCOHADA — Données extra-comptables à titre indicatif
          </p>
        </div>

        {/* Boutons d'export */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            id="btn-export-excel"
            disabled={exportLoading !== null || !treasuryData}
            onClick={() => handleExport('excel')}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 18px', borderRadius: '10px',
              border: '1px solid #16a34a',
              background: exportLoading === 'excel' ? '#14532d' : 'rgba(22,163,74,0.12)',
              color: '#22c55e',
              cursor: exportLoading !== null ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s',
            }}
          >
            <i
              className={`ph ${exportLoading === 'excel' ? 'ph-circle-notch' : 'ph-file-xls'}`}
              style={{ animation: exportLoading === 'excel' ? 'spin 1s linear infinite' : undefined }}
            />
            {exportLoading === 'excel' ? 'Génération...' : 'Export Excel'}
          </button>

          <button
            id="btn-export-pdf"
            disabled={exportLoading !== null || !treasuryData}
            onClick={() => handleExport('pdf')}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 18px', borderRadius: '10px',
              border: '1px solid #dc2626',
              background: exportLoading === 'pdf' ? '#450a0a' : 'rgba(220,38,38,0.1)',
              color: '#ef4444',
              cursor: exportLoading !== null ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s',
            }}
          >
            <i
              className={`ph ${exportLoading === 'pdf' ? 'ph-circle-notch' : 'ph-file-pdf'}`}
              style={{ animation: exportLoading === 'pdf' ? 'spin 1s linear infinite' : undefined }}
            />
            {exportLoading === 'pdf' ? 'Génération...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ── Filtres de période ── */}
      <div
        className="module-container"
        style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}
      >
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>
          Période :
        </span>
        {presetLabels.map(p => (
          <button
            key={p.id}
            id={`period-btn-${p.id}`}
            onClick={() => setPeriodPreset(p.id)}
            style={{
              padding: '6px 16px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600,
              border: periodPreset === p.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              background: periodPreset === p.id ? 'var(--primary)' : 'var(--bg-secondary)',
              color: periodPreset === p.id ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.2s',
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
              onClick={fetchData}
              style={{
                padding: '6px 16px', borderRadius: '8px', border: 'none',
                background: 'var(--primary)', color: '#fff',
                fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Appliquer
            </button>
          </>
        )}
      </div>

      {/* ── Contenu principal ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
          <i className="ph ph-circle-notch" style={{ fontSize: '2.5rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '1rem', fontSize: '1rem' }}>Chargement des données de trésorerie...</p>
        </div>
      ) : error ? (
        <div
          className="module-container"
          style={{ textAlign: 'center', padding: '3rem', color: '#ef4444', background: 'rgba(239,68,68,0.06)' }}
        >
          <i className="ph ph-lock" style={{ fontSize: '3rem', color: '#f97316' }} />
          <h3 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>Fonctionnalité non activée</h3>
          <p style={{ maxWidth: '500px', margin: '0.75rem auto 0', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {error}
          </p>
        </div>
      ) : treasuryData ? (
        <>
          {/* KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '18px',
              marginBottom: '1.75rem',
            }}
          >
            {/* Produits Cl.7 */}
            <div
              className="module-container"
              style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0.04) 100%)',
                border: '1px solid rgba(34,197,94,0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: '#86efac', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>
                    Produits — Classe 7
                  </p>
                  <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#22c55e', margin: 0, lineHeight: 1 }}>
                    {formatXOF(treasuryData.summary.totalSales)}
                  </p>
                  <p style={{ color: '#86efac', fontSize: '0.78rem', marginTop: '8px' }}>
                    {treasuryData.summary.salesCount} vente(s) / cession(s)
                  </p>
                </div>
                <div style={{ background: 'rgba(34,197,94,0.15)', borderRadius: '12px', padding: '12px' }}>
                  <i className="ph ph-trend-up" style={{ fontSize: '1.6rem', color: '#22c55e' }} />
                </div>
              </div>
              <div style={{ marginTop: '14px', borderTop: '1px solid rgba(34,197,94,0.2)', paddingTop: '12px' }}>
                {treasuryData.details.salesByStatus.map(s => (
                  <div key={s.status} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#86efac', marginTop: '5px' }}>
                    <span>{s.status}</span>
                    <span style={{ fontWeight: 700 }}>{formatXOF(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Charges Cl.6 */}
            <div
              className="module-container"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.04) 100%)',
                border: '1px solid rgba(239,68,68,0.25)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: '#fca5a5', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>
                    Charges — Classe 6
                  </p>
                  <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444', margin: 0, lineHeight: 1 }}>
                    {formatXOF(treasuryData.summary.totalPurchases)}
                  </p>
                  <p style={{ color: '#fca5a5', fontSize: '0.78rem', marginTop: '8px' }}>
                    {treasuryData.summary.purchasesCount} commande(s) fournisseur
                  </p>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.12)', borderRadius: '12px', padding: '12px' }}>
                  <i className="ph ph-trend-down" style={{ fontSize: '1.6rem', color: '#ef4444' }} />
                </div>
              </div>
              <div style={{ marginTop: '14px', borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: '12px' }}>
                {treasuryData.details.purchasesByStatus.map(p => (
                  <div key={p.status} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#fca5a5', marginTop: '5px' }}>
                    <span>{p.status}</span>
                    <span style={{ fontWeight: 700 }}>{formatXOF(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Résultat Net */}
            <div
              className="module-container"
              style={{
                background: `linear-gradient(135deg, ${treasuryData.summary.netResult >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'} 0%, rgba(0,0,0,0) 100%)`,
                border: `1px solid ${treasuryData.summary.netResult >= 0 ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>
                    Résultat Net de Trésorerie
                  </p>
                  <p style={{ fontSize: '1.8rem', fontWeight: 800, color: netResultColor, margin: 0, lineHeight: 1 }}>
                    {treasuryData.summary.netResult >= 0 ? '+' : ''}
                    {formatXOF(treasuryData.summary.netResult)}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '8px', lineHeight: 1.4 }}>
                    Solde indicatif extra-comptable
                  </p>
                </div>
                <div
                  style={{
                    background: treasuryData.summary.netResult >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    borderRadius: '12px', padding: '12px',
                  }}
                >
                  <i
                    className={`ph ${treasuryData.summary.netResult >= 0 ? 'ph-piggy-bank' : 'ph-warning'}`}
                    style={{ fontSize: '1.6rem', color: netResultColor }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Graphique tendance + Top fournisseurs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: treasuryData.details.chargesBySupplier.length > 0 ? '1fr 280px' : '1fr',
              gap: '1.5rem',
              marginBottom: '1.5rem',
            }}
          >
            <div className="module-container">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                Évolution Produits vs Charges
              </h3>
              <div style={{ height: '260px', position: 'relative' }}>
                {treasuryData.trend.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Aucune donnée sur la période sélectionnée
                  </div>
                ) : (
                  <canvas id="treasuryTrendChart" />
                )}
              </div>
            </div>

            {treasuryData.details.chargesBySupplier.length > 0 && (
              <div className="module-container">
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                  Top Fournisseurs (Charges)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {treasuryData.details.chargesBySupplier
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 6)
                    .map((s, i) => {
                      const maxAmt = treasuryData.details.chargesBySupplier[0].amount;
                      const pct = maxAmt > 0 ? (s.amount / maxAmt) * 100 : 0;
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={s.supplierName}>
                              {s.supplierName}
                            </span>
                            <span style={{ color: '#ef4444', fontWeight: 700 }}>{formatXOF(s.amount)}</span>
                          </div>
                          <div style={{ background: 'var(--bg-tertiary)', borderRadius: '4px', height: '5px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #ef4444, #f97316)', borderRadius: '4px', transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Note de bas de page */}
          <div
            className="module-container"
            style={{ padding: '12px 16px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
          >
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0, lineHeight: 1.6 }}>
              <i className="ph ph-info" style={{ marginRight: '6px', color: '#fbbf24' }} />
              <strong style={{ color: '#fbbf24' }}>Avertissement :</strong>{' '}
              Ce tableau de bord fournit une vue indicative extra-comptable conforme aux grands principes de classification SYSCOHADA (Produits Cl. 7 / Charges Cl. 6). Il ne se substitue pas à une comptabilité certifiée. Consultez votre expert-comptable pour toute déclaration officielle.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
};
