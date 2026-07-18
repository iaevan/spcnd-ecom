import {
  ORDER_SERVICE,
  type Order,
  type OrderService,
  PAYMENT_SERVICE,
  type PaymentGatewayInfo,
  type PaymentResult,
  type PaymentService,
  SETTINGS_SERVICE,
  type SettingsService,
} from '@spacendigital/core';
import { defineSpcndPlugin } from '@spacendigital/plugin-system';

/**
 * Built-in payment gateways (RESUME step 6). COD / BACS / Cheque are
 * configuration-only — no third-party client, no credentials — so they ship
 * now and power the v1 demo checkout.
 *
 * TODO:security-blocked — see docs/SECURITY_WORK.md item S5: the Stripe and
 * PayPal fetch-based clients (DECISION-8), saved payment methods
 * (payment_tokens CRUD) and the gateway-charge endpoints are deferred; the
 * ids below are reserved and processPayment refuses them until S5 lands.
 */

export interface GatewayConfig {
  enabled: boolean;
  title: string;
  description: string;
  instructions: string;
  [key: string]: unknown;
}

interface GatewayDefinition {
  id: string;
  methodTitle: string;
  defaults: GatewayConfig;
  /** Status + note applied when an order is placed with this gateway. */
  placeOrder: { status: 'processing' | 'on-hold'; note: string };
}

const BUILTIN_GATEWAYS: GatewayDefinition[] = [
  {
    id: 'cod',
    methodTitle: 'Cash on delivery',
    defaults: {
      enabled: true,
      title: 'Cash on delivery',
      description: 'Pay with cash upon delivery.',
      instructions: 'Pay with cash upon delivery.',
    },
    placeOrder: { status: 'processing', note: 'Payment to be made upon delivery.' },
  },
  {
    id: 'bacs',
    methodTitle: 'Direct bank transfer',
    defaults: {
      enabled: false,
      title: 'Direct bank transfer',
      description: 'Make your payment directly into our bank account.',
      instructions: '',
    },
    placeOrder: { status: 'on-hold', note: 'Awaiting BACS payment.' },
  },
  {
    id: 'cheque',
    methodTitle: 'Check payments',
    defaults: {
      enabled: false,
      title: 'Check payments',
      description: 'Please send a check to our store address.',
      instructions: '',
    },
    placeOrder: { status: 'on-hold', note: 'Awaiting check payment.' },
  },
];

/** Reserved for S5 — listed so config UIs can show them as "coming". */
export const THIRD_PARTY_GATEWAY_IDS = ['stripe', 'paypal'] as const;

interface Deps {
  settings: SettingsService;
  orders: OrderService;
}

export class BuiltinPaymentService implements PaymentService {
  constructor(private readonly deps: Deps) {}

  private async config(gateway: GatewayDefinition): Promise<GatewayConfig> {
    const raw = await this.deps.settings.get(`gateway_${gateway.id}_settings`);
    if (raw === undefined || raw === null) return gateway.defaults;
    const parsed =
      typeof raw === 'string'
        ? (() => {
            try {
              return JSON.parse(raw) as Partial<GatewayConfig>;
            } catch {
              return {};
            }
          })()
        : (raw as Partial<GatewayConfig>);
    return { ...gateway.defaults, ...parsed };
  }

  async availableGateways(): Promise<PaymentGatewayInfo[]> {
    const out: PaymentGatewayInfo[] = [];
    for (const gateway of BUILTIN_GATEWAYS) {
      const config = await this.config(gateway);
      if (!config.enabled) continue;
      out.push({
        id: gateway.id,
        title: config.title,
        description: config.description,
        methodTitle: gateway.methodTitle,
        enabled: true,
        supports: ['products'],
        hasFields: false,
        instructions: config.instructions,
      });
    }
    return out;
  }

  async processPayment(
    gatewayId: string,
    order: Order,
    _context?: Record<string, unknown>,
  ): Promise<PaymentResult> {
    if ((THIRD_PARTY_GATEWAY_IDS as readonly string[]).includes(gatewayId)) {
      /* TODO:security-blocked — see docs/SECURITY_WORK.md item S5 */
      return {
        result: 'failure',
        message: `Gateway "${gatewayId}" is not available yet (SECURITY_WORK item S5).`,
      };
    }
    const gateway = BUILTIN_GATEWAYS.find((g) => g.id === gatewayId);
    if (!gateway) {
      return { result: 'failure', message: `Unknown payment gateway "${gatewayId}".` };
    }
    const config = await this.config(gateway);
    if (!config.enabled) {
      return { result: 'failure', message: `Payment gateway "${gatewayId}" is disabled.` };
    }
    await this.deps.orders.setStatus(order.id, gateway.placeOrder.status, gateway.placeOrder.note);
    return { result: 'success' };
  }

  /** Offline gateways cannot refund through an API — always a manual step. */
  async processRefund(
    gatewayId: string,
    _order: Order,
    _amountMinor: number,
    _reason?: string,
  ): Promise<{ ok: boolean; message?: string }> {
    return {
      ok: false,
      message: `Gateway "${gatewayId}" does not support automatic refunds; refund manually.`,
    };
  }

  async supports(gatewayId: string, feature: string): Promise<boolean> {
    if (!BUILTIN_GATEWAYS.some((g) => g.id === gatewayId)) return false;
    return feature === 'products';
  }
}

/** Registers the built-in gateways as the PaymentService implementation. */
export const PaymentsPlugin = defineSpcndPlugin({
  id: 'spacendigital/payments',
  version: '0.1.0',
  setup({ container }) {
    container.registerFactory(PAYMENT_SERVICE, (c) => {
      return new BuiltinPaymentService({
        settings: c.resolve(SETTINGS_SERVICE),
        orders: c.resolve(ORDER_SERVICE),
      });
    });
  },
});

export default PaymentsPlugin;
