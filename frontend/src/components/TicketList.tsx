import React, { useEffect, useState } from 'react';
import { api } from '../api';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

interface Ticket {
  id: string;
  title: string;
  creator: string | { firstName: string; lastName: string } | null;
  status: Status;
  priority: Priority;
  createdAt: string;
}

const mockTickets: Ticket[] = [
  { id: 'T-1001', title: 'Mon PC ne s\'allume plus', creator: 'Jean Dupont', status: 'OPEN', priority: 'HIGH', createdAt: '2026-04-29T10:30:00Z' },
  { id: 'T-1002', title: 'Demande accès VPN', creator: 'Alice Martin', status: 'IN_PROGRESS', priority: 'MEDIUM', createdAt: '2026-04-28T14:15:00Z' },
  { id: 'T-1003', title: 'Serveur de fichiers très lent', creator: 'Admin Système', status: 'OPEN', priority: 'CRITICAL', createdAt: '2026-04-29T08:00:00Z' },
];

const priorityColors: Record<Priority, { bg: string; text: string }> = {
  LOW: { bg: 'rgba(16, 185, 129, 0.1)', text: 'var(--success)' },
  MEDIUM: { bg: 'var(--accent-soft)', text: 'var(--accent-primary)' },
  HIGH: { bg: 'rgba(245, 158, 11, 0.1)', text: 'var(--warning)' },
  CRITICAL: { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--danger)' },
};

const statusLabels: Record<Status, string> = {
  OPEN: 'Nouveau',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolu',
  CLOSED: 'Fermé',
};

export const TicketList: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>(mockTickets);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const res = await api.get('/tickets');
        if (res.data && Array.isArray(res.data)) {
          setTickets(res.data);
        }
      } catch (err) {
        console.warn('API backend inaccessible. Utilisation des données de tickets simulées.', err);
      }
    };
    fetchTickets();
  }, []);

  return (
    <div className="module-container">
      <div className="module-header">
        <h2>Helpdesk & Tickets</h2>
        <button className="btn-primary">Nouveau Ticket</button>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Titre du ticket</th>
              <th>Demandeur</th>
              <th>Priorité</th>
              <th>Statut</th>
              <th>Date de création</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td className="fw-500">{ticket.id.substring(0, 8)}</td>
                <td className="text-truncate" style={{ maxWidth: '250px' }}>{ticket.title}</td>
                <td>
                  {typeof ticket.creator === 'string'
                    ? ticket.creator
                    : (ticket.creator ? `${ticket.creator.firstName} ${ticket.creator.lastName}` : 'Anonyme')}
                </td>
                <td>
                  <span 
                    className="priority-badge"
                    style={{ 
                      backgroundColor: priorityColors[ticket.priority]?.bg || 'rgba(16, 185, 129, 0.1)', 
                      color: priorityColors[ticket.priority]?.text || 'var(--success)' 
                    }}
                  >
                    {ticket.priority}
                  </span>
                </td>
                <td>{statusLabels[ticket.status] || ticket.status}</td>
                <td>{new Date(ticket.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


