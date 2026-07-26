import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface Plan {
  id: string;
  name: string;
  price: number;
  quotaAssets: number;
  quotaUsers: number;
  featuresIncluded: Record<string, boolean>;
}

interface PricingViewProps {
  onSignup?: () => void;
}

const FEATURE_LABELS: Record<string, string> = {
  helpdesk: 'Tickets & Helpdesk',
  financial: 'Module Financier',
  agent: 'Agent Windows (ITAM)',
  kb: 'Base de Connaissances',
  onboarding: 'Onboarding IT',
  depreciation: 'Amortissement & Cycle de Vie',
  treasury_dashboard: 'Dashboard Trésorerie',
};

const PLAN_ICONS: Record<string, string> = {
  Starter: 'ph-rocket-launch',
  Pro: 'ph-lightning',
  Enterprise: 'ph-buildings',
  Legacy: 'ph-archive',
};

const PLAN_COLORS: Record<string, { gradient: string; accent: string; badge: string }> = {
  Starter:    { gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', accent: '#3b82f6', badge: '#dbeafe' },
  Pro:        { gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', accent: '#8b5cf6', badge: '#ede9fe' },
  Enterprise: { gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', accent: '#f59e0b', badge: '#fef3c7' },
};

export function PricingView({ onSignup }: PricingViewProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    api.get('/tenants/plans')
      .then(res => setPlans(res.data.filter((p: Plan) => p.name !== 'Legacy')))
      .catch(() => {
        // Plans de démonstration si l'API est indisponible
        setPlans([
          {
            id: 'starter',
            name: 'Starter',
            price: 15000,
            quotaAssets: 100,
            quotaUsers: 10,
            featuresIncluded: { helpdesk: true, financial: false, agent: false, kb: true, onboarding: false, depreciation: false },
          },
          {
            id: 'pro',
            name: 'Pro',
            price: 45000,
            quotaAssets: 500,
            quotaUsers: 50,
            featuresIncluded: { helpdesk: true, financial: true, agent: true, kb: true, onboarding: true, depreciation: false },
          },
          {
            id: 'enterprise',
            name: 'Enterprise',
            price: 120000,
            quotaAssets: 99999,
            quotaUsers: 99999,
            featuresIncluded: { helpdesk: true, financial: true, agent: true, kb: true, onboarding: true, depreciation: true },
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const formatPrice = (price: number) => {
    if (price === 0) return 'Gratuit';
    const annual = price * 12 * 0.8; // 20% de remise annuelle
    const displayed = billingCycle === 'yearly' ? annual / 12 : price;
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(displayed);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <i className="ph ph-spinner" style={{ fontSize: '2rem', animation: 'spin 1s linear infinite' }} />
          <div style={{ marginTop: '12px' }}>Chargement des plans...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'linear-gradient(135deg, #8b5cf620, #3b82f620)',
          border: '1px solid #8b5cf640', borderRadius: '50px',
          padding: '6px 18px', marginBottom: '1.5rem',
          fontSize: '0.8rem', color: '#8b5cf6', fontWeight: 600
        }}>
          <i className="ph-fill ph-sparkle" />
          Tarification SaaS
        </div>
        <h1 style={{
          fontSize: '2.5rem', fontWeight: 800, margin: '0 0 1rem',
          background: 'linear-gradient(135deg, var(--text-primary) 0%, #8b5cf6 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
        }}>
          Choisissez votre plan
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '500px', margin: '0 auto 2rem' }}>
          Gérez votre parc informatique avec la solution KPSyDesk ITAM. Commencez gratuitement pendant 7 jours.
        </p>

        {/* Billing Toggle */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '1rem',
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: '50px', padding: '6px'
        }}>
          <button
            onClick={() => setBillingCycle('monthly')}
            style={{
              padding: '8px 20px', borderRadius: '50px', border: 'none',
              background: billingCycle === 'monthly' ? 'var(--accent-blue)' : 'transparent',
              color: billingCycle === 'monthly' ? 'white' : 'var(--text-muted)',
              fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem'
            }}
          >
            Mensuel
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 20px', borderRadius: '50px', border: 'none',
              background: billingCycle === 'yearly' ? 'var(--accent-blue)' : 'transparent',
              color: billingCycle === 'yearly' ? 'white' : 'var(--text-muted)',
              fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem'
            }}
          >
            Annuel
            <span style={{
              background: '#22c55e', color: 'white', borderRadius: '50px',
              padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700
            }}>-20%</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, 1fr)`,
        gap: '1.5rem',
        alignItems: 'stretch'
      }}>
        {plans.map((plan, idx) => {
          const colors = PLAN_COLORS[plan.name] ?? PLAN_COLORS['Pro'];
          const isPro = plan.name === 'Pro';
          const icon = PLAN_ICONS[plan.name] ?? 'ph-package';
          const allFeatures = Object.keys(FEATURE_LABELS);

          return (
            <div key={plan.id} style={{
              position: 'relative', display: 'flex', flexDirection: 'column',
              background: 'var(--bg-secondary)', borderRadius: '20px',
              border: isPro ? `2px solid ${colors.accent}` : '1px solid var(--border-color)',
              overflow: 'hidden',
              boxShadow: isPro ? `0 0 40px ${colors.accent}30` : '0 4px 20px rgba(0,0,0,0.15)',
              transform: isPro ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}>
              {isPro && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  background: colors.gradient, padding: '6px', textAlign: 'center',
                  fontSize: '0.72rem', fontWeight: 700, color: 'white', letterSpacing: '1px'
                }}>
                  ⭐ LE PLUS POPULAIRE
                </div>
              )}

              {/* Plan Header */}
              <div style={{
                padding: isPro ? '2.5rem 1.75rem 1.5rem' : '1.75rem 1.75rem 1.5rem',
                background: `linear-gradient(135deg, ${colors.accent}15, ${colors.accent}05)`,
                borderBottom: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '12px',
                    background: colors.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <i className={`ph-bold ${icon}`} style={{ fontSize: '1.4rem', color: 'white' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{plan.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {plan.quotaAssets >= 99999 ? 'Actifs illimités' : `Jusqu'à ${plan.quotaAssets} actifs`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{
                    fontSize: '2.5rem', fontWeight: 800,
                    background: colors.gradient,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                  }}>{formatPrice(plan.price)}</span>
                  {plan.price > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>/mois</span>
                  )}
                </div>
                {billingCycle === 'yearly' && plan.price > 0 && (
                  <div style={{ fontSize: '0.78rem', color: '#22c55e', marginTop: '4px', fontWeight: 600 }}>
                    Économisez {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(plan.price * 12 * 0.2)}/an
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '1rem', flexWrap: 'wrap' }}>
                  <span style={{
                    background: `${colors.accent}20`, color: colors.accent,
                    border: `1px solid ${colors.accent}40`, borderRadius: '6px',
                    padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600
                  }}>
                    <i className="ph ph-desktop" style={{ marginRight: '4px' }} />
                    {plan.quotaAssets >= 99999 ? '∞' : plan.quotaAssets} actifs
                  </span>
                  <span style={{
                    background: `${colors.accent}20`, color: colors.accent,
                    border: `1px solid ${colors.accent}40`, borderRadius: '6px',
                    padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600
                  }}>
                    <i className="ph ph-users" style={{ marginRight: '4px' }} />
                    {plan.quotaUsers >= 99999 ? '∞' : plan.quotaUsers} utilisateurs
                  </span>
                </div>
              </div>

              {/* Features */}
              <div style={{ padding: '1.5rem 1.75rem', flex: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>
                  Fonctionnalités
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {allFeatures.map(key => {
                    const included = plan.featuresIncluded?.[key] === true;
                    return (
                      <li key={key} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        fontSize: '0.875rem',
                        color: included ? 'var(--text-primary)' : 'var(--text-muted)',
                        opacity: included ? 1 : 0.5
                      }}>
                        <i className={`ph-bold ${included ? 'ph-check-circle' : 'ph-x-circle'}`}
                          style={{ color: included ? '#22c55e' : 'var(--text-muted)', fontSize: '1rem', flexShrink: 0 }} />
                        {FEATURE_LABELS[key]}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* CTA */}
              <div style={{ padding: '1.25rem 1.75rem' }}>
                <button
                  onClick={onSignup}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
                    background: isPro ? colors.gradient : 'var(--bg-tertiary)',
                    color: isPro ? 'white' : 'var(--text-primary)',
                    fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                    transition: 'all 0.2s', letterSpacing: '0.5px',
                    boxShadow: isPro ? `0 4px 15px ${colors.accent}40` : 'none'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Commencer l'essai gratuit →
                </button>
                <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  7 jours gratuits • Aucune CB requise
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust Badges */}
      <div style={{
        marginTop: '3rem', display: 'flex', justifyContent: 'center', gap: '2rem',
        flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.85rem'
      }}>
        {[
          { icon: 'ph-shield-check', text: 'Données isolées par entreprise' },
          { icon: 'ph-lock', text: 'Chiffrement JWT & bcrypt' },
          { icon: 'ph-cloud', text: 'Infrastructure mutualisée' },
          { icon: 'ph-headset', text: 'Support inclus' },
        ].map(({ icon, text }) => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className={`ph-bold ${icon}`} style={{ color: '#22c55e' }} />
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}
