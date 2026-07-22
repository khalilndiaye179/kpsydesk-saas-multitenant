import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

interface TenantInfo {
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    status: string;
    createdAt: string;
  };
  subscription: {
    plan: string;
    status: string;
    billingInterval?: string;
    startDate: string;
    endDate: string | null;
  } | null;
  usage: {
    assets: { current: number; quota: number };
    users: { current: number; quota: number };
  };
}

interface Plan {
  id: string;
  name: string;
  price: number;
  quotaAssets: number;
  quotaUsers: number;
  annualDiscountPct: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:    { label: 'Actif',         color: '#22c55e', bg: '#22c55e15' },
  TRIALING:  { label: 'Période d\'essai', color: '#3b82f6', bg: '#3b82f615' },
  PAST_DUE:  { label: 'Paiement en retard', color: '#f59e0b', bg: '#f59e0b15' },
  CANCELLED: { label: 'Annulé',        color: '#ef4444', bg: '#ef444415' },
  GRACE_PERIOD: { label: 'Délai de grâce', color: '#f59e0b', bg: '#f59e0b15' },
  SUSPENDED: { label: 'Suspendu',       color: '#ef4444', bg: '#ef444415' },
};

const PLAN_COLORS: Record<string, string> = {
  Starter: '#3b82f6', Pro: '#8b5cf6', Enterprise: '#f59e0b', Legacy: '#6b7280'
};

function UsageBar({ label, current, quota, color }: { label: string; current: number; quota: number; color: string }) {
  const pct = quota >= 99999 ? 0 : Math.min(100, Math.round((current / quota) * 100));
  const isWarning = pct >= 80;
  const isCritical = pct >= 95;
  const barColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : color;

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '0.82rem', color: isWarning ? barColor : 'var(--text-muted)' }}>
          {current.toLocaleString()} / {quota >= 99999 ? '∞' : quota.toLocaleString()}
          {quota < 99999 && <span style={{ marginLeft: '6px', fontWeight: 700 }}>({pct}%)</span>}
        </span>
      </div>
      <div style={{ height: '8px', borderRadius: '50px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
        {quota < 99999 && (
          <div style={{
            height: '100%', width: `${pct}%`, borderRadius: '50px',
            background: isCritical
              ? 'linear-gradient(90deg, #ef4444, #dc2626)'
              : isWarning
              ? 'linear-gradient(90deg, #f59e0b, #d97706)'
              : `linear-gradient(90deg, ${color}, ${color}cc)`,
            transition: 'width 0.6s ease, background 0.3s'
          }} />
        )}
        {quota >= 99999 && (
          <div style={{
            height: '100%', width: '100%', borderRadius: '50px',
            background: `linear-gradient(90deg, ${color}60, ${color}20)`,
          }} />
        )}
      </div>
      {isCritical && (
        <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', fontWeight: 600 }}>
          <i className="ph-bold ph-warning" style={{ marginRight: '4px' }} />
          Quota critique ! Passez à un plan supérieur.
        </div>
      )}
    </div>
  );
}

interface GatewayInfo {
  id: string;
  provider: string;
  displayName: string;
  merchantId?: string;
  isSandbox: boolean;
  isPublished: boolean;
  validatedAt?: string;
}

export function SubscriptionView() {
  const [info, setInfo] = useState<TenantInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [gateways, setGateways] = useState<GatewayInfo[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [isYearlyBilling, setIsYearlyBilling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedNewPlan, setSelectedNewPlan] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Modal paiement
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentGateway, setPaymentGateway] = useState<string>('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<{ name: string; interval: string } | null>(null);

  const fetchInfo = useCallback(async () => {
    try {
      const res = await api.get('/tenants/me');
      setInfo(res.data);
      if (res.data.subscription?.billingInterval === 'YEARLY') {
        setIsYearlyBilling(true);
      }
    } catch {
      // Données de démo si pas de contexte tenant
      setInfo({
        tenant: { id: 'demo', name: 'Mon Entreprise', subdomain: 'legacy', status: 'ACTIVE', createdAt: new Date().toISOString() },
        subscription: { plan: 'Legacy', status: 'ACTIVE', billingInterval: 'MONTHLY', startDate: new Date().toISOString(), endDate: null },
        usage: { assets: { current: 12, quota: 99999 }, users: { current: 4, quota: 99999 } },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInfo();
    api.get('/tenants/plans')
      .then(res => setPlans(res.data))
      .catch(() => {});
    
    api.get('/tenants/payment-gateways')
      .then(res => {
        // Normalize backend format: { code, displayName, environment, publishedAt } -> GatewayInfo
        const normalized: GatewayInfo[] = (res.data || []).map((p: any) => ({
          id: p.id,
          provider: p.code || p.provider || '',
          displayName: p.displayName || p.code || p.provider || '',
          isSandbox: (p.environment || '').toUpperCase() === 'SANDBOX',
          isPublished: p.globalStatus === 'ACTIVE',
          validatedAt: p.publishedAt,
        }));
        setGateways(normalized);
        if (normalized.length > 0) {
          setSelectedGateway(normalized[0].provider);
        }
      })
      .catch(() => {});
  }, [fetchInfo]);

  // Étape 1 : ouvrir le modal de paiement avant de changer de plan
  const handleInitiateUpgrade = () => {
    if (!selectedNewPlan) return;
    setPendingPlan({ name: selectedNewPlan, interval: isYearlyBilling ? 'YEARLY' : 'MONTHLY' });
    setPaymentGateway(gateways.length > 0 ? gateways[0].provider : '');
    setShowPaymentModal(true);
  };

  // Étape 2 : l'utilisateur a confirmé le paiement → appliquer le changement de plan
  const handleConfirmPaymentAndUpgrade = async () => {
    if (!pendingPlan || !paymentGateway) return;
    setProcessingPayment(true);
    try {
      // Simuler la validation du paiement (dans un vrai système, cette étape
      // serait confirmée par un webhook de la passerelle de paiement)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Appliquer le changement de plan
      await api.post('/subscriptions/upgrade', {
        planName: pendingPlan.name,
        billingInterval: pendingPlan.interval,
        paymentGateway: paymentGateway,
      });
      setShowPaymentModal(false);
      setShowUpgrade(false);
      setSelectedNewPlan('');
      setPendingPlan(null);
      setMessage({ type: 'success', text: `Plan migré vers "${pendingPlan.name}" (${pendingPlan.interval === 'YEARLY' ? 'Annuel' : 'Mensuel'}) — paiement validé via ${paymentGateway}.` });
      fetchInfo();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Erreur lors du changement de plan.' });
      setShowPaymentModal(false);
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleUpgrade = handleInitiateUpgrade;


  const handleCancel = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir annuler votre abonnement ? Vos données seront conservées.')) return;
    try {
      await api.delete('/subscriptions/cancel');
      setMessage({ type: 'success', text: 'Abonnement annulé. Vos données restent accessibles jusqu\'à la fin de la période.' });
      fetchInfo();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Erreur lors de l\'annulation.' });
    }
  };

  const handleSimulatePayment = async () => {
    try {
      const res = await api.post('/subscriptions/webhook', {
        tenantId: info?.tenant.id,
        status: 'success'
      });
      setMessage({ type: 'success', text: res.data.message || 'Paiement simulé avec succès par webhook !' });
      fetchInfo();
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Erreur lors de la simulation du paiement.' });
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <i className="ph ph-circle-notch" style={{ fontSize: '2rem', animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
      </div>
    );
  }

  if (!info) return null;

  const subStatus = info.subscription ? STATUS_LABELS[info.subscription.status] ?? STATUS_LABELS['ACTIVE'] : null;
  const planColor = PLAN_COLORS[info.subscription?.plan ?? ''] ?? '#6b7280';
  const trialEnd = info.subscription?.endDate ? new Date(info.subscription.endDate) : null;
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : null;

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px',
          background: `linear-gradient(135deg, ${planColor}, ${planColor}99)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <i className="ph-bold ph-crown" style={{ fontSize: '1.4rem', color: 'white' }} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Mon Abonnement</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {info.tenant.name} · {info.tenant.subdomain}.kpsyinformatique.com
          </p>
        </div>
      </div>

      {/* Alert message */}
      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px', marginBottom: '1.5rem',
          background: message.type === 'success' ? '#22c55e15' : '#ef444415',
          border: `1px solid ${message.type === 'success' ? '#22c55e40' : '#ef444440'}`,
          color: message.type === 'success' ? '#22c55e' : '#ef4444',
          display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600
        }}>
          <i className={`ph-bold ${message.type === 'success' ? 'ph-check-circle' : 'ph-x-circle'}`} />
          {message.text}
          <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <i className="ph ph-x" />
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* Plan Actuel Card */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: '16px', overflow: 'hidden',
          gridColumn: '1 / -1'
        }}>
          <div style={{
            padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: `linear-gradient(135deg, ${planColor}20, ${planColor}08)`,
            borderBottom: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Plan actuel :
              </span>
              <span style={{
                background: `linear-gradient(135deg, ${planColor}, ${planColor}99)`,
                color: 'white', borderRadius: '8px', padding: '4px 16px',
                fontWeight: 700, fontSize: '1rem'
              }}>
                {info.subscription?.plan ?? 'Aucun'} {info.subscription?.billingInterval === 'YEARLY' ? '(Annuel)' : '(Mensuel)'}
              </span>
              {subStatus && (
                <span style={{
                  background: subStatus.bg, color: subStatus.color,
                  border: `1px solid ${subStatus.color}40`,
                  borderRadius: '6px', padding: '3px 12px', fontSize: '0.8rem', fontWeight: 600
                }}>
                  {subStatus.label}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>

              <button
                onClick={() => { setShowUpgrade(!showUpgrade); setSelectedNewPlan(''); }}
                style={{
                  padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg, ${planColor}, ${planColor}99)`,
                  color: 'white', fontWeight: 700, fontSize: '0.85rem',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <i className="ph-bold ph-arrow-up" style={{ marginRight: '6px' }} />
                Changer de plan
              </button>
            </div>
          </div>

          {/* Trial Banner */}
          {info.subscription?.status === 'TRIALING' && daysLeft !== null && (
            <div style={{
              padding: '10px 24px',
              background: daysLeft <= 3 ? '#ef444415' : '#3b82f615',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', gap: '10px',
              color: daysLeft <= 3 ? '#ef4444' : '#3b82f6', fontSize: '0.85rem', fontWeight: 600
            }}>
              <i className={`ph-bold ${daysLeft <= 3 ? 'ph-warning' : 'ph-clock'}`} />
              Période d'essai : <strong>{daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}</strong>
              {trialEnd && <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>
                (expire le {new Intl.DateTimeFormat('fr-FR').format(trialEnd)})
              </span>}
            </div>
          )}

          {/* Upgrade Panel */}
          {showUpgrade && (
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
              
              {/* Billing Period Selector Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isYearlyBilling ? 'var(--text-muted)' : 'var(--text-primary)' }}>Facturation Mensuelle</span>
                <button
                  type="button"
                  onClick={() => setIsYearlyBilling(!isYearlyBilling)}
                  style={{
                    width: '48px', height: '24px', borderRadius: '50px',
                    background: isYearlyBilling ? '#22c55e' : 'var(--border-color)',
                    border: 'none', cursor: 'pointer', position: 'relative',
                    transition: 'background 0.2s', padding: 0
                  }}
                >
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: 'white', position: 'absolute', top: '3px',
                    left: isYearlyBilling ? '27px' : '3px',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </button>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isYearlyBilling ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Facturation Annuelle
                  <span style={{ background: '#22c55e20', color: '#22c55e', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '50px', fontWeight: 700 }}>
                    Économisez jusqu'à -20%
                  </span>
                </span>
              </div>

              <div style={{ fontWeight: 700, marginBottom: '12px', fontSize: '0.9rem' }}>Choisir un nouveau plan :</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                {plans.filter(p => p.name !== 'Legacy').map(plan => {
                  const pc = PLAN_COLORS[plan.name] ?? '#6b7280';
                  
                  // Calcul du prix selon la facturation
                  let displayPrice = '';
                  if (plan.price === 0) {
                    displayPrice = 'Gratuit';
                  } else if (isYearlyBilling) {
                    const discount = plan.annualDiscountPct || 20;
                    const discountedAnnualPrice = Math.round(plan.price * 12 * (1 - discount / 100));
                    displayPrice = `${discountedAnnualPrice.toLocaleString()} XOF/an (-${discount}%)`;
                  } else {
                    displayPrice = `${plan.price.toLocaleString()} XOF/mois`;
                  }

                  return (
                    <label key={plan.id} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                      border: selectedNewPlan === plan.name ? `2px solid ${pc}` : '1px solid var(--border-color)',
                      background: selectedNewPlan === plan.name ? `${pc}15` : 'var(--bg-secondary)',
                      transition: 'all 0.2s'
                    }}>
                      <input type="radio" name="newPlan" value={plan.name} checked={selectedNewPlan === plan.name} onChange={() => setSelectedNewPlan(plan.name)} style={{ accentColor: pc }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{plan.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {plan.quotaAssets >= 99999 ? '∞' : plan.quotaAssets} actifs · {displayPrice}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleUpgrade}
                  disabled={!selectedNewPlan || upgrading}
                  style={{
                    padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: selectedNewPlan ? 'pointer' : 'not-allowed',
                    background: selectedNewPlan ? `linear-gradient(135deg, #22c55e, #16a34a)` : 'var(--bg-tertiary)',
                    color: 'white', fontWeight: 700, opacity: selectedNewPlan ? 1 : 0.5
                  }}
                >
                  {upgrading ? <i className="ph ph-circle-notch" style={{ animation: 'spin 1s linear infinite' }} /> : '✓ Confirmer le changement'}
                </button>
                <button onClick={() => setShowUpgrade(false)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Usage Stats */}
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontWeight: 700, marginBottom: '16px', fontSize: '0.9rem' }}>
              <i className="ph-bold ph-chart-bar" style={{ marginRight: '8px', color: planColor }} />
              Utilisation du quota
            </div>
            <UsageBar
              label="Actifs informatiques"
              current={info.usage.assets.current}
              quota={info.usage.assets.quota}
              color={planColor}
            />
            <UsageBar
              label="Utilisateurs"
              current={info.usage.users.current}
              quota={info.usage.users.quota}
              color={planColor}
            />
          </div>
        </div>

        {/* Tenant Info Card */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: '16px', padding: '20px 24px'
        }}>
          <div style={{ fontWeight: 700, marginBottom: '16px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ph-bold ph-buildings" style={{ color: '#8b5cf6' }} />
            Informations tenant
          </div>
          {[
            { label: 'Nom', value: info.tenant.name },
            { label: 'Sous-domaine', value: `${info.tenant.subdomain}.kpsyinformatique.com` },
            { label: 'Statut', value: info.tenant.status },
            { label: 'Membre depuis', value: new Intl.DateTimeFormat('fr-FR').format(new Date(info.tenant.createdAt)) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', maxWidth: '55%', wordBreak: 'break-all' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Subscription Details Card */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: '16px', padding: '20px 24px'
        }}>
          <div style={{ fontWeight: 700, marginBottom: '16px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ph-bold ph-receipt" style={{ color: '#3b82f6' }} />
            Détails de l'abonnement
          </div>
          {info.subscription ? [
            { label: 'Plan', value: info.subscription.plan },
            { label: 'Période de facturation', value: info.subscription.billingInterval === 'YEARLY' ? 'Annuelle (avec remise)' : 'Mensuelle' },
            { label: 'Statut', value: subStatus?.label ?? info.subscription.status },
            { label: 'Début', value: new Intl.DateTimeFormat('fr-FR').format(new Date(info.subscription.startDate)) },
            { label: 'Fin / Renouvellement', value: info.subscription.endDate ? new Intl.DateTimeFormat('fr-FR').format(new Date(info.subscription.endDate)) : 'Indéfini' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
            </div>
          )) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Aucun abonnement actif</div>
          )}

          {info.subscription?.status !== 'CANCELLED' && (
            <button
              onClick={handleCancel}
              style={{
                marginTop: '16px', width: '100%', padding: '8px', borderRadius: '8px',
                border: '1px solid #ef444440', background: '#ef444410',
                color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#ef444420')}
              onMouseLeave={e => (e.currentTarget.style.background = '#ef444410')}
            >
              <i className="ph ph-x-circle" style={{ marginRight: '6px' }} />
              Annuler l'abonnement
            </button>
          )}
        </div>

        {/* Moyens de Paiement & Facturation Digitale */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: '16px', padding: '24px', gridColumn: '1 / -1',
          display: 'flex', flexDirection: 'column', gap: '20px'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              💳 Règlement & Moyens de Paiement
            </h3>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Réglez votre abonnement mensuel en toute sécurité via nos intégrateurs certifiés.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {gateways.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '20px', background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                <i className="ph ph-warning" style={{ fontSize: '1.2rem', marginBottom: '8px', display: 'block', color: '#f59e0b' }} />
                Aucun moyen de paiement disponible pour le moment. Contactez l'administrateur.
              </div>
            ) : (
              gateways.map(gw => {
                const code = gw.provider.toUpperCase();
                let logo = '💳';
                let color = '#3b82f6';
                let bg = '#3b82f615';
                let border = '#3b82f640';

                if (code === 'WAVE') { logo = '🌊'; color = '#3b82f6'; bg = '#3b82f615'; border = '#3b82f640'; }
                else if (code === 'ORANGE_MONEY' || code === 'ORANGEMONEY') { logo = '🍊'; color = '#f97316'; bg = '#f9731615'; border = '#f9731640'; }
                else if (code === 'PAYTECH') { logo = '🚀'; color = '#22c55e'; bg = '#22c55e15'; border = '#22c55e40'; }
                else if (code === 'MTN_MOMO' || code === 'MTNMOMO') { logo = '📱'; color = '#f59e0b'; bg = '#f59e0b15'; border = '#f59e0b40'; }
                else if (code === 'FREE_MONEY' || code === 'FREEMONEY') { logo = '📱'; color = '#8b5cf6'; bg = '#8b5cf615'; border = '#8b5cf640'; }

                const displayLabel = gw.displayName || gw.provider;
                const isSelected = selectedGateway === gw.provider;

                return (
                  <div 
                    key={gw.id} 
                    onClick={() => setSelectedGateway(gw.provider)}
                    style={{ 
                      background: isSelected ? bg : 'var(--bg-tertiary)', 
                      border: isSelected ? `2px solid ${color}` : '1px solid var(--border-color)', 
                      borderRadius: '12px', padding: '16px', cursor: 'pointer',
                      transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '8px'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{logo}</span>
                      {displayLabel}
                      {gw.isSandbox && (
                        <span style={{ background: '#f59e0b20', color: '#b45309', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '50px', marginLeft: 'auto' }}>
                          TEST
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Intégration certifiée.{gw.validatedAt ? ` Validée le ${new Date(gw.validatedAt).toLocaleDateString('fr-FR')}.` : ''}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {info.subscription && gateways.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Prochaine facture</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Abonnement mensuel {info.subscription.plan}
                </div>
              </div>
              <button
                onClick={() => alert(`Simulation du portail de paiement sécurisé KPSyPay... \n\nPasserelle sélectionnée : ${selectedGateway}.\nStatut de l'API : Opérationnel.\nRedirection en cours...`)}
                className="btn-primary"
                style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <i className="ph ph-shield-check" /> Procéder au paiement sécurisé via {selectedGateway}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── Modal de Paiement Obligatoire ─────────────────────────── */}
      {showPaymentModal && pendingPlan && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '480px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <i className="ph-bold ph-shield-check" style={{ fontSize: '1.4rem', color: 'white' }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Paiement sécurisé requis</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Migration vers le plan <strong style={{ color: 'var(--text-primary)' }}>{pendingPlan.name}</strong>
                  {' '}({pendingPlan.interval === 'YEARLY' ? 'Annuel' : 'Mensuel'})
                </p>
              </div>
            </div>

            {/* Récapitulatif */}
            <div style={{
              background: 'var(--bg-tertiary)', borderRadius: '12px',
              padding: '16px', marginBottom: '20px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
                Récapitulatif
              </div>
              {[
                { label: 'Plan sélectionné', value: pendingPlan.name },
                { label: 'Facturation', value: pendingPlan.interval === 'YEARLY' ? 'Annuelle (avec remise)' : 'Mensuelle' },
                { label: 'Plan actuel', value: info?.subscription?.plan ?? 'Aucun' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Choix de passerelle */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '12px' }}>
                Choisir le moyen de paiement :
              </div>
              {gateways.length === 0 ? (
                <div style={{
                  padding: '20px', borderRadius: '12px', border: '1px dashed #ef4444',
                  background: 'rgba(239,68,68,0.08)', color: 'var(--text-primary)', textAlign: 'left', fontSize: '0.85rem'
                }}>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', marginBottom: '8px' }}>
                    <i className="ph-fill ph-warning" style={{ fontSize: '1.2rem' }} />
                    Paiements automatisés indisponibles
                  </div>
                  Les passerelles de paiement en ligne ne sont pas configurées ou activées sur la plateforme.
                  Pour souscrire à ce plan, vous pouvez effectuer un paiement par <strong>chèque</strong> ou <strong>virement bancaire</strong> en contactant directement le propriétaire de la plateforme :
                  <div style={{ marginTop: '12px', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="ph ph-user-gear" style={{ color: 'var(--primary)' }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Admin :</span>
                      <a href="mailto:khalil.ndiaye@kpsyinformatique.com" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>khalil.ndiaye@kpsyinformatique.com</a>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="ph ph-envelope" style={{ color: 'var(--primary)' }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Support :</span>
                      <a href="mailto:kpsydesk.support@kpsyinformatique.com" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>kpsydesk.support@kpsyinformatique.com</a>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="ph ph-phone" style={{ color: 'var(--primary)' }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Téléphone :</span>
                      <a href="tel:+221778034756" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>+221 77 803 47 56</a>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {gateways.map(gw => {
                    const code = gw.provider.toUpperCase();
                    let logo = '💳';
                    let color = '#3b82f6';
                    if (code === 'WAVE') { logo = '🌊'; color = '#3b82f6'; }
                    else if (code === 'ORANGE_MONEY' || code === 'ORANGEMONEY') { logo = '🍊'; color = '#f97316'; }
                    else if (code === 'PAYTECH') { logo = '🚀'; color = '#22c55e'; }
                    else if (code === 'MTN_MOMO' || code === 'MTNMOMO') { logo = '📱'; color = '#f59e0b'; }

                    const isSelected = paymentGateway === gw.provider;
                    return (
                      <label key={gw.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                        border: isSelected ? `2px solid ${color}` : '1px solid var(--border-color)',
                        background: isSelected ? `${color}15` : 'var(--bg-tertiary)',
                        transition: 'all 0.15s'
                      }}>
                        <input
                          type="radio"
                          name="paymentGateway"
                          value={gw.provider}
                          checked={isSelected}
                          onChange={() => setPaymentGateway(gw.provider)}
                          style={{ accentColor: color }}
                        />
                        <span style={{ fontSize: '1.4rem' }}>{logo}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {gw.displayName || gw.provider}
                          </div>
                          {gw.isSandbox && (
                            <span style={{
                              fontSize: '0.65rem', background: '#f59e0b20', color: '#b45309',
                              padding: '1px 6px', borderRadius: '50px', fontWeight: 600
                            }}>MODE TEST</span>
                          )}
                        </div>
                        {isSelected && (
                          <i className="ph-bold ph-check-circle" style={{ marginLeft: 'auto', color, fontSize: '1.2rem' }} />
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Boutons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setShowPaymentModal(false); setPendingPlan(null); }}
                disabled={processingPayment}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: '1px solid var(--border-color)', background: 'transparent',
                  cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmPaymentAndUpgrade}
                disabled={!paymentGateway || processingPayment || gateways.length === 0}
                style={{
                  flex: 2, padding: '12px', borderRadius: '10px', border: 'none',
                  background: paymentGateway && gateways.length > 0
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : 'var(--border-color)',
                  color: 'white', fontWeight: 700, cursor: paymentGateway ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  fontSize: '0.9rem', transition: 'opacity 0.2s'
                }}
              >
                {processingPayment ? (
                  <>
                    <i className="ph ph-circle-notch" style={{ animation: 'spin 1s linear infinite' }} />
                    Traitement en cours...
                  </>
                ) : (
                  <>
                    <i className="ph-bold ph-shield-check" />
                    Confirmer & Payer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
