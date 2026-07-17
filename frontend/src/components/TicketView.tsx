import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
}

interface TicketComment {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string; // OPEN, IN_PROGRESS, RESOLVED, CLOSED
  priority: string; // LOW, MEDIUM, HIGH, CRITICAL
  createdAt: string;
  creatorId: string;
  creator?: User;
  assigneeId?: string;
  assignee?: User;
  assetId?: string;
  comments?: TicketComment[];
}

export const TicketView: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [techs, setTechs] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const session = localStorage.getItem('currentUser');
  const currentUser = session ? JSON.parse(session) : null;
  const isUser = currentUser && currentUser.role === 'USER';
  const isAdmin = currentUser && currentUser.role === 'ADMIN';
  
  // Search & Filters
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  // Form Fields
  const [formFields, setFormFields] = useState({
    title: '',
    description: '',
    status: 'OPEN',
    priority: 'MEDIUM',
    assigneeId: '',
    assetId: '',
    techEmail: '',
    techWhatsapp: ''
  });

  const fetchTickets = async () => {
    try {
      const ticketsRes = await api.get('/tickets');
      setTickets(ticketsRes.data || []);
    } catch (err) {
      console.warn('API error fetching tickets.', err);
      setTickets([]);
    }

    try {
      const usersRes = await api.get('/users');
      const allUsersData = usersRes.data || [];
      setAllUsers(allUsersData);
      setTechs(allUsersData.filter((u: any) => u.role === 'TECHNICIAN' || u.systemRole === 'Technicien IT'));
    } catch (err) {
      console.warn('API error fetching users (expected for USER role).', err);
      setAllUsers([]);
      setTechs([]);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const openAddModal = () => {
    setEditingTicket(null);
    setFormFields({
      title: '',
      description: '',
      status: 'OPEN',
      priority: 'MEDIUM',
      assigneeId: '',
      assetId: '',
      techEmail: '',
      techWhatsapp: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (t: Ticket) => {
    setEditingTicket(t);
    setFormFields({
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      assigneeId: t.assigneeId || '',
      assetId: t.assetId || '',
      techEmail: '',
      techWhatsapp: ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const session = localStorage.getItem('currentUser');
    let loggedInUserId = allUsers.length > 0 ? allUsers[0].id : '1';
    if (session) {
      try {
        const u = JSON.parse(session);
        if (u && u.id) loggedInUserId = u.id;
      } catch (e) {}
    }

    const dataToSend = {
      title: formFields.title,
      description: formFields.description,
      status: formFields.status,
      priority: formFields.priority,
      assigneeId: formFields.assigneeId === '' ? null : formFields.assigneeId,
      assetId: formFields.assetId === '' ? null : formFields.assetId,
      creatorId: loggedInUserId
    };

    try {
      if (editingTicket && editingTicket.id !== '1') {
        await api.put(`/tickets/${editingTicket.id}`, dataToSend);
        
        // Simuler les notifications si assignation modifiée
        if (formFields.assigneeId && formFields.assigneeId !== editingTicket.assigneeId) {
          if (formFields.techEmail) {
            alert(`Email de notification envoyé au technicien à : ${formFields.techEmail}`);
          }
          if (formFields.techWhatsapp) {
            alert(`Notification WhatsApp envoyée au technicien à : ${formFields.techWhatsapp}`);
          }
        }
      } else {
        await api.post('/tickets', dataToSend);
      }
      setIsModalOpen(false);
      fetchTickets();
    } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur lors de la sauvegarde du ticket : " + msg); }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Supprimer ce ticket ?")) {
      try {
        await api.delete(`/tickets/${id}`);
        fetchTickets();
      } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur lors de la suppression : " + msg); }
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p.toUpperCase()) {
      case 'CRITICAL': return 'var(--danger)';
      case 'HIGH': return 'var(--warning)';
      case 'MEDIUM': return 'var(--accent-primary)';
      default: return 'var(--text-muted)';
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesPriority = filterPriority === '' || t.priority === filterPriority;
    const matchesStatus = filterStatus === '' || t.status === filterStatus;
    return matchesPriority && matchesStatus;
  });

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Helpdesk</h1>
          <p style={{ color: 'var(--text-muted)' }}>Suivi des incidents et demandes d'assistance</p>
        </div>
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ph ph-plus"></i> Nouveau Ticket
        </button>
      </div>

      <div className="module-container">
        <div style={{ display: 'flex', gap: '15px', marginBottom: '1.5rem' }}>
          <select 
            value={filterPriority} 
            onChange={(e) => setFilterPriority(e.target.value)}
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.5rem', color: 'white' }}
          >
            <option value="">Toutes les priorités</option>
            <option value="CRITICAL">Critique</option>
            <option value="HIGH">Haute</option>
            <option value="MEDIUM">Moyenne</option>
            <option value="LOW">Basse</option>
          </select>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.5rem', color: 'white' }}
          >
            <option value="">Tous les statuts</option>
            <option value="OPEN">Ouvert</option>
            <option value="IN_PROGRESS">En cours</option>
            <option value="RESOLVED">Résolu</option>
            <option value="CLOSED">Clos</option>
          </select>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sujet</th>
                <th>Demandeur</th>
                <th>Équipement</th>
                <th>Assigné à</th>
                <th>Priorité</th>
                <th>Statut</th>
                <th>Créé le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun ticket trouvé</td>
                </tr>
              ) : (
                filteredTickets.map(t => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.title}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.description}</div>
                    </td>
                    <td>{t.creator ? `${t.creator.firstName} ${t.creator.lastName}` : 'Anonyme'}</td>
                    <td>{t.assetId || '-'}</td>
                    <td>{t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : 'Non assigné'}</td>
                    <td>
                      <span style={{ color: getPriorityColor(t.priority), fontWeight: 'bold' }}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${t.status.toLowerCase()}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-icon" onClick={() => openEditModal(t)}>
                          <i className="ph ph-pencil-simple"></i>
                        </button>
                        {isAdmin && (
                          <button className="btn-icon" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleDelete(t.id)}>
                            <i className="ph ph-trash"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '550px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingTicket ? "Modifier le Ticket" : "Créer un Ticket"}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Sujet du problème</label>
                  <input 
                    type="text" 
                    value={formFields.title} 
                    onChange={e => setFormFields({...formFields, title: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Description détaillée</label>
                  <textarea 
                    value={formFields.description} 
                    onChange={e => setFormFields({...formFields, description: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px', height: '80px' }}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Priorité</label>
                    <select 
                      value={formFields.priority} 
                      onChange={e => setFormFields({...formFields, priority: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    >
                      <option value="LOW">Basse</option>
                      <option value="MEDIUM">Moyenne</option>
                      <option value="HIGH">Haute</option>
                      <option value="CRITICAL">Critique</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Statut</label>
                    {isUser ? (
                      <input 
                        type="text" 
                        value={formFields.status} 
                        disabled 
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '6px' }}
                      />
                    ) : (
                      <select 
                        value={formFields.status} 
                        onChange={e => setFormFields({...formFields, status: e.target.value})} 
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      >
                        <option value="OPEN">Ouvert</option>
                        <option value="IN_PROGRESS">En cours</option>
                        <option value="RESOLVED">Résolu</option>
                        <option value="CLOSED">Clos</option>
                      </select>
                    )}
                  </div>
                </div>
                {!isUser && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Assigné au Technicien IT</label>
                    <select 
                      value={formFields.assigneeId} 
                      onChange={e => setFormFields({...formFields, assigneeId: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    >
                      <option value="">Non assigné</option>
                      {techs.map(t => (
                        <option key={t.id} value={t.id}>{`${t.firstName} ${t.lastName}`}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {!isUser && formFields.assigneeId && (
                  <div style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Options de notification</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.75rem' }}>Email de notification</label>
                        <input 
                          type="email" 
                          placeholder="tech@entreprise.com"
                          value={formFields.techEmail} 
                          onChange={e => setFormFields({...formFields, techEmail: e.target.value})} 
                          style={{ width: '100%', padding: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', fontSize: '0.8rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.75rem' }}>WhatsApp de notification</label>
                        <input 
                          type="text" 
                          placeholder="+221 xx xxx xx xx"
                          value={formFields.techWhatsapp} 
                          onChange={e => setFormFields({...formFields, techWhatsapp: e.target.value})} 
                          style={{ width: '100%', padding: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


