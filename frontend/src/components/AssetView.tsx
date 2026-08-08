import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface User {
  id: string;
  firstName: string;
  lastName: string;
}

interface Location {
  id: string;
  name: string;
}

interface Asset {
  id: string;
  inventoryCode: string;
  name: string;
  type: string;
  status: 'IN_STOCK' | 'ASSIGNED' | 'BROKEN' | 'IN_MAINTENANCE' | 'OBSOLETE' | 'RETIRED' | 'LOST';
  serialNumber?: string;
  purchaseDate?: string;
  warrantyEnd?: string;
  warrantyMonths?: number;
  country?: string;
  hostname?: string;
  notes?: string;
  userId?: string;
  user?: User;
  locationId?: string;
  location?: Location;
  assignmentDate?: string;
  cpu?: string;
  ram?: string;
  storage?: string;
  os?: string;
  ipAddress?: string;
  macAddress?: string;
  model?: string;
  manufacturer?: string;
  lastAgentCommunication?: string;
}

export const AssetView: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const session = localStorage.getItem('currentUser');
  const currentUser = session ? JSON.parse(session) : null;
  const isRH = currentUser && (currentUser.systemRole === 'RH' || currentUser.systemRole === 'Finance');
  const isUser = currentUser && currentUser.role === 'USER';
  const isReadOnly = isRH || isUser;
  
  // Filters
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  // Écran détail actif mobile (par onglets/accordéons)
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<Asset | null>(null);
  const [detailActiveTab, setDetailActiveTab] = useState<'info' | 'specs' | 'docs'>('info');

  // Scanner de code-barres / QR Code
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerManualInput, setScannerManualInput] = useState('');
  
  // Offline state & Local Unsynchronized scan list
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [localUnsyncedAssets, setLocalUnsyncedAssets] = useState<Asset[]>(() => {
    const saved = localStorage.getItem('kpsy_unsynced_scans');
    return saved ? JSON.parse(saved) : [];
  });

  // Barre de progression Upload Excel
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, pct: 0 });
  const [importDoneNotification, setImportDoneNotification] = useState<string | null>(null);

  // Form fields
  const [formFields, setFormFields] = useState({
    inventoryCode: '',
    name: '',
    type: 'Ordinateur Portable',
    status: 'IN_STOCK' as any,
    serialNumber: '',
    purchaseDate: '',
    warrantyMonths: 36,
    country: 'Sénégal',
    hostname: '',
    notes: '',
    userId: '',
    locationId: '',
    assignmentDate: '',
    cpu: '',
    ram: '',
    storage: '',
    os: '',
    ipAddress: '',
    macAddress: '',
    model: '',
    manufacturer: ''
  });

  const fetchAllData = async () => {
    try {
      const assetsRes = await api.get('/assets');
      setAssets(assetsRes.data || []);
    } catch (err) {
      console.warn('API error fetching assets.', err);
      setAssets([]);
    }

    try {
      const usersRes = await api.get('/users');
      setUsers(usersRes.data || []);
    } catch (err) {
      console.warn('API error fetching users (expected for USER role).', err);
      setUsers([]);
    }

    try {
      const locationsRes = await api.get('/locations');
      setLocations(locationsRes.data || []);
    } catch (err) {
      console.warn('API error fetching locations (expected for USER role).', err);
      setLocations([]);
    }
  };

  const syncLocalScans = async (localList: Asset[]) => {
    if (localList.length === 0) return;
    let syncedCount = 0;
    const remaining: Asset[] = [];
    for (const asset of localList) {
      try {
        await api.post('/assets', {
          inventoryCode: asset.inventoryCode,
          name: asset.name,
          type: asset.type,
          status: asset.status,
          performedBy: 'admin'
        });
        syncedCount++;
      } catch (err) {
        remaining.push(asset);
      }
    }
    setLocalUnsyncedAssets(remaining);
    localStorage.setItem('kpsy_unsynced_scans', JSON.stringify(remaining));
    if (syncedCount > 0) {
      alert(`✓ Synchronisation réussie : ${syncedCount} scan(s) local/locaux enregistré(s) sur le serveur.`);
      fetchAllData();
    }
  };

  useEffect(() => {
    fetchAllData();

    const goOnline = () => {
      setIsOffline(false);
      // Tentative de synchronisation dès le retour en ligne
      const saved = localStorage.getItem('kpsy_unsynced_scans');
      if (saved) {
        syncLocalScans(JSON.parse(saved));
      }
    };
    const goOffline = () => setIsOffline(true);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredAssets.map(a => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const generateNextInventoryCode = (currentAssets: Asset[], offset = 0) => {
    const year = new Date().getFullYear();
    const seqNumber = currentAssets.length + 1 + offset;
    const formattedSeq = String(seqNumber).padStart(4, '0');
    return `INV-${year}-${formattedSeq}`;
  };

  const openAddModal = () => {
    setEditingAsset(null);
    setFormFields({
      inventoryCode: generateNextInventoryCode(assets),
      name: '',
      type: 'Ordinateur Portable',
      status: 'IN_STOCK',
      serialNumber: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      warrantyMonths: 36,
      country: 'Sénégal',
      hostname: '',
      notes: '',
      userId: '',
      locationId: '',
      assignmentDate: '',
      cpu: '',
      ram: '',
      storage: '',
      os: '',
      ipAddress: '',
      macAddress: '',
      model: '',
      manufacturer: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setFormFields({
      inventoryCode: asset.inventoryCode,
      name: asset.name,
      type: asset.type,
      status: asset.status,
      serialNumber: asset.serialNumber || '',
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
      warrantyMonths: asset.warrantyMonths || 36,
      country: asset.country || 'Sénégal',
      hostname: asset.hostname || '',
      notes: asset.notes || '',
      userId: asset.userId || '',
      locationId: asset.locationId || '',
      assignmentDate: asset.assignmentDate ? asset.assignmentDate.split('T')[0] : '',
      cpu: asset.cpu || '',
      ram: asset.ram || '',
      storage: asset.storage || '',
      os: asset.os || '',
      ipAddress: asset.ipAddress || '',
      macAddress: asset.macAddress || '',
      model: asset.model || '',
      manufacturer: asset.manufacturer || ''
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSend = {
      ...formFields,
      purchaseDate: formFields.purchaseDate ? new Date(formFields.purchaseDate).toISOString() : null,
      assignmentDate: formFields.assignmentDate ? new Date(formFields.assignmentDate).toISOString() : null,
      userId: formFields.userId === '' ? null : formFields.userId,
      locationId: formFields.locationId === '' ? null : formFields.locationId,
      warrantyEnd: formFields.purchaseDate ? calculateWarrantyEnd(formFields.purchaseDate, formFields.warrantyMonths) : null,
      performedBy: 'admin' // current logged in
    };

    if (isOffline) {
      // Offline mode: save locally with temporary negative ID
      const newMockAsset: Asset = {
        id: `offline-${Date.now()}`,
        inventoryCode: formFields.inventoryCode,
        name: formFields.name,
        type: formFields.type,
        status: formFields.status,
        serialNumber: formFields.serialNumber || undefined,
        purchaseDate: dataToSend.purchaseDate || undefined,
        warrantyMonths: formFields.warrantyMonths,
        country: formFields.country,
        userId: formFields.userId || undefined,
        locationId: formFields.locationId || undefined
      };
      
      const newLocalList = [...localUnsyncedAssets, newMockAsset];
      setLocalUnsyncedAssets(newLocalList);
      localStorage.setItem('kpsy_unsynced_scans', JSON.stringify(newLocalList));
      
      alert("Mode Hors-ligne activé : l'actif a été sauvegardé localement sur votre appareil. Il sera automatiquement synchronisé au retour de votre connexion réseau !");
      setIsModalOpen(false);
      return;
    }

    try {
      if (editingAsset && !editingAsset.id.startsWith('offline-')) {
        await api.put(`/assets/${editingAsset.id}`, dataToSend);
      } else {
        await api.post('/assets', dataToSend);
      }
      setIsModalOpen(false);
      fetchAllData();
      setSelectedIds([]);
    } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur lors de la sauvegarde de l'équipement : " + msg); }
  };

  const playHapticScanBeep = () => {
    try {
      // Émettre un léger vibreur si supporté
      if (navigator.vibrate) navigator.vibrate(100);
      // Jouer un bip audio de scan
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, audioCtx.currentTime); // 1000Hz bip
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.log("Audio contexts non initialisés", e);
    }
  };

  const handleQrCodeScan = async (code: string) => {
    if (!code || code.trim() === '') return;
    playHapticScanBeep();
    
    // Rechercher si l'actif existe déjà
    const matched = assets.find(a => a.inventoryCode.toLowerCase() === code.toLowerCase() || a.serialNumber?.toLowerCase() === code.toLowerCase());
    
    if (matched) {
      // Actif trouvé -> Ouvrir sa fiche détaillée en mode accordéon
      setSelectedAssetForDetail(matched);
      setIsScannerOpen(false);
    } else {
      // Actif non trouvé -> Proposer la création rapide de cet équipement
      const wantsToCreate = window.confirm(`L'actif avec le code ou n° série "${code}" n'existe pas encore. Voulez-vous le créer maintenant ?`);
      if (wantsToCreate) {
        setFormFields({
          inventoryCode: code.startsWith('INV-') ? code : generateNextInventoryCode(assets),
          name: 'Nouvel Actif Scanné',
          type: 'Ordinateur Portable',
          status: 'IN_STOCK',
          serialNumber: code.startsWith('INV-') ? '' : code,
          purchaseDate: new Date().toISOString().split('T')[0],
          warrantyMonths: 36,
          country: 'Sénégal',
          userId: '',
          locationId: '',
          assignmentDate: '',
          cpu: '',
          ram: '',
          storage: '',
          os: '',
          ipAddress: '',
          macAddress: '',
          model: '',
          manufacturer: ''
        });
        setIsScannerOpen(false);
        setIsModalOpen(true);
      }
    }
  };

  const calculateWarrantyEnd = (purchaseDateStr: string, months: number) => {
    const d = new Date(purchaseDateStr);
    d.setMonth(d.getMonth() + Number(months));
    return d;
  };

  const handleDelete = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet équipement ?")) {
      try {
        await api.delete(`/assets/${id}?performedBy=admin`);
        fetchAllData();
        setSelectedIds(prev => prev.filter(item => item !== id));
      } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur lors de la suppression : " + msg); }
    }
  };

  const handleBulkDelete = async () => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer les ${selectedIds.length} équipement(s) sélectionné(s) ?`)) {
      let successCount = 0;
      for (const id of selectedIds) {
        if (id.startsWith('offline-')) {
          // Supprimer du stockage hors-ligne local
          const remainingUnsynced = localUnsyncedAssets.filter(a => a.id !== id);
          setLocalUnsyncedAssets(remainingUnsynced);
          localStorage.setItem('kpsy_unsynced_scans', JSON.stringify(remainingUnsynced));
          successCount++;
        } else {
          try {
            await api.delete(`/assets/${id}?performedBy=admin`);
            successCount++;
          } catch (err) {
            console.warn(`Impossible de supprimer l'actif ${id}`, err);
          }
        }
      }
      setSelectedIds([]);
      fetchAllData();
      if (successCount > 0) {
        alert(`✓ ${successCount} équipement(s) supprimé(s) avec succès.`);
      }
    }
  };

  const handleExportXLSX = async () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) return;

    let brandingText = [];
    try {
      const res = await api.get('/tenants/me');
      const tenant = res.data.tenant;
      if (tenant) {
        brandingText.push([`Entreprise : ${tenant.name}`]);
        if (tenant.companyAddress) brandingText.push([`Adresse : ${tenant.companyAddress}`]);
        if (tenant.companyPhone) brandingText.push([`Tél : ${tenant.companyPhone}`]);
        if (tenant.companyEmail) brandingText.push([`Email : ${tenant.companyEmail}`]);
        if (tenant.companyTaxId) brandingText.push([`NIF/RC : ${tenant.companyTaxId}`]);
        brandingText.push([]); // Ligne vide d'espacement
      }
    } catch (e) {
      console.warn("Impossible de charger le branding", e);
    }

    const data = assets.map(a => ({
      "Code Inventaire": a.inventoryCode,
      "Nom / Modèle": a.name,
      "Type": a.type,
      "N° Série": a.serialNumber || '-',
      "Nom d'hôte IT": a.hostname || '-',
      "Pays": a.country || '-',
      "Garantie (mois)": a.warrantyMonths || '-',
      "Statut": a.status,
      "Assigné à": a.user ? `${a.user.firstName} ${a.user.lastName}` : 'Non assigné',
      "Site": a.location ? a.location.name : '-',
      "Commentaires": a.notes || '-',
      "Processeur": a.cpu || '-',
      "RAM": a.ram || '-',
      "Stockage": a.storage || '-',
      "OS": a.os || '-',
      "Adresse IP": a.ipAddress || '-',
      "Adresse MAC": a.macAddress || '-'
    }));

    const ws = XLSX.utils.json_to_sheet([]);
    
    // Ajout du branding en haut (aoa = array of arrays)
    if (brandingText.length > 0) {
      XLSX.utils.sheet_add_aoa(ws, brandingText, { origin: "A1" });
      XLSX.utils.sheet_add_json(ws, data, { origin: `A${brandingText.length + 1}` });
    } else {
      XLSX.utils.sheet_add_json(ws, data, { origin: "A1" });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assets");
    XLSX.writeFile(wb, "Inventaire_Parc_Informatique.xlsx");
  };

  const handleExportPDF = async () => {
    const jspdf = (window as any).jspdf;
    if (!jspdf) return;

    const doc = new jspdf.jsPDF('landscape');
    let startY = 20;

    try {
      const { addBrandingToPdf } = await import('../pdfUtils');
      startY = await addBrandingToPdf(doc, startY, "Inventaire des Actifs IT");
    } catch (e) {
      console.warn("Erreur pdf", e);
      doc.text("Inventaire des Actifs IT", 14, startY);
      startY += 10;
    }
    startY += 10;

    const columns = ["Code", "Nom", "Type", "N° Série", "Garantie", "État", "Assigné à", "Site"];
    const rows = assets.map(a => [
      a.inventoryCode,
      a.name,
      a.type,
      a.serialNumber || '-',
      a.warrantyMonths ? a.warrantyMonths + ' mois' : '-',
      a.status,
      a.user ? `${a.user.firstName} ${a.user.lastName}` : 'Non assigné',
      a.location ? a.location.name : '-'
    ]);

    doc.autoTable({
      head: [columns],
      body: rows,
      startY: startY,
      theme: 'grid',
      styles: { fontSize: 8 }
    });

    doc.save("Inventaire_Parc_Informatique.pdf");
  };

  const handleImportXLSX = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event: any) => {
      const XLSX = (window as any).XLSX;
      if (!XLSX) return;

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
          
          // Helper de recherche de clé ultra-robuste
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

          const brand = getVal("marque", "brand", "fabricant", "constructeur");
          const modelStr = getVal("modele", "model", "modele / nom", "modele et nom");
          const genericName = getVal("nom", "equipement", "designation", "name", "libelle");

          let name = 'Équipement';
          if (brand && modelStr) {
            name = modelStr.toLowerCase().includes(brand.toLowerCase()) ? modelStr : `${brand} ${modelStr}`;
          } else if (brand) {
            name = genericName ? `${brand} (${genericName})` : brand;
          } else if (modelStr) {
            name = modelStr;
          } else if (genericName) {
            name = genericName;
          }

          const invCode = getVal("code", "code inventaire", "inventorycode") || generateNextInventoryCode(assets, i);
          let type = getVal("type", "categorie");
          if (!type) {
            const checkStr = `${brand || ''} ${modelStr || ''} ${genericName || ''}`.toLowerCase();
            if (checkStr.includes('macbook air')) type = 'MacBook Air';
            else if (checkStr.includes('macbook pro')) type = 'MacBook Pro';
            else if (checkStr.includes('imac')) type = 'iMac';
            else if (checkStr.includes('mac mini')) type = 'Mac mini';
            else if (checkStr.includes('ipad')) type = 'iPad';
            else if (checkStr.includes('iphone')) type = 'iPhone';
            else type = 'Ordinateur Portable';
          }
          const serialNumber = getVal("n° serie", "serial", "serie", "sn", "serialnumber");
          const hostname = getVal("nom d'hote it", "nom d'hote", "hostname", "hote", "nom hote");
          const country = getVal("pays", "country") || 'Sénégal';
          const notes = getVal("commentaires", "remarques", "notes", "commentaire");
          const cpu = getVal("cpu", "processeur");
          const ram = getVal("ram", "memoire");
          const storage = getVal("stockage", "disque");
          const os = getVal("os", "systeme");
          const ipAddress = getVal("ip", "adresse ip");
          const macAddress = getVal("mac", "adresse mac");
          const manufacturer = brand || getVal("fabricant", "constructeur", "marque");

          // Détection automatique de l'emplacement (Site)
          const siteStr = getVal("site", "emplacement", "magasin", "localisation");
          let locationId: string | undefined = undefined;
          if (siteStr && locations.length > 0) {
            const matchedLoc = locations.find(l => l.name.toLowerCase().includes(siteStr.toLowerCase()) || siteStr.toLowerCase().includes(l.name.toLowerCase()));
            if (matchedLoc) locationId = matchedLoc.id;
          }

          // Détection automatique de l'utilisateur assigné
          const userStr = getVal("assigne a", "assigne", "utilisateur", "affecte a");
          let userId: string | undefined = undefined;
          if (userStr && users.length > 0) {
            const matchedUser = users.find(u => {
              const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
              return fullName.includes(userStr.toLowerCase()) || userStr.toLowerCase().includes(u.firstName.toLowerCase());
            });
            if (matchedUser) userId = matchedUser.id;
          }

          const rawStatus = getVal("statut", "etat");
          let status = 'IN_STOCK';
          if (rawStatus) {
            const sLower = rawStatus.toLowerCase();
            if (sLower.includes('actif') || sLower.includes('assign') || sLower.includes('deploy')) status = 'ASSIGNED';
            else if (sLower.includes('panne') || sLower.includes('cass')) status = 'BROKEN';
            else if (sLower.includes('maint')) status = 'IN_MAINTENANCE';
            else if (sLower.includes('reform')) status = 'RETIRED';
            else if (sLower.includes('obsol')) status = 'OBSOLETE';
          }

          const payload: any = {
            inventoryCode: invCode,
            name: name,
            type: type,
            status: status,
            performedBy: 'admin'
          };

          if (serialNumber) payload.serialNumber = serialNumber;
          if (hostname) payload.hostname = hostname;
          if (country) payload.country = country;
          if (notes) payload.notes = notes;
          if (cpu) payload.cpu = cpu;
          if (ram) payload.ram = ram;
          if (storage) payload.storage = storage;
          if (os) payload.os = os;
          if (ipAddress) payload.ipAddress = ipAddress;
          if (macAddress) payload.macAddress = macAddress;
          if (manufacturer) payload.manufacturer = manufacturer;
          if (modelStr) payload.model = modelStr;
          if (locationId) payload.locationId = locationId;
          if (userId) payload.userId = userId;

          const rawWarranty = getVal("garantie", "garantie (mois)");
          if (rawWarranty) payload.warrantyMonths = parseInt(rawWarranty) || 36;

          try {
            await api.post('/assets', payload);
            added++;
          } catch (err) {
            console.warn(`Erreur import ligne ${i+1}`, err);
          }

          // Mise à jour de la barre de progression en temps réel
          const currentCount = i + 1;
          const currentPct = Math.round((currentCount / totalRows) * 100);
          setImportProgress({ current: currentCount, total: totalRows, pct: currentPct });
        }

        setIsImporting(false);
        setImportDoneNotification(`🎉 Importation terminée avec succès : ${added} équipement(s) sur ${totalRows} ont été enregistrés !`);
        fetchAllData();

        // Réinitialiser la notification d'information après 6 secondes
        setTimeout(() => {
          setImportDoneNotification(null);
        }, 6000);
      } catch (err: any) {
        setIsImporting(false);
        console.error(err);
        const errorMsg = err.response?.data?.message || err.message || "Erreur de format";
        alert(`Erreur lors de l'importation Excel : ${errorMsg}`);
      }
    };
    reader.readAsArrayBuffer(file);
    // Réinitialiser le file input pour ré-autoriser la même sélection
    e.target.value = '';
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.inventoryCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (asset.serialNumber && asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (asset.hostname && asset.hostname.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (asset.country && asset.country.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (asset.notes && asset.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === '' || asset.type === filterType;
    const matchesStatus = filterStatus === '' || asset.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="fade-in" style={{ paddingBottom: isOffline || localUnsyncedAssets.length > 0 ? '60px' : '0px' }}>
      
      {/* MODALE BARRE DE PROGRESSION UPLOAD EXCEL */}
      {isImporting && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '30px', maxWidth: '460px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', textAlign: 'center', color: 'white' }}>
            <div style={{ width: '60px', height: '60px', margin: '0 auto 16px', borderRadius: '50%', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ph ph-upload-simple" style={{ fontSize: '2rem', color: '#38bdf8' }}></i>
            </div>
            
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0' }}>Importation Excel en cours...</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
              Enregistrement des équipements : <strong>{importProgress.current}</strong> / {importProgress.total} ({importProgress.pct}%)
            </p>

            {/* Barre de Progression Visuelle */}
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
              Veuillez patienter pendant l'écriture en base de données...
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATION FLOTTANTE SUCCÈS D'ACHÈVEMENT UPLOAD */}
      {importDoneNotification && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, backgroundColor: '#064e3b', border: '1px solid #10b981', color: '#ecfdf5', padding: '16px 20px', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '420px', animation: 'fadeIn 0.3s ease-in' }}>
          <i className="ph-fill ph-check-circle" style={{ fontSize: '1.6rem', color: '#34d399', flexShrink: 0 }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{importDoneNotification}</div>
        </div>
      )}

      {/* BANDEAU DE SYNCHRONISATION OFFLINE */}
      {(isOffline || localUnsyncedAssets.length > 0) && (
        <div className="offline-sync-banner">
          <i className="ph-fill ph-wifi-slash" style={{ fontSize: '1.2rem' }}></i>
          <span>
            {isOffline 
              ? `Mode Hors-ligne actif — ${localUnsyncedAssets.length} scan(s) en attente de synchronisation` 
              : `Connexion rétablie — ${localUnsyncedAssets.length} scan(s) local/locaux en cours d'enregistrement...`
            }
          </span>
          {localUnsyncedAssets.length > 0 && !isOffline && (
            <button 
              onClick={() => syncLocalScans(localUnsyncedAssets)}
              style={{ background: 'white', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', color: '#0f071a' }}
            >
              Forcer Sync
            </button>
          )}
        </div>
      )}

      {/* TITRE ET ACTIONS PRINCIPALES ADAPTATIFS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Inventaire des Actifs</h1>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>Gestion complète du matériel informatique</p>
          </div>
          
          {/* Actions rapides de terrain au pouce sur mobile */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button 
              className="btn-primary" 
              onClick={() => setIsScannerOpen(true)}
              style={{ background: 'linear-gradient(135deg, var(--accent-primary), #4ba32b)', color: 'var(--text-on-accent)', fontWeight: 800, flex: '1 1 auto', minWidth: '150px' }}
            >
              <i className="ph ph-qr-code" style={{ fontSize: '1.2rem', marginRight: '6px' }}></i> Scanner QR / Code-barres
            </button>
            {!isReadOnly && (
              <button className="btn-primary" onClick={openAddModal} style={{ flex: '1 1 auto', minWidth: '120px' }}>
                <i className="ph ph-plus" style={{ marginRight: '6px' }}></i> Nouveau
              </button>
            )}
          </div>
        </div>

        {/* Boutons d'exports secondaires masqués sur mobile */}
        <div className="hide-on-mobile-flex" style={{ gap: '10px', justifyContent: 'flex-end' }}>
          {!isReadOnly && (
            <label className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', padding: '0.5rem 1rem' }}>
              <i className="ph ph-upload-simple"></i> Importer Excel
              <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleImportXLSX} />
            </label>
          )}
          <button className="btn-icon" style={{ display: 'flex', alignItems: 'center', gap: '5px' }} onClick={handleExportXLSX}>
            <i className="ph ph-file-xls"></i> Export Excel
          </button>
          <button className="btn-icon" style={{ display: 'flex', alignItems: 'center', gap: '5px' }} onClick={handleExportPDF}>
            <i className="ph ph-file-pdf"></i> Export PDF
          </button>
        </div>
      </div>

      <div className="module-container">
        {/* RECHERCHE ET FILTRES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', width: '100%' }}>
            <div style={{ display: 'flex', flex: '1 1 200px', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.5rem 0.75rem' }}>
              <i className="ph ph-magnifying-glass" style={{ color: 'var(--text-muted)' }}></i>
              <input 
                type="text" 
                placeholder="Rechercher code, n° série..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%' }}
              />
            </div>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.5rem', color: 'white', flex: '1 1 120px' }}
            >
              <option value="">Tous les types</option>
              <optgroup label="── Produits Apple 🍎 ──">
                <option value="MacBook Air">MacBook Air</option>
                <option value="MacBook Pro">MacBook Pro</option>
                <option value="iMac">iMac</option>
                <option value="Mac mini">Mac mini</option>
                <option value="Mac Studio / Pro">Mac Studio / Mac Pro</option>
                <option value="iPad">iPad / iPad Pro</option>
                <option value="iPhone">iPhone</option>
              </optgroup>
              <optgroup label="── Informatique ──">
                <option value="Ordinateur Portable">Ordinateur Portable</option>
                <option value="Ordinateur de Bureau">Ordinateur de Bureau</option>
                <option value="Serveur">Serveur</option>
                <option value="Station de Travail">Station de Travail</option>
                <option value="Tablette">Tablette</option>
              </optgroup>
              <optgroup label="── Téléphonie ──">
                <option value="Téléphone Portable">Téléphone Portable</option>
                <option value="Smartphone">Smartphone</option>
                <option value="Téléphone IP">Téléphone IP (VoIP)</option>
              </optgroup>
              <optgroup label="── Réseau & Périphériques ──">
                <option value="Switch Réseau">Switch Réseau</option>
                <option value="Routeur">Routeur</option>
                <option value="Point d'accès WiFi">Point d'accès WiFi</option>
                <option value="Imprimante">Imprimante</option>
                <option value="Imprimante Multifonction">Imprimante Multifonction</option>
                <option value="Écran">Écran / Moniteur</option>
                <option value="Onduleur">Onduleur (UPS)</option>
              </optgroup>
              <option value="Autre">Autre</option>
            </select>
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.5rem', color: 'white', flex: '1 1 120px' }}
            >
              <option value="">Tous les statuts</option>
              <option value="IN_STOCK">En Stock</option>
              <option value="ASSIGNED">Assigné (Actif)</option>
              <option value="BROKEN">En panne</option>
              <option value="IN_MAINTENANCE">En maintenance</option>
              <option value="RETIRED">Réformé</option>
            </select>
          </div>

          {!isReadOnly && selectedIds.length > 0 && (
            <button className="btn-primary" style={{ backgroundColor: 'var(--danger)', alignSelf: 'flex-start' }} onClick={handleBulkDelete}>
              <i className="ph ph-trash"></i> Supprimer sélectionnés ({selectedIds.length})
            </button>
          )}
        </div>

        {/* ── RENDU TABLEAU (DESKTOP / TABLETTE) ── */}
        <div className="table-responsive hide-on-mobile-block">
          <table className="data-table">
            <thead>
              <tr>
                {!isReadOnly && (
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll} 
                      checked={filteredAssets.length > 0 && selectedIds.length === filteredAssets.length} 
                    />
                  </th>
                )}
                <th>Code</th>
                <th>Modèle / Nom</th>
                <th>Type</th>
                <th>N° Série</th>
                <th>Nom d'hôte IT</th>
                <th>Pays</th>
                <th>Garantie</th>
                <th>État</th>
                <th>Assigné à</th>
                <th>Site</th>
                <th>Commentaires</th>
                {!isReadOnly && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={isReadOnly ? 11 : 13} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun actif trouvé</td>
                </tr>
              ) : (
                filteredAssets.map(asset => (
                  <tr key={asset.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedAssetForDetail(asset)}>
                    {!isReadOnly && (
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(asset.id)} 
                          onChange={(e) => handleSelectOne(asset.id, e.target.checked)} 
                        />
                      </td>
                    )}
                    <td><strong>{asset.inventoryCode}</strong></td>
                    <td>
                      {asset.manufacturer && !asset.name.toLowerCase().includes(asset.manufacturer.toLowerCase()) 
                        ? `${asset.manufacturer} ${asset.name}` 
                        : asset.name}
                    </td>
                    <td>{asset.type}</td>
                    <td>{asset.serialNumber || '-'}</td>
                    <td><code style={{ fontSize: '0.82rem', color: '#38bdf8' }}>{asset.hostname || '-'}</code></td>
                    <td>{asset.country || '-'}</td>
                    <td>{asset.warrantyMonths ? asset.warrantyMonths + ' mois' : '-'}</td>
                    <td>
                      <span className={`status-badge ${asset.status.toLowerCase()}`}>
                        {asset.status === 'ASSIGNED' ? 'Actif' : asset.status === 'IN_STOCK' ? 'En Stock' : asset.status === 'BROKEN' ? 'En Panne' : asset.status === 'IN_MAINTENANCE' ? 'Maintenance' : asset.status}
                      </span>
                    </td>
                    <td>{asset.user ? `${asset.user.firstName} ${asset.user.lastName}` : 'Non assigné'}</td>
                    <td>{asset.location ? asset.location.name : '-'}</td>
                    <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={asset.notes || ''}>
                      {asset.notes || '-'}
                    </td>
                    {!isReadOnly && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-icon" onClick={() => openEditModal(asset)}>
                            <i className="ph ph-pencil-simple"></i>
                          </button>
                          <button className="btn-icon" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleDelete(asset.id)}>
                            <i className="ph ph-trash"></i>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── RENDU CARTES (MOBILE / HORS-CONNEXION TERRAIN) ── */}
        <div className="show-on-mobile" style={{ display: 'none' }}>
          {filteredAssets.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucun actif trouvé</div>
          ) : (
            filteredAssets.map(asset => {
              const isUnsyncedOffline = asset.id.startsWith('offline-');
              return (
                <div 
                  key={asset.id} 
                  className="mobile-asset-card" 
                  onClick={() => setSelectedAssetForDetail(asset)}
                  style={{ border: isUnsyncedOffline ? '1px dashed #f59e0b' : '1px solid var(--border-color)' }}
                >
                  <div className="card-row">
                    <span className="card-code">{asset.inventoryCode}</span>
                    <span className={`status-badge ${asset.status.toLowerCase()}`}>
                      {asset.status === 'ASSIGNED' ? 'Actif' : asset.status === 'IN_STOCK' ? 'En Stock' : asset.status === 'BROKEN' ? 'En Panne' : asset.status}
                    </span>
                  </div>
                  <div className="card-title" style={{ marginTop: '4px' }}>{asset.name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{asset.type}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                    <span>Site : {asset.location ? asset.location.name : '-'}</span>
                    <span>Série : {asset.serialNumber || '-'}</span>
                  </div>
                  
                  {isUnsyncedOffline && (
                    <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                      <i className="ph ph-warning" /> En attente de réseau
                    </div>
                  )}

                  {!isReadOnly && (
                    <div className="card-row" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                        <button className="btn-primary btn-outline" style={{ flex: 1, minHeight: '44px' }} onClick={() => openEditModal(asset)}>
                          <i className="ph ph-pencil-simple" style={{ marginRight: '6px' }}></i> Modifier
                        </button>
                        <button className="btn-primary" style={{ flex: 1, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)', minHeight: '44px' }} onClick={() => handleDelete(asset.id)}>
                          <i className="ph ph-trash" style={{ marginRight: '6px' }}></i> Supprimer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', padding: '20px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingAsset ? "Modifier l'Actif" : "Ajouter un nouvel Actif"}</h2>
            <form onSubmit={handleFormSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Code Inventaire</label>
                  <input 
                    type="text" 
                    value={formFields.inventoryCode} 
                    onChange={e => setFormFields({...formFields, inventoryCode: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Modèle / Nom</label>
                  <input 
                    type="text" 
                    value={formFields.name} 
                    onChange={e => setFormFields({...formFields, name: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Type d'équipement</label>
                  <select 
                    value={formFields.type} 
                    onChange={e => setFormFields({...formFields, type: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <optgroup label="── Produits Apple 🍎 ──">
                      <option value="MacBook Air">MacBook Air</option>
                      <option value="MacBook Pro">MacBook Pro</option>
                      <option value="iMac">iMac</option>
                      <option value="Mac mini">Mac mini</option>
                      <option value="Mac Studio / Pro">Mac Studio / Mac Pro</option>
                      <option value="iPad">iPad / iPad Air / iPad Pro</option>
                      <option value="iPhone">iPhone</option>
                      <option value="Apple Watch">Apple Watch</option>
                    </optgroup>
                    <optgroup label="── Informatique ──">
                      <option value="Ordinateur Portable">Ordinateur Portable</option>
                      <option value="Ordinateur de Bureau">Ordinateur de Bureau</option>
                      <option value="Serveur">Serveur</option>
                      <option value="Station de Travail">Station de Travail</option>
                      <option value="Tablette">Tablette</option>
                    </optgroup>
                    <optgroup label="── Téléphonie & Mobile ──">
                      <option value="Téléphone Portable">Téléphone Portable</option>
                      <option value="Smartphone">Smartphone</option>
                      <option value="Téléphone IP">Téléphone IP (VoIP)</option>
                      <option value="Téléphone Fixe">Téléphone Fixe</option>
                    </optgroup>
                    <optgroup label="── Réseau & Connectivité ──">
                      <option value="Routeur">Routeur</option>
                      <option value="Switch Réseau">Switch Réseau</option>
                      <option value="Point d'accès WiFi">Point d'accès WiFi</option>
                      <option value="Modem 4G/5G">Modem 4G/5G</option>
                      <option value="Modem ADSL/Fibre">Modem ADSL/Fibre</option>
                      <option value="Firewall">Firewall</option>
                      <option value="NAS">NAS (Stockage Réseau)</option>
                    </optgroup>
                    <optgroup label="── Périphériques ──">
                      <option value="Imprimante">Imprimante</option>
                      <option value="Imprimante Multifonction">Imprimante Multifonction</option>
                      <option value="Scanner">Scanner</option>
                      <option value="Écran">Écran / Moniteur</option>
                      <option value="Projecteur">Projecteur / Vidéoprojecteur</option>
                      <option value="Caméra IP">Caméra IP / Surveillance</option>
                      <option value="Webcam">Webcam</option>
                    </optgroup>
                    <optgroup label="── Alimentation & Accessoires ──">
                      <option value="Onduleur">Onduleur (UPS)</option>
                      <option value="Disque Dur Externe">Disque Dur Externe</option>
                      <option value="Clé USB">Clé USB</option>
                      <option value="Docking Station">Docking Station</option>
                      <option value="Souris">Souris</option>
                      <option value="Clavier">Clavier</option>
                      <option value="Casque Audio">Casque Audio</option>
                    </optgroup>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>N° Série</label>
                  <input 
                    type="text" 
                    value={formFields.serialNumber} 
                    onChange={e => setFormFields({...formFields, serialNumber: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Date d'acquisition</label>
                  <input 
                    type="date" 
                    value={formFields.purchaseDate} 
                    onChange={e => setFormFields({...formFields, purchaseDate: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Garantie (mois)</label>
                  <input 
                    type="number" 
                    value={formFields.warrantyMonths} 
                    onChange={e => setFormFields({...formFields, warrantyMonths: Number(e.target.value)})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Pays</label>
                  <input 
                    type="text" 
                    value={formFields.country} 
                    onChange={e => setFormFields({...formFields, country: e.target.value})} 
                    placeholder="Ex: Sénégal, Côte d'Ivoire..."
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>Nom d'hôte réseau (IT)</label>
                  <input 
                    type="text" 
                    value={formFields.hostname} 
                    onChange={e => setFormFields({...formFields, hostname: e.target.value})} 
                    placeholder="Ex: PC-SRV-01.local"
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Statut</label>
                  <select 
                    value={formFields.status} 
                    onChange={e => setFormFields({...formFields, status: e.target.value as any})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="IN_STOCK">En Stock</option>
                    <option value="ASSIGNED">Actif (Assigné)</option>
                    <option value="BROKEN">En Panne</option>
                    <option value="IN_MAINTENANCE">En Maintenance</option>
                    <option value="OBSOLETE">Obsolète</option>
                    <option value="RETIRED">Réformé</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Assigner à l'utilisateur</label>
                  <select 
                    value={formFields.userId} 
                    onChange={e => setFormFields({...formFields, userId: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="">Non assigné</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{`${u.firstName} ${u.lastName}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Emplacement / Magasin</label>
                  <select 
                    value={formFields.locationId} 
                    onChange={e => setFormFields({...formFields, locationId: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="">Aucun emplacement</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Commentaires / Remarques (Optionnel)</label>
                  <textarea 
                    rows={2}
                    value={formFields.notes} 
                    onChange={e => setFormFields({...formFields, notes: e.target.value})} 
                    placeholder="Remarques particulières, état physique, historique..."
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>

                {(!editingAsset || !editingAsset.lastAgentCommunication) ? (
                  <div style={{ marginTop: '1rem', padding: '15px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-secondary)', gridColumn: 'span 2' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#ff9f43' }}>
                      <i className="ph ph-wrench" style={{ fontSize: '1.2rem', color: '#ff9f43' }}></i> Spécifications Matérielles (Manuel)
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>OS</label>
                        <input 
                          type="text" 
                          value={formFields.os} 
                          onChange={e => setFormFields({...formFields, os: e.target.value})} 
                          placeholder="Ex: Windows 11 Pro"
                          style={{ width: '100%', padding: '6px 8px', fontSize: '0.82rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Processeur (CPU)</label>
                        <input 
                          type="text" 
                          value={formFields.cpu} 
                          onChange={e => setFormFields({...formFields, cpu: e.target.value})} 
                          placeholder="Ex: Intel Core i5-7300U"
                          style={{ width: '100%', padding: '6px 8px', fontSize: '0.82rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Mémoire RAM</label>
                        <input 
                          type="text" 
                          value={formFields.ram} 
                          onChange={e => setFormFields({...formFields, ram: e.target.value})} 
                          placeholder="Ex: 8 GB"
                          style={{ width: '100%', padding: '6px 8px', fontSize: '0.82rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Stockage</label>
                        <input 
                          type="text" 
                          value={formFields.storage} 
                          onChange={e => setFormFields({...formFields, storage: e.target.value})} 
                          placeholder="Ex: SSD 256 GB"
                          style={{ width: '100%', padding: '6px 8px', fontSize: '0.82rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Adresse IP</label>
                        <input 
                          type="text" 
                          value={formFields.ipAddress} 
                          onChange={e => setFormFields({...formFields, ipAddress: e.target.value})} 
                          placeholder="Ex: 192.168.1.82"
                          style={{ width: '100%', padding: '6px 8px', fontSize: '0.82rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Adresse MAC</label>
                        <input 
                          type="text" 
                          value={formFields.macAddress} 
                          onChange={e => setFormFields({...formFields, macAddress: e.target.value})} 
                          placeholder="Ex: 28:C6:3F:32:26:2F"
                          style={{ width: '100%', padding: '6px 8px', fontSize: '0.82rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Fabricant</label>
                        <input 
                          type="text" 
                          value={formFields.manufacturer} 
                          onChange={e => setFormFields({...formFields, manufacturer: e.target.value})} 
                          placeholder="Ex: Dell Inc."
                          style={{ width: '100%', padding: '6px 8px', fontSize: '0.82rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Modèle</label>
                        <input 
                          type="text" 
                          value={formFields.model} 
                          onChange={e => setFormFields({...formFields, model: e.target.value})} 
                          placeholder="Ex: Latitude 7389"
                          style={{ width: '100%', padding: '6px 8px', fontSize: '0.82rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '1rem', padding: '15px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-secondary)', gridColumn: 'span 2' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
                      <i className="ph ph-cpu" style={{ fontSize: '1.2rem', color: '#3b82f6' }}></i> Spécifications Matérielles (Agent)
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>OS :</span> {editingAsset.os || '-'}</div>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Processeur :</span> {editingAsset.cpu || '-'}</div>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Mémoire RAM :</span> {editingAsset.ram || '-'}</div>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Stockage :</span> {editingAsset.storage || '-'}</div>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Adresse IP :</span> {editingAsset.ipAddress || '-'}</div>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Adresse MAC :</span> {editingAsset.macAddress || '-'}</div>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Fabricant :</span> {editingAsset.manufacturer || '-'}</div>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Modèle :</span> {editingAsset.model || '-'}</div>
                      <div style={{ gridColumn: 'span 2', marginTop: '5px', paddingTop: '5px', borderTop: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Dernier contact Agent :</span> {editingAsset.lastAgentCommunication ? new Date(editingAsset.lastAgentCommunication).toLocaleString('fr-FR') : 'Jamais'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Formulaire adaptatif en 1 colonne sur mobile, 2 colonnes sur tablette/desktop */}
              <div className="responsive-grid-2cols" style={{ marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Code Inventaire</label>
                  <input 
                    type="text" 
                    value={formFields.inventoryCode} 
                    onChange={e => setFormFields({...formFields, inventoryCode: e.target.value})} 
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Modèle / Nom</label>
                  <input 
                    type="text" 
                    value={formFields.name} 
                    onChange={e => setFormFields({...formFields, name: e.target.value})} 
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Type d'équipement</label>
                  <select 
                    value={formFields.type} 
                    onChange={e => setFormFields({...formFields, type: e.target.value})} 
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <optgroup label="── Informatique ──">
                      <option value="Ordinateur Portable">Ordinateur Portable</option>
                      <option value="Ordinateur de Bureau">Ordinateur de Bureau</option>
                      <option value="Serveur">Serveur</option>
                      <option value="Station de Travail">Station de Travail</option>
                      <option value="Tablette">Tablette</option>
                    </optgroup>
                    <optgroup label="── Téléphonie & Mobile ──">
                      <option value="Smartphone">Smartphone</option>
                      <option value="Téléphone IP">Téléphone IP (VoIP)</option>
                    </optgroup>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>N° Série</label>
                  <input 
                    type="text" 
                    value={formFields.serialNumber} 
                    onChange={e => setFormFields({...formFields, serialNumber: e.target.value})} 
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Date d'acquisition</label>
                  <input 
                    type="date" 
                    value={formFields.purchaseDate} 
                    onChange={e => setFormFields({...formFields, purchaseDate: e.target.value})} 
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Garantie (mois)</label>
                  <input 
                    type="number" 
                    value={formFields.warrantyMonths} 
                    onChange={e => setFormFields({...formFields, warrantyMonths: Number(e.target.value)})} 
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Pays d'origine</label>
                  <input 
                    type="text" 
                    value={formFields.country} 
                    onChange={e => setFormFields({...formFields, country: e.target.value})} 
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Statut</label>
                  <select 
                    value={formFields.status} 
                    onChange={e => setFormFields({...formFields, status: e.target.value as any})} 
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="IN_STOCK">En Stock</option>
                    <option value="ASSIGNED">Actif (Assigné)</option>
                    <option value="BROKEN">En Panne</option>
                    <option value="IN_MAINTENANCE">En Maintenance</option>
                    <option value="RETIRED">Réformé</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Assigner à l'utilisateur</label>
                  <select 
                    value={formFields.userId} 
                    onChange={e => setFormFields({...formFields, userId: e.target.value})} 
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="">Non assigné</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{`${u.firstName} ${u.lastName}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Emplacement / Magasin</label>
                  <select 
                    value={formFields.locationId} 
                    onChange={e => setFormFields({...formFields, locationId: e.target.value})} 
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                  >
                    <option value="">Aucun emplacement</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                {(!editingAsset || !editingAsset.lastAgentCommunication) ? (
                  <div style={{ marginTop: '1rem', padding: '15px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-secondary)', gridColumn: '1 / -1' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#ff9f43' }}>
                      <i className="ph ph-wrench" style={{ fontSize: '1.2rem', color: '#ff9f43' }}></i> Spécifications Matérielles (Manuel)
                    </h3>
                    <div className="responsive-grid-2cols">
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>OS</label>
                        <input 
                          type="text" 
                          value={formFields.os} 
                          onChange={e => setFormFields({...formFields, os: e.target.value})} 
                          placeholder="Ex: Windows 11 Pro"
                          style={{ width: '100%', padding: '10px', fontSize: '0.85rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Processeur (CPU)</label>
                        <input 
                          type="text" 
                          value={formFields.cpu} 
                          onChange={e => setFormFields({...formFields, cpu: e.target.value})} 
                          placeholder="Ex: Intel Core i5-7300U"
                          style={{ width: '100%', padding: '10px', fontSize: '0.85rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Mémoire RAM</label>
                        <input 
                          type="text" 
                          value={formFields.ram} 
                          onChange={e => setFormFields({...formFields, ram: e.target.value})} 
                          placeholder="Ex: 8 GB"
                          style={{ width: '100%', padding: '10px', fontSize: '0.85rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Stockage</label>
                        <input 
                          type="text" 
                          value={formFields.storage} 
                          onChange={e => setFormFields({...formFields, storage: e.target.value})} 
                          placeholder="Ex: SSD 256 GB"
                          style={{ width: '100%', padding: '10px', fontSize: '0.85rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Adresse IP</label>
                        <input 
                          type="text" 
                          value={formFields.ipAddress} 
                          onChange={e => setFormFields({...formFields, ipAddress: e.target.value})} 
                          placeholder="Ex: 192.168.1.82"
                          style={{ width: '100%', padding: '10px', fontSize: '0.85rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Adresse MAC</label>
                        <input 
                          type="text" 
                          value={formFields.macAddress} 
                          onChange={e => setFormFields({...formFields, macAddress: e.target.value})} 
                          placeholder="Ex: 28:C6:3F:32:26:2F"
                          style={{ width: '100%', padding: '10px', fontSize: '0.85rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Fabricant</label>
                        <input 
                          type="text" 
                          value={formFields.manufacturer} 
                          onChange={e => setFormFields({...formFields, manufacturer: e.target.value})} 
                          placeholder="Ex: Dell Inc."
                          style={{ width: '100%', padding: '10px', fontSize: '0.85rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Modèle</label>
                        <input 
                          type="text" 
                          value={formFields.model} 
                          onChange={e => setFormFields({...formFields, model: e.target.value})} 
                          placeholder="Ex: Latitude 7389"
                          style={{ width: '100%', padding: '10px', fontSize: '0.85rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '1rem', padding: '15px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-secondary)', gridColumn: '1 / -1' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
                      <i className="ph ph-cpu" style={{ fontSize: '1.2rem', color: '#3b82f6' }}></i> Spécifications Matérielles (Agent)
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>OS :</span> {editingAsset.os || '-'}</div>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Processeur :</span> {editingAsset.cpu || '-'}</div>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Mémoire RAM :</span> {editingAsset.ram || '-'}</div>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Stockage :</span> {editingAsset.storage || '-'}</div>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Adresse IP :</span> {editingAsset.ipAddress || '-'}</div>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Adresse MAC :</span> {editingAsset.macAddress || '-'}</div>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Fabricant :</span> {editingAsset.manufacturer || '-'}</div>
                      <div><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Modèle :</span> {editingAsset.model || '-'}</div>
                      <div style={{ gridColumn: 'span 2', marginTop: '5px', paddingTop: '5px', borderTop: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Dernier contact Agent :</span> {editingAsset.lastAgentCommunication ? new Date(editingAsset.lastAgentCommunication).toLocaleString('fr-FR') : 'Jamais'}
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

      {/* OVERLAY SCANNER QR CODE / CODE-BARRES TERRAIN */}
      {isScannerOpen && (
        <div className="mobile-qr-scanner-overlay">
          <div style={{ textAlign: 'center', width: '100%' }}>
            <h2 style={{ fontSize: '1.4rem', color: 'white', marginBottom: '8px' }}>Scanner de Matériel</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Placez l'étiquette QR ou Code-barres de l'actif dans la zone de visée</p>
          </div>

          <div className="scanner-viewfinder">
            <i className="ph ph-qr-code" style={{ fontSize: '4.5rem', opacity: 0.15, color: 'white' }}></i>
          </div>

          <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Fallback de saisie manuelle si étiquette illisible */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Saisie manuelle si étiquette endommagée</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Saisir Code / Série" 
                  value={scannerManualInput}
                  onChange={(e) => setScannerManualInput(e.target.value)}
                  style={{ flex: 1, padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}
                />
                <button 
                  className="btn-primary" 
                  onClick={() => { handleQrCodeScan(scannerManualInput); setScannerManualInput(''); }}
                  style={{ minHeight: '44px' }}
                >
                  Valider
                </button>
              </div>
            </div>

            {/* Boutons de simulation de scans tests terrain */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                className="btn-primary btn-outline" 
                onClick={() => handleQrCodeScan('PC-LT-001')}
                style={{ flex: 1, fontSize: '0.75rem', minHeight: '44px', borderColor: 'rgba(255,255,255,0.2)' }}
              >
                Simuler Scan existant
              </button>
              <button 
                className="btn-primary btn-outline" 
                onClick={() => handleQrCodeScan(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)}
                style={{ flex: 1, fontSize: '0.75rem', minHeight: '44px', borderColor: 'rgba(255,255,255,0.2)' }}
              >
                Simuler Scan inconnu
              </button>
            </div>

            <button 
              className="btn-primary" 
              onClick={() => setIsScannerOpen(false)}
              style={{ backgroundColor: 'var(--danger)', marginTop: '8px', minHeight: '44px' }}
            >
              Fermer le Scanner
            </button>
          </div>
        </div>
      )}

      {/* MODALE FICHE ACTIF DÉTAILLÉE PAR ONGLET / ACCORDÉON (MOBILE & TABLETTE) */}
      {selectedAssetForDetail && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
          <div className="module-container" style={{ width: '600px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header Fiche */}
            <div style={{ padding: '20px 20px 10px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="status-badge assigned" style={{ marginBottom: '6px', display: 'inline-block' }}>{selectedAssetForDetail.inventoryCode}</span>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{selectedAssetForDetail.name}</h2>
              </div>
              <button className="btn-icon" onClick={() => setSelectedAssetForDetail(null)}>
                <i className="ph ph-x" style={{ fontSize: '1.2rem' }} />
              </button>
            </div>

            {/* Système d'onglets pour navigation fluide mobile sans défilement */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
              <button 
                onClick={() => setDetailActiveTab('info')}
                style={{ flex: 1, padding: '12px', background: 'none', border: 'none', borderBottom: detailActiveTab === 'info' ? '2px solid var(--accent-primary)' : 'none', color: detailActiveTab === 'info' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', minHeight: '44px' }}
              >
                Infos Générales
              </button>
              <button 
                onClick={() => setDetailActiveTab('specs')}
                style={{ flex: 1, padding: '12px', background: 'none', border: 'none', borderBottom: detailActiveTab === 'specs' ? '2px solid var(--accent-primary)' : 'none', color: detailActiveTab === 'specs' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', minHeight: '44px' }}
              >
                Spécifications
              </button>
              <button 
                onClick={() => setDetailActiveTab('docs')}
                style={{ flex: 1, padding: '12px', background: 'none', border: 'none', borderBottom: detailActiveTab === 'docs' ? '2px solid var(--accent-primary)' : 'none', color: detailActiveTab === 'docs' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', minHeight: '44px' }}
              >
                Garantie & Docs
              </button>
            </div>

            {/* Contenu onglet */}
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
              {detailActiveTab === 'info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Type :</strong> {selectedAssetForDetail.type}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>État de l'actif :</strong> <span className={`status-badge ${selectedAssetForDetail.status.toLowerCase()}`}>{selectedAssetForDetail.status}</span></div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Nom d'hôte IT :</strong> <code style={{ color: '#38bdf8' }}>{selectedAssetForDetail.hostname || '-'}</code></div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Pays :</strong> {selectedAssetForDetail.country || '-'}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Utilisateur assigné :</strong> {selectedAssetForDetail.user ? `${selectedAssetForDetail.user.firstName} ${selectedAssetForDetail.user.lastName}` : 'Non assigné'}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Magasin / Emplacement :</strong> {selectedAssetForDetail.location ? selectedAssetForDetail.location.name : 'Aucun'}</div>
                  {selectedAssetForDetail.notes && (
                    <div style={{ marginTop: '8px', padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <strong style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Commentaires / Remarques :</strong>
                      <span style={{ fontSize: '0.88rem', color: 'white' }}>{selectedAssetForDetail.notes}</span>
                    </div>
                  )}
                </div>
              )}

              {detailActiveTab === 'specs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Numéro de série (S/N) :</strong> {selectedAssetForDetail.serialNumber || '-'}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Nom d'hôte (Hostname) :</strong> <code style={{ color: '#38bdf8' }}>{selectedAssetForDetail.hostname || '-'}</code></div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Processeur (CPU) :</strong> {selectedAssetForDetail.cpu || '-'}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Mémoire RAM :</strong> {selectedAssetForDetail.ram || '-'}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Stockage :</strong> {selectedAssetForDetail.storage || '-'}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Système d'exploitation :</strong> {selectedAssetForDetail.os || '-'}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Adresse IP :</strong> {selectedAssetForDetail.ipAddress || '-'}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Adresse MAC :</strong> {selectedAssetForDetail.macAddress || '-'}</div>
                  {selectedAssetForDetail.lastAgentCommunication && (
                    <div style={{ padding: '10px', background: 'var(--bg-primary)', borderRadius: '6px', marginTop: '10px', fontSize: '0.8rem', color: '#7ED957' }}>
                      <i className="ph ph-pulse" style={{ marginRight: '6px' }}></i>
                      Dernière synchronisation Agent : {new Date(selectedAssetForDetail.lastAgentCommunication).toLocaleString('fr-FR')}
                    </div>
                  )}
                </div>
              )}

              {detailActiveTab === 'docs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Pays de provenance :</strong> {selectedAssetForDetail.country || '-'}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Date d'acquisition :</strong> {selectedAssetForDetail.purchaseDate ? new Date(selectedAssetForDetail.purchaseDate).toLocaleDateString() : '-'}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Garantie contractuelle :</strong> {selectedAssetForDetail.warrantyMonths ? `${selectedAssetForDetail.warrantyMonths} mois` : '-'}</div>
                  {selectedAssetForDetail.warrantyEnd && (
                    <div><strong style={{ color: 'var(--text-muted)' }}>Date fin de garantie :</strong> {new Date(selectedAssetForDetail.warrantyEnd).toLocaleDateString()}</div>
                  )}
                </div>
              )}
            </div>

            {/* Actions Fiche */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--bg-primary)' }}>
              {!isReadOnly && (
                <button 
                  className="btn-primary" 
                  onClick={() => { openEditModal(selectedAssetForDetail); setSelectedAssetForDetail(null); }}
                  style={{ minHeight: '44px' }}
                >
                  <i className="ph ph-pencil-simple" style={{ marginRight: '6px' }}></i> Modifier l'actif
                </button>
              )}
              <button 
                className="btn-primary btn-outline" 
                onClick={() => setSelectedAssetForDetail(null)}
                style={{ minHeight: '44px' }}
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};


