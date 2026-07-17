/**
 * Règle ESLint custom — no-unguarded-raw-query
 * ============================================
 *
 * Détecte tout usage de $queryRaw, $executeRaw, $queryRawUnsafe, $executeRawUnsafe
 * dans le code Prisma et génère un avertissement demandant une revue manuelle.
 *
 * CONTEXTE HISTORIQUE :
 *   Un bug d'isolation multi-tenant a été causé par l'usage de requêtes SQL brutes
 *   qui bypassent le filtre applicatif tenant (AsyncLocalStorage + Prisma middleware).
 *   Tout nouvel usage doit être explicitement justifié et documenté.
 *
 * USAGE :
 *   Dans .eslintrc.js → plugins: ['local'] + rules: { 'local/no-unguarded-raw-query': 'warn' }
 *
 * VOIR AUSSI : CONTRIBUTING.md section "Requêtes SQL Brutes"
 */

'use strict';

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Détecte les usages de $queryRaw/$executeRaw Prisma qui bypassent le filtre tenant applicatif. Requiert une revue manuelle pour confirmer la présence d\'un filtre tenant explicite.',
      recommended: true,
    },
    messages: {
      rawQueryDetected:
        '⚠️  SÉCURITÉ MULTI-TENANT : Usage de {{ method }}() détecté. ' +
        'Ces méthodes bypassent le filtre tenant applicatif (AsyncLocalStorage + Prisma middleware). ' +
        'Assurez-vous qu\'un filtre tenant explicite est présent dans la requête SQL (WHERE "tenantId" = ...) ' +
        'ou que la requête est documentée comme intentionnellement globale (Super-Admin/migration uniquement). ' +
        'Voir CONTRIBUTING.md pour la politique complète.',
    },
    schema: [],
  },

  create(context) {
    const RAW_METHODS = new Set([
      '$queryRaw',
      '$executeRaw',
      '$queryRawUnsafe',
      '$executeRawUnsafe',
    ]);

    return {
      // Détecter les tagged template literals : prisma.$queryRaw`...`
      TaggedTemplateExpression(node) {
        const tag = node.tag;
        if (
          tag.type === 'MemberExpression' &&
          tag.property.type === 'Identifier' &&
          RAW_METHODS.has(tag.property.name)
        ) {
          context.report({
            node,
            messageId: 'rawQueryDetected',
            data: { method: tag.property.name },
          });
        }
      },

      // Détecter les appels de méthode : prisma.$executeRawUnsafe(...)
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          RAW_METHODS.has(callee.property.name)
        ) {
          context.report({
            node,
            messageId: 'rawQueryDetected',
            data: { method: callee.property.name },
          });
        }
      },
    };
  },
};
