import type { DbConfig, SpcndDb } from '@spacendigital/db';
import {
  Container,
  createToken,
  type PluginHost,
  type SpcndPlugin,
  setupPlugins,
  TypedBus,
} from '@spacendigital/plugin-system';
import { CartService } from './cart/cart-service.js';
import { ProductService } from './catalog/product-service.js';
import { CheckoutService } from './checkout/checkout-service.js';
import { CouponService } from './coupons/coupon-service.js';
import { CustomerService } from './customers/customer-service.js';
import { DownloadService } from './downloads/download-service.js';
import { MemoryCacheAdapter } from './cache/memory-cache.js';
import {
  afterRegisterPostType,
  afterRegisterTaxonomy,
  appInit,
  appLoaded,
  orderStatusChanged,
  registerPostType,
  registerTaxonomy,
} from './events.js';
import { retentionJobs } from './gdpr/exporters.js';
import { ScheduledJobs } from './jobs/scheduled.js';
import { MediaService } from './media/media-service.js';
import { OrderService } from './orders/order-service.js';
import { MemoryQueueAdapter } from './queue/memory-queue.js';
import { DbSearchAdapter } from './search/db-search.js';
import {
  ANALYTICS_SYNC,
  CACHE_ADAPTER,
  type CacheAdapter,
  LOGGER,
  type Logger,
  type LogLevel,
  MEDIA_ADAPTER,
  type MediaAdapter,
  QUEUE_ADAPTER,
  type QueueAdapter,
  SEARCH_ADAPTER,
  type SearchAdapter,
  SESSION_STORE,
  type SessionStore,
  SHIPPING_SERVICE,
  TAX_SERVICE,
} from './services/interfaces.js';
import { MemorySessionStore } from './sessions/session-service.js';
import { SettingsService } from './settings/service.js';

/** DI tokens for the core services (plugins resolve these from the container). */
export const PRODUCT_SERVICE = createToken<ProductService>('ProductService');
export const CUSTOMER_SERVICE = createToken<CustomerService>('CustomerService');
export const COUPON_SERVICE = createToken<CouponService>('CouponService');
export const ORDER_SERVICE = createToken<OrderService>('OrderService');
export const CART_SERVICE = createToken<CartService>('CartService');
export const CHECKOUT_SERVICE = createToken<CheckoutService>('CheckoutService');
export const MEDIA_SERVICE = createToken<MediaService>('MediaService');
export const DOWNLOAD_SERVICE = createToken<DownloadService>('DownloadService');
export const SETTINGS_SERVICE = createToken<SettingsService>('SettingsService');

export interface SpcndCoreConfig {
  /** A connected SpcndDb or a lazy DbConfig from @spacendigital/db. */
  db: DbConfig | SpcndDb;
  /**
   * Optional migration hook, e.g. `(db) => migrate(db, migrationsDir)` from
   * @spacendigital/db. Kept injectable so core stays edge-clean.
   */
  migrate?: (db: SpcndDb) => Promise<void>;
  plugins?: SpcndPlugin[];
  /**
   * Injectable discovery hook (plugin-system's `./discover` export bound to a
   * scan root). Auto-discovery stays opt-in and Node-only (spec §7.1).
   */
  discoverPlugins?: () => Promise<SpcndPlugin[]>;
  sessionStore?: SessionStore;
  mediaAdapter?: MediaAdapter;
  cacheAdapter?: CacheAdapter;
  queueAdapter?: QueueAdapter;
  searchAdapter?: SearchAdapter;
  logger?: Logger;
  /** Platform capabilities for plugin gating, e.g. 'node:fs'. */
  capabilities?: string[];
}

export interface SpcndCore {
  db: SpcndDb;
  bus: TypedBus;
  container: Container;
  settings: SettingsService;
  jobs: ScheduledJobs;
  products: ProductService;
  customers: CustomerService;
  coupons: CouponService;
  orders: OrderService;
  cart: CartService;
  checkout: CheckoutService;
  media: MediaService;
  downloads: DownloadService;
  sessions: SessionStore;
  cache: CacheAdapter;
  queue: QueueAdapter;
  search: SearchAdapter;
  log: Logger;
  close(): Promise<void>;
}

class ConsoleLogger implements Logger {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const line = context ? `${message} ${JSON.stringify(context)}` : message;
    if (level === 'error') console.error(`[spcnd] ${line}`);
    else if (level === 'warn') console.warn(`[spcnd] ${line}`);
    else console.log(`[spcnd] ${level}: ${line}`);
  }
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }
  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }
}

/**
 * The core kernel factory (DECISION-7): connect the db, build bus + container
 * + settings + services, set up plugins, fire boot events. The `spcnd-ecom`
 * meta-package composes this with api + default impl plugins into
 * `createSpcndApp`. No module-level state — every call is an isolated world
 * (docs/AGENTS.md §3.2).
 */
export async function createSpcndCore(config: SpcndCoreConfig): Promise<SpcndCore> {
  const db = 'connect' in config.db ? await config.db.connect() : config.db;
  if (config.migrate) await config.migrate(db);

  const bus = new TypedBus();
  const container = new Container();
  const log = config.logger ?? new ConsoleLogger();
  const settings = new SettingsService(db);
  const jobs = new ScheduledJobs();

  const sessions = config.sessionStore ?? new MemorySessionStore();
  const cache = config.cacheAdapter ?? new MemoryCacheAdapter();
  const queue = config.queueAdapter ?? new MemoryQueueAdapter();
  const search = config.searchAdapter ?? new DbSearchAdapter(db);

  container.register(LOGGER, log);
  container.register(SESSION_STORE, sessions);
  container.register(CACHE_ADAPTER, cache);
  container.register(QUEUE_ADAPTER, queue);
  container.register(SEARCH_ADAPTER, search);
  if (config.mediaAdapter) container.register(MEDIA_ADAPTER, config.mediaAdapter);
  container.register(SETTINGS_SERVICE, settings);

  // Base services plugins may want during setup.
  const products = new ProductService({ db, bus, settings });
  const customers = new CustomerService({ db, bus });
  const coupons = new CouponService({ db, bus, settings });
  container.register(PRODUCT_SERVICE, products);
  container.register(CUSTOMER_SERVICE, customers);
  container.register(COUPON_SERVICE, coupons);

  await bus.emit(appInit, undefined);

  // Plugins register impl services (tax/shipping/payments/...) here.
  const host: PluginHost = {
    bus,
    container,
    capabilities: new Set(config.capabilities ?? []),
    log: (level, message, context) => log.log(level, message, context),
  };
  const plugins = [...(config.plugins ?? [])];
  if (config.discoverPlugins) plugins.push(...(await config.discoverPlugins()));
  await setupPlugins(plugins, host);

  // Orchestration services resolve impl interfaces after plugin setup.
  const tax = container.tryResolve(TAX_SERVICE);
  const shipping = container.tryResolve(SHIPPING_SERVICE);
  const analytics = container.tryResolve(ANALYTICS_SYNC);

  const cart = new CartService({ db, bus, settings, sessions, products, coupons, tax, shipping });
  const orders = new OrderService({
    db,
    bus,
    settings,
    products,
    coupons,
    customers,
    cart,
    tax,
    analytics,
  });
  const checkout = new CheckoutService({
    db,
    bus,
    settings,
    sessions,
    cart,
    orders,
    customers,
    coupons,
  });
  const media = new MediaService({ db, adapter: config.mediaAdapter });
  const downloads = new DownloadService({
    db,
    bus,
    settings,
    orders,
    products,
    media: config.mediaAdapter,
  });
  container.register(CART_SERVICE, cart);
  container.register(ORDER_SERVICE, orders);
  container.register(CHECKOUT_SERVICE, checkout);
  container.register(MEDIA_SERVICE, media);
  container.register(DOWNLOAD_SERVICE, downloads);

  // Download permissions follow paid statuses (grant-after-payment setting).
  bus.on(orderStatusChanged, async ({ order }) => {
    if (order.status === 'processing' || order.status === 'completed') {
      await downloads.maybeGrantOnStatus(order);
    }
  });

  for (const job of retentionJobs(db, settings)) jobs.register(job);
  const memoryQueue = queue instanceof MemoryQueueAdapter ? queue : null;
  if (memoryQueue) {
    jobs.register({
      name: 'queue.run-pending',
      schedule: '*/5 * * * *',
      run: async () => {
        await memoryQueue.runPending();
      },
    });
  }

  // WC-compat no-op boot events (spec §7.3 delta).
  await bus.emit(registerPostType, undefined);
  await bus.emit(afterRegisterPostType, undefined);
  await bus.emit(registerTaxonomy, undefined);
  await bus.emit(afterRegisterTaxonomy, undefined);
  await bus.emit(appLoaded, undefined);

  return {
    db,
    bus,
    container,
    settings,
    jobs,
    products,
    customers,
    coupons,
    orders,
    cart,
    checkout,
    media,
    downloads,
    sessions,
    cache,
    queue,
    search,
    log,
    close: () => db.close(),
  };
}
