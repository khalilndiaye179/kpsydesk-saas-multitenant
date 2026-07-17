import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface OnboardingTasks {
  account: boolean;
  hardware: boolean;
  badge: boolean;
  access: boolean;
}

interface Onboarding {
  id: string;
  type: string; // Onboarding, Offboarding
  employeeName: string;
  department: string;
  position: string;
  startDate: string;
  status: string; // En cours, Terminé, Annulé
  tasks?: OnboardingTasks;
}

export const OnboardingView: React.FC = () => {
  const [items, setItems] = useState<Onboarding[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Onboarding | null>(null);

  // Form Fields
  const [formFields, setFormFields] = useState({
    type: 'Onboarding',
    employeeName: '',
    department: '',
    position: '',
    startDate: '',
    status: 'En cours',
    tasks: {
      account: false,
      hardware: false,
      badge: false,
      access: false
    }
  });

  const fetchItems = async () => {
    try {
      const res = await api.get('/onboardings');
      setItems(res.data || []);
    } catch (err) {
      console.warn('API error in OnboardingView. Using fallback.', err);
      setItems([
        { 
          id: '1', 
          type: 'Onboarding', 
          employeeName: 'Fatou Diop', 
          department: 'Marketing', 
          position: 'Chef de Projet', 
          startDate: '2026-06-01', 
          status: 'En cours', 
          tasks: { account: true, hardware: false, badge: false, access: false } 
        }
      ]);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    setFormFields({
      type: 'Onboarding',
      employeeName: '',
      department: '',
      position: '',
      startDate: new Date().toISOString().split('T')[0],
      status: 'En cours',
      tasks: {
        account: false,
        hardware: false,
        badge: false,
        access: false
      }
    });
    setIsOpen(true);
  };

  const openEditModal = (item: Onboarding) => {
    setEditingItem(item);
    setFormFields({
      type: item.type,
      employeeName: item.employeeName,
      department: item.department,
      position: item.position,
      startDate: item.startDate ? item.startDate.split('T')[0] : '',
      status: item.status,
      tasks: item.tasks || { account: false, hardware: false, badge: false, access: false }
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSend = {
      ...formFields,
      performedBy: 'admin'
    };

    try {
      if (editingItem && editingItem.id !== '1') {
        await api.put(`/onboardings/${editingItem.id}`, dataToSend);
      } else {
        await api.post('/onboardings', dataToSend);
      }
      setIsOpen(false);
      fetchItems();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Erreur inconnue";
      alert(`Erreur lors de la sauvegarde du processus: ${errorMessage}`);
    }
  };

  const toggleTask = async (item: Onboarding, taskKey: keyof OnboardingTasks) => {
    const updatedTasks = {
      ...(item.tasks || { account: false, hardware: false, badge: false, access: false }),
      [taskKey]: !(item.tasks?.[taskKey])
    };

    try {
      await api.put(`/onboardings/${item.id}`, {
        tasks: updatedTasks,
        performedBy: 'admin'
      });
      fetchItems();
    } catch (err) {
      console.warn("Failed to update task via API, updating state locally.");
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, tasks: updatedTasks } : i));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Supprimer ce processus d'onboarding ?")) {
      try {
        await api.delete(`/onboardings/${id}?performedBy=admin`);
        fetchItems();
      } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur lors de la suppression : " + msg); }
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Onboarding & Offboarding</h1>
          <p style={{ color: 'var(--text-muted)' }}>Suivi de l'intégration et du départ des collaborateurs (RH)</p>
        </div>
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ph ph-plus"></i> Nouveau Processus
        </button>
      </div>

      <div className="module-container">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Employé</th>
                <th>Département</th>
                <th>Poste</th>
                <th>Date d'effet</th>
                <th>Tâches IT (Checklist)</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun processus d'onboarding/offboarding</td>
                </tr>
              ) : (
                items.map(item => {
                  const tasks = item.tasks || { account: false, hardware: false, badge: false, access: false };
                  return (
                    <tr key={item.id}>
                      <td>
                        <span className={`status-badge ${item.type === 'Onboarding' ? 'success' : 'warning'}`}>
                          {item.type}
                        </span>
                      </td>
                      <td><strong>{item.employeeName}</strong></td>
                      <td>{item.department}</td>
                      <td>{item.position}</td>
                      <td>{new Date(item.startDate).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={tasks.account} onChange={() => toggleTask(item, 'account')} />
                            Compte
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={tasks.hardware} onChange={() => toggleTask(item, 'hardware')} />
                            Matériel
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={tasks.badge} onChange={() => toggleTask(item, 'badge')} />
                            Badge
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={tasks.access} onChange={() => toggleTask(item, 'access')} />
                            Accès
                          </label>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${item.status === 'Terminé' ? 'success' : item.status === 'En cours' ? 'warning' : 'danger'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-icon" onClick={() => openEditModal(item)}>
                            <i className="ph ph-pencil-simple"></i>
                          </button>
                          <button className="btn-icon" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleDelete(item.id)}>
                            <i className="ph ph-trash"></i>
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

      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '550px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingItem ? 'Modifier le processus' : 'Nouveau processus'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '15px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Type de processus</label>
                    <select 
                      value={formFields.type} 
                      onChange={e => setFormFields({...formFields, type: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    >
                      <option value="Onboarding">Onboarding (Arrivée)</option>
                      <option value="Offboarding">Offboarding (Départ)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Nom de l'employé</label>
                    <input 
                      type="text" 
                      value={formFields.employeeName} 
                      onChange={e => setFormFields({...formFields, employeeName: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Département</label>
                    <input 
                      type="text" 
                      value={formFields.department} 
                      onChange={e => setFormFields({...formFields, department: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Poste</label>
                    <input 
                      type="text" 
                      value={formFields.position} 
                      onChange={e => setFormFields({...formFields, position: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Date d'effet</label>
                    <input 
                      type="date" 
                      value={formFields.startDate} 
                      onChange={e => setFormFields({...formFields, startDate: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Statut</label>
                    <select 
                      value={formFields.status} 
                      onChange={e => setFormFields({...formFields, status: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    >
                      <option value="En cours">En cours</option>
                      <option value="Terminé">Terminé</option>
                      <option value="Annulé">Annulé</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Tâches IT initiales</label>
                  <div style={{ display: 'flex', gap: '20px', background: 'var(--bg-primary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={formFields.tasks.account} 
                        onChange={e => setFormFields({...formFields, tasks: {...formFields.tasks, account: e.target.checked}})} 
                      />
                      Compte
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={formFields.tasks.hardware} 
                        onChange={e => setFormFields({...formFields, tasks: {...formFields.tasks, hardware: e.target.checked}})} 
                      />
                      Matériel
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={formFields.tasks.badge} 
                        onChange={e => setFormFields({...formFields, tasks: {...formFields.tasks, badge: e.target.checked}})} 
                      />
                      Badge
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={formFields.tasks.access} 
                        onChange={e => setFormFields({...formFields, tasks: {...formFields.tasks, access: e.target.checked}})} 
                      />
                      Accès
                    </label>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => setIsOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


