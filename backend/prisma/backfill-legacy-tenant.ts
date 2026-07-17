/**
 * Script de backfill multi-tenant — "Legacy Default Tenant"
 * 
 * Ce script doit être exécuté UNE SEULE FOIS après la migration Prisma initiale.
 * Il crée un tenant "Legacy" et assigne toutes les données existantes sans tenantId
 * à ce tenant, pour préserver la compatibilité avec les données pré-migration.
 * 
 * Exécution : npx ts-node prisma/backfill-legacy-tenant.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Démarrage du backfill multi-tenant...\n');

  // ============================================================
  // ÉTAPE 1 : Créer le Plan "Legacy"
  // ============================================================
  console.log('📋 Création du plan Legacy...');
  let legacyPlan = await prisma.plan.findFirst({ where: { name: 'Legacy' } });
  if (!legacyPlan) {
    legacyPlan = await prisma.plan.create({
      data: {
        name: 'Legacy',
        price: 0,
        quotaAssets: 99999,
        quotaUsers: 99999,
        featuresIncluded: {
          helpdesk: true,
          financial: true,
          agent: true,
          kb: true,
          onboarding: true,
          depreciation: true,
        },
        isPublic: false,
      },
    });
    console.log(`  ✅ Plan "Legacy" créé: ${legacyPlan.id}`);
  } else {
    console.log(`  ℹ️  Plan "Legacy" déjà existant: ${legacyPlan.id}`);
  }

  // ============================================================
  // ÉTAPE 2 : Créer le Tenant "Legacy Default"
  // ============================================================
  console.log('\n🏢 Création du tenant Legacy...');
  let legacyTenant = await prisma.tenant.findFirst({ where: { subdomain: 'legacy' } });
  if (!legacyTenant) {
    legacyTenant = await prisma.tenant.create({
      data: {
        name: 'Legacy Default',
        subdomain: 'legacy',
        status: 'ACTIVE',
        planId: legacyPlan.id,
      },
    });
    console.log(`  ✅ Tenant "Legacy Default" créé: ${legacyTenant.id}`);
  } else {
    console.log(`  ℹ️  Tenant "Legacy Default" déjà existant: ${legacyTenant.id}`);
  }

  const tenantId = legacyTenant.id;

  // ============================================================
  // ÉTAPE 3 : Créer la Subscription du tenant Legacy
  // ============================================================
  console.log('\n📑 Création de la subscription Legacy...');
  const existingSub = await prisma.subscription.findFirst({ where: { tenantId } });
  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        tenantId,
        planId: legacyPlan.id,
        status: 'ACTIVE',
        startDate: new Date('2025-01-01'),
      },
    });
    console.log('  ✅ Subscription Legacy créée.');
  } else {
    console.log('  ℹ️  Subscription Legacy déjà existante.');
  }

  // ============================================================
  // ÉTAPE 4 : Backfill de toutes les tables métier
  // ============================================================
  console.log('\n🔄 Backfill des tables métier...\n');

  const tables: Array<{ name: string; model: any }> = [
    { name: 'Department', model: prisma.department },
    { name: 'Location', model: prisma.location },
    { name: 'User', model: prisma.user },
    { name: 'Asset', model: prisma.asset },
    { name: 'Ticket', model: prisma.ticket },
    { name: 'TicketComment', model: prisma.ticketComment },
    { name: 'AssetHistory', model: prisma.assetHistory },
    { name: 'AuditLog', model: prisma.auditLog },
    { name: 'Supplier', model: prisma.supplier },
    { name: 'PurchaseOrder', model: prisma.purchaseOrder },
    { name: 'Contract', model: prisma.contract },
    { name: 'Maintenance', model: prisma.maintenance },
    { name: 'Consumable', model: prisma.consumable },
    { name: 'Sale', model: prisma.sale },
    { name: 'License', model: prisma.license },
    { name: 'Onboarding', model: prisma.onboarding },
    { name: 'KBArticle', model: prisma.kBArticle },
    { name: 'Movement', model: prisma.movement },
    { name: 'Depreciation', model: prisma.depreciation },
  ];

  for (const table of tables) {
    const result = await table.model.updateMany({
      where: { tenantId: null },
      data: { tenantId },
    });
    console.log(`  ✅ ${table.name.padEnd(15)}: ${result.count} enregistrement(s) mis à jour`);
  }

  // ============================================================
  // ÉTAPE 5 : Vérification — compte les enregistrements sans tenantId
  // ============================================================
  console.log('\n🔍 Vérification (enregistrements encore sans tenantId)...\n');
  let allOk = true;
  for (const table of tables) {
    const count = await table.model.count({ where: { tenantId: null } });
    if (count > 0) {
      console.log(`  ⚠️  ${table.name}: ${count} enregistrement(s) SANS tenantId`);
      allOk = false;
    } else {
      console.log(`  ✅ ${table.name.padEnd(15)}: OK`);
    }
  }

  if (allOk) {
    console.log('\n✅ Backfill terminé avec succès. Toutes les données ont un tenantId.');
    console.log(`\n📌 ID du Tenant Legacy : ${tenantId}`);
    console.log('   Sous-domaine : legacy');
    console.log('   Notez cet ID pour vos fichiers de configuration.\n');
  } else {
    console.error('\n❌ Certaines données n\'ont pas pu être migrées. Vérifiez manuellement.');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('❌ Erreur durant le backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
