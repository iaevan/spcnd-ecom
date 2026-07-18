import type { ActionHandler, FilterHandler, TypedBus } from '@spacendigital/plugin-system';
import { WC_HOOK_ALIASES, resolveWcHookName } from './aliases.js';

/**
 * The WC-shaped hook surface (docs/AGENTS.md §7.2). Everything routes through
 * the app's TypedBus, so a `compat.on('woocommerce_new_product', fn)` handler
 * and a typed `bus.on(productCreated, fn)` handler run in one
 * priority-ordered chain — never a second registry.
 */
export interface WcCompat {
  /** `add_action` / `add_filter`. Returns an unsubscribe function. */
  on(hookName: string, handler: ActionHandler | FilterHandler, priority?: number): () => void;
  addAction(hookName: string, handler: ActionHandler, priority?: number): () => void;
  addFilter(hookName: string, handler: FilterHandler, priority?: number): () => void;
  /** `remove_action` / `remove_filter`. */
  off(hookName: string, handler: ActionHandler | FilterHandler): void;
  /** `do_action` — async because typed handlers may be async. */
  doAction(hookName: string, ...args: unknown[]): Promise<void>;
  /** Sync `do_action` for WC code paths that cannot await (fire-and-forget). */
  doActionSync(hookName: string, ...args: unknown[]): void;
  /** `apply_filters`. */
  applyFilters<T>(hookName: string, value: T, ...args: unknown[]): Promise<T>;
  /** Sync `apply_filters` — throws if an async handler is registered (getter filters). */
  applyFiltersSync<T>(hookName: string, value: T, ...args: unknown[]): T;
  /** `has_action` / `has_filter`. */
  hasHook(hookName: string): boolean;
  /** Canonical name a WC hook maps onto (itself when unmapped). */
  resolve(hookName: string): string;
}

/**
 * Register every static alias on the bus and return the WC-shaped API.
 * Dynamic families (`woocommerce_order_status_{a}_to_{b}`,
 * `woocommerce_product_get_{prop}`, …) are resolved per call, so sync getter
 * filters registered under WC names participate in core's
 * `applyFiltersSync(productGetterFilter('price'), …)` chains.
 */
export function createWcCompat(bus: TypedBus): WcCompat {
  for (const [wcName, canonical] of Object.entries(WC_HOOK_ALIASES)) {
    bus.alias(wcName, canonical);
  }

  return {
    on(hookName, handler, priority = 10) {
      return bus.onName(resolveWcHookName(hookName), handler, priority);
    },
    addAction(hookName, handler, priority = 10) {
      return bus.onName(resolveWcHookName(hookName), handler, priority);
    },
    addFilter(hookName, handler, priority = 10) {
      return bus.onName(resolveWcHookName(hookName), handler, priority);
    },
    off(hookName, handler) {
      bus.offName(resolveWcHookName(hookName), handler);
    },
    async doAction(hookName, ...args) {
      await bus.emitByName(resolveWcHookName(hookName), ...args);
    },
    doActionSync(hookName, ...args) {
      bus.emitSync(resolveWcHookName(hookName), ...args);
    },
    async applyFilters(hookName, value, ...args) {
      return (await bus.applyFiltersByName(
        resolveWcHookName(hookName),
        value,
        ...args,
      )) as typeof value;
    },
    applyFiltersSync(hookName, value, ...args) {
      return bus.applyFiltersSync(resolveWcHookName(hookName), value, ...args) as typeof value;
    },
    hasHook(hookName) {
      return bus.hasHandlers(resolveWcHookName(hookName));
    },
    resolve: resolveWcHookName,
  };
}
