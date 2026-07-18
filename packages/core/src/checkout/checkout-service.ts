import type { SpcndDb } from '@spacendigital/db';
import type { TypedBus } from '@spacendigital/plugin-system';
import type { Address } from '@spacendigital/types';
import type { CalculatedCart, CartService } from '../cart/cart-service.js';
import type { CustomerService } from '../customers/customer-service.js';
import type { Customer, Order } from '../entities.js';
import { CheckoutError } from '../errors.js';
import type { CouponService } from '../coupons/coupon-service.js';
import {
  checkoutAfterValidation,
  checkoutBeforeProcess,
  checkoutCreateOrder,
  checkoutInit,
  checkoutOrderCreated,
  checkoutOrderException,
  checkoutOrderProcessed,
  checkoutProcess,
  checkoutUpdateCustomer,
  checkoutUpdateOrderMeta,
  filterCheckoutCustomerId,
  filterCheckoutPostedData,
  filterCheckoutRegistrationEnabled,
  filterCheckoutRegistrationRequired,
  filterPaymentSuccessfulResult,
} from '../events.js';
import { COUNTRIES, COUNTRIES_WITHOUT_POSTCODE } from '../i18n/countries.js';
import type { OrderService } from '../orders/order-service.js';
import type { SessionStore, TaxLocation } from '../services/interfaces.js';
import type { SettingsService } from '../settings/service.js';
import { normalizePostcode } from '../utils.js';

/** Posted checkout data (WC get_posted_data shape, camel-cased). */
export interface CheckoutData {
  billing: Partial<Address>;
  shipping?: Partial<Address>;
  shipToDifferentAddress?: boolean;
  paymentMethod?: string;
  shippingRateId?: string;
  customerNote?: string;
  createAccount?: boolean;
  termsAccepted?: boolean;
  customerIpAddress?: string;
  customerUserAgent?: string;
  [key: string]: unknown;
}

export interface CheckoutResult {
  result: 'success';
  orderId: number;
  orderKey: string;
  order: Order;
  redirect: string;
  /** Coupons dropped during final calculation (no longer valid). */
  removedCoupons: string[];
}

interface Deps {
  db: SpcndDb;
  bus: TypedBus;
  settings: SettingsService;
  sessions: SessionStore;
  cart: CartService;
  orders: OrderService;
  customers: CustomerService;
  coupons: CouponService;
}

const AWAITING_SUFFIX = ':order_awaiting_payment';

/**
 * WC_Checkout port (core-architecture report §7): posted-data validation,
 * customer processing, order creation from the calculated cart with
 * cart-hash resume, and order finalization.
 *
 * TODO:security-blocked — see docs/SECURITY_WORK.md item S5: third-party
 * payment-gateway processing is not called here. Every checkout currently
 * takes the no-payment path (payment_complete immediately), which matches
 * configuration-only gateways like COD for the v1 demo.
 */
export class CheckoutService {
  constructor(private readonly deps: Deps) {}

  async init(cartId: string): Promise<void> {
    await this.deps.bus.emit(checkoutInit, { cartId });
  }

  /** `woocommerce_enable_guest_checkout` inverted, filterable. */
  async isRegistrationRequired(): Promise<boolean> {
    const allowGuest = await this.deps.settings.getBool('enable_guest_checkout');
    return this.deps.bus.applyFilters(filterCheckoutRegistrationRequired, !allowGuest);
  }

  async isRegistrationEnabled(): Promise<boolean> {
    const enabled = await this.deps.settings.getBool('enable_signup_and_login_from_checkout');
    return this.deps.bus.applyFilters(filterCheckoutRegistrationEnabled, enabled);
  }

  /**
   * §7 process_checkout. Throws CheckoutError with every validation message
   * joined when validation fails; returns the successful result otherwise.
   */
  async processCheckout(
    cartId: string,
    rawData: CheckoutData,
    sessionCustomer?: Customer | null,
  ): Promise<CheckoutResult> {
    const { bus, cart } = this.deps;
    await bus.emit(checkoutBeforeProcess, { cartId });
    await bus.emit(checkoutProcess, { cartId });

    if (await cart.isEmpty(cartId)) {
      throw new CheckoutError(
        'Sorry, your session has expired. Please return to the shop and try again.',
        'checkout_session_expired',
      );
    }

    const data = (await bus.applyFilters(
      filterCheckoutPostedData,
      rawData as Record<string, unknown>,
    )) as CheckoutData;
    if (!data.shipToDifferentAddress || !data.shipping) {
      data.shipping = { ...data.billing };
    }

    // A first calculation drives validation (shipping needs, payment needs).
    const destination = this.toAddress(data.shipping);
    const preliminary = await cart.calculate(
      cartId,
      { destination, taxLocation: await this.taxLocation(data) },
      this.customerContext(sessionCustomer, data),
    );

    const errors = await this.validate(data, preliminary);
    await bus.emit(checkoutAfterValidation, { data: data as Record<string, unknown>, errors });
    if (errors.length > 0) {
      throw new CheckoutError(errors.join(' '), 'checkout_validation_failed');
    }

    const customer = await this.processCustomer(data, sessionCustomer ?? null);
    const customerId = await bus.applyFilters(filterCheckoutCustomerId, customer?.id ?? null);

    if (data.shippingRateId) await cart.setChosenShippingRate(cartId, data.shippingRateId);
    const calculated = await cart.calculate(
      cartId,
      { destination, taxLocation: await this.taxLocation(data) },
      this.customerContext(customer ?? sessionCustomer, data),
    );

    // Tentative coupon holds for limited coupons while the order is written
    // (released after processing; real usage lands via status events).
    const holdKeys: string[] = [];
    for (const coupon of calculated.coupons) {
      if (coupon.usageLimit !== null && coupon.usageLimit > 0) {
        holdKeys.push(await this.deps.coupons.holdUsage(coupon.id));
      }
    }

    let order: Order;
    try {
      const awaitingRaw = await this.deps.sessions.get(`${cartId}${AWAITING_SUFFIX}`);
      const resumeOrderId = Number((awaitingRaw as { orderId?: number } | undefined)?.orderId ?? 0);
      order = await this.deps.orders.createFromCart(calculated, {
        resumeOrderId: resumeOrderId > 0 ? resumeOrderId : undefined,
        customerId,
        billing: data.billing,
        shipping: preliminaryNeedsShipping(calculated) ? data.shipping : {},
        paymentMethod: data.paymentMethod ?? '',
        paymentMethodTitle: data.paymentMethod ?? '',
        customerNote: data.customerNote,
        createdVia: 'checkout',
        customerIpAddress: data.customerIpAddress,
        customerUserAgent: data.customerUserAgent,
        pricesIncludeTax: await this.deps.settings.getBool('prices_include_tax'),
      });
      await bus.emit(checkoutCreateOrder, { order, data: data as Record<string, unknown> });
      await bus.emit(checkoutUpdateOrderMeta, { orderId: order.id, data: data as Record<string, unknown> });
      await bus.emit(checkoutOrderCreated, order);
    } catch (error) {
      for (const key of holdKeys) await this.deps.coupons.releaseHold(key);
      await bus.emit(checkoutOrderException, { error });
      throw error;
    }

    await this.deps.sessions.set(`${cartId}${AWAITING_SUFFIX}`, { orderId: order.id }, 60 * 60);
    await bus.emit(checkoutOrderProcessed, {
      orderId: order.id,
      postedData: data as Record<string, unknown>,
      order,
    });

    try {
      /* TODO:security-blocked — see docs/SECURITY_WORK.md item S5 */
      // Gateway processing (PaymentService.processPayment) is not wired yet;
      // all checkouts finalize via the no-payment path below.
      const result = await this.processOrderWithoutPayment(cartId, order);
      return { ...result, removedCoupons: calculated.removedCoupons };
    } finally {
      for (const key of holdKeys) await this.deps.coupons.releaseHold(key);
    }
  }

  /** §7 process_order_without_payment: payment_complete, empty cart, redirect. */
  private async processOrderWithoutPayment(
    cartId: string,
    order: Order,
  ): Promise<Omit<CheckoutResult, 'removedCoupons'>> {
    const { bus, orders, cart, sessions, settings } = this.deps;
    await orders.paymentComplete(order.id);
    await cart.emptyCart(cartId);
    await sessions.destroy(`${cartId}${AWAITING_SUFFIX}`);
    const fresh = await orders.get(order.id);
    const storeUrl = await settings.getString('store_url');
    const redirect = `${storeUrl.replace(/\/$/, '')}/checkout/order-received/${fresh.id}/?key=${fresh.orderKey}`;
    const filtered = (await bus.applyFilters(
      filterPaymentSuccessfulResult,
      { result: 'success', redirect } as Record<string, unknown>,
      fresh.id,
    )) as { result: 'success'; redirect: string };
    return {
      result: 'success',
      orderId: fresh.id,
      orderKey: fresh.orderKey,
      order: fresh,
      redirect: filtered.redirect,
    };
  }

  /** §7 process_customer: create the account when required/requested. */
  private async processCustomer(
    data: CheckoutData,
    sessionCustomer: Customer | null,
  ): Promise<Customer | null> {
    const { bus, customers } = this.deps;
    let customer = sessionCustomer;
    const registrationRequired = await this.isRegistrationRequired();
    const wantsAccount = data.createAccount === true && (await this.isRegistrationEnabled());
    if (!customer && (registrationRequired || wantsAccount)) {
      const email = data.billing.email ?? '';
      const existing = await customers.findByEmail(email);
      if (existing) {
        throw new CheckoutError(
          'An account is already registered with your email address. Please log in.',
          'registration-error-email-exists',
        );
      }
      customer = await customers.registerFromGuest({
        email,
        firstName: data.billing.firstName,
        lastName: data.billing.lastName,
        billing: data.billing,
        shipping: data.shipping,
      });
    }
    if (customer) {
      customer = await customers.update(customer.id, {
        billing: data.billing,
        shipping: data.shipping,
      });
      await bus.emit(checkoutUpdateCustomer, { customer, data: data as Record<string, unknown> });
    }
    return customer;
  }

  // --- Validation (§7 validate_checkout / validate_posted_data) ------------

  private async validate(data: CheckoutData, calculated: CalculatedCart): Promise<string[]> {
    const { settings } = this.deps;
    const errors: string[] = [];
    const billing = data.billing;

    const required: [keyof Address, string][] = [
      ['firstName', 'Billing first name'],
      ['lastName', 'Billing last name'],
      ['address1', 'Billing street address'],
      ['city', 'Billing town / city'],
      ['country', 'Billing country'],
    ];
    for (const [field, label] of required) {
      if (!billing[field]) errors.push(`${label} is a required field.`);
    }
    // Per-country required/hidden field overrides (state labels, NL postcode
    // rules, ...) arrive with i18n country-locale data — SECURITY_WORK S8.

    if (billing.country && !COUNTRIES[billing.country]) {
      errors.push(`'${billing.country}' is not a valid country code.`);
    }
    const allowed = await settings.getString('allowed_countries');
    if (billing.country && allowed === 'specific') {
      const list = await settings.getJson<string[]>('specific_allowed_countries');
      if (Array.isArray(list) && list.length > 0 && !list.includes(billing.country)) {
        errors.push(`Sorry, we do not sell to ${COUNTRIES[billing.country] ?? billing.country}.`);
      }
    }

    if (!billing.email || !isEmail(billing.email)) {
      errors.push('A valid billing email address is required.');
    }
    if (billing.phone && !isPhone(billing.phone)) {
      errors.push('The provided billing phone number is not valid.');
    }
    if (billing.country && postcodeRequired(billing.country)) {
      if (!billing.postcode) errors.push('Billing postcode / ZIP is a required field.');
      else if (!isPlausiblePostcode(billing.postcode)) {
        // Country-specific postcode formats land with S8; generic check here.
        errors.push('The provided billing postcode / ZIP is not valid.');
      }
    }

    if (calculated.needsShipping) {
      const shipping = data.shipping ?? {};
      if (!shipping.country) errors.push('Shipping country is a required field.');
      else if (!COUNTRIES[shipping.country]) {
        errors.push(`'${shipping.country}' is not a valid shipping country code.`);
      } else {
        const shipTo = await settings.getString('ship_to_countries');
        const effective = shipTo === '' ? allowed : shipTo;
        if (effective === 'specific') {
          const key = shipTo === '' ? 'specific_allowed_countries' : 'specific_ship_to_countries';
          const list = await settings.getJson<string[]>(key);
          if (Array.isArray(list) && list.length > 0 && !list.includes(shipping.country)) {
            errors.push(
              `Sorry, we do not ship to ${COUNTRIES[shipping.country] ?? shipping.country}.`,
            );
          }
        }
        if (postcodeRequired(shipping.country) && !shipping.postcode) {
          errors.push('Shipping postcode / ZIP is a required field.');
        }
      }
      if (calculated.totals.shipping.length === 0 && this.shippingConfigured()) {
        errors.push('No shipping method has been selected.');
      }
    }

    const termsPageId = await settings.getInt('checkout_terms_page_id');
    if (termsPageId > 0 && data.termsAccepted !== true) {
      errors.push('Please read and accept the terms and conditions to proceed with your order.');
    }

    if (calculated.needsPayment && !data.paymentMethod) {
      errors.push('Please select a payment method.');
    }
    return errors;
  }

  /** Whether a ShippingService is wired at all (no service → don't block). */
  private shippingConfigured(): boolean {
    return false;
  }

  private async taxLocation(data: CheckoutData): Promise<TaxLocation> {
    const basedOn = await this.deps.settings.getString('tax_based_on');
    const source = basedOn === 'billing' ? data.billing : (data.shipping ?? data.billing);
    if (basedOn === 'base') return this.deps.settings.baseLocation();
    return {
      country: source.country ?? '',
      state: source.state ?? '',
      postcode: source.postcode ?? '',
      city: source.city ?? '',
    };
  }

  private customerContext(
    customer: Customer | null | undefined,
    data: CheckoutData,
  ): { id: number | null; emails: string[] } {
    const emails = [customer?.email, data.billing.email]
      .filter((e): e is string => Boolean(e))
      .map((e) => e.toLowerCase());
    return { id: customer?.id ?? null, emails: [...new Set(emails)] };
  }

  private toAddress(partial: Partial<Address> | undefined): Address {
    return {
      firstName: partial?.firstName ?? '',
      lastName: partial?.lastName ?? '',
      company: partial?.company ?? '',
      address1: partial?.address1 ?? '',
      address2: partial?.address2 ?? '',
      city: partial?.city ?? '',
      state: partial?.state ?? '',
      postcode: partial?.postcode ?? '',
      country: partial?.country ?? '',
      email: partial?.email ?? '',
      phone: partial?.phone ?? '',
    };
  }
}

function preliminaryNeedsShipping(calculated: CalculatedCart): boolean {
  return calculated.needsShipping;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** WC_Validation::is_phone — digits, spaces, dashes, parens, leading +. */
function isPhone(value: string): boolean {
  return !/[^\s\d\-+().]/.test(value.trim()) && value.replace(/\D/g, '').length >= 3;
}

function postcodeRequired(country: string): boolean {
  return !COUNTRIES_WITHOUT_POSTCODE.includes(country);
}

/** Generic postcode plausibility; per-country formats come with S8. */
function isPlausiblePostcode(postcode: string): boolean {
  const clean = normalizePostcode(postcode);
  return clean.length >= 2 && clean.length <= 10 && /^[A-Z0-9]+$/.test(clean);
}
