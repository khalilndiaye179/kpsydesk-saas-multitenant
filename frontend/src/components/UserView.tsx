import React, { useEffect, useState } from 'react';
import { api } from '../api';
import PasswordStrengthIndicator, { isPasswordValid } from './PasswordStrengthIndicator';

interface Asset {
  id: string;
  inventoryCode: string;
  name: string;
  type: string;
  status: string;
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  role: string;
  systemRole?: string;
  status?: string;
  entryDate?: string;
  country?: string;
  position?: string;
  departmentId?: string;
  department?: Department;
  assets?: Asset[];
  baseSalary?: number;
  transportAllowance?: number;
  isExecutive?: boolean;
}

export const UserView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [freeAssets, setFreeAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');

  // Sub-tab selection
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'departments'>('users');

  // Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Department CRUD states
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');
  
  // Form fields
  const [formFields, setFormFields] = useState({
    email: '',
    password: 'KPsy2026!',
    firstName: '',
    lastName: '',
    username: '',
    systemRole: 'Utilisateur Standard',
    status: 'Actif',
    entryDate: '',
    country: 'Sénégal',
    position: '',
    departmentId: '',
    baseSalary: '',
    transportAllowance: '',
    isExecutive: false
  });

  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assignTargetUser, setAssignTargetUser] = useState<User | null>(null);

  // Barre de progression Upload Collaborateurs Excel / CSV
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, pct: 0 });
  const [importDoneNotification, setImportDoneNotification] = useState<string | null>(null);

  const handleImportUsersXLSX = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event: any) => {
      const XLSX = (window as any).XLSX;
      if (!XLSX) {
        alert("Bibliothèque XLSX introuvable.");
        return;
      }

      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws) as any[];

        const totalRows = json.length;
        if (totalRows === 0) {
          alert("Le fichier Excel sélectionné est vide.");
          return;
        }

        setIsImporting(true);
        setImportProgress({ current: 0, total: totalRows, pct: 0 });

        let added = 0;
        for (let i = 0; i < json.length; i++) {
          const row = json[i];

          const getVal = (...possibleKeys: string[]): string | undefined => {
            for (const key of possibleKeys) {
              for (const rowKey of Object.keys(row)) {
                const cleanRowKey = rowKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                const cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                if (cleanRowKey === cleanKey) {
                  const val = row[rowKey];
                  if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
                }
              }
            }
            for (const key of possibleKeys) {
              for (const rowKey of Object.keys(row)) {
                const cleanRowKey = rowKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                const cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                if (cleanRowKey.includes(cleanKey)) {
                  const val = row[rowKey];
                  if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
                }
              }
            }
            return undefined;
          };

          const firstName = getVal("prenom", "firstname", "first name") || 'Collaborateur';
          const lastName = getVal("nom", "lastname", "last name") || 'Importé';
          const email = getVal("email", "e-mail", "courriel", "mail") || `user.${Date.now()}.${i}@kpsy.local`;
          let username = getVal("nom d'utilisateur", "username", "identifiant", "user name", "pseudo");

          if (!username && firstName && lastName) {
            const cleanFirst = firstName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
            const cleanLast = lastName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
            username = `${cleanFirst}.${cleanLast}`;
          }

          const position = getVal("poste", "fonction", "position", "job", "titre");
          const country = getVal("pays", "country") || 'Sénégal';
          const status = getVal("statut", "status") || 'Actif';
          const sysRoleStr = getVal("role", "role systeme", "systemrole") || 'Collaborateur';

          // Résolution intelligente du département (ou création automatique)
          const deptStr = getVal("departement", "department", "service", "direction");
          let departmentId: string | null = null;
          if (deptStr) {
            const matchedDept = departments.find(d => d.name.toLowerCase().includes(deptStr.toLowerCase()) || deptStr.toLowerCase().includes(d.name.toLowerCase()));
            if (matchedDept) {
              departmentId = matchedDept.id;
            } else {
              // Créer le département à la volée s'il n'existe pas encore
              try {
                const newDeptRes = await api.post('/departments', { name: deptStr });
                if (newDeptRes.data?.id) {
                  departmentId = newDeptRes.data.id;
                  setDepartments(prev => [...prev, newDeptRes.data]);
                }
              } catch (e) {
                console.warn("Impossible de créer le département", deptStr);
              }
            }
          }

          // Détermination du rôle d'accès
          let role = 'USER';
          if (sysRoleStr.toLowerCase().includes('admin')) role = 'ADMIN';
          else if (sysRoleStr.toLowerCase().includes('tech')) role = 'TECHNICIAN';

          const password = getVal("mot de passe", "password") || 'Kpsy2026!Pass';

          const payload: any = {
            firstName,
            lastName,
            username,
            email,
            position,
            country,
            status,
            systemRole: sysRoleStr,
            role,
            password,
            departmentId: departmentId || null
          };

          const rawSalary = getVal("salaire", "base salary", "salaire de base");
          if (rawSalary) payload.baseSalary = Number(rawSalary) || null;

          const rawTransport = getVal("transport", "prime transport", "indemnite");
          if (rawTransport) payload.transportAllowance = Number(rawTransport) || null;

          const rawExec = getVal("cadre", "executive");
          if (rawExec) payload.isExecutive = ['oui', 'yes', 'true', '1'].includes(rawExec.toLowerCase());

          try {
            await api.post('/users', payload);
            added++;
          } catch (err) {
            console.warn(`Erreur lors de l'import du collaborateur ligne ${i+1}`, err);
          }

          const currentCount = i + 1;
          const currentPct = Math.round((currentCount / totalRows) * 100);
          setImportProgress({ current: currentCount, total: totalRows, pct: currentPct });
        }

        setIsImporting(false);
        setImportDoneNotification(`🎉 Importation terminée avec succès : ${added} collaborateur(s) sur ${totalRows} enregistré(s) !`);
        fetchAllData();

        setTimeout(() => {
          setImportDoneNotification(null);
        }, 6000);
      } catch (err: any) {
        setIsImporting(false);
        console.error(err);
        const errorMsg = err.response?.data?.message || err.message || "Erreur de format";
        alert(`Erreur lors de l'importation du fichier Excel/CSV : ${errorMsg}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const fetchAllData = async () => {
    try {
      const [usersRes, assetsRes, deptsRes] = await Promise.all([
        api.get('/users'),
        api.get('/assets'),
        api.get('/departments')
      ]);
      setUsers(usersRes.data || []);
      
      const allAssets = assetsRes.data || [];
      setFreeAssets(allAssets.filter((a: any) => a.status === 'IN_STOCK'));

      setDepartments(deptsRes.data || []);
    } catch (err) {
      console.warn('API error in UserView.', err);
      setUsers([]);
      setFreeAssets([]);
      setDepartments([]);
    }
  };

  const openAddDeptModal = () => {
    setEditingDept(null);
    setDeptName('');
    setIsDeptModalOpen(true);
  };

  const openEditDeptModal = (dept: Department) => {
    setEditingDept(dept);
    setDeptName(dept.name);
    setIsDeptModalOpen(true);
  };

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await api.put(`/departments/${editingDept.id}`, { name: deptName });
      } else {
        await api.post('/departments', { name: deptName });
      }
      setIsDeptModalOpen(false);
      fetchAllData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Erreur inconnue";
      alert("Erreur lors de l'enregistrement du département : " + msg);
    }
  };

  const handleDeleteDept = async (id: string, name: string) => {
    const deptUsers = users.filter(u => u.departmentId === id);
    if (deptUsers.length > 0) {
      alert(`Impossible de supprimer le département "${name}" car il contient encore des collaborateurs (${deptUsers.length}).`);
      return;
    }
    if (confirm(`Voulez-vous supprimer le département "${name}" ?`)) {
      try {
        await api.delete(`/departments/${id}`);
        fetchAllData();
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || "Erreur inconnue";
        alert("Erreur lors de la suppression : " + msg);
      }
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setFormFields({
      email: '',
      password: 'KPsy2026!',
      firstName: '',
      lastName: '',
      username: '',
      systemRole: 'Utilisateur Standard',
      status: 'Actif',
      entryDate: new Date().toISOString().split('T')[0],
      country: 'Sénégal',
      position: '',
      departmentId: '',
      baseSalary: '',
      transportAllowance: '',
      isExecutive: false
    });
    setIsUserModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormFields({
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username || '',
      systemRole: user.systemRole || 'Utilisateur Standard',
      status: user.status || 'Actif',
      entryDate: user.entryDate ? user.entryDate.split('T')[0] : '',
      country: user.country || 'Sénégal',
      position: user.position || '',
      departmentId: user.departmentId || '',
      baseSalary: user.baseSalary !== undefined && user.baseSalary !== null ? String(user.baseSalary) : '',
      transportAllowance: user.transportAllowance !== undefined && user.transportAllowance !== null ? String(user.transportAllowance) : '',
      isExecutive: !!user.isExecutive
    });
    setIsUserModalOpen(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSend: any = {
      email: formFields.email,
      firstName: formFields.firstName,
      lastName: formFields.lastName,
      username: formFields.username === '' ? formFields.firstName.charAt(0).toLowerCase() + '.' + formFields.lastName.toLowerCase() : formFields.username,
      systemRole: formFields.systemRole,
      status: formFields.status,
      entryDate: formFields.entryDate ? new Date(formFields.entryDate) : null,
      country: formFields.country,
      position: formFields.position,
      departmentId: formFields.departmentId === '' ? null : formFields.departmentId,
      role: formFields.systemRole.toLowerCase().includes('admin') ? 'ADMIN' : formFields.systemRole.toLowerCase().includes('tech') ? 'TECHNICIAN' : 'USER',
      baseSalary: formFields.baseSalary === '' ? null : Number(formFields.baseSalary),
      transportAllowance: formFields.transportAllowance === '' ? null : Number(formFields.transportAllowance),
      isExecutive: formFields.isExecutive
    };

    if (formFields.password) {
      if (!isPasswordValid(formFields.password)) {
        alert("Le mot de passe ne respecte pas les critères de sécurité.");
        return;
      }
      dataToSend.password = formFields.password;
    }

    try {
      if (editingUser && editingUser.id !== '1') {
        await api.put(`/users/${editingUser.id}`, dataToSend);
      } else {
        await api.post('/users', dataToSend);
      }
      setIsUserModalOpen(false);
      fetchAllData();
    } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur lors de l'enregistrement : " + msg); }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm("Supprimer cet utilisateur ?")) {
      try {
        await api.delete(`/users/${id}`);
        fetchAllData();
      } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur lors de la suppression : " + msg); }
    }
  };

  const openAssignModal = (user: User) => {
    setAssignTargetUser(user);
    setSelectedAssetId('');
    setIsAssignModalOpen(true);
  };

  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetUser || !selectedAssetId) return;

    try {
      // Pour assigner un actif : on change son statut en ASSIGNED et on lie le userId
      await api.put(`/assets/${selectedAssetId}`, {
        status: 'ASSIGNED',
        userId: assignTargetUser.id,
        assignmentDate: new Date().toISOString().split('T')[0],
        performedBy: 'admin'
      });
      
      // Ajouter un mouvement dans movements
      await api.post('/movements', {
        action: 'Assignation',
        inventoryCode: freeAssets.find(a => a.id === selectedAssetId)?.inventoryCode || 'INV-UNK',
        assetName: freeAssets.find(a => a.id === selectedAssetId)?.name || 'Équipement',
        userName: `${assignTargetUser.firstName} ${assignTargetUser.lastName}`,
        performedBy: 'admin'
      });

      setIsAssignModalOpen(false);
      fetchAllData();
    } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur d'attribution : " + msg); }
  };

  const handleDetachAsset = async (assetId: string, assetCode: string, assetName: string, userName: string) => {
    if (confirm(`Voulez-vous retirer l'actif ${assetCode} de cet utilisateur ?`)) {
      try {
        await api.put(`/assets/${assetId}`, {
          status: 'IN_STOCK',
          userId: null,
          assignmentDate: null,
          performedBy: 'admin'
        });

        // Ajouter un mouvement de retour
        await api.post('/movements', {
          action: 'Retour',
          inventoryCode: assetCode,
          assetName: assetName,
          userName: userName,
          performedBy: 'admin'
        });

        fetchAllData();
      } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur de détachement : " + msg); }
    }
  };

  const filteredUsers = users.filter(u => {
    const fullName = `${u.firstName} ${u.lastName} ${u.email} ${u.username || ''}`.toLowerCase();
    const matchesSearch = fullName.includes(search.toLowerCase());
    const matchesDept = filterDept === '' || u.departmentId === filterDept;
    return matchesSearch && matchesDept;
  });

  const totalAssignedCount = users.reduce((acc, curr) => acc + (curr.assets?.length || 0), 0);

  const handleExportXLSX = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      alert("La bibliothèque d'export Excel n'est pas chargée.");
      return;
    }

    if (activeSubTab === 'users') {
      const data = filteredUsers.map(u => ({
        "Prénom": u.firstName,
        "Nom": u.lastName,
        "Email": u.email,
        "Nom d'utilisateur": u.username || '-',
        "Poste": u.position || '-',
        "Département": u.department ? u.department.name : '-',
        "Pays": u.country || '-',
        "Date d'entrée": u.entryDate ? new Date(u.entryDate).toLocaleDateString() : '-',
        "Statut": u.status || 'Actif',
        "Rôle Système": u.systemRole || '-',
        "Matériels Assignés": u.assets ? u.assets.length : 0
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Collaborateurs");
      XLSX.writeFile(wb, "Liste_Collaborateurs.xlsx");
    } else {
      const data = departments.map(d => ({
        "Nom du Département": d.name,
        "Nombre de collaborateurs": users.filter(u => u.departmentId === d.id).length
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Departements");
      XLSX.writeFile(wb, "Liste_Departements.xlsx");
    }
  };

  const handleExportPDF = () => {
    const jspdf = (window as any).jspdf;
    if (!jspdf) {
      alert("La bibliothèque d'export PDF n'est pas chargée.");
      return;
    }

    const doc = new jspdf.jsPDF('landscape');
    
    import('../pdfUtils').then(async ({ addBrandingToPdf }) => {
      let startY = 15;
      if (activeSubTab === 'users') {
        startY = await addBrandingToPdf(doc, startY, "Liste des Collaborateurs");
        const columns = ["Prénom", "Nom", "Nom d'utilisateur", "Email", "Poste", "Département", "Statut"];
        const rows = filteredUsers.map(u => [
          u.firstName,
          u.lastName,
          u.username || '-',
          u.email,
          u.position || '-',
          u.department ? u.department.name : '-',
          u.status || 'Actif'
        ]);
        doc.autoTable({ head: [columns], body: rows, startY, theme: 'grid', styles: { fontSize: 8 } });
        doc.save("Liste_Collaborateurs.pdf");
      } else {
        startY = await addBrandingToPdf(doc, startY, "Liste des Départements");
        const columns = ["Nom du Departement", "Nombre de collaborateurs"];
        const rows = departments.map(d => [
          d.name,
          users.filter(u => u.departmentId === d.id).length.toString()
        ]);
        doc.autoTable({ head: [columns], body: rows, startY, theme: 'grid', styles: { fontSize: 9 } });
        doc.save("Liste_Departements.pdf");
      }
    });
  };

  return (
    <div className="fade-in">
      {/* MODALE BARRE DE PROGRESSION UPLOAD COLLABORATEURS */}
      {isImporting && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '30px', maxWidth: '460px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', textAlign: 'center', color: 'white' }}>
            <div style={{ width: '60px', height: '60px', margin: '0 auto 16px', borderRadius: '50%', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ph ph-upload-simple" style={{ fontSize: '2rem', color: '#38bdf8' }}></i>
            </div>
            
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0' }}>Importation des Collaborateurs...</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
              Enregistrement en cours : <strong>{importProgress.current}</strong> / {importProgress.total} ({importProgress.pct}%)
            </p>

            <div style={{ width: '100%', height: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
              <div 
                style={{ 
                  height: '100%', 
                  width: `${importProgress.pct}%`, 
                  background: 'linear-gradient(90deg, #38bdf8, #4ba32b)', 
                  transition: 'width 0.2s ease-in-out',
                  borderRadius: '6px'
                }} 
              />
            </div>
            <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 600 }}>
              Création des profils & départements associés...
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATION FLOTTANTE DE SUCCÈS */}
      {importDoneNotification && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, backgroundColor: '#064e3b', border: '1px solid #10b981', color: '#ecfdf5', padding: '16px 20px', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '420px', animation: 'fadeIn 0.3s ease-in' }}>
          <i className="ph-fill ph-check-circle" style={{ fontSize: '1.6rem', color: '#34d399', flexShrink: 0 }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{importDoneNotification}</div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Collaborateurs & Départements</h1>
          <p style={{ color: 'var(--text-muted)' }}>Gestion du personnel, des structures internes et des affectations</p>
        </div>
        {activeSubTab === 'users' ? (
          <div style={{ display: 'flex', gap: '10px' }}>
            <label className="btn-icon" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', fontWeight: 600 }}>
              <i className="ph ph-upload-simple" style={{ color: '#38bdf8', fontSize: '1.2rem' }}></i> Importer Excel / CSV
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportUsersXLSX} style={{ display: 'none' }} />
            </label>

            <button className="btn-icon" onClick={handleExportXLSX} title="Exporter en Excel" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <i className="ph ph-file-xls" style={{ color: '#107c41', fontSize: '1.2rem' }}></i> Excel
            </button>
            <button className="btn-icon" onClick={handleExportPDF} title="Exporter en PDF" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <i className="ph ph-file-pdf" style={{ color: '#da0a14', fontSize: '1.2rem' }}></i> PDF
            </button>
            <button className="btn-primary" onClick={openAddModal}>
              <i className="ph ph-user-plus"></i> Nouvel Utilisateur
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-icon" onClick={handleExportXLSX} title="Exporter en Excel" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <i className="ph ph-file-xls" style={{ color: '#107c41', fontSize: '1.2rem' }}></i> Excel
            </button>
            <button className="btn-icon" onClick={handleExportPDF} title="Exporter en PDF" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <i className="ph ph-file-pdf" style={{ color: '#da0a14', fontSize: '1.2rem' }}></i> PDF
            </button>
            <button className="btn-primary" onClick={openAddDeptModal}>
              <i className="ph ph-plus-circle"></i> Nouveau Département
            </button>
          </div>
        )}
      </div>

      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <h3>Total Utilisateurs</h3>
          <p className="stat-value">{users.length}</p>
        </div>
        <div className="stat-card">
          <h3>Matériel Assigné</h3>
          <p className="stat-value success">{totalAssignedCount}</p>
        </div>
        <div className="stat-card">
          <h3>Total Départements</h3>
          <p className="stat-value warning">{departments.length}</p>
        </div>
      </div>

      {/* Sub-tab selection menu */}
      <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', paddingLeft: '0.5rem' }}>
        <button 
          onClick={() => setActiveSubTab('users')} 
          style={{ 
            background: 'none', 
            border: 'none', 
            borderBottom: activeSubTab === 'users' ? '2px solid var(--accent-primary)' : '2px solid transparent', 
            color: activeSubTab === 'users' ? 'var(--text-primary)' : 'var(--text-muted)', 
            paddingBottom: '0.75rem', 
            fontWeight: 600, 
            cursor: 'pointer',
            fontSize: '1rem',
            transition: 'all 0.2s ease'
          }}
        >
          Collaborateurs
        </button>
        <button 
          onClick={() => setActiveSubTab('departments')} 
          style={{ 
            background: 'none', 
            border: 'none', 
            borderBottom: activeSubTab === 'departments' ? '2px solid var(--accent-primary)' : '2px solid transparent', 
            color: activeSubTab === 'departments' ? 'var(--text-primary)' : 'var(--text-muted)', 
            paddingBottom: '0.75rem', 
            fontWeight: 600, 
            cursor: 'pointer',
            fontSize: '1rem',
            transition: 'all 0.2s ease'
          }}
        >
          Départements
        </button>
      </div>

      <div className="module-container">
        {activeSubTab === 'users' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                  <i className="ph ph-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
                  <input 
                    type="text" 
                    placeholder="Rechercher par nom, email, poste..." 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: '100%', paddingLeft: '38px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', color: 'white', height: '38px' }}
                  />
                </div>
                <select 
                  value={filterDept} 
                  onChange={(e) => setFilterDept(e.target.value)}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.5rem', color: 'white' }}
                >
                  <option value="">Tous les départements</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Prénom</th>
                    <th>Nom</th>
                    <th>Nom d'utilisateur</th>
                    <th>E-mail</th>
                    <th>Département</th>
                    <th>Poste</th>
                    <th>Matériel Assigné</th>
                    <th>État</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun utilisateur trouvé</td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => (
                      <tr key={user.id}>
                        <td><strong>{user.firstName}</strong></td>
                        <td><strong>{user.lastName}</strong></td>
                        <td><code style={{ fontSize: '0.82rem', color: '#38bdf8' }}>@{user.username || 'n/a'}</code></td>
                        <td><a href={`mailto:${user.email}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{user.email}</a></td>
                        <td>{user.department ? user.department.name : '-'}</td>
                        <td>{user.position || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {user.assets && user.assets.length > 0 ? (
                              user.assets.map(a => (
                                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                  <span>{a.inventoryCode} ({a.name})</span>
                                  <button 
                                    className="btn-text" 
                                    style={{ color: 'var(--danger)', fontSize: '0.75rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                                    onClick={() => handleDetachAsset(a.id, a.inventoryCode, a.name, `${user.firstName} ${user.lastName}`)}
                                  >
                                    Détacher
                                  </button>
                                </div>
                              ))
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>Aucun</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge ${user.status?.toLowerCase() === 'actif' ? 'success' : 'warning'}`}>
                            {user.status || 'Actif'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-icon" onClick={() => openAssignModal(user)} title="Assigner Matériel">
                              <i className="ph ph-plus-circle"></i>
                            </button>
                            <button className="btn-icon" onClick={() => openEditModal(user)} title="Modifier">
                              <i className="ph ph-pencil-simple"></i>
                            </button>
                            <button className="btn-icon" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleDeleteUser(user.id)} title="Supprimer">
                              <i className="ph ph-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nom du Département</th>
                  <th>Collaborateurs</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun département trouvé</td>
                  </tr>
                ) : (
                  departments.map(dept => {
                    const count = users.filter(u => u.departmentId === dept.id).length;
                    return (
                      <tr key={dept.id}>
                        <td><strong>{dept.name}</strong></td>
                        <td>{count} collaborateur{count > 1 ? 's' : ''}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-icon" onClick={() => openEditDeptModal(dept)} title="Modifier">
                              <i className="ph ph-pencil-simple"></i>
                            </button>
                            <button className="btn-icon" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleDeleteDept(dept.id, dept.name)} title="Supprimer">
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
        )}
      </div>

      {isUserModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '600px', maxWidth: '95%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</h2>
            <form onSubmit={handleUserSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Prénom</label>
                  <input 
                    type="text" 
                    value={formFields.firstName} 
                    onChange={e => setFormFields({...formFields, firstName: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Nom</label>
                  <input 
                    type="text" 
                    value={formFields.lastName} 
                    onChange={e => setFormFields({...formFields, lastName: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Nom d'utilisateur</label>
                  <input 
                    type="text" 
                    placeholder="Généré automatiquement si vide"
                    value={formFields.username} 
                    onChange={e => setFormFields({...formFields, username: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Email</label>
                  <input 
                    type="email" 
                    value={formFields.email} 
                    onChange={e => setFormFields({...formFields, email: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                {!editingUser && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Mot de passe</label>
                    <input 
                      type="password" 
                      placeholder="Minimum 10 caractères"
                      value={formFields.password} 
                      onChange={e => setFormFields({...formFields, password: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    />
                    {formFields.password && <PasswordStrengthIndicator password={formFields.password} />}
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Fonction / Poste</label>
                  <input 
                    type="text" 
                    value={formFields.position} 
                    onChange={e => setFormFields({...formFields, position: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Rôle d'accès système</label>
                  <select 
                    value={formFields.systemRole} 
                    onChange={e => setFormFields({...formFields, systemRole: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="Admin IT">Admin IT (Accès Total)</option>
                    <option value="Technicien IT">Technicien IT (Matériel & Support)</option>
                    <option value="Logistique / Achat">Logistique / Achat (Stock & Approvisionnement)</option>
                    <option value="Finance">Finance (Ventes, Paiements, Contrats)</option>
                    <option value="RH">Ressources Humaines (Gestion Personnel)</option>
                    <option value="Utilisateur Standard">Utilisateur Standard (Tickets uniquement)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Date d'entrée</label>
                  <input 
                    type="date" 
                    value={formFields.entryDate} 
                    onChange={e => setFormFields({...formFields, entryDate: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Pays</label>
                  <input 
                    type="text" 
                    value={formFields.country} 
                    onChange={e => setFormFields({...formFields, country: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Statut</label>
                  <select 
                    value={formFields.status} 
                    onChange={e => setFormFields({...formFields, status: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="Actif">Actif</option>
                    <option value="Inactif">Inactif</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Département</label>
                  <select 
                    value={formFields.departmentId} 
                    onChange={e => setFormFields({...formFields, departmentId: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="">Aucun</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Salaire de Base (FCFA)</label>
                  <input 
                    type="number" 
                    value={formFields.baseSalary} 
                    onChange={e => setFormFields({...formFields, baseSalary: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    placeholder="Ex: 500000"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Indemnité de Transport (FCFA)</label>
                  <input 
                    type="number" 
                    value={formFields.transportAllowance} 
                    onChange={e => setFormFields({...formFields, transportAllowance: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    placeholder="Ex: 20000"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%', paddingTop: '20px' }}>
                  <input 
                    type="checkbox" 
                    id="isExecutive"
                    checked={formFields.isExecutive} 
                    onChange={e => setFormFields({...formFields, isExecutive: e.target.checked})} 
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
                  />
                  <label htmlFor="isExecutive" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>Statut Cadre (IPRES Cadres)</label>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => setIsUserModalOpen(false)}>Annuler</button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={!!formFields.password && !isPasswordValid(formFields.password)}
                  style={{ opacity: (formFields.password && !isPasswordValid(formFields.password)) ? 0.5 : 1 }}
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeptModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '400px', maxWidth: '95%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingDept ? "Modifier le Département" : "Nouveau Département"}</h2>
            <form onSubmit={handleDeptSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Nom du Département</label>
                <input 
                  type="text" 
                  value={deptName} 
                  onChange={e => setDeptName(e.target.value)} 
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  required
                  placeholder="Ex: Marketing, IT, Finance..."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => setIsDeptModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAssignModalOpen && assignTargetUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '450px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '1rem' }}>Assigner du matériel</h2>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Sélectionnez un actif disponible en stock à attribuer à <strong>{`${assignTargetUser.firstName} ${assignTargetUser.lastName}`}</strong>.
            </p>
            <form onSubmit={handleAssignAsset}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px' }}>Matériel disponible</label>
                <select 
                  value={selectedAssetId} 
                  onChange={e => setSelectedAssetId(e.target.value)} 
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  required
                >
                  <option value="">Sélectionner un équipement...</option>
                  {freeAssets.map(a => (
                    <option key={a.id} value={a.id}>{`${a.inventoryCode} - ${a.name} (${a.type})`}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => setIsAssignModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Assigner</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


