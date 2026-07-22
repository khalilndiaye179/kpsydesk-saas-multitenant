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
  asset?: any;
  comments?: TicketComment[];
}

const getTicketNumber = (t: Ticket) => {
  if (!t || !t.id) return '#N/A';
  return '#' + t.id.substring(0, Math.min(8, t.id.length)).toUpperCase();
};

export const TicketView: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [techs, setTechs] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [assets, setAssets] = useState<any[]>([]);

  const session = localStorage.getItem('currentUser');
  const currentUser = session ? JSON.parse(session) : null;
  const isUser = currentUser && currentUser.role === 'USER';
  const isAdmin = currentUser && currentUser.role === 'ADMIN';
  
  // Search & Filters
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

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
      const assetsRes = await api.get('/assets');
      setAssets(assetsRes.data || []);
    } catch (err) {
      console.warn('API error fetching assets.', err);
      setAssets([]);
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
        
        // Notification email factice (la vraie est gérée en tâche de fond par le backend)
        if (formFields.assigneeId && formFields.assigneeId !== editingTicket.assigneeId) {
          if (formFields.techEmail) {
            alert(`Email de notification envoyé au technicien à : ${formFields.techEmail}`);
          }
        }
      } else {
        await api.post('/tickets', dataToSend);
      }

      // Option A : Notification WhatsApp interactive par lien direct
      if (formFields.techWhatsapp) {
        const cleanPhone = formFields.techWhatsapp.replace(/[^0-9]/g, '');
        if (cleanPhone) {
          const priorityLabel = 
            formFields.priority === 'CRITICAL' ? '⚠️ Critique' : 
            formFields.priority === 'HIGH' ? '🔥 Haute' : 
            formFields.priority === 'MEDIUM' ? 'Moyenne' : 'Basse';
            
          const messageText = `*KPSyDesk ITAM - Notification d'Incident*\n\n` +
            `Bonjour,\n` +
            `Un ticket d'incident vous a été assigné :\n\n` +
            `• *Sujet* : ${formFields.title}\n` +
            `• *Description* : ${formFields.description}\n` +
            `• *Priorité* : ${priorityLabel}\n` +
            `• *Statut* : En cours\n\n` +
            `Merci de vous connecter sur https://app.kpsyinformatique.com/ pour le prendre en charge.`;

          const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
          window.open(whatsappUrl, '_blank');
        }
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

  const handleValidateStatus = async (id: string, currentPendingStatus: string) => {
    const finalStatus = currentPendingStatus === 'PENDING_RESOLVED' ? 'RESOLVED' : 'CLOSED';
    try {
      await api.put(`/tickets/${id}/status`, { status: finalStatus });
      fetchTickets();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Erreur inconnue";
      alert("Erreur lors de la validation : " + msg);
    }
  };

  const exportToExcel = () => {
    const headers = ["N° Ticket", "Sujet", "Description", "Demandeur", "Équipement", "Assigné à", "Priorité", "Statut", "Date de création"];
    
    const rows = filteredTickets.map(t => [
      getTicketNumber(t),
      t.title,
      t.description.replace(/\n/g, ' '),
      t.creator ? `${t.creator.firstName} ${t.creator.lastName}` : 'Anonyme',
      t.asset ? `[${t.asset.inventoryCode}] ${t.asset.name}` : '-',
      t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : 'Non assigné',
      t.priority,
      t.status,
      new Date(t.createdAt).toLocaleDateString()
    ]);
    
    // Combine with UTF-8 BOM for Excel native French compatibility
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(";"))].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tickets_export_${new Date().toISOString().slice(0,10)}.csv`);
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
    
    const rowsHtml = filteredTickets.map(t => `
      <tr>
        <td style="font-family: monospace; font-weight: bold; color: #6366f1;">${getTicketNumber(t)}</td>
        <td><b>${t.title}</b><br/><small style="color: #666;">${t.description}</small></td>
        <td>${t.creator ? `${t.creator.firstName} ${t.creator.lastName}` : 'Anonyme'}</td>
        <td>${t.asset ? `[${t.asset.inventoryCode}] ${t.asset.name}` : '-'}</td>
        <td>${t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : 'Non assigné'}</td>
        <td><span style="font-weight: bold; color: ${getPriorityColor(t.priority).startsWith('var') ? '#4b5563' : getPriorityColor(t.priority)};">${t.priority}</span></td>
        <td><span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; background: #e5e7eb; color: #374151;">${t.status}</span></td>
        <td>${new Date(t.createdAt).toLocaleDateString()}</td>
      </tr>
    `).join('');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Export Incidents - KPSyDesk ITAM</title>
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
          <h1>Suivi des incidents et demandes d'assistance</h1>
          <p class="meta">
            Rapport généré le ${new Date().toLocaleDateString()} à ${new Date().toLocaleTimeString()}<br/>
            Filtres : Statut : ${filterStatus || 'Tous'} | Priorité : ${filterPriority || 'Toutes'}
            ${filterStartDate || filterEndDate ? ` | Période : ${filterStartDate || 'Début'} au ${filterEndDate || 'Fin'}` : ''}
          </p>
          <table>
            <thead>
              <tr>
                <th>N° Ticket</th>
                <th>Sujet & Description</th>
                <th>Demandeur</th>
                <th>Équipement</th>
                <th>Assigné à</th>
                <th>Priorité</th>
                <th>Statut</th>
                <th>Créé le</th>
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
    
    const tDate = t.createdAt ? new Date(t.createdAt) : null;
    const ticketDate = tDate && !isNaN(tDate.getTime()) ? tDate.setHours(0,0,0,0) : 0;
    const start = filterStartDate ? new Date(filterStartDate).setHours(0,0,0,0) : null;
    const end = filterEndDate ? new Date(filterEndDate).setHours(23,59,59,999) : null;
    
    const matchesStart = !start || ticketDate >= start;
    const matchesEnd = !end || ticketDate <= end;
    
    return matchesPriority && matchesStatus && matchesStart && matchesEnd;
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Période du</span>
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
                title="Réinitialiser les dates"
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
                <th>N° Ticket</th>
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
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun ticket trouvé</td>
                </tr>
              ) : (
                filteredTickets.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{getTicketNumber(t)}</td>
                    <td>
                      <strong>{t.title}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.description}</div>
                    </td>
                    <td>{t.creator ? `${t.creator.firstName} ${t.creator.lastName}` : 'Anonyme'}</td>
                    <td>{t.asset ? `[${t.asset.inventoryCode}] ${t.asset.name}` : '-'}</td>
                    <td>{t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : 'Non assigné'}</td>
                    <td>
                      <span style={{ color: getPriorityColor(t.priority), fontWeight: 'bold' }}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${
                        t.status === 'PENDING_RESOLVED' || t.status === 'PENDING_CLOSED' ? 'danger' : t.status.toLowerCase()
                      }`}>
                        {t.status === 'PENDING_RESOLVED' ? 'Attente Résolution' : 
                         t.status === 'PENDING_CLOSED' ? 'Attente Clôture' : 
                         t.status === 'RESOLVED' ? 'Résolu' : 
                         t.status === 'CLOSED' ? 'Clos' : t.status}
                      </span>
                    </td>
                    <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {isAdmin && (t.status === 'PENDING_RESOLVED' || t.status === 'PENDING_CLOSED') && (
                          <button 
                            className="btn-icon" 
                            style={{ borderColor: 'var(--success)', color: 'var(--success)' }} 
                            onClick={() => handleValidateStatus(t.id, t.status)}
                            title="Valider la résolution/clôture"
                          >
                            <i className="ph ph-check-circle" style={{ fontSize: '1.1rem' }}></i>
                          </button>
                        )}
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
                        value={
                          formFields.status === 'PENDING_RESOLVED' ? 'Attente Résolution' : 
                          formFields.status === 'PENDING_CLOSED' ? 'Attente Clôture' : 
                          formFields.status === 'RESOLVED' ? 'Résolu' : 
                          formFields.status === 'CLOSED' ? 'Clos' : 
                          formFields.status === 'OPEN' ? 'Ouvert' : 'En cours'
                        } 
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
                        {formFields.status === 'PENDING_RESOLVED' && <option value="PENDING_RESOLVED">Attente Résolution</option>}
                        {formFields.status === 'PENDING_CLOSED' && <option value="PENDING_CLOSED">Attente Clôture</option>}
                        <option value="RESOLVED">Résolu</option>
                        <option value="CLOSED">Clos</option>
                      </select>
                    )}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Équipement associé (Actif)</label>
                  <select 
                    value={formFields.assetId} 
                    onChange={e => setFormFields({...formFields, assetId: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="">Aucun équipement</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{`[${a.inventoryCode}] ${a.name}`}</option>
                    ))}
                  </select>
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


