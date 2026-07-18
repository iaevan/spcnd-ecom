import type {
  EmailService,
  EmailTransport,
  Order,
  OrderService,
  SettingsService,
} from '@spacendigital/core';
import { currencySymbol, SpcndError } from '@spacendigital/core';
import { Money } from '@spacendigital/types';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  EMAIL_TEMPLATES,
  type EmailTemplateId,
  type TemplatePayload,
} from './templates/definitions.js';
import type { EmailTheme, OrderEmailData } from './templates/shared.js';

/**
 * EmailService implementation: per-template config from the email_settings
 * json blob ({ [id]: { enabled, subject, heading, additional_content, cc,
 * bcc, recipient } }), React rendering via renderToStaticMarkup (DECISION-9),
 * WC placeholder substitution, recipient resolution (customer vs merchant).
 */

export interface TemplateSettings {
  enabled?: boolean;
  subject?: string;
  heading?: string;
  additional_content?: string;
  cc?: string;
  bcc?: string;
  /** Merchant-facing templates only: override the merchant recipient. */
  recipient?: string;
}

interface Deps {
  settings: SettingsService;
  orders: OrderService;
  transport: () => EmailTransport;
}

export class DbEmailService implements EmailService {
  constructor(private readonly deps: Deps) {}

  /** True when the template is enabled and the message was handed to the transport. */
  async sendTransactional(templateId: string, payload: Record<string, unknown>): Promise<void> {
    const template = EMAIL_TEMPLATES[templateId as EmailTemplateId];
    if (!template) throw new SpcndError(`Unknown email template "${templateId}"`, 'unknown_email_template');
    const { settings } = this.deps;

    const allSettings = await settings.getJson<Record<string, TemplateSettings>>('email_settings');
    const config: TemplateSettings = allSettings?.[template.id] ?? {};
    if (!(config.enabled ?? template.defaultEnabled)) return;

    const order =
      typeof payload.orderId === 'number' ? await this.deps.orders.find(payload.orderId) : undefined;
    const orderData = order ? await this.orderData(order) : undefined;

    const to = await this.resolveRecipient(template.customerFacing, config, order, payload);
    if (!to) return;

    const theme = await this.theme();
    const templatePayload: TemplatePayload = {
      theme,
      order: orderData,
      customerName: typeof payload.customerName === 'string' ? payload.customerName : undefined,
      note: typeof payload.note === 'string' ? payload.note : undefined,
      extra: (payload.extra as Record<string, string>) ?? undefined,
      additionalContent: config.additional_content,
    };

    const substitute = (input: string) =>
      this.substitutePlaceholders(input, theme.storeName, order, orderData);
    const heading = substitute(config.heading ?? template.defaultHeading);
    const subject = substitute(config.subject ?? template.defaultSubject);
    const html = `<!doctype html>${renderToStaticMarkup(template.render(templatePayload, heading))}`.replaceAll(
      '{site_title}',
      theme.storeName,
    );

    await this.deps.transport().send({
      to,
      subject,
      html,
      cc: config.cc,
      bcc: config.bcc,
      from: await settings.getString('email_from_address'),
      fromName: await settings.getString('email_from_name'),
    });
  }

  private async resolveRecipient(
    customerFacing: boolean,
    config: TemplateSettings,
    order: Order | undefined,
    payload: Record<string, unknown>,
  ): Promise<string | null> {
    if (!customerFacing) {
      return config.recipient || (await this.deps.settings.getString('merchant_email')) || null;
    }
    if (typeof payload.to === 'string' && payload.to) return payload.to;
    return order?.billingEmail || null;
  }

  private substitutePlaceholders(
    input: string,
    storeName: string,
    order: Order | undefined,
    orderData: OrderEmailData | undefined,
  ): string {
    return input
      .replaceAll('{site_title}', storeName)
      .replaceAll('{order_number}', orderData?.orderNumber ?? '')
      .replaceAll('{order_date}', order ? order.dateCreated.slice(0, 10) : '')
      .replaceAll(
        '{customer_name}',
        order ? `${order.billingFirstName} ${order.billingLastName}`.trim() : '',
      );
  }

  private async theme(): Promise<EmailTheme> {
    const { settings } = this.deps;
    const storeName = await settings.getString('store_name');
    return {
      baseColor: await settings.getString('email_base_color'),
      backgroundColor: await settings.getString('email_background_color'),
      bodyBackgroundColor: await settings.getString('email_body_background_color'),
      textColor: await settings.getString('email_text_color'),
      storeName,
      footerText: (await settings.getString('email_footer_text')).replaceAll('{site_title}', storeName),
    };
  }

  private async orderData(order: Order): Promise<OrderEmailData> {
    const items = await this.deps.orders.getItems(order.id, ['line_item']);
    const minor = (value: string | null) => Money.fromDb(value).minor;
    return {
      orderNumber: await this.deps.orders.getOrderNumber(order),
      dateCreated: order.dateCreated,
      currencySymbol: currencySymbol(order.currency),
      items: items.map((item) => ({
        name: item.name,
        quantity: item.quantity ?? 1,
        totalMinor: minor(item.total),
      })),
      subtotalMinor: items.reduce((sum, i) => sum + minor(i.subtotal), 0),
      discountTotalMinor: minor(order.discountTotal),
      shippingTotalMinor: minor(order.shippingTotal),
      totalTaxMinor: minor(order.totalTax),
      totalMinor: minor(order.total),
      paymentMethodTitle: order.paymentMethodTitle,
      customerNote: order.customerNote,
      billing: {
        firstName: order.billingFirstName,
        lastName: order.billingLastName,
        company: order.billingCompany,
        address1: order.billingAddress1,
        address2: order.billingAddress2,
        city: order.billingCity,
        state: order.billingState,
        postcode: order.billingPostcode,
        country: order.billingCountry,
        email: order.billingEmail,
        phone: order.billingPhone,
      },
      shipping: {
        firstName: order.shippingFirstName,
        lastName: order.shippingLastName,
        company: order.shippingCompany,
        address1: order.shippingAddress1,
        address2: order.shippingAddress2,
        city: order.shippingCity,
        state: order.shippingState,
        postcode: order.shippingPostcode,
        country: order.shippingCountry,
        phone: order.shippingPhone,
      },
    };
  }
}
