import React, { useEffect, useState } from 'react';
import { api } from '../api';

// Types simulés basés sur notre Prisma Schema
type AssetStatus = 'IN_STOCK' | 'ASSIGNED' | 'BROKEN' | 'IN_MAINTENANCE' | 'OBSOLETE' | 'RETIRED' | 'LOST';

interface Asset {
  id: string;
  inventoryCode: string;
  name: string;
  type: string;
  status: AssetStatus;
  warrantyEnd: string;
}

const mockAssets: Asset[] = [
  { id: '1', inventoryCode: 'PC-LT-001', name: 'Dell XPS 15', type: 'Matériel', status: 'ASSIGNED', warrantyEnd: '2025-12-01' },
  { id: '2', inventoryCode: 'MAC-002', name: 'MacBook Pro M2', type: 'Matériel', status: 'IN_STOCK', warrantyEnd: '2026-05-15' },
  { id: '3', inventoryCode: 'SRV-001', name: 'Serveur HP ProLiant', type: 'Matériel', status: 'BROKEN', warrantyEnd: '2024-01-10' },
  { id: '4', inventoryCode: 'LIC-OFF-01', name: 'Licence Office 365', type: 'Logiciel', status: 'ASSIGNED', warrantyEnd: '2026-11-20' },
];

const statusColors: Record<AssetStatus, { bg: string; text: string }> = {
  IN_STOCK: { bg: 'rgba(16, 185, 129, 0.1)', text: 'var(--success)' },
  ASSIGNED: { bg: 'var(--accent-soft)', text: 'var(--accent-primary)' },
  BROKEN: { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--danger)' },
  IN_MAINTENANCE: { bg: 'rgba(245, 158, 11, 0.1)', text: 'var(--warning)' },
  OBSOLETE: { bg: 'rgba(148, 163, 184, 0.1)', text: 'var(--text-muted)' },
  RETIRED: { bg: 'rgba(51, 65, 85, 0.5)', text: 'var(--text-secondary)' },
  LOST: { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--danger)' },
};

export const AssetList: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>(mockAssets);

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await api.get('/assets');
        if (res.data && Array.isArray(res.data)) {
          setAssets(res.data);
        }
      } catch (err) {
        console.warn('API backend inaccessible. Utilisation des données d\'actifs simulées.', err);
      }
    };
    fetchAssets();
  }, []);

  return (
    <div className="module-container">
      <div className="module-header">
        <h2>Gestion des Actifs (CMDB)</h2>
        <button className="btn-primary">Ajouter un Actif</button>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code Inventaire</th>
              <th>Nom</th>
              <th>Type</th>
              <th>Statut</th>
              <th>Fin de Garantie</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id}>
                <td className="fw-500">{asset.inventoryCode}</td>
                <td>{asset.name}</td>
                <td>{asset.type}</td>
                <td>
                  <span 
                    className="status-badge"
                    style={{ 
                      backgroundColor: statusColors[asset.status].bg, 
                      color: statusColors[asset.status].text 
                    }}
                  >
                    {asset.status}
                  </span>
                </td>
                <td>{new Date(asset.warrantyEnd).toLocaleDateString()}</td>
                <td>
                  <button className="btn-icon">Détails</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


