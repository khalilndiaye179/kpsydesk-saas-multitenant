import React, { useEffect, useState } from 'react';
import { api } from '../api';

type Role = 'USER' | 'TECHNICIAN' | 'ADMIN';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  department: string | { name: string } | null;
}

const mockUsers: User[] = [
  { id: '1', firstName: 'Jean', lastName: 'Dupont', email: 'jean.d@entreprise.com', role: 'USER', department: 'Ressources Humaines' },
  { id: '2', firstName: 'Alice', lastName: 'Martin', email: 'alice.m@entreprise.com', role: 'TECHNICIAN', department: 'IT Support' },
  { id: '3', firstName: 'Ibrahima', lastName: 'Ndiaye', email: 'admin@entreprise.com', role: 'ADMIN', department: 'Direction IT' },
  { id: '4', firstName: 'Sophie', lastName: 'Leroux', email: 'sophie.l@entreprise.com', role: 'USER', department: 'Marketing' },
];

const roleColors: Record<Role, { bg: string; text: string }> = {
  USER: { bg: 'rgba(148, 163, 184, 0.1)', text: 'var(--text-secondary)' },
  TECHNICIAN: { bg: 'var(--accent-soft)', text: 'var(--accent-primary)' },
  ADMIN: { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--danger)' },
};

export const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>(mockUsers);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/users');
        if (res.data && Array.isArray(res.data)) {
          setUsers(res.data);
        }
      } catch (err) {
        console.warn('API backend inaccessible. Utilisation des données d\'utilisateurs simulées.', err);
      }
    };
    fetchUsers();
  }, []);

  return (
    <div className="module-container">
      <div className="module-header">
        <h2>Gestion des Utilisateurs & Rôles</h2>
        <button className="btn-primary">Nouvel Utilisateur</button>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nom complet</th>
              <th>Email</th>
              <th>Département</th>
              <th>Rôle</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="fw-500">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                      {(user.firstName?.[0] || '')}{(user.lastName?.[0] || '')}
                    </div>
                    {user.firstName} {user.lastName}
                  </div>
                </td>
                <td>{user.email}</td>
                <td>
                  {typeof user.department === 'string'
                    ? user.department
                    : (user.department?.name || 'Aucun')}
                </td>
                <td>
                  <span 
                    className="status-badge"
                    style={{ 
                      backgroundColor: roleColors[user.role]?.bg || 'rgba(148, 163, 184, 0.1)', 
                      color: roleColors[user.role]?.text || 'var(--text-secondary)'
                    }}
                  >
                    {user.role}
                  </span>
                </td>
                <td>
                  <button className="btn-icon">Gérer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


