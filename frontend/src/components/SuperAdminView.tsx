import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { AboutView } from './AboutView';

interface TenantStats {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  createdAt: string;
  planName: string;
  usage: {
    assets: { current: number; quota: number };
    users: { current: number; quota: number };
  };
}

interface FinancialStats {
  revenue: {
    mrr: number;
    annualized: number;
    currency: string;
  };
  counts: {
    tenants: number;
    active: number;
    trial: number;
    suspended: number;
  };
  infrastructure: {
    assets: number;
    users: number;
    tickets: number;
  };
  distribution: {
    name: string;
    count: number;
    revenue: number;
  }[];
}

interface GatewayConfig {
  provider: string;
  apiKey: string;
  apiSecret: string;
  merchantId?: string;
  isSandbox: boolean;
  isActive: boolean;
}

interface PlanConfig {
  id: string;
  name: string;
  price: number;
  quotaAssets: number;
  quotaUsers: number;
  description?: string;
  features: string[];
  annualDiscountPct: number;
  featuresIncluded?: Record<string, boolean>;
  promos?: PromoConfig[];
  volumeDiscounts?: VolumeDiscountConfig[];
}

interface PromoConfig {
  id: string;
  code: string;
  label: string;
  discountPct: number;
  maxUses?: number;
  usedCount: number;
  validUntil?: string;
  isActive: boolean;
  planId?: string;
  plan?: { name: string };
}

interface VolumeDiscountConfig {
  id: string;
  planId: string;
  plan?: { name: string };
  minAssets: number;
  minUsers: number;
  discountPct: number;
  label: string;
}

interface QuoteConfig {
  id: string;
  quoteNo: string;
  billingCycle?: 'monthly' | 'yearly';
  tenantId?: string;
  tenant?: { name: string; subdomain: string };
  planId: string;
  plan: PlanConfig;
  clientName?: string;
  clientEmail?: string;
  promoCode?: string;
  discountPct: number;
  volumeDiscPct: number;
  subtotal: number;
  tvaRate: number;
  tvaAmount: number;
  total: number;
  notes?: string;
  status: string;
  validUntil?: string;
  createdAt: string;
}

interface InvoiceInfo {
  id: string;
  invoiceNo: string;
  tenantId: string;
  tenant: { name: string; subdomain: string };
  plan: { name: string };
  amountHT: number;
  tvaRate: number;
  tvaAmount: number;
  amountTTC: number;
  status: string;
  dueDate: string;
  createdAt: string;
}

interface TransactionInfo {
  id: string;
  reference: string;
  tenant: { name: string; subdomain: string };
  amount: number;
  type: string;
  paymentMethod: string;
  createdAt: string;
}

interface AdvancedStats {
  conversionRate: number;
  activeCount: number;
  trialCount: number;
  nearQuotaTenants: Array<{
    id: string;
    name: string;
    subdomain: string;
    planName: string;
    usagePct: number;
    currentAssets: number;
    quotaAssets: number;
  }>;
  inactiveTenants: Array<{
    id: string;
    name: string;
    subdomain: string;
    status: string;
    lastActivity: string;
    daysInactive: number;
  }>;
}

interface Collaborator {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  systemRole: string;
  status: string;
  entryDate: string;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldData: any;
  newData: any;
  performedBy: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:    { label: 'Actif',         color: '#22c55e', bg: '#22c55e15' },
  TRIAL:     { label: 'Période d\'essai', color: '#3b82f6', bg: '#3b82f615' },
  SUSPENDED: { label: 'Suspendu',      color: '#ef4444', bg: '#ef444415' },
  CANCELLED: { label: 'Annulé',        color: '#f59e0b', bg: '#f59e0b15' },
};

const PLAN_COLORS: Record<string, string> = {
  Starter: '#3b82f6', Pro: '#8b5cf6', Enterprise: '#f59e0b', Legacy: '#6b7280'
};

export function SuperAdminView({ currentUser }: { currentUser?: any }) {
  const [tenants, setTenants] = useState<TenantStats[]>([]);
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [advStats, setAdvStats] = useState<AdvancedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'finance' | 'about' | 'tenants' | 'payment' | 'pricing' | 'compta' | 'stats-av' | 'profile' | 'collaborators' | 'audit'>('finance');
  const [modifyingId, setModifyingId] = useState<string | null>(null);

  // ── Profil Super-Admin & Collaborateurs ──────────────────────────
  const superAdminSession = currentUser || (() => {
    try { return JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch { return {}; }
  })();
  const systemRoleOrRole = superAdminSession.systemRole || superAdminSession.role;
  const userRole = (superAdminSession.email?.toLowerCase() === 'admin@entreprise.com' || systemRoleOrRole === 'Admin IT') 
    ? 'SuperAdmin' 
    : (systemRoleOrRole || 'SuperAdmin');

  useEffect(() => {
    if (userRole === 'Finance') setActiveTab('pricing');
    else if (userRole === 'Support') setActiveTab('tenants');
    else setActiveTab('finance');
  }, [userRole]);

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabForm, setCollabForm] = useState({ firstName: '', lastName: '', email: '', systemRole: 'Support', password: '' });
  const [savingCollab, setSavingCollab] = useState(false);
  const [editingCollabId, setEditingCollabId] = useState<string | null>(null);
  const [collabCreatedInfo, setCollabCreatedInfo] = useState<{ email: string, tempPass: string } | null>(null);

  // ── Purge Inactifs ───────────────────────────────────────────────
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeableTenants, setPurgeableTenants] = useState<any[]>([]);
  const [isPurging, setIsPurging] = useState(false);
  const [profileRecoveryEmail, setProfileRecoveryEmail] = useState<string>(() =>
    localStorage.getItem('sa_recoveryEmail') || superAdminSession.recoveryEmail || ''
  );
  const [profileRecoveryPhone, setProfileRecoveryPhone] = useState<string>(() =>
    localStorage.getItem('sa_recoveryPhone') || superAdminSession.recoveryPhone || ''
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Recherche & Filtres
  const [searchTerm, setSearchTerm] = useState('');

  // Modale de réinitialisation manuelle pour abonnés sans récupération
  const [resetModalUser, setResetModalUser] = useState<any | null>(null);
  const [resetReason, setResetReason] = useState('');
  const [identityVerified, setIdentityVerified] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleAdminResetNoRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    if (!resetReason || resetReason.trim().length < 5) {
      alert("Un motif de réinitialisation de 5 caractères minimum est requis.");
      return;
    }
    if (!identityVerified) {
      alert("Veuillez confirmer l'identité de l'abonné.");
      return;
    }

    setResetLoading(true);
    try {
      // Appel API simulé / Edge Function
      await api.post(`/admin-tenants/reset-no-recovery`, {
        targetUserId: resetModalUser.id,
        reason: resetReason
      });

      alert(`✓ Réinitialisation validée avec succès. Un e-mail contenant le lien sécurisé de réinitialisation de mot de passe a été envoyé à l'adresse principale de ${resetModalUser.name}.`);
      setResetModalUser(null);
      setResetReason('');
      setIdentityVerified(false);
      loadData();
    } catch (err: any) {
      alert("Erreur lors de la réinitialisation : " + (err.response?.data?.message || err.message));
    } finally {
      setResetLoading(false);
    }
  };

  // Auto-refresh states
  const [isAutoRefreshActive, setIsAutoRefreshActive] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(15);
  const [secondsToNextRefresh, setSecondsToNextRefresh] = useState(15);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [bgError, setBgError] = useState('');

  // Nouveaux états de facturation et statistiques
  const [invoices, setInvoices] = useState<InvoiceInfo[]>([]);
  const [transactions, setTransactions] = useState<TransactionInfo[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [usageStats, setUsageStats] = useState<any>(null);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  // States pour la gestion tarifaire
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [promos, setPromos] = useState<PromoConfig[]>([]);
  const [volumeDiscounts, setVolumeDiscounts] = useState<VolumeDiscountConfig[]>([]);
  const [quotes, setQuotes] = useState<QuoteConfig[]>([]);

  // Modals d'ajout / édition
  const [editingPlan, setEditingPlan] = useState<PlanConfig | null>(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showQuoteResultModal, setShowQuoteResultModal] = useState(false);
  const [selectedTenantProfile, setSelectedTenantProfile] = useState<any>(null);

  // Formulaires d'ajout
  const [promoForm, setPromoForm] = useState({ code: '', label: '', discountPct: 10, maxUses: '', validUntil: '', planId: '' });
  const [discountForm, setDiscountForm] = useState({ planId: '', minAssets: 100, minUsers: 10, discountPct: 10, label: '' });
  const [quoteForm, setQuoteForm] = useState({ planId: '', tenantId: '', clientName: '', clientEmail: '', assetsCount: '', usersCount: '', promoCode: '', applyTva: true, notes: '', billingCycle: 'monthly', customAnnualDiscountPct: '' });
  
  const [generatedQuote, setGeneratedQuote] = useState<QuoteConfig | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingPromo, setSavingPromo] = useState(false);
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [generatingQuoteState, setGeneratingQuoteState] = useState(false);

  // States pour l'édition de quota (licence)
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [targetTenant, setTargetTenant] = useState<TenantStats | null>(null);
  const [newQuotaAssets, setNewQuotaAssets] = useState<number>(0);
  const [savingQuota, setSavingQuota] = useState(false);

  // States pour la configuration Mobile Money
  const [gateways, setGateways] = useState<GatewayConfig[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string>('PayTech');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [isSandbox, setIsSandbox] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [savingGateway, setSavingGateway] = useState(false);
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  // Purge handlers
  const fetchPurgeableTenants = async () => {
    try {
      const res = await api.get('/admin-tenants/purgeable', { headers: { 'X-Tenant-ID': 'legacy' } });
      setPurgeableTenants(res.data || []);
      setShowPurgeModal(true);
    } catch (err: any) {
      alert('Erreur lors du calcul des abonnés purgeables : ' + (err.response?.data?.message || err.message));
    }
  };

  const handleExecutePurge = async () => {
    if (purgeableTenants.length === 0) return;
    const confirmText = prompt(`TAPEZ "PURGE" POUR CONFIRMER LA SUPPRESSION DE ${purgeableTenants.length} ABONNÉS INACTIFS :`);
    if (confirmText !== 'PURGE') {
      alert('Purge annulée. Le texte de sécurité est incorrect.');
      return;
    }

    setIsPurging(true);
    try {
      const tenantIds = purgeableTenants.map(t => t.id);
      const res = await api.post('/admin-tenants/purge-inactive', { tenantIds }, { headers: { 'X-Tenant-ID': 'legacy' } });
      alert(res.data.message || 'Purge effectuée avec succès.');
      setShowPurgeModal(false);
      loadData(false);
    } catch (err: any) {
      alert('Erreur lors de la purge : ' + (err.response?.data?.message || err.message));
    } finally {
      setIsPurging(false);
    }
  };

  const loadData = async (isBackground = false) => {
    try {
      if (isBackground) {
        setBgError('');
      }
      const [
        tenantsRes, 
        statsRes, 
        gatewayRes, 
        plansRes, 
        promosRes, 
        quotesRes, 
        discountsRes, 
        advStatsRes,
        collabRes,
        auditLogsRes
      ] = await Promise.all([
        api.get('/admin-tenants/list', { headers: { 'X-Tenant-ID': 'legacy' } }).catch(() => ({ data: [] })),
        api.get('/admin-tenants/stats-global', { headers: { 'X-Tenant-ID': 'legacy' } }).catch(() => ({ data: null })),
        userRole === 'SuperAdmin' ? api.get('/admin-tenants/payment-gateway', { headers: { 'X-Tenant-ID': 'legacy' } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        api.get('/admin-tenants/plans', { headers: { 'X-Tenant-ID': 'legacy' } }).catch(() => ({ data: [] })),
        (userRole === 'SuperAdmin' || userRole === 'Finance') ? api.get('/admin-tenants/promos', { headers: { 'X-Tenant-ID': 'legacy' } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        api.get('/admin-tenants/quotes', { headers: { 'X-Tenant-ID': 'legacy' } }).catch(() => ({ data: [] })),
        api.get('/admin-tenants/volume-discounts', { headers: { 'X-Tenant-ID': 'legacy' } }).catch(() => ({ data: [] })),
        api.get('/admin-tenants/stats-advanced', { headers: { 'X-Tenant-ID': 'legacy' } }).catch(() => ({ data: null })),
        userRole === 'SuperAdmin' ? api.get('/admin-tenants/collaborators/list', { headers: { 'X-Tenant-ID': 'legacy' } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        userRole === 'SuperAdmin' ? api.get('/admin-tenants/audit-logs', { headers: { 'X-Tenant-ID': 'legacy' } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
      ]);
      
      setTenants(tenantsRes.data || []);
      setStats(statsRes.data || null);
      if (advStatsRes.data) setAdvStats(advStatsRes.data);
      setCollaborators(collabRes.data || []);
      setPlans(plansRes.data || []);
      setPromos(promosRes.data || []);
      setQuotes(quotesRes.data || []);
      setVolumeDiscounts(discountsRes.data || []);
      setAuditLogs(auditLogsRes.data || []);
      
      const gwList: GatewayConfig[] = gatewayRes.data || [];
      setGateways(gwList);
      
      // Charger la configuration existante de la passerelle sélectionnée
      const current = gwList.find(g => g.provider === selectedGateway);
      if (current) {
        setApiKey(current.apiKey);
        setApiSecret(current.apiSecret);
        setMerchantId(current.merchantId || '');
        setIsSandbox(current.isSandbox);
        setIsActive(current.isActive);
      } else {
        setApiKey('');
        setApiSecret('');
        setMerchantId('');
        setIsSandbox(true);
        setIsActive(false);
      }

      // NOUVEAU : Récupérer les factures, transactions et statistiques
      const [invoicesRes, transactionsRes, cohortsRes, usageRes] = await Promise.all([
        api.get('/admin-tenants/invoices').catch(() => ({ data: [] })),
        api.get('/admin-tenants/transactions').catch(() => ({ data: [] })),
        api.get('/admin-tenants/cohorts').catch(() => ({ data: [] })),
        api.get('/admin-tenants/stats-usage').catch(() => ({ data: null }))
      ]);
      setInvoices(invoicesRes.data || []);
      setTransactions(transactionsRes.data || []);
      setCohorts(cohortsRes.data || []);
      setUsageStats(usageRes.data || null);
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Erreur lors de la récupération des données globales.';
      if (isBackground) {
        setBgError(errMsg);
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, [selectedGateway]);

  useEffect(() => {
    setSecondsToNextRefresh(refreshInterval);
  }, [refreshInterval, isAutoRefreshActive]);

  useEffect(() => {
    if (!isAutoRefreshActive) return;

    const timer = setInterval(() => {
      setSecondsToNextRefresh((prev) => {
        if (prev <= 1) {
          setIsBackgroundRefreshing(true);
          loadData(true).finally(() => {
            setIsBackgroundRefreshing(false);
          });
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoRefreshActive, refreshInterval, selectedGateway]);

  const handleModerate = async (tenantId: string, newStatus: string) => {
    if (!window.confirm(`Voulez-vous vraiment changer le statut de ce locataire en "${newStatus}" ?`)) return;
    setModifyingId(tenantId);
    try {
      await api.put(`/admin-tenants/moderate/${tenantId}`, { status: newStatus });
      loadData();
    } catch (err: any) {
      alert("Erreur de modération : " + (err.response?.data?.message || err.message));
    } finally {
      setModifyingId(null);
    }
  };

  const openQuotaModal = (tenant: TenantStats) => {
    setTargetTenant(tenant);
    setNewQuotaAssets(tenant.usage.assets.quota);
    setIsQuotaModalOpen(true);
  };

  const handleSaveQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTenant) return;
    setSavingQuota(true);
    try {
      await api.put(`/admin-tenants/quota/${targetTenant.id}`, { quotaAssets: Number(newQuotaAssets) });
      setIsQuotaModalOpen(false);
      setTargetTenant(null);
      loadData();
    } catch (err: any) {
      alert("Erreur lors de l'enregistrement du quota : " + (err.response?.data?.message || err.message));
    } finally {
      setSavingQuota(false);
    }
  };

  const handleSaveGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGateway(true);
    try {
      const res = await api.post('/admin-tenants/payment-gateway', {
        provider: selectedGateway,
        apiKey,
        apiSecret,
        merchantId,
        isSandbox,
        isActive
      });
      
      if (res.data?.validationError) {
        alert(`Configuration enregistrée mais non publiée :\n⚠️ ${res.data.validationError}`);
      } else {
        alert(`Configuration ${selectedGateway} enregistrée et publiée avec succès.`);
      }
      
      loadData();
    } catch (err: any) {
      alert("Erreur lors de la sauvegarde : " + (err.response?.data?.message || err.message));
    } finally {
      setSavingGateway(false);
    }
  };

  const testGatewayPing = async () => {
    setPingStatus('testing');
    setTimeout(() => {
      // Simulation ping API
      setPingStatus(apiKey.length > 10 ? 'success' : 'failed');
    }, 1200);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(price);
  };

  // Handlers pour la gestion tarifaire
  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setSavingPlan(true);
    try {
      await api.put(`/admin-tenants/plans/${editingPlan.id}`, {
        price: Number(editingPlan.price),
        quotaAssets: Number(editingPlan.quotaAssets),
        quotaUsers: Number(editingPlan.quotaUsers),
        description: editingPlan.description,
        features: editingPlan.features,
        annualDiscountPct: Number(editingPlan.annualDiscountPct),
        featuresIncluded: editingPlan.featuresIncluded || {},
      });
      alert('Plan mis à jour avec succès.');
      setEditingPlan(null);
      loadData();
    } catch (err: any) {
      alert("Erreur lors de la mise à jour du plan : " + (err.response?.data?.message || err.message));
    } finally {
      setSavingPlan(false);
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPromo(true);
    try {
      await api.post('/admin-tenants/promos', {
        code: promoForm.code,
        label: promoForm.label,
        discountPct: Number(promoForm.discountPct),
        maxUses: promoForm.maxUses ? Number(promoForm.maxUses) : undefined,
        validUntil: promoForm.validUntil || undefined,
        planId: promoForm.planId || undefined,
      });
      alert('Code promo créé avec succès.');
      setShowPromoModal(false);
      setPromoForm({ code: '', label: '', discountPct: 10, maxUses: '', validUntil: '', planId: '' });
      loadData();
    } catch (err: any) {
      alert("Erreur de création du code promo : " + (err.response?.data?.message || err.message));
    } finally {
      setSavingPromo(false);
    }
  };

  const handleDeletePromo = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce code promo ?')) return;
    try {
      await api.delete(`/admin-tenants/promos/${id}`);
      loadData();
    } catch (err: any) {
      alert("Erreur de suppression : " + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteQuote = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce devis ?')) return;
    try {
      await api.delete(`/admin-tenants/quotes/${id}`);
      loadData();
    } catch (err: any) {
      alert("Erreur de suppression : " + (err.response?.data?.message || err.message));
    }
  };

  const handleCancelInvoice = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment annuler cette facture suite à un désistement ?')) return;
    try {
      await api.put(`/admin-tenants/invoices/${id}/cancel`);
      loadData();
    } catch (err: any) {
      alert("Erreur d'annulation : " + (err.response?.data?.message || err.message));
    }
  };

  const handleCreateVolumeDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountForm.planId) {
      alert('Veuillez sélectionner un plan.');
      return;
    }
    setSavingDiscount(true);
    try {
      await api.post('/admin-tenants/volume-discounts', {
        planId: discountForm.planId,
        minAssets: Number(discountForm.minAssets),
        minUsers: Number(discountForm.minUsers),
        discountPct: Number(discountForm.discountPct),
        label: discountForm.label || `Remise volume -${discountForm.discountPct}%`,
      });
      alert('Réduction volumétrique ajoutée avec succès.');
      setShowDiscountModal(false);
      setDiscountForm({ planId: '', minAssets: 100, minUsers: 10, discountPct: 10, label: '' });
      loadData();
    } catch (err: any) {
      alert("Erreur de création : " + (err.response?.data?.message || err.message));
    } finally {
      setSavingDiscount(false);
    }
  };

  const handleDeleteVolumeDiscount = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette règle ?')) return;
    try {
      await api.delete(`/admin-tenants/volume-discounts/${id}`);
      loadData();
    } catch (err: any) {
      alert("Erreur de suppression : " + (err.response?.data?.message || err.message));
    }
  };

  const handleGenerateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteForm.planId) {
      alert('Veuillez sélectionner un plan.');
      return;
    }
    setGeneratingQuoteState(true);
    try {
      const res = await api.post('/admin-tenants/quotes/generate', {
        planId: quoteForm.planId,
        tenantId: quoteForm.tenantId || undefined,
        clientName: quoteForm.clientName || undefined,
        clientEmail: quoteForm.clientEmail || undefined,
        assetsCount: quoteForm.assetsCount ? Number(quoteForm.assetsCount) : undefined,
        usersCount: quoteForm.usersCount ? Number(quoteForm.usersCount) : undefined,
        promoCode: quoteForm.promoCode || undefined,
        applyTva: quoteForm.applyTva,
        notes: quoteForm.notes || undefined,
        billingCycle: quoteForm.billingCycle,
        customAnnualDiscountPct: quoteForm.customAnnualDiscountPct !== '' ? Number(quoteForm.customAnnualDiscountPct) : undefined
      });
      setGeneratedQuote(res.data);
      setShowQuoteResultModal(true);
      loadData();
    } catch (err: any) {
      alert("Erreur lors de la génération du devis : " + (err.response?.data?.message || err.message));
    } finally {
      setGeneratingQuoteState(false);
    }
  };

  const handleCreateCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabForm.email || !collabForm.firstName) return;
    setSavingCollab(true);
    setCollabCreatedInfo(null);
    try {
      if (editingCollabId) {
        await api.put(`/admin-tenants/collaborators/${editingCollabId}`, {
          firstName: collabForm.firstName,
          lastName: collabForm.lastName,
          systemRole: collabForm.systemRole,
          status: 'Actif'
        });
        alert('Collaborateur mis à jour.');
        setShowCollabModal(false);
        setEditingCollabId(null);
      } else {
        const res = await api.post('/admin-tenants/collaborators', collabForm);
        setCollabCreatedInfo({ email: res.data.user.email, tempPass: res.data.tempPassword });
        // Ne pas fermer la modal tout de suite pour qu'il puisse voir le mot de passe
      }
      loadData();
    } catch (err: any) {
      alert("Erreur : " + (err.response?.data?.message || err.message));
    } finally {
      setSavingCollab(false);
    }
  };

  const handleDeleteCollaborator = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment révoquer ce collaborateur ?')) return;
    try {
      await api.delete(`/admin-tenants/collaborators/${id}`);
      loadData();
    } catch (err: any) {
      alert("Erreur de suppression : " + (err.response?.data?.message || err.message));
    }
  };

  const handleEditCollaborator = (collab: Collaborator) => {
    setEditingCollabId(collab.id);
    setCollabForm({
      firstName: collab.firstName,
      lastName: collab.lastName,
      email: collab.email,
      systemRole: collab.systemRole,
      password: ''
    });
    setCollabCreatedInfo(null);
    setShowCollabModal(true);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <i className="ph ph-circle-notch" style={{ fontSize: '2rem', animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-alert-error" style={{ margin: '2rem' }}>
        <i className="ph ph-warning-circle" style={{ marginRight: '8px' }} />
        {error}
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: '1.5rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.6; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin-animation {
          display: inline-block;
          animation: spin 1.2s linear infinite;
        }
      `}</style>
      
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>🛠️ Console de Pilotage SaaS</h1>
          <p style={{ color: 'var(--text-muted)' }}>Super-Administration, Abonnés, Finance & Licences globales</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {userRole === 'SuperAdmin' && (
            <button 
              onClick={() => setActiveTab('finance')}
              className={`btn-primary ${activeTab === 'finance' ? '' : 'btn-outline'}`}
              style={{ padding: '8px 16px', borderRadius: '8px', border: activeTab === 'finance' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="ph ph-chart-line" /> Indicateurs & Finance
            </button>
          )}
          {(userRole === 'SuperAdmin' || userRole === 'Support') && (
            <button 
              onClick={() => setActiveTab('tenants')}
              className={`btn-primary ${activeTab === 'tenants' ? '' : 'btn-outline'}`}
              style={{ padding: '8px 16px', borderRadius: '8px', border: activeTab === 'tenants' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="ph ph-buildings" /> Abonnés ({tenants.length})
            </button>
          )}
          {userRole === 'SuperAdmin' && (
            <button 
              onClick={() => setActiveTab('payment')}
              className={`btn-primary ${activeTab === 'payment' ? '' : 'btn-outline'}`}
              style={{ padding: '8px 16px', borderRadius: '8px', border: activeTab === 'payment' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="ph ph-credit-card" /> 💳 Intégration Paiement
            </button>
          )}
          {(userRole === 'SuperAdmin' || userRole === 'Finance') && (
            <>
              <button 
                onClick={() => setActiveTab('pricing')}
                className={`btn-primary ${activeTab === 'pricing' ? '' : 'btn-outline'}`}
                style={{ padding: '8px 16px', borderRadius: '8px', border: activeTab === 'pricing' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="ph ph-currency-dollar" /> 💰 Tarification & Devis
              </button>
              <button 
                onClick={() => setActiveTab('compta')}
                className={`btn-primary ${activeTab === 'compta' ? '' : 'btn-outline'}`}
                style={{ padding: '8px 16px', borderRadius: '8px', border: activeTab === 'compta' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="ph ph-scroll" /> 📄 Comptabilité & Finances
              </button>
            </>
          )}
          {(userRole === 'SuperAdmin' || userRole === 'Support') && (
            <button 
              onClick={() => setActiveTab('stats-av')}
              className={`btn-primary ${activeTab === 'stats-av' ? '' : 'btn-outline'}`}
              style={{ padding: '8px 16px', borderRadius: '8px', border: activeTab === 'stats-av' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="ph ph-presentation-chart" /> 📊 Stats Avancées
            </button>
          )}
          {userRole === 'SuperAdmin' && (
            <button 
              onClick={() => setActiveTab('collaborators')}
              className={`btn-primary ${activeTab === 'collaborators' ? '' : 'btn-outline'}`}
              style={{ padding: '8px 16px', borderRadius: '8px', border: activeTab === 'collaborators' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="ph ph-users-three" /> 👥 Collaborateurs
            </button>
          )}
          {userRole === 'SuperAdmin' && (
            <button 
              onClick={() => setActiveTab('audit')}
              className={`btn-primary ${activeTab === 'audit' ? '' : 'btn-outline'}`}
              style={{ padding: '8px 16px', borderRadius: '8px', border: activeTab === 'audit' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="ph ph-file-search" /> 🕵️ Journal d'Audit
            </button>
          )}
          <button 
            onClick={() => setActiveTab('about')}
            className={`btn-primary ${activeTab === 'about' ? '' : 'btn-outline'}`}
            style={{ padding: '8px 16px', borderRadius: '8px', border: activeTab === 'about' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="ph ph-info" /> À Propos
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`btn-primary ${activeTab === 'profile' ? '' : 'btn-outline'}`}
            style={{
              padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              border: activeTab === 'profile' ? 'none' : '1px solid rgba(139,92,246,0.5)',
              background: activeTab === 'profile' ? 'linear-gradient(135deg, #8b5cf6, #3b82f6)' : 'rgba(139,92,246,0.08)',
              color: activeTab === 'profile' ? 'white' : '#8b5cf6',
              position: 'relative',
            }}
          >
            <i className="ph ph-user-circle" /> Mon Profil
            {(!profileRecoveryEmail && !profileRecoveryPhone) && (
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px',
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#f59e0b', border: '1px solid var(--bg-primary)'
              }} />
            )}
          </button>
        </div>
      </div>

      {/* Auto-Refresh Control Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '10px 20px',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isAutoRefreshActive ? '#22c55e' : '#9ca3af',
            boxShadow: isAutoRefreshActive ? '0 0 8px #22c55e' : 'none',
            animation: isAutoRefreshActive ? 'pulse 2s infinite' : 'none'
          }} />
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {isAutoRefreshActive 
              ? `Mise à jour automatique active (prochaine dans ${secondsToNextRefresh}s)` 
              : 'Mise à jour automatique désactivée'}
          </span>
          {isBackgroundRefreshing && (
            <i className="ph ph-circle-notch" style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-blue)', fontSize: '1rem' }} />
          )}
          {bgError && (
            <span style={{ fontSize: '0.8rem', color: '#ef4444', background: '#ef444415', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i className="ph ph-warning" /> Synchro en échec : {bgError}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Toggle Button */}
          <button
            onClick={() => setIsAutoRefreshActive(!isAutoRefreshActive)}
            style={{
              background: isAutoRefreshActive ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-tertiary)',
              color: isAutoRefreshActive ? '#22c55e' : 'var(--text-secondary)',
              border: `1px solid ${isAutoRefreshActive ? '#22c55e40' : 'var(--border-color)'}`,
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <i className={isAutoRefreshActive ? "ph ph-pause" : "ph ph-play"} style={{ fontSize: '1rem' }} />
            {isAutoRefreshActive ? 'Suspendre' : 'Activer'}
          </button>

          {/* Interval Select */}
          {isAutoRefreshActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fréquence :</span>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={15}>15s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
              </select>
            </div>
          )}

          {/* Manual Refresh Button */}
          <button
            onClick={async () => {
              setIsBackgroundRefreshing(true);
              setBgError('');
              try {
                await loadData(true);
                setSecondsToNextRefresh(refreshInterval);
              } catch (err: any) {
                setBgError(err.response?.data?.message || err.message);
              } finally {
                setIsBackgroundRefreshing(false);
              }
            }}
            disabled={isBackgroundRefreshing}
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <i className={`ph ph-arrows-counter-clockwise ${isBackgroundRefreshing ? 'spin-animation' : ''}`} style={{ fontSize: '1rem' }} />
            Actualiser
          </button>
        </div>
      </div>

      {/* COLLABORATORS TAB */}
      {activeTab === 'collaborators' && userRole === 'SuperAdmin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Gestion de l'Équipe SaaS</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>Ajoutez des collaborateurs avec des accès restreints.</p>
            </div>
            <button
              onClick={() => {
                setCollabForm({ firstName: '', lastName: '', email: '', systemRole: 'Support', password: '' });
                setEditingCollabId(null);
                setCollabCreatedInfo(null);
                setShowCollabModal(true);
              }}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              <i className="ph ph-plus-circle" style={{ fontSize: '1.2rem' }} /> Ajouter un membre
            </button>
          </div>

          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '16px 20px', fontWeight: 600, fontSize: '0.85rem' }}>Utilisateur</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, fontSize: '0.85rem' }}>Rôle Console</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, fontSize: '0.85rem' }}>Date d'ajout</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {collaborators.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Aucun collaborateur trouvé sur la console.
                    </td>
                  </tr>
                ) : (
                  collaborators.map(collab => (
                    <tr key={collab.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
                            {(collab.firstName?.[0] || 'U').toUpperCase()}{(collab.lastName?.[0] || 'U').toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{collab.firstName || 'Sans'} {collab.lastName || 'Nom'}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{collab.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          background: collab.systemRole === 'SuperAdmin' ? '#8b5cf615' : collab.systemRole === 'Finance' ? '#f59e0b15' : '#3b82f615',
                          color: collab.systemRole === 'SuperAdmin' ? '#8b5cf6' : collab.systemRole === 'Finance' ? '#f59e0b' : '#3b82f6',
                          padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-block'
                        }}>
                          {collab.systemRole}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {new Date(collab.entryDate).toLocaleDateString('fr-FR')}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <button onClick={() => handleEditCollaborator(collab)} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '4px', marginRight: '8px' }} title="Modifier">
                          <i className="ph ph-pencil-simple" style={{ fontSize: '1.2rem' }} />
                        </button>
                        <button onClick={() => handleDeleteCollaborator(collab.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Révoquer l'accès">
                          <i className="ph ph-trash" style={{ fontSize: '1.2rem' }} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Modal Ajout/Modif Collaborateur */}
          {showCollabModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '30px', borderRadius: '16px', width: '500px', maxWidth: '95%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.4rem', color: 'var(--text-primary)' }}>
                  {editingCollabId ? 'Modifier un collaborateur' : 'Ajouter un collaborateur'}
                </h3>
                
                {collabCreatedInfo ? (
                  <div style={{ background: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                    <p style={{ margin: '0 0 10px 0', color: '#22c55e', fontWeight: 600 }}>✅ Collaborateur créé avec succès !</p>
                    <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}><strong>Email :</strong> {collabCreatedInfo.email}</p>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}><strong>Mot de passe :</strong> <span style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>{collabCreatedInfo.tempPass}</span></p>
                    <p style={{ margin: '10px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Veuillez copier ce mot de passe et le transmettre au collaborateur.</p>
                  </div>
                ) : (
                  <form onSubmit={handleCreateCollaborator} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Prénom *</label>
                        <input type="text" value={collabForm.firstName} onChange={e => setCollabForm({...collabForm, firstName: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Nom *</label>
                        <input type="text" value={collabForm.lastName} onChange={e => setCollabForm({...collabForm, lastName: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Email (identifiant) *</label>
                      <input type="email" value={collabForm.email} onChange={e => setCollabForm({...collabForm, email: e.target.value})} disabled={!!editingCollabId} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', boxSizing: 'border-box', opacity: editingCollabId ? 0.6 : 1 }} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Rôle SaaS *</label>
                      <select value={collabForm.systemRole} onChange={e => setCollabForm({...collabForm, systemRole: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                        <option value="SuperAdmin">SuperAdmin (Accès total)</option>
                        <option value="Finance">Finance (Tarification, Compta)</option>
                        <option value="Support">Support (Lecture seule, Stats)</option>
                      </select>
                    </div>

                    {!editingCollabId && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Mot de passe (optionnel)</label>
                        <input type="text" value={collabForm.password} onChange={e => setCollabForm({...collabForm, password: e.target.value})} placeholder="Généré automatiquement si vide" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button type="button" onClick={() => setShowCollabModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Annuler</button>
                      <button type="submit" disabled={savingCollab} style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', cursor: 'pointer', fontWeight: 700 }}>{savingCollab ? 'Enregistrement...' : (editingCollabId ? 'Enregistrer' : 'Ajouter')}</button>
                    </div>
                  </form>
                )}
                
                {collabCreatedInfo && (
                  <button onClick={() => setShowCollabModal(false)} style={{ width: '100%', padding: '10px', marginTop: '20px', borderRadius: '8px', border: 'none', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>Fermer</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '16px', padding: '24px', display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ph-fill ph-shield-check" style={{ fontSize: '2rem', color: 'white' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {superAdminSession.firstName || 'Super'} {superAdminSession.lastName || 'Admin'}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <i className="ph ph-envelope" style={{ marginRight: '4px' }} />
                {superAdminSession.email || 'admin@entreprise.com'}
                <span style={{ marginLeft: '10px', background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>SUPER-ADMIN</span>
              </p>
            </div>
          </div>

          {/* Feedback message */}
          {profileMsg && (
            <div style={{
              padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', gap: '10px',
              background: profileMsg.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${profileMsg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: profileMsg.type === 'success' ? '#22c55e' : '#ef4444',
            }}>
              <i className={`ph-bold ph-${profileMsg.type === 'success' ? 'check-circle' : 'warning-circle'}`} />
              {profileMsg.text}
            </div>
          )}

          {/* Contacts de récupération */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ph-fill ph-key" style={{ fontSize: '1.2rem', color: 'white' }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Contacts de Récupération</h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Utilisés pour réinitialiser votre mot de passe Super-Admin en cas de perte d'accès</p>
              </div>
            </div>

            {/* Badge statut */}
            <div style={{ margin: '16px 0', padding: '10px 14px', borderRadius: '10px', background: profileRecoveryEmail || profileRecoveryPhone ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${profileRecoveryEmail || profileRecoveryPhone ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: profileRecoveryEmail || profileRecoveryPhone ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
              <i className={`ph-bold ph-${profileRecoveryEmail || profileRecoveryPhone ? 'check-circle' : 'warning'}`} />
              {profileRecoveryEmail || profileRecoveryPhone
                ? 'Récupération configurée — votre accès peut être restauré automatiquement.'
                : 'Récupération non configurée — renseignez au moins un contact pour sécuriser votre accès.'}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setProfileSaving(true);
                setProfileMsg(null);
                try {
                  await api.patch('/auth/super-admin/profile', {
                    recoveryEmail: profileRecoveryEmail.trim() || undefined,
                    recoveryPhone: profileRecoveryPhone.trim() || undefined,
                  });
                  // Persister en localStorage pour survie au rechargement
                  localStorage.setItem('sa_recoveryEmail', profileRecoveryEmail.trim());
                  localStorage.setItem('sa_recoveryPhone', profileRecoveryPhone.trim());
                  // Mettre à jour la session courante
                  const session = JSON.parse(localStorage.getItem('currentUser') || '{}');
                  session.recoveryEmail = profileRecoveryEmail.trim() || null;
                  session.recoveryPhone = profileRecoveryPhone.trim() || null;
                  localStorage.setItem('currentUser', JSON.stringify(session));
                  setProfileMsg({ type: 'success', text: 'Contacts de récupération enregistrés avec succès !' });
                  setTimeout(() => setProfileMsg(null), 4000);
                } catch (err: any) {
                  setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Erreur lors de la sauvegarde.' });
                } finally {
                  setProfileSaving(false);
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}
            >
              {/* Email de récupération */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <i className="ph ph-envelope" style={{ marginRight: '4px' }} /> Email de récupération
                </label>
                <input
                  type="email"
                  value={profileRecoveryEmail}
                  onChange={e => setProfileRecoveryEmail(e.target.value)}
                  placeholder="ex: ibrahima@kpsyinformatique.com"
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
                <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Adresse email personnelle ou de secours (différente de admin@entreprise.com)</p>
              </div>

              {/* Téléphone de récupération */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <i className="ph ph-device-mobile" style={{ marginRight: '4px' }} /> Téléphone de récupération
                </label>
                <input
                  type="tel"
                  value={profileRecoveryPhone}
                  onChange={e => setProfileRecoveryPhone(e.target.value)}
                  placeholder="ex: +221 77 803 47 58"
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
                <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Numéro de téléphone au format international (ex: +221 77 000 00 00)</p>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setProfileRecoveryEmail(localStorage.getItem('sa_recoveryEmail') || '');
                    setProfileRecoveryPhone(localStorage.getItem('sa_recoveryPhone') || '');
                    setProfileMsg(null);
                  }}
                  style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: profileSaving ? 0.7 : 1 }}
                >
                  <i className="ph ph-floppy-disk" />
                  {profileSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>

          {/* Info box */}
          <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '12px', padding: '14px 18px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <i className="ph-bold ph-info" style={{ color: '#3b82f6', fontSize: '1.1rem', marginTop: '1px', flexShrink: 0 }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Comment utiliser la récupération ?</strong><br />
              Sur la page de connexion, cliquez sur <strong>«&nbsp;Console SaaS&nbsp;»</strong> en bas à gauche du lien "Mot de passe oublié". 
              Saisissez l'email ou le téléphone de récupération enregistré ici. 
              Un code OTP à 6 chiffres vous sera fourni (en démo : affiché à l'écran). 
              Saisissez ce code pour définir un nouveau mot de passe.
            </div>
          </div>

        </div>
      )}

      {/* AUDIT TAB */}
      {activeTab === 'audit' && userRole === 'SuperAdmin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '16px 24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="ph-fill ph-file-search" style={{ color: '#8b5cf6' }} /> Journal d'Audit
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '6px 12px', borderRadius: '8px' }}>
              Historique des actions de la Console SaaS
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date & Heure</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Auteur</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Action</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Entité / Cible</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Détails (Nouvelles données)</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Aucun journal d'audit enregistré.</td></tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{log.performedBy}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.entityType.replace('SaaS_', '')}</div>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.entityId}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {log.newData && Object.keys(log.newData).length > 0 ? (
                            <pre style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '6px 10px', borderRadius: '6px', maxWidth: '280px', overflowX: 'auto', border: '1px solid var(--border-color)' }}>
                              {JSON.stringify(log.newData, null, 2)}
                            </pre>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>Aucune donnée</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STATS AVANCEES TAB */}
      {activeTab === 'stats-av' && (userRole === 'SuperAdmin' || userRole === 'Support') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Taux de conversion */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #10b981, #047857)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ph-fill ph-trend-up" style={{ fontSize: '1.8rem', color: 'white' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Taux de Conversion (Actif vs Essai)</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>{advStats?.conversionRate ?? 0}%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{advStats?.activeCount ?? 0} actifs / {(advStats?.activeCount ?? 0) + (advStats?.trialCount ?? 0)} engagés</div>
              </div>
            </div>

            {/* Total Inactifs */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ph-fill ph-warning" style={{ fontSize: '1.8rem', color: 'white' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Abonnés inactifs (&gt; 30j)</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444' }}>{advStats?.inactiveTenants.length ?? 0}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Risque élevé de désabonnement (Churn)</div>
              </div>
            </div>

            {/* Total Proche Quota */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ph-fill ph-rocket-launch" style={{ fontSize: '1.8rem', color: 'white' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Abonnés proches du quota (&gt; 85%)</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>{advStats?.nearQuotaTenants.length ?? 0}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Opportunité de montée en gamme (Upsell)</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Table Abonnés Inactifs */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="ph-bold ph-ghost" style={{ fontSize: '1.2rem', color: '#ef4444' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Alerte Churn (Inactifs &gt; 30j)</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 20px', fontWeight: 600 }}>Locataire</th>
                      <th style={{ padding: '12px 20px', fontWeight: 600 }}>Statut</th>
                      <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Inactif depuis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!advStats || advStats.inactiveTenants.length === 0) ? (
                      <tr>
                        <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          Aucun locataire inactif.
                        </td>
                      </tr>
                    ) : (
                      advStats.inactiveTenants.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.subdomain}</div>
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: STATUS_LABELS[t.status]?.bg, color: STATUS_LABELS[t.status]?.color }}>
                              {STATUS_LABELS[t.status]?.label || t.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>
                            {t.daysInactive} jours
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table Abonnés Proches Quota */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="ph-bold ph-trend-up" style={{ fontSize: '1.2rem', color: '#f59e0b' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Opportunités d'Upsell (Quotas)</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 20px', fontWeight: 600 }}>Locataire</th>
                      <th style={{ padding: '12px 20px', fontWeight: 600 }}>Actifs (Matériel)</th>
                      <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>% Utilisé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!advStats || advStats.nearQuotaTenants.length === 0) ? (
                      <tr>
                        <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          Aucun locataire proche de son quota.
                        </td>
                      </tr>
                    ) : (
                      advStats.nearQuotaTenants.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.planName}</div>
                          </td>
                          <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {t.currentAssets} / {t.quotaAssets}
                          </td>
                          <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                              <div style={{ flex: 1, height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', maxWidth: '60px' }}>
                                <div style={{ width: `${Math.min(t.usagePct, 100)}%`, height: '100%', background: t.usagePct >= 95 ? '#ef4444' : '#f59e0b', borderRadius: '3px' }} />
                              </div>
                              <span style={{ fontWeight: 700, color: t.usagePct >= 95 ? '#ef4444' : '#f59e0b', fontSize: '0.85rem' }}>
                                {t.usagePct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* FINANCE & INFRA TAB */}
      {activeTab === 'finance' && userRole === 'SuperAdmin' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Revenue Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #22c55e, #15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ph-fill ph-wallet" style={{ fontSize: '1.4rem', color: 'white' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Revenu Mensuel (MRR)</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#22c55e' }}>{formatPrice(stats.revenue.mrr)}</div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ph-fill ph-chart-line-up" style={{ fontSize: '1.4rem', color: 'white' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Revenu Annuel (ARR)</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatPrice(stats.revenue.annualized)}</div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ph-fill ph-buildings" style={{ fontSize: '1.4rem', color: 'white' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Abonnés Actifs / Période d'essai</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {stats.counts.active} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>/ {stats.counts.trial} d'essais</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            
            {/* Plan Distribution */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-crown" style={{ color: '#f59e0b' }} /> Ventilation des Abonnements
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.distribution.map(plan => {
                  const color = PLAN_COLORS[plan.name] ?? '#6b7280';
                  const totalCount = stats.counts.tenants || 1;
                  const pct = Math.round((plan.count / totalCount) * 100);

                  return (
                    <div key={plan.name} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          <i className="ph ph-circle-fill" style={{ color, fontSize: '0.7rem', marginRight: '6px' }} />
                          Plan {plan.name}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          <strong>{plan.count} tenant(s)</strong> ({pct}%) · MRR: {formatPrice(plan.revenue)}
                        </span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '50px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '50px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Infrastructure metrics */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-desktop" style={{ color: '#3b82f6' }} /> Charge Globale d'Infrastructure
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', textAlign: 'center' }}>
                
                <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                  <i className="ph ph-cpu" style={{ fontSize: '1.5rem', color: '#8b5cf6', marginBottom: '6px' }} />
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.infrastructure.assets}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Actifs sous gestion</span>
                </div>

                <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                  <i className="ph ph-users-three" style={{ fontSize: '1.5rem', color: '#3b82f6', marginBottom: '6px' }} />
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.infrastructure.users}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Comptes Utilisateurs</span>
                </div>

                <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                  <i className="ph ph-chat-centered-text" style={{ fontSize: '1.5rem', color: '#f59e0b', marginBottom: '6px' }} />
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.infrastructure.tickets}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tickets d'incidents</span>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ABOUT TAB */}
      {activeTab === 'about' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '5px' }}>KPSyDesk Console</h2>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-blue)', fontWeight: 500 }}>IT Asset Management v3.0 (PRO)</h3>
            </div>

            <div className="module-container" style={{ maxWidth: '750px', width: '100%', marginBottom: '2rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-primary)' }}>Informations Techniques & SaaS</h3>
              <ul style={{ listStyle: 'none', lineHeight: 2, color: 'var(--text-secondary)', paddingLeft: 0 }}>
                <li><strong>Version de l'application :</strong> 3.0.0 (Multi-Tenant)</li>
                <li><strong>Type de licence :</strong> SaaS Commercial</li>
                <li><strong>Dernière mise à jour :</strong> Juillet 2026</li>
              </ul>
            </div>

            <div className="module-container" style={{ maxWidth: '750px', width: '100%', marginBottom: '2rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-primary)' }}>Architecture de l'Application</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.6' }}>
                L'application <strong>KPSyDesk ITAM</strong> est conçue sur une architecture client-serveur moderne, découplée et conteneurisée sous Docker. Voici les composants technologiques principaux de l'architecture :
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ color: 'var(--accent-blue)', fontSize: '1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="ph ph-desktop" style={{ fontSize: '1.2rem' }}></i>
                    Frontend (Client)
                  </h4>
                  <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    <li><strong>Framework :</strong> React 18 & TypeScript</li>
                    <li><strong>Outil de build :</strong> Vite (rechargement à chaud ultra-rapide)</li>
                    <li><strong>Serveur de prod :</strong> Nginx conteneurisé</li>
                    <li><strong>Graphiques :</strong> Chart.js</li>
                    <li><strong>Exportations :</strong> SheetJS (Excel) & jsPDF</li>
                  </ul>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ color: 'var(--accent-blue)', fontSize: '1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="ph ph-cpu" style={{ fontSize: '1.2rem' }}></i>
                    Backend (Serveur API)
                  </h4>
                  <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    <li><strong>Framework :</strong> NestJS (Node.js d'entreprise)</li>
                    <li><strong>Langage :</strong> TypeScript</li>
                    <li><strong>ORM :</strong> Prisma ORM</li>
                    <li><strong>Sécurité :</strong> JWT multi-tenant & RLS</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="module-container" style={{ maxWidth: '750px', width: '100%', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ marginBottom: '0.5rem', color: 'white' }}>Développement & Assistance</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Conçu et réalisé par :</p>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '10px' }}>Ibrahima NDIAYE</h2>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '0.9rem', color: 'var(--accent-blue)' }}>
                <a href="mailto:neguinho.ndiaye@gmail.com" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <i className="ph ph-envelope"></i> neguinho.ndiaye@gmail.com
                </a>
                <a href="tel:+221778034756" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <i className="ph ph-phone"></i> +221 77 803 47 56
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TENANTS TAB */}
      {activeTab === 'tenants' && (userRole === 'SuperAdmin' || userRole === 'Support') && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Liste des locataires enregistrés</strong>
              <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', borderRadius: '50px', padding: '3px 12px', fontSize: '0.75rem', fontWeight: 600, marginLeft: '10px' }}>
                {tenants.length} Entreprises
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={fetchPurgeableTenants}
                className="btn-primary"
                style={{ background: '#ef4444', borderColor: '#ef4444', padding: '6px 12px', fontSize: '0.8rem' }}
                title="Purger les comptes inactifs depuis plus de 15 jours après leur période d'essai"
              >
                <i className="ph ph-trash" style={{ marginRight: '6px' }} />
                Purger les inactifs
              </button>
              <input
                type="text"
                placeholder="Rechercher nom, subdomain..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'white',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  minWidth: '200px'
                }}
              />
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '14px 20px' }}>Entreprise</th>
                  <th>Sous-domaine / URL</th>
                  <th>Plan Actif</th>
                  <th>Sécurité / Récup.</th>
                  <th>Statut</th>
                  <th>Utilisation (Actifs / Users)</th>
                  <th>Création</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants
                  .filter(t => {
                    const term = searchTerm.toLowerCase();
                    return t.name.toLowerCase().includes(term) || t.subdomain.toLowerCase().includes(term);
                  })
                  .map(t => {
                    const status = STATUS_LABELS[t.status] ?? STATUS_LABELS['ACTIVE'];
                    const planColor = PLAN_COLORS[t.planName] ?? '#6b7280';
                    
                    // Dans l'app d'inventaire, (t as any).recoveryEmail et recoveryPhone
                    // représentent l'adresse et le tel de l'administrateur du tenant.
                    const hasRecovery = !!((t as any).recoveryEmail || (t as any).recoveryPhone);
                    
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {t.name}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <code>{t.subdomain}.inventaire-parc.com</code>
                        </td>
                        <td>
                          <span style={{ background: `${planColor}15`, color: planColor, border: `1px solid ${planColor}40`, borderRadius: '6px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
                            {t.planName}
                          </span>
                        </td>
                        <td>
                          {hasRecovery ? (
                            <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>
                              ✓ Sécurisé {(t as any).recoveryPhone ? '📱' : ''}{(t as any).recoveryEmail ? '✉️' : ''}
                            </span>
                          ) : (
                            <span style={{
                              padding: '2px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)',
                              color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700
                            }}>
                              ⚠️ Pas de récupération
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ background: status.bg, color: status.color, border: `1px solid ${status.color}30`, borderRadius: '6px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: 600 }}>
                            {status.label}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          <i className="ph ph-desktop" style={{ marginRight: '4px' }} />
                          {t.usage.assets.current} / {t.usage.assets.quota >= 99999 ? '∞' : t.usage.assets.quota}
                          <br />
                          <i className="ph ph-users" style={{ marginRight: '4px' }} />
                          {t.usage.users.current} / {t.usage.users.quota >= 99999 ? '∞' : t.usage.users.quota}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {new Intl.DateTimeFormat('fr-FR').format(new Date(t.createdAt))}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => setSelectedTenantProfile(t)}
                              style={{
                                background: 'var(--bg-tertiary)', color: 'var(--accent-blue)', border: '1px solid var(--border-color)',
                                borderRadius: '6px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600,
                                cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              <i className="ph ph-identification-card" /> Voir Fiche
                            </button>

                            <button
                              onClick={() => openQuotaModal(t)}
                              style={{
                                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)',
                                borderRadius: '6px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600,
                                cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              <i className="ph ph-key" /> Licences
                            </button>

                            <button
                              onClick={() => {
                                if (hasRecovery) {
                                  alert("Cet abonné dispose déjà d'un moyen de récupération. Utilisez le flow self-service.");
                                } else {
                                  setResetModalUser(t);
                                }
                              }}
                              style={{
                                background: hasRecovery ? 'rgba(71, 85, 105, 0.1)' : 'rgba(239, 68, 68, 0.15)',
                                color: hasRecovery ? 'var(--text-muted)' : '#ef4444',
                                border: hasRecovery ? '1px solid var(--border-color)' : '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '6px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600,
                                cursor: hasRecovery ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
                              }}
                            >
                              🔑 Reset Manuel
                            </button>

                            {t.status === 'ACTIVE' || t.status === 'TRIAL' ? (
                              <button
                                onClick={() => handleModerate(t.id, 'SUSPENDED')}
                                disabled={modifyingId !== null}
                                style={{
                                  background: '#ef444415', color: '#ef4444', border: '1px solid #ef444440',
                                  borderRadius: '6px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600,
                                  cursor: 'pointer', transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#ef444425')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#ef444415')}
                              >
                                <i className="ph ph-lock" style={{ marginRight: '4px' }} /> Suspendre
                              </button>
                            ) : (
                              <button
                                onClick={() => handleModerate(t.id, 'ACTIVE')}
                                disabled={modifyingId !== null}
                                style={{
                                  background: '#22c55e15', color: '#22c55e', border: '1px solid #22c55e40',
                                  borderRadius: '6px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600,
                                  cursor: 'pointer', transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#22c55e25')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#22c55e15')}
                              >
                                <i className="ph ph-key" style={{ marginRight: '4px' }} /> Réactiver
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MOBILE MONEY INTEGRATION TAB */}
      {activeTab === 'payment' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          
          {/* Provider Selection */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '8px' }}>💳 Choisir un intégrateur</strong>
            {[
              { id: 'PayTech', name: 'PayTech (Orange Money, Wave, Free)', logo: '⚡' },
              { id: 'Wave', name: 'Wave Direct API (Sénégal / Côte d\'Ivoire)', logo: '🌊' },
              { id: 'PayDunya', name: 'PayDunya (Sénégal / Côte d\'Ivoire / Bénin)', logo: '🌴' },
              { id: 'FedaPay', name: 'FedaPay (Afrique de l\'Ouest / Centrale)', logo: '💳' },
            ].map(gw => (
              <label key={gw.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                border: selectedGateway === gw.id ? `2px solid var(--accent-blue)` : '1px solid var(--border-color)',
                background: selectedGateway === gw.id ? `rgba(59, 130, 246, 0.1)` : 'var(--bg-tertiary)',
                transition: 'all 0.2s'
              }}>
                <input 
                  type="radio" 
                  name="provider" 
                  value={gw.id} 
                  checked={selectedGateway === gw.id} 
                  onChange={() => setSelectedGateway(gw.id)}
                  style={{ accentColor: 'var(--accent-blue)' }} 
                />
                <span style={{ fontSize: '1.2rem' }}>{gw.logo}</span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{gw.name}</span>
              </label>
            ))}
          </div>

          {/* Config Form */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>
              ⚙️ Paramètres API - {selectedGateway}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '24px' }}>
              Configurez vos clés API de production ou de test pour recevoir les paiements par Mobile Money des abonnés.
            </p>

            <form onSubmit={handleSaveGateway} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Clé d'API Publique (API Public Key) *
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="pk_live_..."
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Clé d'API Secrète (API Secret Key) *
                  </label>
                  <input
                    type="password"
                    value={apiSecret}
                    onChange={e => setApiSecret(e.target.value)} // stocké dans apiSecret
                    placeholder="sk_live_..."
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                    required
                  />
                </div>
              </div>

              {['PayTech', 'PayDunya'].includes(selectedGateway) && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    {selectedGateway === 'PayDunya' ? "Token d'Application (Master Key / Token)" : "Code Marchand (Merchant ID)"}
                  </label>
                  <input
                    type="text"
                    value={merchantId}
                    onChange={e => setMerchantId(e.target.value)}
                    placeholder={selectedGateway === 'PayDunya' ? "Ex: mp_live_..." : "Ex: march_8a927..."}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '2rem', padding: '12px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input 
                    type="checkbox" 
                    checked={isSandbox} 
                    onChange={e => setIsSandbox(e.target.checked)} 
                    style={{ accentColor: 'var(--accent-blue)' }}
                  />
                  Mode Sandbox / Test
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input 
                    type="checkbox" 
                    checked={isActive} 
                    onChange={e => setIsActive(e.target.checked)} 
                    style={{ accentColor: 'var(--accent-blue)' }}
                  />
                  Activer cette passerelle de paiement
                </label>
              </div>

              <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>🔗 URL Webhook automatique</div>
                <code style={{ color: 'var(--accent-blue)', wordBreak: 'break-all' }}>
                  http://api.inventaire-parc.com/api/subscriptions/webhook/{selectedGateway.toLowerCase()}
                </code>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Copiez cette URL de notification dans le tableau de bord de votre intégrateur pour valider les paiements en direct.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={testGatewayPing}
                  disabled={pingStatus === 'testing'}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px',
                    border: '1px solid var(--border-color)', background: 'transparent',
                    color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  {pingStatus === 'testing' ? (
                    'Connexion...'
                  ) : (
                    <><i className="ph ph-plugs" /> Tester la clé API</>
                  )}
                </button>
                <button
                  type="submit"
                  disabled={savingGateway}
                  style={{
                    flex: 2, padding: '10px', borderRadius: '8px',
                    border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    color: 'white', cursor: 'pointer', fontWeight: 700
                  }}
                >
                  {savingGateway ? 'Enregistrement...' : '✓ Enregistrer la configuration'}
                </button>
              </div>

              {pingStatus === 'success' && (
                <div style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="ph-fill ph-check-circle" /> Connexion réussie à l'API de {selectedGateway} ✅
                </div>
              )}
              {pingStatus === 'failed' && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="ph-fill ph-x-circle" /> Clés d'API incorrectes ou connexion impossible ❌
                </div>
              )}

            </form>
          </div>
        </div>
      )}

      {/* TARIFICATION & DEVIS TAB */}
      {activeTab === 'pricing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* PLANS SECTION */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>📋 Gestion des Plans Tarifaires</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 0' }}>Configurez les prix de base, quotas et fonctionnalités incluses par défaut</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {plans.map(p => (
                <div key={p.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', background: 'var(--bg-tertiary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.1rem', color: PLAN_COLORS[p.name] || 'var(--text-primary)' }}>{p.name}</span>
                      <button 
                        onClick={() => setEditingPlan(p)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 600 }}
                      >
                        <i className="ph ph-pencil" /> Modifier
                      </button>
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '15px' }}>
                      {formatPrice(p.price)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ mois</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '15px', minHeight: '40px' }}>{p.description || 'Aucune description disponible.'}</p>
                    
                    <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <li><strong>{p.quotaAssets >= 99999 ? 'Actifs illimités' : `${p.quotaAssets} actifs max`}</strong></li>
                      <li><strong>{p.quotaUsers >= 99999 ? 'Utilisateurs illimités' : `${p.quotaUsers} utilisateurs max`}</strong></li>
                      {p.features && p.features.map((f, i) => (
                        <li key={i}><i className="ph ph-check" style={{ color: '#22c55e', marginRight: '4px' }} />{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PROMOS & VOLUME DISCOUNTS SECTION */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '2rem' }}>
            
            {/* Promo Codes */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🏷️ Codes Promos</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 0' }}>Remises globales temporaires applicables</p>
                </div>
                <button 
                  onClick={() => setShowPromoModal(true)}
                  className="btn-primary" 
                  style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <i className="ph ph-plus" /> Créer
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Code</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Remise</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Utilisations</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Validité</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promos.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Aucun code promo actif.</td>
                      </tr>
                    ) : promos.map(pr => (
                      <tr key={pr.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>{pr.code}</td>
                        <td style={{ padding: '10px', color: '#22c55e', fontWeight: 600 }}>-{pr.discountPct}%</td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{pr.usedCount} {pr.maxUses ? `/ ${pr.maxUses}` : ''}</td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                          {pr.validUntil ? new Date(pr.validUntil).toLocaleDateString('fr-FR') : 'Illimité'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleDeletePromo(pr.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                            title="Supprimer"
                          >
                            <i className="ph ph-trash" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Volume Discounts */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>📊 Réductions Volumétriques</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 0' }}>Remises par paliers en fonction des quotas</p>
                </div>
                <button 
                  onClick={() => setShowDiscountModal(true)}
                  className="btn-primary" 
                  style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <i className="ph ph-plus" /> Ajouter
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Plan</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Paliers requis</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Réduction</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Label</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volumeDiscounts.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Aucun palier configuré.</td>
                      </tr>
                    ) : volumeDiscounts.map(vd => (
                      <tr key={vd.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px', color: 'var(--text-primary)', fontWeight: 600 }}>{vd.plan?.name || 'Inconnu'}</td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                          {vd.minAssets > 0 && `Assets: ${vd.minAssets} `}
                          {vd.minUsers > 0 && `Users: ${vd.minUsers}`}
                        </td>
                        <td style={{ padding: '10px', color: '#22c55e', fontWeight: 600 }}>-{vd.discountPct}%</td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{vd.label}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleDeleteVolumeDiscount(vd.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                            title="Supprimer"
                          >
                            <i className="ph ph-trash" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* QUOTE GENERATOR SECTION */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
            
            {/* Formulaire de création */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📄 Générateur de Devis Professionnel
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
                Générez des devis personnalisés pour les clients et prospects de la plateforme avec application optionnelle de la TVA à 18%
              </p>

              <form onSubmit={handleGenerateQuote} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Plan de base *</label>
                    <select
                      value={quoteForm.planId}
                      onChange={e => setQuoteForm({ ...quoteForm, planId: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                      required
                    >
                      <option value="">-- Choisir un plan --</option>
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({formatPrice(p.price)}/mois)</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Client Abonné (optionnel)</label>
                    <select
                      value={quoteForm.tenantId}
                      onChange={e => setQuoteForm({ ...quoteForm, tenantId: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                    >
                      <option value="">-- Client non inscrit --</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.subdomain}.kpsy.com)</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!quoteForm.tenantId && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Nom du prospect</label>
                      <input
                        type="text"
                        placeholder="Ex: Entreprise X"
                        value={quoteForm.clientName}
                        onChange={e => setQuoteForm({ ...quoteForm, clientName: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>E-mail du prospect</label>
                      <input
                        type="email"
                        placeholder="contact@entreprise.com"
                        value={quoteForm.clientEmail}
                        onChange={e => setQuoteForm({ ...quoteForm, clientEmail: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Volume d'actifs ciblés</label>
                    <input
                      type="number"
                      placeholder="Laisser vide pour quotas plan"
                      value={quoteForm.assetsCount}
                      onChange={e => setQuoteForm({ ...quoteForm, assetsCount: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Volume d'utilisateurs ciblés</label>
                    <input
                      type="number"
                      placeholder="Laisser vide pour quotas plan"
                      value={quoteForm.usersCount}
                      onChange={e => setQuoteForm({ ...quoteForm, usersCount: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {/* Choix d'abonnement annuel avec réduction modulable */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Périodicité Facturation</label>
                    <select
                      value={quoteForm.billingCycle}
                      onChange={e => setQuoteForm({ ...quoteForm, billingCycle: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                    >
                      <option value="monthly">Mensuel</option>
                      <option value="yearly">Annuel (Engagement 12 mois)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      Taux Réduction Annuelle (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Laisser vide pour réduction plan"
                      disabled={quoteForm.billingCycle !== 'yearly'}
                      value={quoteForm.customAnnualDiscountPct}
                      onChange={e => setQuoteForm({ ...quoteForm, customAnnualDiscountPct: e.target.value })}
                      style={{ 
                        width: '100%', padding: '10px', borderRadius: '8px', 
                        border: '1px solid var(--border-color)', 
                        background: quoteForm.billingCycle !== 'yearly' ? 'rgba(71,85,105,0.1)' : 'var(--bg-tertiary)', 
                        color: quoteForm.billingCycle !== 'yearly' ? 'var(--text-muted)' : 'var(--text-primary)', 
                        fontSize: '0.85rem', cursor: quoteForm.billingCycle !== 'yearly' ? 'not-allowed' : 'text'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Code Promotionnel</label>
                    <input
                      type="text"
                      placeholder="Ex: PROMO25"
                      value={quoteForm.promoCode}
                      onChange={e => setQuoteForm({ ...quoteForm, promoCode: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%', paddingTop: '20px' }}>
                    <input
                      type="checkbox"
                      id="applyTva"
                      checked={quoteForm.applyTva}
                      onChange={e => setQuoteForm({ ...quoteForm, applyTva: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--accent-blue)' }}
                    />
                    <label htmlFor="applyTva" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>TVA de 18%</label>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Commentaires / Notes (optionnel)</label>
                  <textarea
                    placeholder="Notes additionnelles visibles sur le devis..."
                    value={quoteForm.notes}
                    onChange={e => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem', minHeight: '60px', resize: 'vertical' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={generatingQuoteState}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  {generatingQuoteState ? (
                    <><i className="ph ph-circle-notch" style={{ animation: 'spin 1s linear infinite' }} /> Génération en cours...</>
                  ) : (
                    '📄 Générer & Afficher le Devis'
                  )}
                </button>
              </form>
            </div>

            {/* Liste des devis générés */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>📄 Devis Générés</h3>
              
              <div style={{ overflowY: 'auto', flex: 1, maxHeight: '420px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ textAlign: 'left', padding: '10px' }}>No Devis</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Client</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Plan</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Total</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>Devis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Aucun devis généré pour le moment.</td>
                      </tr>
                    ) : quotes.map(q => (
                      <tr key={q.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px', color: 'var(--text-primary)', fontWeight: 600 }}>{q.quoteNo}</td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                          {q.tenant?.name || q.clientName || 'Inconnu'}
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{q.plan?.name}</td>
                        <td style={{ padding: '10px', color: 'var(--text-primary)', fontWeight: 700 }}>{formatPrice(q.total)}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          <button 
                            onClick={() => { setGeneratedQuote(q); setShowQuoteResultModal(true); }}
                            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '6px', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                          >
                            Ouvrir
                          </button>
                          {userRole === 'SuperAdmin' && (
                            <button 
                              onClick={() => handleDeleteQuote(q.id)}
                              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, marginLeft: '8px' }}
                              title="Supprimer le devis"
                            >
                              <i className="ph ph-trash" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* MODAL EDITION PLAN */}
          {editingPlan && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', width: '500px', maxWidth: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>🛠️ Modifier le plan {editingPlan.name}</h3>
                
                <form onSubmit={handleUpdatePlan} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '15px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Tarif Mensuel (FCFA)</label>
                      <input 
                        type="number"
                        value={editingPlan.price}
                        onChange={e => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 700 }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Quota actifs</label>
                      <input 
                        type="number"
                        value={editingPlan.quotaAssets}
                        onChange={e => setEditingPlan({ ...editingPlan, quotaAssets: Number(e.target.value) })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 700 }}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Quota utilisateurs max</label>
                    <input 
                      type="number"
                      value={editingPlan.quotaUsers}
                      onChange={e => setEditingPlan({ ...editingPlan, quotaUsers: Number(e.target.value) })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 700 }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Réduction abonnement annuel (%)</label>
                    <input 
                      type="number"
                      min="0"
                      max="100"
                      value={editingPlan.annualDiscountPct}
                      onChange={e => setEditingPlan({ ...editingPlan, annualDiscountPct: Number(e.target.value) })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 700 }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Description Marketing</label>
                    <textarea 
                      value={editingPlan.description || ''}
                      onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem', minHeight: '60px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Fonctionnalités activées</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      {[
                        { key: 'helpdesk', label: 'Tickets & Helpdesk' },
                        { key: 'financial', label: 'Module Financier' },
                        { key: 'agent', label: 'Agent Windows (ITAM)' },
                        { key: 'kb', label: 'Base de Connaissances' },
                        { key: 'onboarding', label: 'Onboarding IT' },
                        { key: 'depreciation', label: 'Amortissement & Cycle de Vie' },
                      ].map(feat => {
                        const included = !!(editingPlan.featuresIncluded?.[feat.key]);
                        return (
                          <label key={feat.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <input 
                              type="checkbox"
                              checked={included}
                              onChange={e => {
                                const currentFeats = { ...(editingPlan.featuresIncluded || {}) };
                                currentFeats[feat.key] = e.target.checked;
                                setEditingPlan({ ...editingPlan, featuresIncluded: currentFeats });
                              }}
                              style={{ accentColor: '#3b82f6' }}
                            />
                            {feat.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Tags Marketing (séparés par des virgules)</label>
                    <input 
                      type="text"
                      value={editingPlan.features ? editingPlan.features.join(', ') : ''}
                      onChange={e => setEditingPlan({ ...editingPlan, features: e.target.value.split(',').map(f => f.trim()).filter(Boolean) })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setEditingPlan(null)}
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={savingPlan}
                      style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', cursor: 'pointer', fontWeight: 700 }}
                    >
                      {savingPlan ? 'Mise à jour...' : 'Enregistrer'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL AJOUT PROMO */}
          {showPromoModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', width: '450px', maxWidth: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>🏷️ Créer un Code Promo</h3>
                
                <form onSubmit={handleCreatePromo} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '15px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Code unique (ex: BLACKFRIDAY)*</label>
                    <input 
                      type="text"
                      value={promoForm.code}
                      onChange={e => setPromoForm({ ...promoForm, code: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 700, textTransform: 'uppercase' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Label / Description *</label>
                    <input 
                      type="text"
                      placeholder="Ex: Remise de bienvenue 15%"
                      value={promoForm.label}
                      onChange={e => setPromoForm({ ...promoForm, label: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Remise (%) *</label>
                      <input 
                        type="number"
                        min="1"
                        max="100"
                        value={promoForm.discountPct}
                        onChange={e => setPromoForm({ ...promoForm, discountPct: Number(e.target.value) })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 700 }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Utilisations max</label>
                      <input 
                        type="number"
                        placeholder="Illimité"
                        value={promoForm.maxUses}
                        onChange={e => setPromoForm({ ...promoForm, maxUses: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Date de fin</label>
                      <input 
                        type="date"
                        value={promoForm.validUntil}
                        onChange={e => setPromoForm({ ...promoForm, validUntil: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Plan associé</label>
                      <select
                        value={promoForm.planId}
                        onChange={e => setPromoForm({ ...promoForm, planId: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                      >
                        <option value="">Tous les plans</option>
                        {plans.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setShowPromoModal(false)}
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={savingPromo}
                      style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #15803d)', color: 'white', cursor: 'pointer', fontWeight: 700 }}
                    >
                      {savingPromo ? 'Création...' : 'Créer le code'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL AJOUT RÉDUCTION VOLUMÉTRIQUE */}
          {showDiscountModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', width: '450px', maxWidth: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>📊 Ajouter un Palier de Remise</h3>
                
                <form onSubmit={handleCreateVolumeDiscount} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '15px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Plan concerné *</label>
                    <select
                      value={discountForm.planId}
                      onChange={e => setDiscountForm({ ...discountForm, planId: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                      required
                    >
                      <option value="">-- Choisir un plan --</option>
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Min. Actifs</label>
                      <input 
                        type="number"
                        value={discountForm.minAssets}
                        onChange={e => setDiscountForm({ ...discountForm, minAssets: Number(e.target.value) })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 700 }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Min. Utilisateurs</label>
                      <input 
                        type="number"
                        value={discountForm.minUsers}
                        onChange={e => setDiscountForm({ ...discountForm, minUsers: Number(e.target.value) })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 700 }}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Remise (%) *</label>
                    <input 
                      type="number"
                      min="1"
                      max="100"
                      value={discountForm.discountPct}
                      onChange={e => setDiscountForm({ ...discountForm, discountPct: Number(e.target.value) })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 700 }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Description de l'offre (Label)*</label>
                    <input 
                      type="text"
                      placeholder="Ex: Remise Entreprise +500 actifs"
                      value={discountForm.label}
                      onChange={e => setDiscountForm({ ...discountForm, label: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setShowDiscountModal(false)}
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={savingDiscount}
                      style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #15803d)', color: 'white', cursor: 'pointer', fontWeight: 700 }}
                    >
                      {savingDiscount ? 'Ajout...' : 'Ajouter le palier'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}



          {/* MODAL APERÇU DEVIS IMPRIMABLE */}
          {showQuoteResultModal && generatedQuote && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
              <div style={{ background: '#fff', color: '#1a1a1a', borderRadius: '12px', padding: '40px', width: '800px', maxWidth: '95%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', margin: '40px auto' }}>
                
                {/* Print area wrapper */}
                <div id="printable-quote-area">
                  
                  {/* Header Devis */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #3b82f6', paddingBottom: '20px', marginBottom: '20px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#1d4ed8' }}>K'PSY INFORMATIQUE</h2>
                      <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#555' }}>Prestations Systèmes & ITAM SaaS</p>
                      <p style={{ margin: '2px 0', fontSize: '0.8rem', color: '#777' }}>Dakar, Sénégal · support@kpsy.com</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, color: '#333' }}>DEVIS</h1>
                      <p style={{ margin: '4px 0', fontWeight: 700, fontSize: '1rem', color: '#3b82f6' }}>{generatedQuote.quoteNo}</p>
                      <p style={{ margin: '2px 0', fontSize: '0.8rem', color: '#555' }}>Date : {new Date(generatedQuote.createdAt).toLocaleDateString('fr-FR')}</p>
                      <p style={{ margin: '2px 0', fontSize: '0.8rem', color: '#e11d48', fontWeight: 600 }}>Date d'expiration : {generatedQuote.validUntil ? new Date(generatedQuote.validUntil).toLocaleDateString('fr-FR') : '-'}</p>
                    </div>
                  </div>

                  {/* Infos Client */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                    <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Éditeur du Service</span>
                      <p style={{ margin: '6px 0 2px 0', fontWeight: 700 }}>K'PSY INFORMATIQUE ITAM</p>
                      <p style={{ margin: '2px 0', fontSize: '0.85rem', color: '#475569' }}>Services de gestion de parcs informatiques</p>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Destinataire (Client)</span>
                      <p style={{ margin: '6px 0 2px 0', fontWeight: 700 }}>
                        {generatedQuote.tenant?.name || generatedQuote.clientName || 'Client Prospect'}
                      </p>
                      {generatedQuote.tenant && (
                        <p style={{ margin: '2px 0', fontSize: '0.85rem', color: '#475569' }}>Espace SaaS : {generatedQuote.tenant.subdomain}.kpsy.com</p>
                      )}
                      {generatedQuote.clientEmail && (
                        <p style={{ margin: '2px 0', fontSize: '0.85rem', color: '#475569' }}>E-mail : {generatedQuote.clientEmail}</p>
                      )}
                    </div>
                  </div>

                  {/* Tableau des Tarifs */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                    <thead>
                      <tr style={{ background: '#1e293b', color: '#fff', fontSize: '0.85rem' }}>
                        <th style={{ textAlign: 'left', padding: '12px' }}>Désignation / Option de Plan</th>
                        <th style={{ textAlign: 'center', padding: '12px' }}>Taux / Base</th>
                        <th style={{ textAlign: 'right', padding: '12px' }}>
                          {(generatedQuote as any).billingCycle === 'yearly' ? 'Montant Annuel (12 mois)' : 'Montant Mensuel'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                        <td style={{ padding: '12px' }}>
                          <strong>Plan d'abonnement {generatedQuote.plan?.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                            Inclut jusqu'à {generatedQuote.plan?.quotaAssets} actifs et {generatedQuote.plan?.quotaUsers} utilisateurs.
                          </div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#475569' }}>Prix unitaire plan</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{formatPrice(generatedQuote.plan?.price)}</td>
                      </tr>

                      {/* Remise Volume */}
                      {generatedQuote.volumeDiscPct > 0 && (
                        <tr style={{ borderBottom: '1px solid #e2e8f0', fontSize: '0.9rem', color: '#16a34a' }}>
                          <td style={{ padding: '12px' }}>
                            <strong>Réduction volumétrique appliquée</strong>
                            <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '4px' }}>Offre spéciale palier volume cibles</div>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>-{generatedQuote.volumeDiscPct}%</td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>
                            -{formatPrice((generatedQuote.plan?.price || 0) * (generatedQuote.volumeDiscPct / 100))}
                          </td>
                        </tr>
                      )}

                      {/* Remise Promo */}
                      {generatedQuote.discountPct > 0 && (
                        <tr style={{ borderBottom: '1px solid #e2e8f0', fontSize: '0.9rem', color: '#16a34a' }}>
                          <td style={{ padding: '12px' }}>
                            <strong>Code promotionnel appliqué ({generatedQuote.promoCode})</strong>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>-{generatedQuote.discountPct}%</td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>
                            -{formatPrice(((generatedQuote.plan?.price || 0) - ((generatedQuote.plan?.price || 0) * (generatedQuote.volumeDiscPct / 100))) * (generatedQuote.discountPct / 100))}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Totaux & Règlements */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ width: '50%', paddingRight: '20px' }}>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 10px 0' }}>
                        <strong>Mentions légales & Conditions de règlement :</strong><br />
                        {generatedQuote.billingCycle === 'yearly' 
                          ? "Le règlement s'effectue annuellement (engagement de 12 mois) par virement bancaire ou via la passerelle de paiement Mobile Money." 
                          : "Le règlement s'effectue mensuellement via la passerelle de paiement Mobile Money configurée sur le portail KPSyDesk ITAM."
                        }<br />
                        Toutes nos offres sont sans engagement de durée pour les abonnements mensuels.
                      </p>
                      {generatedQuote.notes && (
                        <div style={{ border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', background: '#f8fafc', color: '#334155' }}>
                          <strong>Notes de l'éditeur :</strong> {generatedQuote.notes}
                        </div>
                      )}
                    </div>

                    <div style={{ width: '45%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                        <span style={{ color: '#475569' }}>Sous-total HT :</span>
                        <span style={{ fontWeight: 700 }}>{formatPrice(generatedQuote.subtotal)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                        <span style={{ color: '#475569' }}>TVA ({generatedQuote.tvaRate}%) :</span>
                        <span style={{ fontWeight: 700 }}>{formatPrice(generatedQuote.tvaAmount)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '1.2rem', color: '#1e293b' }}>
                        <strong>Net à payer (TTC) :</strong>
                        <strong style={{ color: '#1d4ed8' }}>{formatPrice(generatedQuote.total)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px', borderTop: '1px dashed #cbd5e1', paddingTop: '20px' }}>
                    <div style={{ width: '45%', fontSize: '0.85rem' }}>
                      <p style={{ margin: 0, fontWeight: 700 }}>Pour le Client</p>
                      <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>Signature précédée de la mention "Bon pour accord"</p>
                      <div style={{ height: '70px' }} />
                    </div>
                    <div style={{ width: '45%', textAlign: 'right', fontSize: '0.85rem' }}>
                      <p style={{ margin: 0, fontWeight: 700 }}>K'PSY INFORMATIQUE ITAM</p>
                      <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>Le Super-Administrateur</p>
                      <div style={{ height: '70px' }} />
                    </div>
                  </div>

                </div>

                {/* Print Control buttons (hidden during print) */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '30px', borderTop: '1px solid #cbd5e1', paddingTop: '20px' }} className="no-print">
                  <button
                    type="button"
                    onClick={() => { setShowQuoteResultModal(false); setGeneratedQuote(null); }}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#475569', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Fermer l'aperçu
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: '#1d4ed8', color: 'white', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <i className="ph ph-printer" /> Imprimer / Exporter en PDF
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

      {/* COMPTABILITÉ & FINANCES TAB */}
      {activeTab === 'compta' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="fade-in">
          
          {/* Barre de Filtres de Périodes & Export Consolidé */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <i className="ph ph-funnel" /> Période d'audit :
              </span>
              <input 
                type="date" 
                value={filterStartDate} 
                onChange={e => setFilterStartDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>au</span>
              <input 
                type="date" 
                value={filterEndDate} 
                onChange={e => setFilterEndDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              />
              <button 
                onClick={() => {
                  const oneMonthAgo = new Date(); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                  setFilterStartDate(oneMonthAgo.toISOString().split('T')[0]);
                  setFilterEndDate(new Date().toISOString().split('T')[0]);
                }}
                className="btn-outline" 
                style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)' }}
              >
                30 derniers jours
              </button>
            </div>
            
            <button
              onClick={async () => {
                setExportingPdf(true);
                try {
                  const response = await api.post('/admin-tenants/reports/consolidated-pdf', {
                    startDate: filterStartDate || undefined,
                    endDate: filterEndDate || undefined,
                    generatorUser: 'admin@entreprise.com'
                  }, { responseType: 'blob' });
                  
                  const blob = new Blob([response.data], { type: 'application/pdf' });
                  const link = document.createElement('a');
                  link.href = window.URL.createObjectURL(blob);
                  link.download = `Rapport_Revenus_Consolide_${new Date().toISOString().split('T')[0]}.pdf`;
                  link.click();
                } catch (err: any) {
                  alert('Erreur d\'export PDF : ' + err.message);
                } finally {
                  setExportingPdf(false);
                }
              }}
              disabled={exportingPdf}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)', color: 'white', fontWeight: 700 }}
            >
              {exportingPdf ? (
                <i className="ph ph-circle-notch" style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <i className="ph ph-file-pdf" />
              )}
              Exporter Relevé Fiscal Consolidé (PDF)
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem' }}>
            
            {/* Journal des Revenus SaaS (SYSCOHADA) */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Journal des Revenus d'Exploitation (TVA 18%)</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>SYSCOHADA Classe 7 (Ventes de Services)</span>
              </div>
              <div className="table-responsive">
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 20px' }}>Date</th>
                      <th>Référence</th>
                      <th>Abonné</th>
                      <th>Moyen</th>
                      <th style={{ textAlign: 'right', padding: '12px 20px' }}>Recette TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions
                      .filter(t => {
                        if (!filterStartDate && !filterEndDate) return true;
                        const date = t.createdAt.split('T')[0];
                        if (filterStartDate && date < filterStartDate) return false;
                        if (filterEndDate && date > filterEndDate) return false;
                        return true;
                      })
                      .map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 20px', fontSize: '0.85rem' }}>
                            {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            <code>{t.reference}</code>
                          </td>
                          <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {t.tenant.name}
                          </td>
                          <td>
                            <span style={{ background: 'var(--bg-tertiary)', borderRadius: '50px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600 }}>
                              {t.paymentMethod}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '12px 20px', fontWeight: 700, color: '#22c55e', fontSize: '0.85rem' }}>
                            {formatPrice(t.amount)}
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Factures Émises aux Abonnés */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Factures d'Abonnement Émises</strong>
              </div>
              <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {invoices
                  .filter(inv => {
                    if (!filterStartDate && !filterEndDate) return true;
                    const date = inv.createdAt.split('T')[0];
                    if (filterStartDate && date < filterStartDate) return false;
                    if (filterEndDate && date > filterEndDate) return false;
                    return true;
                  })
                  .map(inv => (
                    <div key={inv.id} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{inv.invoiceNo}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{inv.tenant.name}</span>
                          {inv.status === 'Annulée' && (
                            <span style={{ fontSize: '0.65rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              ANNULÉE
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          TTC : {formatPrice(inv.amountTTC)} (HT: {formatPrice(inv.amountHT)})
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {userRole === 'SuperAdmin' && inv.status !== 'Annulée' && (
                          <button
                            onClick={() => handleCancelInvoice(inv.id)}
                            className="btn-outline"
                            style={{ padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border-color)', background: 'transparent', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                            title="Annuler pour désistement"
                          >
                            <i className="ph ph-x-circle" style={{ color: '#f59e0b' }} /> Annuler
                          </button>
                        )}
                      <button
                        onClick={async () => {
                          try {
                            const response = await api.post(`/admin-tenants/invoices/${inv.id}/pdf`, {
                              generatorUser: 'admin@entreprise.com'
                            }, { responseType: 'blob' });
                            
                            const blob = new Blob([response.data], { type: 'application/pdf' });
                            const link = document.createElement('a');
                            link.href = window.URL.createObjectURL(blob);
                            link.download = `Facture_${inv.invoiceNo}.pdf`;
                            link.click();
                          } catch (err: any) {
                            alert('Erreur d\'export PDF : ' + err.message);
                          }
                        }}
                        className="btn-outline"
                        style={{ padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border-color)', background: 'transparent', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                      >
                        <i className="ph ph-file-pdf" style={{ color: '#ef4444' }} /> PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* STATISTIQUES AVANCÉES TAB */}
      {activeTab === 'stats-av' && (userRole === 'SuperAdmin' || userRole === 'Support') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="fade-in">
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            
            {/* Taux d'utilisation moyen des quotas d'actifs par plan */}
            {usageStats && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ph ph-cpu" style={{ color: '#8b5cf6' }} /> Utilisation Moyenne Quotas Actifs
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600 }}>Plan Starter (Quota 100)</span>
                      <span style={{ color: 'var(--text-muted)' }}>{usageStats.starterAverageUsage}% d'actifs</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '50px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                      <div style={{ width: `${usageStats.starterAverageUsage}%`, height: '100%', background: '#3b82f6', borderRadius: '50px' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600 }}>Plan Business (Quota 500)</span>
                      <span style={{ color: 'var(--text-muted)' }}>{usageStats.businessAverageUsage}% d'actifs</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '50px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                      <div style={{ width: `${usageStats.businessAverageUsage}%`, height: '100%', background: '#8b5cf6', borderRadius: '50px' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600 }}>Plan Enterprise (Quota 5000)</span>
                      <span style={{ color: 'var(--text-muted)' }}>{usageStats.enterpriseAverageUsage}% d'actifs</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '50px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                      <div style={{ width: `${usageStats.enterpriseAverageUsage}%`, height: '100%', background: '#f59e0b', borderRadius: '50px' }} />
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Lifetime Value LTV estimée */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ph ph-hourglass-high" style={{ color: '#22c55e' }} /> Valeur Vie Client (LTV)
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Projection financière de la valeur moyenne cumulée générée par un abonné actif sur l'année.
                </p>
              </div>
              <div style={{ padding: '16px 0', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#22c55e' }}>{formatPrice(720000)}</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Moyenne pondérée plateforme (MRR x Rétention Moyenne)</span>
              </div>
            </div>

          </div>

          {/* Analyse de Cohortes (Rétention) */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Rétention des Abonnés par Cohorte Mensuelle</strong>
            </div>
            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 20px' }}>Mois d'inscription</th>
                    <th>Taille Cohorte</th>
                    <th>Mois 0 (Départ)</th>
                    <th>Mois 1 (M+1)</th>
                    <th>Mois 2 (M+2)</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 20px', fontWeight: 700 }}>
                        {cohort.cohort}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{cohort.size} abonnés</span>
                      </td>
                      <td style={{ background: '#22c55e25', color: '#15803d', fontWeight: 700, textAlign: 'center' }}>
                        {cohort.retention[0]}%
                      </td>
                      <td style={{ background: cohort.retention[1] >= 80 ? '#22c55e20' : '#f59e0b20', color: cohort.retention[1] >= 80 ? '#15803d' : '#b45309', fontWeight: 700, textAlign: 'center' }}>
                        {cohort.retention[1]}%
                      </td>
                      <td style={{ background: cohort.retention[2] >= 80 ? '#22c55e20' : '#f59e0b20', color: cohort.retention[2] >= 80 ? '#15803d' : '#b45309', fontWeight: 700, textAlign: 'center' }}>
                        {cohort.retention[2]}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'about' && (
        <AboutView isSuperAdmin={true} />
      )}

      {/* MODAL ATTRIBUTION / MODIFICATION DES QUOTAS DE LICENCES */}
      {isQuotaModalOpen && targetTenant && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: '16px', padding: '24px', width: '400px', maxWidth: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>
              🔑 Gestion des Licences
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '20px' }}>
              Modifier le quota d'attribution des actifs pour <strong>{targetTenant.name}</strong>.
            </p>

            <form onSubmit={handleSaveQuota} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Quota maximum d'actifs (Licences d'équipements)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={newQuotaAssets}
                    onChange={e => setNewQuotaAssets(Number(e.target.value))}
                    min={targetTenant.usage.assets.current}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px',
                      border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)', fontWeight: 700
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setNewQuotaAssets(99999)}
                    style={{
                      padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    ∞ Illimité
                  </button>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Actuellement utilisé : {targetTenant.usage.assets.current} actif(s) sur la plateforme.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setIsQuotaModalOpen(false); setTargetTenant(null); }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px',
                    border: '1px solid var(--border-color)', background: 'transparent',
                    color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingQuota}
                  style={{
                    flex: 2, padding: '10px', borderRadius: '8px',
                    border: 'none', background: 'linear-gradient(135deg, #22c55e, #15803d)',
                    color: 'white', cursor: 'pointer', fontWeight: 700
                  }}
                >
                  {savingQuota ? 'Enregistrement...' : '✓ Mettre à jour'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE DE RÉINITIALISATION SUPER-ADMIN URGENCE */}
      {resetModalUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid #ef4444', padding: '30px',
            borderRadius: '16px', maxWidth: '480px', width: '90%', color: 'white',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: '0 0 15px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 800 }}>
              ⚠️ Réinitialisation Manuelle (Support)
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
              Vous êtes sur le point d'initier une réinitialisation de mot de passe pour le compte abonné suivant sans options de récupération self-service.
            </p>

            <div style={{ background: 'var(--bg-tertiary)', padding: '15px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '20px', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
              <div style={{ marginBottom: '6px' }}><strong>Entreprise :</strong> {resetModalUser.name}</div>
              <div style={{ marginBottom: '6px' }}><strong>Sous-domaine :</strong> {resetModalUser.subdomain}</div>
              <div>
                <strong>Email de destination :</strong> {(() => {
                  // Email administrateur du tenant ou fallback
                  const email = resetModalUser.email || `${resetModalUser.subdomain}@entreprise.com`;
                  const [user, domain] = email.split('@');
                  return `${user[0]}***@${domain}`;
                })()}
              </div>
            </div>

            <form onSubmit={handleAdminResetNoRecovery}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                  Motif de la réinitialisation * (Min. 5 caractères)
                </label>
                <textarea
                  value={resetReason}
                  onChange={e => setResetReason(e.target.value)}
                  placeholder="ex: Demande support par téléphone suite à la perte totale des identifiants..."
                  required
                  style={{
                    width: '100%', height: '80px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                    borderRadius: '8px', padding: '10px', color: 'white', fontSize: '0.85rem', resize: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px' }}>
                <input
                  type="checkbox"
                  id="chk-verify-identity"
                  checked={identityVerified}
                  onChange={e => setIdentityVerified(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="chk-verify-identity" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                  Je confirme avoir vérifié de vive voix l'identité de cet abonné.
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setResetModalUser(null);
                    setResetReason('');
                    setIdentityVerified(false);
                  }}
                  style={{
                    background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
                    padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  style={{
                    background: '#ef4444', color: 'white', border: 'none',
                    padding: '8px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {resetLoading ? 'Envoi...' : 'Confirmer la réinitialisation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FICHE ABONNÉ */}
      {selectedTenantProfile && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', width: '600px', maxWidth: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflowY: 'auto', maxHeight: '90vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                  🏢 {selectedTenantProfile.name}
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: '8px' }}>
                  {selectedTenantProfile.subdomain}.inventaire-parc.com
                </span>
              </div>
              <button onClick={() => setSelectedTenantProfile(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>
                <i className="ph ph-x" />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="ph ph-info" /> Informations Générales
                </h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Date d'inscription :</span>
                    <strong>{new Intl.DateTimeFormat('fr-FR').format(new Date(selectedTenantProfile.createdAt))}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Plan Actif :</span>
                    <strong>{selectedTenantProfile.planName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Statut :</span>
                    <strong>{selectedTenantProfile.status}</strong>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="ph ph-user" /> Contact Principal
                </h4>
                {selectedTenantProfile.primaryContact ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Nom complet</span>
                      <strong style={{ fontSize: '0.95rem' }}>{selectedTenantProfile.primaryContact.firstName} {selectedTenantProfile.primaryContact.lastName}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Email</span>
                      <a href={`mailto:${selectedTenantProfile.primaryContact.email}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}>{selectedTenantProfile.primaryContact.email}</a>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Téléphone</span>
                      <strong>{selectedTenantProfile.primaryContact.phone || 'Non renseigné'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Zone géographique / Pays</span>
                      <strong>{selectedTenantProfile.primaryContact.country || 'Non renseigné'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Poste</span>
                      <strong>{selectedTenantProfile.primaryContact.position || 'Non renseigné'}</strong>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                    Aucun contact principal (Administrateur) identifié pour ce locataire.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedTenantProfile(null)} className="btn-primary" style={{ padding: '8px 24px', borderRadius: '8px', fontSize: '0.9rem' }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PURGE INACTIFS */}
      {showPurgeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '16px', width: '90%', maxWidth: '600px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444' }}>
              <i className="ph ph-warning-circle" style={{ fontSize: '1.5rem' }} />
              Purge des locataires inactifs
            </h3>
            
            <div style={{ background: '#ef444415', border: '1px solid #ef444450', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <p style={{ margin: 0, color: '#fca5a5', fontSize: '0.9rem', lineHeight: 1.5 }}>
                <strong>Action irréversible.</strong> Cette opération supprimera définitivement les locataires suivants ainsi que toutes les données associées (utilisateurs, équipements, tickets, etc.). 
                Seuls les locataires dont la période d'essai est expirée et qui sont inactifs depuis plus de 15 jours sont listés ici.
              </p>
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', marginBottom: '20px' }}>
              {purgeableTenants.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {purgeableTenants.map(t => (
                    <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ fontWeight: 600 }}>{t.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Créé le {new Date(t.createdAt).toLocaleDateString('fr-FR')}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  Aucun locataire inactif éligible à la purge.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                Total : {purgeableTenants.length} locataire(s)
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setShowPurgeModal(false)} 
                  className="btn-secondary" 
                  style={{ padding: '8px 16px', borderRadius: '8px' }}
                  disabled={isPurging}
                >
                  Annuler
                </button>
                <button 
                  onClick={handleExecutePurge} 
                  className="btn-primary" 
                  style={{ background: '#ef4444', borderColor: '#ef4444', padding: '8px 16px', borderRadius: '8px' }}
                  disabled={purgeableTenants.length === 0 || isPurging}
                >
                  {isPurging ? 'Purge en cours...' : 'Exécuter la purge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
