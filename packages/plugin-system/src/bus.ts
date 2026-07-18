/**
 * The typed event bus. One pipeline serves both worlds: typed events created
 * with `defineEvent`, and the WooCommerce-named actions/filters that
 * `@spacendigital/compat-wc` routes through `alias()`. Handlers are stored per
 * canonical name, so a legacy `woocommerce_*` listener and a typed listener
 * registered against the same event run in one priority-ordered chain.
 */

const DEFAULT_PRIORITY = 10;

/** Opaque typed descriptor for an event carrying payload `T`. */
export interface EventDescriptor<T> {
  readonly name: string;
  readonly __payload?: T;
}

/** Typed descriptor for a filter over value `T` with extra args `A`. */
export interface FilterDescriptor<T, A extends unknown[] = unknown[]> {
  readonly name: string;
  readonly __value?: T;
  readonly __args?: A;
}

/** Create a typed event descriptor, e.g. `defineEvent<Order>('order.created')`. */
export function defineEvent<T>(name: string): EventDescriptor<T> {
  return { name };
}

/** Create a typed filter descriptor, e.g. `defineFilter<Money, [Product]>('product.get_price')`. */
export function defineFilter<T, A extends unknown[] = unknown[]>(name: string): FilterDescriptor<T, A> {
  return { name };
}

export type ActionHandler = (...args: unknown[]) => void | Promise<void>;
export type FilterHandler = (value: unknown, ...args: unknown[]) => unknown;

interface Registration {
  handler: ActionHandler | FilterHandler;
  priority: number;
  seq: number;
  once: boolean;
}

export class TypedBus {
  private handlers = new Map<string, Registration[]>();
  /** alias name -> canonical name */
  private aliases = new Map<string, string>();
  /** canonical name -> alias names (for reverse fan-out documentation) */
  private aliasIndex = new Map<string, string[]>();
  private seq = 0;

  private canonical(name: string): string {
    return this.aliases.get(name) ?? name;
  }

  /**
   * Declare `aliasName` (e.g. a `woocommerce_*` hook name) to share the
   * handler chain of `canonicalName` (a typed event name).
   */
  alias(aliasName: string, canonicalName: string): void {
    this.aliases.set(aliasName, canonicalName);
    const list = this.aliasIndex.get(canonicalName) ?? [];
    list.push(aliasName);
    this.aliasIndex.set(canonicalName, list);
  }

  aliasesOf(canonicalName: string): readonly string[] {
    return this.aliasIndex.get(canonicalName) ?? [];
  }

  hasAlias(name: string): boolean {
    return this.aliases.has(name);
  }

  onName(
    name: string,
    handler: ActionHandler | FilterHandler,
    priority = DEFAULT_PRIORITY,
    once = false,
  ): () => void {
    const key = this.canonical(name);
    const list = this.handlers.get(key) ?? [];
    const reg: Registration = { handler, priority, seq: this.seq++, once };
    list.push(reg);
    list.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    this.handlers.set(key, list);
    return () => {
      const current = this.handlers.get(key);
      if (!current) return;
      const idx = current.indexOf(reg);
      if (idx >= 0) current.splice(idx, 1);
    };
  }

  offName(name: string, handler: ActionHandler | FilterHandler): void {
    const key = this.canonical(name);
    const list = this.handlers.get(key);
    if (!list) return;
    const idx = list.findIndex((r) => r.handler === handler);
    if (idx >= 0) list.splice(idx, 1);
  }

  /** Subscribe to a typed event. Returns an unsubscribe function. */
  on<T>(event: EventDescriptor<T>, handler: (payload: T) => void | Promise<void>, priority = DEFAULT_PRIORITY): () => void {
    return this.onName(event.name, handler as ActionHandler, priority);
  }

  once<T>(event: EventDescriptor<T>, handler: (payload: T) => void | Promise<void>, priority = DEFAULT_PRIORITY): () => void {
    return this.onName(event.name, handler as ActionHandler, priority, true);
  }

  /** Register a filter callback for a typed filter. */
  filter<T, A extends unknown[]>(
    filter: FilterDescriptor<T, A>,
    handler: (value: T, ...args: A) => T | Promise<T>,
    priority = DEFAULT_PRIORITY,
  ): () => void {
    return this.onName(filter.name, handler as FilterHandler, priority);
  }

  private take(name: string): Registration[] {
    const key = this.canonical(name);
    const list = this.handlers.get(key) ?? [];
    const snapshot = [...list];
    for (const reg of snapshot) {
      if (reg.once) {
        const idx = list.indexOf(reg);
        if (idx >= 0) list.splice(idx, 1);
      }
    }
    return snapshot;
  }

  /** Emit a typed event; async handlers are awaited in priority order. */
  async emit<T>(event: EventDescriptor<T>, payload: T): Promise<void> {
    await this.emitByName(event.name, payload);
  }

  async emitByName(name: string, ...args: unknown[]): Promise<void> {
    for (const reg of this.take(name)) {
      await (reg.handler as ActionHandler)(...args);
    }
  }

  /** Synchronous emit: every handler must be sync (WC actions fired from sync paths). */
  emitSync(name: string, ...args: unknown[]): void {
    for (const reg of this.take(name)) {
      const result = (reg.handler as ActionHandler)(...args);
      if (result instanceof Promise) {
        result.catch(() => {});
      }
    }
  }

  /** Run a value through a typed filter chain (async). */
  async applyFilters<T, A extends unknown[]>(
    filter: FilterDescriptor<T, A>,
    value: T,
    ...args: A
  ): Promise<T> {
    return (await this.applyFiltersByName(filter.name, value, ...args)) as T;
  }

  async applyFiltersByName(name: string, value: unknown, ...args: unknown[]): Promise<unknown> {
    let current = value;
    for (const reg of this.take(name)) {
      current = await (reg.handler as FilterHandler)(current, ...args);
    }
    return current;
  }

  /**
   * Synchronous filter chain, used by `{prop}` getter filters which must stay
   * sync for WC parity. Throws if a handler returns a Promise.
   */
  applyFiltersSync<T, A extends unknown[]>(filter: FilterDescriptor<T, A>, value: T, ...args: A): T;
  applyFiltersSync(name: string, value: unknown, ...args: unknown[]): unknown;
  applyFiltersSync(
    filterOrName: FilterDescriptor<unknown> | string,
    value: unknown,
    ...args: unknown[]
  ): unknown {
    const name = typeof filterOrName === 'string' ? filterOrName : filterOrName.name;
    let current = value;
    for (const reg of this.take(name)) {
      const next = (reg.handler as FilterHandler)(current, ...args);
      if (next instanceof Promise) {
        throw new TypeError(
          `Filter "${name}" is applied synchronously; handler returned a Promise. Register a sync handler.`,
        );
      }
      current = next;
    }
    return current;
  }

  hasHandlers(name: string): boolean {
    return (this.handlers.get(this.canonical(name))?.length ?? 0) > 0;
  }

  handlerCount(name: string): number {
    return this.handlers.get(this.canonical(name))?.length ?? 0;
  }

  clear(): void {
    this.handlers.clear();
  }
}
