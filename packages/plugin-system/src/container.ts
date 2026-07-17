/** Typed service token. Create once per service interface and share it. */
export interface ServiceToken<T> {
  readonly id: symbol;
  readonly description: string;
  readonly __type?: T;
}

/** Create a typed DI token, e.g. `createToken<TaxService>('tax')`. */
export function createToken<T>(description: string): ServiceToken<T> {
  return { id: Symbol(description), description };
}

type Factory<T> = (container: Container) => T;

/**
 * Per-app-instance DI container. No globals: every `createSpcndApp()` builds
 * its own container, so two apps in one process never share services.
 */
export class Container {
  private instances = new Map<symbol, unknown>();
  private factories = new Map<symbol, Factory<unknown>>();

  register<T>(token: ServiceToken<T>, instance: T): void {
    this.instances.set(token.id, instance);
  }

  registerFactory<T>(token: ServiceToken<T>, factory: Factory<T>): void {
    this.factories.set(token.id, factory as Factory<unknown>);
  }

  has(token: ServiceToken<unknown>): boolean {
    return this.instances.has(token.id) || this.factories.has(token.id);
  }

  resolve<T>(token: ServiceToken<T>): T {
    if (this.instances.has(token.id)) return this.instances.get(token.id) as T;
    const factory = this.factories.get(token.id);
    if (factory) {
      const instance = factory(this) as T;
      this.instances.set(token.id, instance);
      return instance;
    }
    throw new Error(`Service not registered: ${token.description}`);
  }

  tryResolve<T>(token: ServiceToken<T>): T | undefined {
    return this.has(token) ? this.resolve(token) : undefined;
  }
}
