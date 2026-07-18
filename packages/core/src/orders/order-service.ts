import type { SpcndDb } from '@spacendigital/db';
import type { TypedBus } from '@spacendigital/plugin-system';
import {
  type Address,
  Money,
  type OrderEventType,
  type OrderStatus,
  ORDER_STATUSES,
  PAID_ORDER_STATUSES,
  type PaginatedResult,
  VALID_ORDER_STATUSES_FOR_PAYMENT,
  VALID_ORDER_STATUSES_FOR_PAYMENT_COMPLETE,
} from '@spacendigital/types';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { CartService, CalculatedCart } from '../cart/cart-service.js';
import { TotalsEngine, type TotalsFee, type TotalsItem, type TotalsShippingLine } from '../cart/totals.js';
import type { ProductService } from '../catalog/product-service.js';
import type { CouponService } from '../coupons/coupon-service.js';
import type { CustomerService } from '../customers/customer-service.js';
import type { NewOrder, NewOrderItem, Order, OrderItem, OrderNote, OrderRefund } from '../entities.js';
import { NotFoundError, SpcndError } from '../errors.js';
import {
  checkoutCreateOrderCouponItem,
  checkoutCreateOrderFeeItem,
  checkoutCreateOrderLineItem,
  checkoutCreateOrderShippingItem,
  checkoutCreateOrderTaxItem,
  filterDefaultOrderStatus,
  filterOrderIsEditable,
  filterOrderIsPaid,
  filterOrderNeedsPayment,
  filterOrderNumber,
  filterPaymentCompleteOrderStatus,
  filterValidOrderStatusesForPayment,
  filterValidOrderStatusesForPaymentComplete,
  newCustomerNote,
  orderAfterCalculateTotals,
  orderBeforeCalculateTotals,
  orderDeleted,
  orderEditStatus,
  orderFullyRefunded,
  orderNew,
  orderNoteAdded,
  orderPartiallyRefunded,
  orderPaymentStatusChanged,
  orderRefundCreated,
  orderStatusChanged,
  orderStatusEvent,
  orderStatusTransitionEvent,
  orderUpdated,
  paymentComplete,
  paymentCompleteOrderStatusEvent,
  prePaymentComplete,
  resumeOrder,
} from '../events.js';
import type { AnalyticsSync, TaxLocation, TaxService } from '../services/interfaces.js';
import type { SettingsService } from '../settings/service.js';
import { generateOrderKey, nowIso } from '../utils.js';

export interface CreateOrderInput {
  status?: OrderStatus;
  currency?: string;
  customerId?: number | null;
  billing?: Partial<Address>;
  shipping?: Partial<Address>;
  paymentMethod?: string;
  paymentMethodTitle?: string;
  transactionId?: string;
  customerNote?: string;
  createdVia?: string;
  customerIpAddress?: string;
  customerUserAgent?: string;
  pricesIncludeTax?: boolean;
  cartHash?: string;
  parentId?: number | null;
}

export interface OrderListQuery {
  page?: number;
  perPage?: number;
  status?: OrderStatus | OrderStatus[];
  customerId?: number;
  orderBy?: 'date' | 'id' | 'total';
  order?: 'asc' | 'desc';
}

export interface CreateRefundInput {
  amount: string;
  reason?: string;
  refundedBy?: number | null;
  refundedPayment?: boolean;
  /** Per-line refunds: order_item id → { qty, totalMinor }. */
  lineItems?: { orderItemId: number; quantity: number; totalMinor: number }[];
  /** Restore stock for refunded line quantities. */
  restock?: boolean;
}

interface Deps {
  db: SpcndDb;
  bus: TypedBus;
  settings: SettingsService;
  products: ProductService;
  coupons: CouponService;
  customers: CustomerService;
  cart?: CartService;
  tax?: TaxService;
  analytics?: AnalyticsSync;
}

/** Statuses whose transition into them reduces stock / records sales (WC hooks). */
const STOCK_REDUCING_STATUSES: readonly OrderStatus[] = ['processing', 'on-hold', 'completed'];
const SALES_RECORDING_STATUSES: readonly OrderStatus[] = ['processing', 'on-hold', 'completed'];
const COUPON_COUNTING_STATUSES: readonly OrderStatus[] = ['pending', 'processing', 'on-hold', 'completed'];
/** Transition notes are suppressed when leaving these (§2.3 special behaviors). */
const DRAFT_STATUSES: readonly OrderStatus[] = ['draft', 'auto-draft', 'checkout-draft'];

/**
 * Order lifecycle: creation (incl. from a calculated cart), the status state
 * machine with WC's exact transition-event order (§2.3), payment_complete
 * (§2.4), totals recalculation over the shared TotalsEngine (§11.1–11.3),
 * one-shot operational events on the order_events table, refunds and notes.
 */
export class OrderService {
  constructor(private readonly deps: Deps) {}

  // --- Reads ---------------------------------------------------------------

  async get(id: number): Promise<Order> {
    const order = await this.find(id);
    if (!order) throw new NotFoundError('Order', id);
    return order;
  }

  async find(id: number): Promise<Order | undefined> {
    const { db } = this.deps;
    const rows = await db.drizzle.select().from(db.schema.orders).where(eq(db.schema.orders.id, id));
    return rows[0];
  }

  async findByOrderKey(orderKey: string): Promise<Order | undefined> {
    const { db } = this.deps;
    const rows = await db.drizzle
      .select()
      .from(db.schema.orders)
      .where(eq(db.schema.orders.orderKey, orderKey));
    return rows[0];
  }

  /** WC order number — the id unless a plugin filters it (sequential numbers etc.). */
  async getOrderNumber(order: Order): Promise<string> {
    return this.deps.bus.applyFilters(filterOrderNumber, String(order.id), order);
  }

  async list(query: OrderListQuery = {}): Promise<PaginatedResult<Order>> {
    const { db } = this.deps;
    const s = db.schema;
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.perPage ?? 10));
    const conds = [];
    if (query.status) {
      conds.push(
        Array.isArray(query.status)
          ? inArray(s.orders.status, query.status)
          : eq(s.orders.status, query.status),
      );
    }
    if (query.customerId !== undefined) conds.push(eq(s.orders.customerId, query.customerId));
    const where = conds.length > 0 ? and(...conds) : undefined;
    const orderColumn = { date: s.orders.dateCreated, id: s.orders.id, total: s.orders.total }[
      query.orderBy ?? 'date'
    ];
    const orderBy = (query.order === 'asc' ? asc : desc)(orderColumn);
    const base = db.drizzle.select().from(s.orders);
    const rows = await (where ? base.where(where) : base)
      .orderBy(orderBy, desc(s.orders.id))
      .limit(perPage)
      .offset((page - 1) * perPage);
    const countBase = db.drizzle.select({ count: sql<number>`count(*)` }).from(s.orders);
    const total = Number((await (where ? countBase.where(where) : countBase))[0]?.count ?? 0);
    return { items: rows, total, totalPages: Math.ceil(total / perPage), page, perPage };
  }

  async getItems(orderId: number, types?: OrderItem['type'][]): Promise<OrderItem[]> {
    const { db } = this.deps;
    const s = db.schema;
    const conds = [eq(s.orderItems.orderId, orderId)];
    if (types?.length) conds.push(inArray(s.orderItems.type, types));
    return db.drizzle
      .select()
      .from(s.orderItems)
      .where(and(...conds))
      .orderBy(asc(s.orderItems.id));
  }

  // --- Creation ------------------------------------------------------------

  async create(input: CreateOrderInput = {}): Promise<Order> {
    const { db, bus, settings } = this.deps;
    const status =
      input.status ?? (await bus.applyFilters(filterDefaultOrderStatus, 'pending' as string));
    const order = await db.transaction(async (tx) =>
      this.insertOrder(tx, input, status as OrderStatus, await settings.getString('currency')),
    );
    await bus.emit(orderNew, order);
    return order;
  }

  /**
   * WC_Checkout::create_order — build the order (or resume a matching
   * pending/failed one on identical cart_hash) from a calculated cart, writing
   * every item row and the totals in one transaction.
   */
  async createFromCart(
    cart: CalculatedCart,
    input: CreateOrderInput & { resumeOrderId?: number },
  ): Promise<Order> {
    const { db, bus, settings } = this.deps;
    const currency = input.currency ?? (await settings.getString('currency'));
    const status =
      input.status ?? ((await bus.applyFilters(filterDefaultOrderStatus, 'pending')) as OrderStatus);

    let resumed: Order | undefined;
    if (input.resumeOrderId) {
      const candidate = await this.find(input.resumeOrderId);
      if (
        candidate &&
        (candidate.status === 'pending' || candidate.status === 'failed') &&
        candidate.cartHash === cart.cartHash
      ) {
        resumed = candidate;
      }
    }

    const created = await db.transaction(async (tx) => {
      const s = tx.schema;
      let order: Order;
      if (resumed) {
        await tx.drizzle.delete(s.orderItems).where(eq(s.orderItems.orderId, resumed.id));
        await tx.drizzle
          .update(s.orders)
          .set({ ...this.orderFields(input), dateModified: nowIso(), cartHash: cart.cartHash, currency })
          .where(eq(s.orders.id, resumed.id));
        order = (await tx.drizzle.select().from(s.orders).where(eq(s.orders.id, resumed.id)))[0] as Order;
      } else {
        order = await this.insertOrder(tx, { ...input, cartHash: cart.cartHash }, status, currency);
      }
      await this.writeItemsFromCart(tx, order, cart);
      const t = cart.totals;
      await tx.drizzle
        .update(s.orders)
        .set({
          discountTotal: minorToDb(t.discountTotalMinor),
          discountTax: minorToDb(t.discountTaxMinor),
          shippingTotal: minorToDb(t.shippingTotalMinor),
          shippingTax: minorToDb(t.shippingTaxMinor),
          cartTax: minorToDb(t.cartTaxMinor),
          totalTax: minorToDb(t.totalTaxMinor),
          total: minorToDb(t.totalMinor),
          dateModified: nowIso(),
        })
        .where(eq(s.orders.id, order.id));
      const row = (await tx.drizzle.select().from(s.orders).where(eq(s.orders.id, order.id)))[0];
      if (!row) throw new SpcndError('Order write failed', 'order_write_failed', 500);
      if (this.deps.analytics) await this.deps.analytics.syncOrder(tx, row.id);
      return row;
    });

    if (resumed) await bus.emit(resumeOrder, { orderId: created.id });
    else await bus.emit(orderNew, created);
    return created;
  }

  private orderFields(input: CreateOrderInput): Partial<NewOrder> {
    const billing = input.billing ?? {};
    const shipping = input.shipping ?? {};
    return {
      customerId: input.customerId ?? null,
      billingFirstName: billing.firstName ?? '',
      billingLastName: billing.lastName ?? '',
      billingCompany: billing.company ?? '',
      billingAddress1: billing.address1 ?? '',
      billingAddress2: billing.address2 ?? '',
      billingCity: billing.city ?? '',
      billingState: billing.state ?? '',
      billingPostcode: billing.postcode ?? '',
      billingCountry: billing.country ?? '',
      billingEmail: billing.email ?? '',
      billingPhone: billing.phone ?? '',
      shippingFirstName: shipping.firstName ?? '',
      shippingLastName: shipping.lastName ?? '',
      shippingCompany: shipping.company ?? '',
      shippingAddress1: shipping.address1 ?? '',
      shippingAddress2: shipping.address2 ?? '',
      shippingCity: shipping.city ?? '',
      shippingState: shipping.state ?? '',
      shippingPostcode: shipping.postcode ?? '',
      shippingCountry: shipping.country ?? '',
      shippingPhone: shipping.phone ?? '',
      paymentMethod: input.paymentMethod ?? '',
      paymentMethodTitle: input.paymentMethodTitle ?? '',
      transactionId: input.transactionId ?? null,
      customerNote: input.customerNote ?? null,
      createdVia: input.createdVia ?? null,
      customerIpAddress: input.customerIpAddress ?? null,
      customerUserAgent: input.customerUserAgent ?? null,
      pricesIncludeTax: input.pricesIncludeTax ?? false,
      parentId: input.parentId ?? null,
      cartHash: input.cartHash ?? null,
    };
  }

  private async insertOrder(
    tx: SpcndDb,
    input: CreateOrderInput,
    status: OrderStatus,
    currency: string,
  ): Promise<Order> {
    const s = tx.schema;
    const now = nowIso();
    // TODO:security-blocked — SECURITY_WORK item S1: order_key stays a plain
    // random `wc_order_*` string; no integrity-tag derivation yet.
    const orderKey = generateOrderKey();
    await tx.drizzle.insert(s.orders).values({
      ...this.orderFields(input),
      status,
      currency: input.currency ?? currency,
      orderKey,
      dateCreated: now,
      dateModified: now,
    });
    const row = (await tx.drizzle.select().from(s.orders).where(eq(s.orders.orderKey, orderKey)))[0];
    if (!row) throw new SpcndError('Order insert failed', 'order_insert_failed', 500);
    return row;
  }

  private async insertItem(tx: SpcndDb, values: NewOrderItem): Promise<OrderItem> {
    const s = tx.schema;
    await tx.drizzle.insert(s.orderItems).values(values);
    const rows = await tx.drizzle
      .select()
      .from(s.orderItems)
      .where(eq(s.orderItems.orderId, values.orderId))
      .orderBy(desc(s.orderItems.id))
      .limit(1);
    const row = rows[0];
    if (!row) throw new SpcndError('Order item insert failed', 'order_item_insert_failed', 500);
    return row;
  }

  private async writeItemsFromCart(tx: SpcndDb, order: Order, cart: CalculatedCart): Promise<void> {
    const { bus } = this.deps;
    for (const line of cart.lines) {
      const name = line.variationRow
        ? `${line.product.name}${formatVariation(line.variation)}`
        : line.product.name;
      const item = await this.insertItem(tx, {
        orderId: order.id,
        name,
        type: 'line_item',
        productId: line.productId,
        variationId: line.variationId,
        quantity: line.quantity,
        subtotal: minorToDb(line.subtotalMinor),
        total: minorToDb(line.totalMinor),
        subtotalTax: minorToDb(line.subtotalTaxMinor),
        totalTax: minorToDb(line.totalTaxMinor),
        taxClass: line.variationRow?.taxClass || line.product.taxClass,
        taxStatus: line.variationRow?.taxStatus ?? line.product.taxStatus,
        taxes: {
          total: mapMinorToDb(line.taxesByRate),
          subtotal: mapMinorToDb(line.subtotalTaxesByRate),
        },
        metaData: [
          ...Object.entries(line.variation).map(([key, value]) => ({ key, value })),
          ...Object.entries(line.cartItemData).map(([key, value]) => ({ key, value })),
        ],
      });
      await bus.emit(checkoutCreateOrderLineItem, { item, cartItemKey: line.key, orderId: order.id });
    }
    for (const fee of cart.totals.fees) {
      const item = await this.insertItem(tx, {
        orderId: order.id,
        name: fee.name,
        type: 'fee',
        total: minorToDb(fee.totalMinor),
        totalTax: minorToDb(fee.taxMinor),
        taxes: { total: mapMinorToDb(fee.taxesByRate) },
      });
      await bus.emit(checkoutCreateOrderFeeItem, { item, orderId: order.id });
    }
    for (const ship of cart.totals.shipping) {
      const item = await this.insertItem(tx, {
        orderId: order.id,
        name: ship.label,
        type: 'shipping',
        total: minorToDb(ship.totalMinor),
        totalTax: minorToDb(ship.taxMinor),
        taxes: { total: mapMinorToDb(ship.taxesByRate) },
        metaData: [
          { key: 'method_id', value: ship.methodId },
          { key: 'instance_id', value: ship.instanceId },
          { key: 'rate_id', value: ship.rateId },
        ],
      });
      await bus.emit(checkoutCreateOrderShippingItem, { item, orderId: order.id });
    }
    await this.writeTaxLines(tx, order.id, cart.totals.cartTaxesByRate, cart.totals.shippingTaxesByRate);
    for (const [code, totals] of cart.totals.couponTotals) {
      const item = await this.insertItem(tx, {
        orderId: order.id,
        name: code,
        type: 'coupon',
        total: minorToDb(totals.discountMinor),
        totalTax: minorToDb(totals.discountTaxMinor),
      });
      await bus.emit(checkoutCreateOrderCouponItem, { item, orderId: order.id });
    }
  }

  /**
   * §11.3 consolidation: one 'tax' item per rate id. total = cart tax,
   * subtotal = shipping tax (columns reused; labels/rate data in meta_data —
   * compat-wc reshapes to WC's tax-line fields).
   */
  private async writeTaxLines(
    tx: SpcndDb,
    orderId: number,
    cartTaxes: Record<string, number>,
    shippingTaxes: Record<string, number>,
  ): Promise<void> {
    const s = tx.schema;
    await tx.drizzle
      .delete(s.orderItems)
      .where(and(eq(s.orderItems.orderId, orderId), eq(s.orderItems.type, 'tax')));
    const rateIds = new Set([...Object.keys(cartTaxes), ...Object.keys(shippingTaxes)]);
    for (const rateId of rateIds) {
      const cartAmount = cartTaxes[rateId] ?? 0;
      const shippingAmount = shippingTaxes[rateId] ?? 0;
      if (cartAmount === 0 && shippingAmount === 0) continue;
      const rate = await this.findTaxRate(Number(rateId));
      const item = await this.insertItem(tx, {
        orderId,
        name: rate?.name ?? 'Tax',
        type: 'tax',
        total: minorToDb(cartAmount),
        subtotal: minorToDb(shippingAmount),
        metaData: [
          { key: 'rate_id', value: Number(rateId) },
          { key: 'rate_percent', value: rate ? Number(rate.rate) : 0 },
          { key: 'compound', value: rate?.compound ?? false },
          { key: 'label', value: rate?.name ?? 'Tax' },
        ],
      });
      await this.deps.bus.emit(checkoutCreateOrderTaxItem, { item, orderId });
    }
  }

  private async findTaxRate(rateId: number) {
    const { db } = this.deps;
    const rows = await db.drizzle
      .select()
      .from(db.schema.taxRates)
      .where(eq(db.schema.taxRates.id, rateId));
    return rows[0];
  }

  // --- Status machine ------------------------------------------------------

  /**
   * §2.3 — events fire in the exact documented order. Side-effect one-shots
   * (stock, sales, coupon counts) run guarded by order_events rows.
   */
  async setStatus(
    id: number,
    to: OrderStatus,
    note?: string,
    manual = false,
  ): Promise<Order> {
    const { db, bus } = this.deps;
    if (!ORDER_STATUSES.includes(to)) {
      throw new SpcndError(`Invalid order status "${to}"`, 'invalid_order_status');
    }
    const order = await this.get(id);
    const from = order.status;
    if (from === to) return order;

    const patch: Partial<NewOrder> = { status: to, dateModified: nowIso() };
    if (!order.datePaid && PAID_ORDER_STATUSES.includes(to)) patch.datePaid = nowIso();
    if (!order.dateCompleted && to === 'completed') patch.dateCompleted = nowIso();
    await db.drizzle.update(db.schema.orders).set(patch).where(eq(db.schema.orders.id, id));
    const updated = await this.get(id);

    await bus.emit(orderStatusEvent(to), { orderId: id, order: updated });
    if (!DRAFT_STATUSES.includes(from)) {
      await this.addNote(
        id,
        note ? `Order status changed from ${from} to ${to}. ${note}` : `Order status changed from ${from} to ${to}.`,
        'system',
      );
    }
    await bus.emit(orderStatusTransitionEvent(from, to), { orderId: id, order: updated });
    await bus.emit(orderStatusChanged, { orderId: id, from, to, order: updated });
    if (
      VALID_ORDER_STATUSES_FOR_PAYMENT.includes(from) &&
      PAID_ORDER_STATUSES.includes(to)
    ) {
      await bus.emit(orderPaymentStatusChanged, { orderId: id, order: updated });
    }
    if (manual) await bus.emit(orderEditStatus, { orderId: id, status: to });

    // WC's status-hooked side effects, idempotent via order_events.
    if (STOCK_REDUCING_STATUSES.includes(to)) await this.maybeReduceStock(id);
    if (SALES_RECORDING_STATUSES.includes(to)) await this.maybeRecordSales(id);
    if (COUPON_COUNTING_STATUSES.includes(to)) await this.maybeRecordCouponUsage(id);
    if (to === 'cancelled' || to === 'failed') {
      await this.maybeRestoreStock(id);
      await this.maybeReverseCouponUsage(id);
    }
    await bus.emit(orderUpdated, updated);
    return this.get(id);
  }

  /** §2.4 payment_complete. Returns false when the status disallowed it. */
  async paymentComplete(id: number, transactionId?: string): Promise<boolean> {
    const { db, bus } = this.deps;
    const order = await this.get(id);
    await bus.emit(prePaymentComplete, { orderId: id, transactionId });

    const validStatuses = await bus.applyFilters(
      filterValidOrderStatusesForPaymentComplete,
      [...VALID_ORDER_STATUSES_FOR_PAYMENT_COMPLETE],
      order,
    );
    if (!validStatuses.includes(order.status)) {
      await bus.emit(paymentCompleteOrderStatusEvent(order.status), { orderId: id, transactionId });
      return false;
    }

    const patch: Partial<NewOrder> = { dateModified: nowIso() };
    if (transactionId) patch.transactionId = transactionId;
    if (!order.datePaid) patch.datePaid = nowIso();
    await db.drizzle.update(db.schema.orders).set(patch).where(eq(db.schema.orders.id, id));

    const next = await bus.applyFilters(
      filterPaymentCompleteOrderStatus,
      (await this.needsProcessing(id)) ? 'processing' : 'completed',
      id,
      order,
    );
    await this.setStatus(id, next as OrderStatus, 'Payment completed.');
    await bus.emit(paymentComplete, { orderId: id, transactionId });
    return true;
  }

  /** WC needs_processing: anything that is not virtual+downloadable. */
  private async needsProcessing(orderId: number): Promise<boolean> {
    const items = await this.getItems(orderId, ['line_item']);
    for (const item of items) {
      if (!item.productId) return true;
      const product = await this.deps.products.find(item.productId);
      if (!product) return true;
      const variation = item.variationId
        ? await this.deps.products.getVariation(item.variationId).catch(() => null)
        : null;
      const virtual = variation?.virtual ?? product.virtual;
      const downloadable = variation?.downloadable ?? product.downloadable;
      if (!(virtual && downloadable)) return true;
    }
    return false;
  }

  // --- Conditionals (filterable) -------------------------------------------

  async needsPayment(order: Order): Promise<boolean> {
    const { bus } = this.deps;
    const statuses = await bus.applyFilters(
      filterValidOrderStatusesForPayment,
      [...VALID_ORDER_STATUSES_FOR_PAYMENT],
      order,
    );
    const needs = statuses.includes(order.status) && Money.fromDb(order.total).isPositive();
    return bus.applyFilters(filterOrderNeedsPayment, needs, order, statuses);
  }

  async isPaid(order: Order): Promise<boolean> {
    return this.deps.bus.applyFilters(
      filterOrderIsPaid,
      PAID_ORDER_STATUSES.includes(order.status),
      order,
    );
  }

  async isEditable(order: Order): Promise<boolean> {
    const editable = ['pending', 'on-hold', 'auto-draft', 'checkout-draft'].includes(order.status);
    return this.deps.bus.applyFilters(filterOrderIsEditable, editable, order);
  }

  // --- Totals recalculation (§11.1–11.3) -----------------------------------

  /**
   * Rebuild taxes and totals from the item rows through the shared engine.
   * Line items keep their stored ex-tax subtotals/totals (discounts already
   * baked in); taxes are recomputed for the order's tax location.
   */
  async calculateTotals(id: number, andTaxes = true): Promise<Order> {
    const { db, bus, settings } = this.deps;
    const order = await this.get(id);
    await bus.emit(orderBeforeCalculateTotals, { andTaxes, order });

    const items = await this.getItems(id);
    const lineItems = items.filter((i) => i.type === 'line_item');
    const feeItems = items.filter((i) => i.type === 'fee');
    const shippingItems = items.filter((i) => i.type === 'shipping');

    const location = await this.taxLocation(order);
    const calcTaxes = andTaxes && (await settings.getBool('calc_taxes'));

    const engineItems: TotalsItem[] = [];
    for (const item of lineItems) {
      engineItems.push({
        key: String(item.id),
        productId: item.productId ?? 0,
        variationId: item.variationId,
        parentProductId: null,
        quantity: item.quantity ?? 1,
        // Stored totals are ex tax; feed the discounted total as the line
        // price so taxes recompute on what the customer actually pays.
        unitPriceMinor: Math.round(
          Money.fromDb(item.total).minor / Math.max(1, item.quantity ?? 1),
        ),
        taxable: (item.taxStatus ?? 'taxable') === 'taxable',
        taxClass: item.taxClass ?? '',
        onSale: false,
        categoryIds: [],
      });
    }
    const engineFees: TotalsFee[] = feeItems.map((f) => ({
      id: String(f.id),
      name: f.name,
      amountMinor: Money.fromDb(f.total).minor,
      taxable: (f.taxStatus ?? 'taxable') === 'taxable',
      taxClass: f.taxClass ?? '',
    }));
    const engineShipping: TotalsShippingLine[] = shippingItems.map((s) => ({
      rateId: String(s.id),
      methodId: metaValue(s, 'method_id') ?? '',
      instanceId: Number(metaValue(s, 'instance_id') ?? 0),
      label: s.name,
      costMinor: Money.fromDb(s.total).minor,
      taxable: true,
    }));

    const engine = new TotalsEngine(this.deps.tax);
    const totals = await engine.calculate({
      items: engineItems,
      coupons: [],
      fees: engineFees,
      shippingLines: engineShipping,
      config: {
        calcTaxes,
        pricesIncludeTax: false,
        roundAtSubtotal: await settings.getBool('tax_round_at_subtotal'),
        sequentialDiscounts: false,
        taxLocation: location,
        shippingTaxClass: await settings.getString('shipping_tax_class'),
        vatExempt: await this.isVatExempt(id),
      },
    });

    const subtotalMinor = lineItems.reduce((sum, i) => sum + Money.fromDb(i.subtotal).minor, 0);
    const itemsTotalMinor = lineItems.reduce((sum, i) => sum + Money.fromDb(i.total).minor, 0);

    const updated = await db.transaction(async (tx) => {
      const s = tx.schema;
      const byKey = new Map(totals.items.map((t) => [t.key, t]));
      for (const item of lineItems) {
        const computed = byKey.get(String(item.id));
        if (!computed) continue;
        await tx.drizzle
          .update(s.orderItems)
          .set({
            totalTax: minorToDb(computed.totalTaxMinor),
            subtotalTax: minorToDb(computed.totalTaxMinor),
            taxes: { total: mapMinorToDb(computed.taxesByRate) },
          })
          .where(eq(s.orderItems.id, item.id));
      }
      const feeByKey = new Map(totals.fees.map((f) => [f.id, f]));
      for (const fee of feeItems) {
        const computed = feeByKey.get(String(fee.id));
        if (!computed) continue;
        await tx.drizzle
          .update(s.orderItems)
          .set({
            total: minorToDb(computed.totalMinor),
            totalTax: minorToDb(computed.taxMinor),
            taxes: { total: mapMinorToDb(computed.taxesByRate) },
          })
          .where(eq(s.orderItems.id, fee.id));
      }
      const shipByKey = new Map(totals.shipping.map((sh) => [sh.rateId, sh]));
      for (const ship of shippingItems) {
        const computed = shipByKey.get(String(ship.id));
        if (!computed) continue;
        await tx.drizzle
          .update(s.orderItems)
          .set({ totalTax: minorToDb(computed.taxMinor), taxes: { total: mapMinorToDb(computed.taxesByRate) } })
          .where(eq(s.orderItems.id, ship.id));
      }
      await this.writeTaxLines(tx, id, totals.cartTaxesByRate, totals.shippingTaxesByRate);
      await tx.drizzle
        .update(s.orders)
        .set({
          discountTotal: minorToDb(Math.max(0, subtotalMinor - itemsTotalMinor)),
          discountTax: minorToDb(totals.discountTaxMinor),
          shippingTotal: minorToDb(totals.shippingTotalMinor),
          shippingTax: minorToDb(totals.shippingTaxMinor),
          cartTax: minorToDb(totals.cartTaxMinor),
          totalTax: minorToDb(totals.totalTaxMinor),
          total: minorToDb(
            Math.max(
              0,
              itemsTotalMinor +
                totals.feeTotalMinor +
                totals.shippingTotalMinor +
                totals.cartTaxMinor +
                totals.shippingTaxMinor,
            ),
          ),
          dateModified: nowIso(),
        })
        .where(eq(s.orders.id, id));
      const row = (await tx.drizzle.select().from(s.orders).where(eq(s.orders.id, id)))[0];
      if (!row) throw new NotFoundError('Order', id);
      if (this.deps.analytics) await this.deps.analytics.syncOrder(tx, id);
      return row;
    });

    await bus.emit(orderAfterCalculateTotals, { andTaxes, order: updated });
    return updated;
  }

  /** §11.2 tax location: billing / shipping / base per store setting. */
  private async taxLocation(order: Order): Promise<TaxLocation> {
    const basedOn = await this.deps.settings.getString('tax_based_on');
    if (basedOn === 'billing') {
      return {
        country: order.billingCountry,
        state: order.billingState,
        postcode: order.billingPostcode,
        city: order.billingCity,
      };
    }
    if (basedOn === 'shipping') {
      const hasShipping = order.shippingCountry !== '';
      return {
        country: hasShipping ? order.shippingCountry : order.billingCountry,
        state: hasShipping ? order.shippingState : order.billingState,
        postcode: hasShipping ? order.shippingPostcode : order.billingPostcode,
        city: hasShipping ? order.shippingCity : order.billingCity,
      };
    }
    return this.deps.settings.baseLocation();
  }

  private async isVatExempt(orderId: number): Promise<boolean> {
    const { db } = this.deps;
    const s = db.schema;
    const rows = await db.drizzle
      .select()
      .from(s.orderMeta)
      .where(and(eq(s.orderMeta.orderId, orderId), eq(s.orderMeta.key, 'is_vat_exempt')));
    return rows[0]?.value === 'yes';
  }

  // --- One-shot operational events (order_events, UNIQUE-guarded) ----------

  /** Insert the guard row; false when the op already ran for this order. */
  async recordEvent(
    orderId: number,
    eventType: OrderEventType,
    payload?: Record<string, unknown>,
    tx?: SpcndDb,
  ): Promise<boolean> {
    const db = tx ?? this.deps.db;
    const s = db.schema;
    const existing = await db.drizzle
      .select({ id: s.orderEvents.id })
      .from(s.orderEvents)
      .where(and(eq(s.orderEvents.orderId, orderId), eq(s.orderEvents.eventType, eventType)));
    if (existing.length > 0) return false;
    await db.drizzle
      .insert(s.orderEvents)
      .values({ orderId, eventType, payload: payload ?? null, createdAt: nowIso() });
    return true;
  }

  async hasEvent(orderId: number, eventType: OrderEventType): Promise<boolean> {
    const { db } = this.deps;
    const s = db.schema;
    const rows = await db.drizzle
      .select({ id: s.orderEvents.id })
      .from(s.orderEvents)
      .where(and(eq(s.orderEvents.orderId, orderId), eq(s.orderEvents.eventType, eventType)));
    return rows.length > 0;
  }

  async maybeReduceStock(orderId: number): Promise<void> {
    if (!(await this.recordEvent(orderId, 'stock_reduced'))) return;
    const items = await this.getItems(orderId, ['line_item']);
    for (const item of items) {
      if (!item.productId || !item.quantity) continue;
      await this.deps.products.reduceStock(item.productId, item.quantity, item.variationId ?? undefined);
    }
    await this.addNote(orderId, 'Stock levels reduced.', 'system');
  }

  /** Restores stock only when this order actually reduced it. */
  async maybeRestoreStock(orderId: number): Promise<void> {
    const { db } = this.deps;
    const s = db.schema;
    if (!(await this.hasEvent(orderId, 'stock_reduced'))) return;
    const items = await this.getItems(orderId, ['line_item']);
    for (const item of items) {
      if (!item.productId || !item.quantity) continue;
      await this.deps.products.restoreStock(item.productId, item.quantity, item.variationId ?? undefined);
    }
    await db.drizzle
      .delete(s.orderEvents)
      .where(and(eq(s.orderEvents.orderId, orderId), eq(s.orderEvents.eventType, 'stock_reduced')));
    await this.addNote(orderId, 'Stock levels restored.', 'system');
  }

  async maybeRecordSales(orderId: number): Promise<void> {
    if (!(await this.recordEvent(orderId, 'recorded_sales'))) return;
    const { db } = this.deps;
    const order = await this.get(orderId);
    const items = await this.getItems(orderId, ['line_item']);
    await db.transaction(async (tx) => {
      const s = tx.schema;
      for (const item of items) {
        if (!item.productId || !item.quantity) continue;
        await tx.drizzle
          .update(s.products)
          .set({ totalSales: sql`${s.products.totalSales} + ${item.quantity}` })
          .where(eq(s.products.id, item.productId));
        await tx.drizzle
          .update(s.productMetaLookup)
          .set({ totalSales: sql`${s.productMetaLookup.totalSales} + ${item.quantity}` })
          .where(eq(s.productMetaLookup.productId, item.productId));
      }
      if (order.customerId) {
        await this.deps.customers.recordOrderTotals(tx, order.customerId, order.total);
      }
    });
  }

  async maybeRecordCouponUsage(orderId: number): Promise<void> {
    if (!(await this.recordEvent(orderId, 'recorded_coupon_usage_counts'))) return;
    const { db, coupons } = this.deps;
    const order = await this.get(orderId);
    const couponItems = await this.getItems(orderId, ['coupon']);
    await db.transaction(async (tx) => {
      for (const item of couponItems) {
        const coupon = await coupons.findByCode(item.name);
        if (!coupon) continue;
        await coupons.increaseUsage(
          tx,
          coupon,
          { customerId: order.customerId, email: order.billingEmail },
          orderId,
          item.total ?? '0.0000',
        );
      }
    });
  }

  async maybeReverseCouponUsage(orderId: number): Promise<void> {
    const { db, coupons } = this.deps;
    const s = db.schema;
    if (!(await this.hasEvent(orderId, 'recorded_coupon_usage_counts'))) return;
    const couponItems = await this.getItems(orderId, ['coupon']);
    await db.transaction(async (tx) => {
      for (const item of couponItems) {
        const coupon = await coupons.findByCode(item.name);
        if (coupon) await coupons.decreaseUsage(tx, coupon.id, orderId);
      }
      await tx.drizzle
        .delete(s.orderEvents)
        .where(
          and(
            eq(s.orderEvents.orderId, orderId),
            eq(s.orderEvents.eventType, 'recorded_coupon_usage_counts'),
          ),
        );
    });
  }

  // --- Refunds -------------------------------------------------------------

  async getRefunds(orderId: number): Promise<OrderRefund[]> {
    const { db } = this.deps;
    const s = db.schema;
    return db.drizzle
      .select()
      .from(s.orderRefunds)
      .where(eq(s.orderRefunds.orderId, orderId))
      .orderBy(asc(s.orderRefunds.id));
  }

  async totalRefundedMinor(orderId: number): Promise<number> {
    const refunds = await this.getRefunds(orderId);
    return refunds.reduce((sum, r) => sum + Money.fromDb(r.amount).minor, 0);
  }

  async createRefund(orderId: number, input: CreateRefundInput): Promise<OrderRefund> {
    const { db, bus } = this.deps;
    const order = await this.get(orderId);
    const amountMinor = Money.fromDb(input.amount).minor;
    if (amountMinor <= 0) throw new SpcndError('Invalid refund amount', 'invalid_refund_amount');
    const alreadyRefunded = await this.totalRefundedMinor(orderId);
    const remaining = Money.fromDb(order.total).minor - alreadyRefunded;
    if (amountMinor > remaining) {
      throw new SpcndError('Refund amount exceeds remaining order total', 'invalid_refund_amount');
    }

    const refund = await db.transaction(async (tx) => {
      const s = tx.schema;
      await tx.drizzle.insert(s.orderRefunds).values({
        orderId,
        amount: minorToDb(amountMinor),
        reason: input.reason ?? null,
        refundedBy: input.refundedBy ?? null,
        refundedPayment: input.refundedPayment ?? false,
        lineItems: input.lineItems ?? [],
        dateCreated: nowIso(),
      });
      const rows = await tx.drizzle
        .select()
        .from(s.orderRefunds)
        .where(eq(s.orderRefunds.orderId, orderId))
        .orderBy(desc(s.orderRefunds.id))
        .limit(1);
      const row = rows[0];
      if (!row) throw new SpcndError('Refund insert failed', 'refund_insert_failed', 500);
      return row;
    });

    if (input.restock && input.lineItems?.length) {
      const items = await this.getItems(orderId, ['line_item']);
      const byId = new Map(items.map((i) => [i.id, i]));
      for (const line of input.lineItems) {
        const item = byId.get(line.orderItemId);
        if (item?.productId && line.quantity > 0) {
          await this.deps.products.restoreStock(item.productId, line.quantity, item.variationId ?? undefined);
        }
      }
    }

    await bus.emit(orderRefundCreated, { refund, order });
    const totalRefunded = alreadyRefunded + amountMinor;
    if (totalRefunded >= Money.fromDb(order.total).minor) {
      await this.setStatus(orderId, 'refunded', 'Order fully refunded.');
      await bus.emit(orderFullyRefunded, { orderId, refundId: refund.id });
    } else {
      await this.addNote(orderId, `Refunded ${Money.fromMinor(amountMinor).toFixed(2)}${input.reason ? ` — ${input.reason}` : ''}`, 'system');
      await bus.emit(orderPartiallyRefunded, { orderId, refundId: refund.id });
    }
    return refund;
  }

  // --- Notes ---------------------------------------------------------------

  async addNote(
    orderId: number,
    note: string,
    type: OrderNote['type'] = 'private',
    createdBy?: string,
  ): Promise<OrderNote> {
    const { db, bus } = this.deps;
    const s = db.schema;
    await db.drizzle
      .insert(s.orderNotes)
      .values({ orderId, note, type, createdBy: createdBy ?? null, createdAt: nowIso() });
    const rows = await db.drizzle
      .select()
      .from(s.orderNotes)
      .where(eq(s.orderNotes.orderId, orderId))
      .orderBy(desc(s.orderNotes.id))
      .limit(1);
    const row = rows[0];
    if (!row) throw new SpcndError('Note insert failed', 'note_insert_failed', 500);
    const order = await this.get(orderId);
    await bus.emit(orderNoteAdded, { noteId: row.id, order, note: row });
    if (type === 'customer') {
      await bus.emit(newCustomerNote, { orderId, customerNote: note });
    }
    return row;
  }

  async getNotes(orderId: number): Promise<OrderNote[]> {
    const { db } = this.deps;
    const s = db.schema;
    return db.drizzle
      .select()
      .from(s.orderNotes)
      .where(eq(s.orderNotes.orderId, orderId))
      .orderBy(desc(s.orderNotes.id));
  }

  async deleteNote(noteId: number): Promise<void> {
    const { db } = this.deps;
    await db.drizzle.delete(db.schema.orderNotes).where(eq(db.schema.orderNotes.id, noteId));
  }

  // --- Deletion ------------------------------------------------------------

  async trash(id: number): Promise<void> {
    await this.setStatus(id, 'trash');
  }

  async delete(id: number): Promise<void> {
    const { db, bus } = this.deps;
    await this.get(id);
    await db.transaction(async (tx) => {
      if (this.deps.analytics) await this.deps.analytics.deleteOrder(tx, id);
      await tx.drizzle.delete(tx.schema.orders).where(eq(tx.schema.orders.id, id));
    });
    await bus.emit(orderDeleted, { id });
  }
}

function minorToDb(minor: number): string {
  return Money.fromMinor(minor).toDbString();
}

function mapMinorToDb(byRate: Record<string, number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rateId, minor] of Object.entries(byRate)) out[rateId] = minorToDb(minor);
  return out;
}

function metaValue(item: OrderItem, key: string): string | undefined {
  const entry = item.metaData?.find((m) => m.key === key);
  return entry === undefined ? undefined : String(entry.value);
}

function formatVariation(variation: Record<string, string>): string {
  const parts = Object.entries(variation).map(([k, v]) => `${k}: ${v}`);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}
