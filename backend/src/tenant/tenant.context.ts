import { AsyncLocalStorage } from 'async_hooks';

/**
 * Store contenu dans l'AsyncLocalStorage pour chaque requête HTTP.
 * Durée de vie : le temps d'un seul cycle requête→réponse.
 */
export interface TenantStore {
  tenantId: string;
  subdomain: string;
}

/**
 * Instance singleton d'AsyncLocalStorage partagée dans tout le processus.
 * Chaque requête HTTP dispose de son propre "contexte" isolé grâce à ALS.
 */
export const tenantStorage = new AsyncLocalStorage<TenantStore>();

/**
 * Facade statique pour accéder au tenant du contexte courant
 * sans injecter l'ALS partout dans les services.
 */
export class TenantContext {
  /** Retourne le tenantId du contexte courant, ou undefined si hors contexte tenant. */
  static getTenantId(): string | undefined {
    return tenantStorage.getStore()?.tenantId;
  }

  /** Retourne le sous-domaine du contexte courant. */
  static getSubdomain(): string | undefined {
    return tenantStorage.getStore()?.subdomain;
  }

  /**
   * Exécute une fonction dans un contexte tenant donné.
   * Utilisé par TenantMiddleware pour wraper le cycle requête/réponse.
   */
  static run<T>(store: TenantStore, fn: () => T): T {
    return tenantStorage.run(store, fn);
  }

  /** Indique si on est actuellement dans un contexte tenant. */
  static hasTenant(): boolean {
    return !!tenantStorage.getStore();
  }
}
