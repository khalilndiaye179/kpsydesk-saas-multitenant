import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';

interface DepreciationRecord {
  id: string;
  assetCode: string;
  assetName: string;
  purchaseDate: string;
  initialCost: number;
  durationYears: number;
  method: string;
  residualFloor: number;
  notes?: string;
}

interface Asset {
  id: string;
  inventoryCode: string;
  name: string;
  purchaseDate?: string;
}

// ── Calcul de l'amortissement ───────────────────────────────────────────────
const computeDepreciation = (record: DepreciationRecord) => {
  const today = new Date();
  const purchase = new Date(record.purchaseDate);
  const yearsElapsed = Math.max(0, (today.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

  let vnc = 0;
  let pctAmorti = 0;

  if (record.method === 'Degressive') {
    // Méthode dégressive : taux = 1/durée × coeff dégressive (2x)
    const tauxDegressif = (1 / record.durationYears) * 2;
    let val = record.initialCost;
    for (let y = 0; y < Math.floor(yearsElapsed); y++) {
      val = val * (1 - tauxDegressif);
    }
    vnc = Math.max(record.residualFloor, val);
  } else {
    // Méthode linéaire (défaut)
    const dotationAnnuelle = record.initialCost / record.durationYears;
    const totalAmorti = Math.min(dotationAnnuelle * yearsElapsed, record.initialCost);
    vnc = Math.max(record.residualFloor, record.initialCost - totalAmorti);
  }

  pctAmorti = Math.min(100, ((record.initialCost - vnc) / record.initialCost) * 100);
  return { vnc, pctAmorti, yearsElapsed };
};

const getAlertInfo = (pctAmorti: number, initialCost: number) => {
  if (initialCost <= 0) return { level: 'none', label: 'Non renseigné', color: '#6b7280', bg: '#6b728020' };
  if (pctAmorti >= 100) return { level: 'critical', label: 'Amorti à 100% — À réformer', color: '#ef4444', bg: '#ef444420' };
  if (pctAmorti >= 80) return { level: 'warning', label: 'Fin de vie proche (≥ 80%)', color: '#f97316', bg: '#f9731620' };
  if (pctAmorti >= 50) return { level: 'info', label: 'À surveiller (≥ 50%)', color: '#eab308', bg: '#eab30820' };
  return { level: 'ok', label: 'En cours d\'amortissement', color: '#22c55e', bg: '#22c55e20' };
};

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' FCFA';
const fmtPct = (n: number) => n.toFixed(1) + ' %';

export const DepreciationView: React.FC = () => {
  const [records, setRecords] = useState<DepreciationRecord[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filterAlert, setFilterAlert] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DepreciationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [selectedAssetDropdown, setSelectedAssetDropdown] = useState('');

  const [formFields, setFormFields] = useState({
    assetCode: '',
    assetName: '',
    purchaseDate: '',
    initialCost: 0,
    durationYears: 5,
    method: 'Lineaire',
    residualFloor: 0,
    notes: ''
  });

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [depRes, assetsRes] = await Promise.all([
        api.get('/depreciations'),
        api.get('/assets')
      ]);
      setRecords(depRes.data || []);
      setAssets(assetsRes.data || []);
    } catch (err) {
      console.warn('API indisponible, utilisation de données de démo.', err);
      const today = new Date();
      const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate()).toISOString();
      const twoYearsAgo = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate()).toISOString();
      const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()).toISOString();
      setRecords([
        { id: '1', assetCode: 'INV-2025-001', assetName: 'Dell Latitude 5520', purchaseDate: fiveYearsAgo, initialCost: 850000, durationYears: 5, method: 'Lineaire', residualFloor: 1, notes: 'Actif principal du département IT' },
        { id: '2', assetCode: 'INV-2023-045', assetName: 'Cisco Router 2911', purchaseDate: twoYearsAgo, initialCost: 1200000, durationYears: 7, method: 'Lineaire', residualFloor: 0 },
        { id: '3', assetCode: 'INV-2024-012', assetName: 'HP ProLiant DL380', purchaseDate: oneYearAgo, initialCost: 3500000, durationYears: 10, method: 'Degressive', residualFloor: 50000, notes: 'Serveur production' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Rafraîchissement indépendant de la liste des actifs
  const refreshAssets = async () => {
    setIsLoadingAssets(true);
    try {
      const res = await api.get('/assets');
      setAssets(res.data || []);
    } catch (err) {
      console.warn('Impossible de charger les actifs depuis l\'API.', err);
    } finally {
      setIsLoadingAssets(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Enrichissement avec calculs
  const enrichedRecords = useMemo(() => {
    return records.map(r => {
      const { vnc, pctAmorti, yearsElapsed } = computeDepreciation(r);
      const alert = getAlertInfo(pctAmorti, r.initialCost);
      return { ...r, vnc, pctAmorti, yearsElapsed, alert };
    });
  }, [records]);

  // Statistiques globales
  const stats = useMemo(() => {
    const totalBrut = enrichedRecords.reduce((s, r) => s + r.initialCost, 0);
    const totalVNC = enrichedRecords.reduce((s, r) => s + r.vnc, 0);
    const totalAmortis = enrichedRecords.filter(r => r.pctAmorti >= 100).length;
    const totalFinDeVie = enrichedRecords.filter(r => r.pctAmorti >= 80 && r.pctAmorti < 100).length;
    return { totalBrut, totalVNC, totalAmortis, totalFinDeVie };
  }, [enrichedRecords]);

  // Filtrage
  const filtered = useMemo(() => {
    return enrichedRecords.filter(r => {
      const matchSearch = r.assetCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.assetName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchAlert = filterAlert === '' ||
        (filterAlert === 'critical' && r.pctAmorti >= 100) ||
        (filterAlert === 'warning' && r.pctAmorti >= 80 && r.pctAmorti < 100) ||
        (filterAlert === 'info' && r.pctAmorti >= 50 && r.pctAmorti < 80) ||
        (filterAlert === 'ok' && r.pctAmorti < 50);

      const purchaseTime = r.purchaseDate ? new Date(r.purchaseDate).getTime() : 0;
      const start = filterStartDate ? new Date(filterStartDate).setHours(0,0,0,0) : null;
      const end = filterEndDate ? new Date(filterEndDate).setHours(23,59,59,999) : null;
      const matchStart = !start || purchaseTime >= start;
      const matchEnd = !end || purchaseTime <= end;

      return matchSearch && matchAlert && matchStart && matchEnd;
    });
  }, [enrichedRecords, searchTerm, filterAlert, filterStartDate, filterEndDate]);

  // Alertes critiques à afficher en bandeau
  const criticalAlerts = enrichedRecords.filter(r => r.pctAmorti >= 80);

  const openAdd = async () => {
    setEditingItem(null);
    setSelectedAssetDropdown('');
    setFormFields({ assetCode: '', assetName: '', purchaseDate: new Date().toISOString().split('T')[0], initialCost: 0, durationYears: 5, method: 'Lineaire', residualFloor: 0, notes: '' });
    setIsOpen(true);
    // Rafraîchit la liste des actifs à chaque ouverture pour inclure les nouveaux
    await refreshAssets();
  };

  const openEdit = async (r: any) => {
    setEditingItem(r);
    setSelectedAssetDropdown(r.assetCode);
    setFormFields({
      assetCode: r.assetCode,
      assetName: r.assetName,
      purchaseDate: r.purchaseDate ? r.purchaseDate.split('T')[0] : '',
      initialCost: r.initialCost,
      durationYears: r.durationYears,
      method: r.method,
      residualFloor: r.residualFloor,
      notes: r.notes || ''
    });
    setIsOpen(true);
    await refreshAssets();
  };

  const handleAssetSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedAssetDropdown(val);
    if (!val) return;
    const selected = assets.find(a => a.inventoryCode === val);
    if (selected) {
      setFormFields(prev => ({
        ...prev,
        assetCode: selected.inventoryCode,
        assetName: selected.name,
        purchaseDate: selected.purchaseDate ? selected.purchaseDate.split('T')[0] : prev.purchaseDate
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSend = {
      ...formFields,
      initialCost: Number(formFields.initialCost),
      durationYears: Number(formFields.durationYears),
      residualFloor: Number(formFields.residualFloor),
      purchaseDate: formFields.purchaseDate ? new Date(formFields.purchaseDate).toISOString() : null,
      performedBy: 'admin'
    };
    try {
      if (editingItem && editingItem.id !== '1' && editingItem.id !== '2' && editingItem.id !== '3') {
        await api.put(`/depreciations/${editingItem.id}`, dataToSend);
      } else {
        await api.post('/depreciations', dataToSend);
      }
      setIsOpen(false);
      fetchAll();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Erreur inconnue';
      alert('Erreur lors de l\'enregistrement : ' + msg);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Supprimer cette fiche d\'amortissement ?')) {
      try {
        await api.delete(`/depreciations/${id}?performedBy=admin`);
        fetchAll();
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Erreur inconnue';
        alert('Erreur lors de la suppression : ' + msg);
      }
    }
  };

  const exportToExcel = () => {
    const headers = ["Code Actif", "Désignation", "Date Achat", "Coût Initial", "Durée", "Méthode", "VNC Actuelle", "% Amorti", "Statut"];
    
    const rows = filtered.map(r => [
      r.assetCode,
      r.assetName,
      new Date(r.purchaseDate).toLocaleDateString('fr-FR'),
      r.initialCost.toString(),
      `${r.durationYears} ans`,
      r.method === 'Degressive' ? 'Dégressive' : 'Linéaire',
      r.vnc.toString(),
      r.pctAmorti.toFixed(1) + '%',
      r.alert.label
    ]);
    
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(";"))].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `amortissements_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres surgissantes (popups) pour pouvoir exporter en PDF.");
      return;
    }
    
    const rowsHtml = filtered.map(r => `
      <tr>
        <td style="font-family: monospace; font-weight: bold; color: #7c3aed;">${r.assetCode}</td>
        <td><b>${r.assetName}</b></td>
        <td>${new Date(r.purchaseDate).toLocaleDateString('fr-FR')}</td>
        <td>${fmt(r.initialCost)}</td>
        <td style="text-align: center;">${r.durationYears} ans</td>
        <td>${r.method === 'Degressive' ? 'Dégressive' : 'Linéaire'}</td>
        <td><b>${fmt(r.vnc)}</b></td>
        <td><b>${fmtPct(r.pctAmorti)}</b></td>
        <td><span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: ${r.alert.bg}; color: ${r.alert.color};">${r.alert.label}</span></td>
      </tr>
    `).join('');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Export Amortissements - KPSyDesk ITAM</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1f2937; line-height: 1.5; }
            h1 { color: #111827; margin-bottom: 5px; font-size: 24px; font-weight: 700; }
            p.meta { color: #6b7280; margin-bottom: 25px; font-size: 13px; border-bottom: 1px solid #e5e7eb; padding-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #e5e7eb; padding: 12px 10px; text-align: left; font-size: 11px; vertical-align: top; }
            th { background-color: #f9fafb; color: #374151; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
            tr:nth-child(even) { background-color: #fafafa; }
            @media print {
              body { padding: 0; }
              @page { size: A4 landscape; margin: 1.5cm; }
            }
          </style>
        </head>
        <body>
          <h1>Rapport d'Amortissement & Cycle de Vie des Actifs IT</h1>
          <p class="meta">
            Rapport généré le ${new Date().toLocaleDateString()} à ${new Date().toLocaleTimeString()}<br/>
            Filtres : Alerte : ${filterAlert || 'Toutes'}
            ${filterStartDate || filterEndDate ? ` | Période d'acquisition : ${filterStartDate || 'Début'} au ${filterEndDate || 'Fin'}` : ''}
          </p>
          <table>
            <thead>
              <tr>
                <th>Code Actif</th>
                <th>Désignation</th>
                <th>Date Achat</th>
                <th>Coût Initial</th>
                <th>Durée</th>
                <th>Méthode</th>
                <th>VNC Actuelle</th>
                <th>% Amorti</th>
                <th>Statut / Alerte</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Calcul prévisuel en temps réel dans le formulaire
  const previewCalc = useMemo(() => {
    if (!formFields.purchaseDate || !formFields.initialCost || !formFields.durationYears) return null;
    const dummyRecord: DepreciationRecord = {
      id: 'preview', ...formFields,
      initialCost: Number(formFields.initialCost),
      durationYears: Number(formFields.durationYears),
      residualFloor: Number(formFields.residualFloor),
    };
    return computeDepreciation(dummyRecord);
  }, [formFields]);

  const cardStyle = (color: string): React.CSSProperties => ({
    background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
    border: `1px solid ${color}40`,
    borderRadius: '12px',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1
  });

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px', background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px', boxSizing: 'border-box'
  };

  return (
    <div className="fade-in">
      {/* ── En-tête ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="ph-duotone ph-chart-line-down" style={{ color: '#a78bfa' }} />
            Amortissement & Cycle de Vie
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Suivi comptable, dépréciation linéaire/dégressive et alertes de fin de vie des actifs IT</p>
        </div>
        <button className="btn-primary" onClick={openAdd} style={{ background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', border: 'none' }}>
          <i className="ph ph-plus" /> Nouvelle Fiche
        </button>
      </div>

      {/* ── 4 Cartes statistiques ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={cardStyle('#7c3aed')}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valeur Brute Totale</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a78bfa' }}>{fmt(stats.totalBrut)}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{records.length} actifs suivis</span>
        </div>
        <div style={cardStyle('#22c55e')}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valeur Nette Comptable (VNC)</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e' }}>{fmt(stats.totalVNC)}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {stats.totalBrut > 0 ? fmtPct(((stats.totalBrut - stats.totalVNC) / stats.totalBrut) * 100) + ' déprécié' : '-'}
          </span>
        </div>
        <div style={cardStyle('#ef4444')}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actifs Totalement Amortis</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{stats.totalAmortis}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>À réformer / recenser</span>
        </div>
        <div style={cardStyle('#f97316')}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fin de Vie Proche (≥ 80%)</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f97316' }}>{stats.totalFinDeVie}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>À planifier en remplacement</span>
        </div>
      </div>

      {/* ── Bandeau d'alertes ─────────────────────────────────────────────────── */}
      {criticalAlerts.length > 0 && (
        <div style={{ marginBottom: '1.5rem', padding: '14px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #7f1d1d20, #ef444410)', border: '1px solid #ef444440' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <i className="ph ph-warning-circle" style={{ color: '#ef4444', fontSize: '1.3rem' }} />
            <strong style={{ color: '#ef4444' }}>{criticalAlerts.length} actif(s) nécessitent une attention immédiate</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {criticalAlerts.map(r => (
              <span key={r.id} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', background: r.alert.bg, color: r.alert.color, border: `1px solid ${r.alert.color}40` }}>
                <i className="ph ph-arrow-right" /> {r.assetCode} — {r.assetName} ({fmtPct(r.pctAmorti)})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Tableau principal ─────────────────────────────────────────────────── */}
      <div className="module-container">
        {/* Filtres */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.25rem 0.75rem', flex: 1, minWidth: '180px' }}>
            <i className="ph ph-magnifying-glass" style={{ color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Rechercher un actif..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%' }} />
          </div>
          <select value={filterAlert} onChange={e => setFilterAlert(e.target.value)}
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.5rem', color: 'white' }}>
            <option value="">Toutes les alertes</option>
            <option value="critical">🔴 Amortis à 100%</option>
            <option value="warning">🟠 Fin de vie (≥ 80%)</option>
            <option value="info">🟡 À surveiller (≥ 50%)</option>
            <option value="ok">🟢 En cours</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Acquisition du</span>
            <input 
              type="date" 
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.4rem 0.5rem', color: 'white', fontSize: '0.85rem' }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>au</span>
            <input 
              type="date" 
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.4rem 0.5rem', color: 'white', fontSize: '0.85rem' }}
            />
            {(filterStartDate || filterEndDate) && (
              <button 
                type="button" 
                onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '0.85rem', cursor: 'pointer', padding: '0.2rem' }}
              >
                Effacer
              </button>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            <button 
              type="button"
              onClick={exportToExcel}
              className="btn-icon" 
              style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', cursor: 'pointer' }}
              title="Exporter vers Excel"
            >
              <i className="ph ph-file-xls" style={{ color: '#10b981' }}></i> Excel
            </button>
            <button 
              type="button"
              onClick={exportToPDF}
              className="btn-icon" 
              style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', cursor: 'pointer' }}
              title="Exporter au format PDF / Imprimer"
            >
              <i className="ph ph-file-pdf" style={{ color: '#ef4444' }}></i> PDF
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code Actif</th>
                <th>Désignation</th>
                <th>Date Achat</th>
                <th>Coût Initial</th>
                <th>Durée</th>
                <th>Méthode</th>
                <th>VNC Actuelle</th>
                <th>% Amorti</th>
                <th>Statut / Alerte</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Chargement...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  <i className="ph ph-chart-line-down" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px', opacity: 0.4 }} />
                  Aucune fiche d'amortissement. Cliquez sur "Nouvelle Fiche" pour commencer.
                </td></tr>
              ) : (
                filtered.map((r: any) => {
                  // Progress bar color
                  const barColor = r.pctAmorti >= 100 ? '#ef4444' : r.pctAmorti >= 80 ? '#f97316' : r.pctAmorti >= 50 ? '#eab308' : '#22c55e';
                  return (
                    <tr key={r.id}>
                      <td><strong style={{ fontFamily: 'monospace', color: '#a78bfa' }}>{r.assetCode}</strong></td>
                      <td>{r.assetName}</td>
                      <td>{new Date(r.purchaseDate).toLocaleDateString('fr-FR')}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{fmt(r.initialCost)}</td>
                      <td style={{ textAlign: 'center' }}>{r.durationYears} ans</td>
                      <td>
                        <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: '4px', background: r.method === 'Degressive' ? '#7c3aed20' : '#06b6d420', color: r.method === 'Degressive' ? '#a78bfa' : '#22d3ee' }}>
                          {r.method === 'Degressive' ? '📉 Dégressive' : '📊 Linéaire'}
                        </span>
                      </td>
                      <td><strong style={{ color: barColor }}>{fmt(r.vnc)}</strong></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '100px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                            <span style={{ color: barColor }}>{fmtPct(r.pctAmorti)}</span>
                          </div>
                          <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, r.pctAmorti)}%`, background: barColor, borderRadius: '3px', transition: 'width 0.3s ease' }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, background: r.alert.bg, color: r.alert.color, border: `1px solid ${r.alert.color}30`, whiteSpace: 'nowrap' }}>
                          {r.alert.level === 'critical' && <i className="ph ph-warning-circle" />}
                          {r.alert.level === 'warning' && <i className="ph ph-clock-countdown" />}
                          {r.alert.level === 'info' && <i className="ph ph-eye" />}
                          {r.alert.level === 'ok' && <i className="ph ph-check-circle" />}
                          {r.alert.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn-icon" onClick={() => openEdit(r)} title="Modifier">
                            <i className="ph ph-pencil-simple" />
                          </button>
                          <button className="btn-icon" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleDelete(r.id)} title="Supprimer">
                            <i className="ph ph-trash" />
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

      {/* ── Modal de saisie ───────────────────────────────────────────────────── */}
      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '640px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
              <i className="ph-duotone ph-chart-line-down" style={{ fontSize: '1.5rem', color: '#a78bfa' }} />
              <h2 style={{ margin: 0 }}>{editingItem ? 'Modifier la fiche d\'amortissement' : 'Nouvelle fiche d\'amortissement'}</h2>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                {/* Sélection actif depuis la liste — rechargée automatiquement */}
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <label style={{ fontSize: '0.85rem' }}>Sélectionner un actif de l'inventaire</label>
                    <button
                      type="button"
                      onClick={refreshAssets}
                      disabled={isLoadingAssets}
                      style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <i className={`ph ${isLoadingAssets ? 'ph-circle-notch' : 'ph-arrows-clockwise'}`}
                        style={{ animation: isLoadingAssets ? 'spin 1s linear infinite' : 'none' }} />
                      {isLoadingAssets ? 'Chargement...' : 'Actualiser la liste'}
                    </button>
                  </div>
                  <select
                    value={selectedAssetDropdown}
                    onChange={handleAssetSelect}
                    style={{ ...inputStyle, borderColor: selectedAssetDropdown ? '#a78bfa' : 'var(--border-color)' }}
                    disabled={isLoadingAssets}
                  >
                    <option value="">-- Choisir un actif dans l'inventaire ({assets.length} actifs disponibles) --</option>
                    {/* Groupe 1 : actifs sans fiche d'amortissement */}
                    {assets.filter(a => !records.some(r => r.assetCode === a.inventoryCode)).length > 0 && (
                      <optgroup label="✅ Sans fiche d'amortissement (nouveaux)">
                        {assets
                          .filter(a => !records.some(r => r.assetCode === a.inventoryCode))
                          .sort((a, b) => a.inventoryCode.localeCompare(b.inventoryCode))
                          .map(a => (
                            <option key={a.id} value={a.inventoryCode}>
                              {a.inventoryCode} — {a.name}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {/* Groupe 2 : actifs avec fiche existante */}
                    {assets.filter(a => records.some(r => r.assetCode === a.inventoryCode)).length > 0 && (
                      <optgroup label="📊 Déjà suivis (modifier la fiche existante)">
                        {assets
                          .filter(a => records.some(r => r.assetCode === a.inventoryCode))
                          .sort((a, b) => a.inventoryCode.localeCompare(b.inventoryCode))
                          .map(a => (
                            <option key={a.id} value={a.inventoryCode}>
                              {a.inventoryCode} — {a.name} [fiche existante]
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                  {assets.length === 0 && !isLoadingAssets && (
                    <p style={{ fontSize: '0.78rem', color: '#f97316', marginTop: '4px' }}>
                      <i className="ph ph-warning" /> Aucun actif trouvé. Vérifiez la connexion au serveur ou créez d'abord des actifs dans l'inventaire.
                    </p>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Code Inventaire *</label>
                  <input type="text" value={formFields.assetCode} onChange={e => setFormFields({ ...formFields, assetCode: e.target.value })}
                    style={inputStyle} placeholder="INV-XXXX-XXX" required />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Désignation / Nom *</label>
                  <input type="text" value={formFields.assetName} onChange={e => setFormFields({ ...formFields, assetName: e.target.value })}
                    style={inputStyle} placeholder="Ex: Dell Latitude 5520" required />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Date d'acquisition *</label>
                  <input type="date" value={formFields.purchaseDate} onChange={e => setFormFields({ ...formFields, purchaseDate: e.target.value })}
                    style={inputStyle} required />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Coût d'acquisition (FCFA) *</label>
                  <input type="number" value={formFields.initialCost} onChange={e => setFormFields({ ...formFields, initialCost: Number(e.target.value) })}
                    style={inputStyle} min={0} required />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Durée d'amortissement (années) *</label>
                  <select value={formFields.durationYears} onChange={e => setFormFields({ ...formFields, durationYears: Number(e.target.value) })} style={inputStyle}>
                    <option value={3}>3 ans (périphériques)</option>
                    <option value={5}>5 ans (PC portables / de bureau)</option>
                    <option value={7}>7 ans (équipements réseau)</option>
                    <option value={10}>10 ans (serveurs / équipements lourds)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Méthode d'amortissement</label>
                  <select value={formFields.method} onChange={e => setFormFields({ ...formFields, method: e.target.value })} style={inputStyle}>
                    <option value="Lineaire">📊 Linéaire (constant)</option>
                    <option value="Degressive">📉 Dégressive (accéléré × 2)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Valeur résiduelle plancher (FCFA)</label>
                  <input type="number" value={formFields.residualFloor} onChange={e => setFormFields({ ...formFields, residualFloor: Number(e.target.value) })}
                    style={inputStyle} min={0} placeholder="0 ou 1 FCFA symbolique" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Notes comptables</label>
                  <textarea value={formFields.notes} onChange={e => setFormFields({ ...formFields, notes: e.target.value })}
                    style={{ ...inputStyle, height: '70px', resize: 'vertical' }}
                    placeholder="Remarques, justifications, décisions de gestion..." />
                </div>
              </div>

              {/* Aperçu calculé en temps réel */}
              {previewCalc && formFields.initialCost > 0 && (
                <div style={{ marginBottom: '16px', padding: '14px', borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed15, #a78bfa08)', border: '1px solid #a78bfa40' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <i className="ph ph-calculator" style={{ color: '#a78bfa' }} />
                    <strong style={{ color: '#a78bfa', fontSize: '0.9rem' }}>Aperçu de l'amortissement (calculé en temps réel)</strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '0.82rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Années écoulées</div>
                      <div style={{ fontWeight: 700, color: 'white', fontSize: '1.1rem' }}>{previewCalc.yearsElapsed.toFixed(1)} ans</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>VNC Actuelle</div>
                      <div style={{ fontWeight: 700, color: '#22c55e', fontSize: '1.1rem' }}>{fmt(previewCalc.vnc)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>% Amorti</div>
                      <div style={{ fontWeight: 700, color: previewCalc.pctAmorti >= 100 ? '#ef4444' : previewCalc.pctAmorti >= 80 ? '#f97316' : '#a78bfa', fontSize: '1.1rem' }}>
                        {fmtPct(previewCalc.pctAmorti)}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, previewCalc.pctAmorti)}%`, background: previewCalc.pctAmorti >= 100 ? '#ef4444' : previewCalc.pctAmorti >= 80 ? '#f97316' : '#a78bfa', transition: 'width 0.3s ease', borderRadius: '4px' }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => setIsOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary" style={{ background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', border: 'none' }}>
                  <i className="ph ph-floppy-disk" /> Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
