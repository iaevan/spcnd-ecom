import {
  customerCreated,
  EMAIL_SERVICE,
  EMAIL_TRANSPORT,
  type EmailTransport,
  LOGGER,
  newCustomerNote,
  ORDER_SERVICE,
  orderPartiallyRefunded,
  orderFullyRefunded,
  orderStatusChanged,
  resetPasswordNotification,
  SETTINGS_SERVICE,
} from '@spacendigital/core';
import { defineSpcndPlugin } from '@spacendigital/plugin-system';
import { DbEmailService } from './service.jsx';
import { ConsoleTransport } from './transports.js';

export { EMAIL_TEMPLATES, type EmailTemplateId } from './templates/definitions.jsx';
export { DbEmailService, type TemplateSettings } from './service.jsx';
export { ConsoleTransport, ResendTransport, SendGridTransport, SmtpTransport } from './transports.js';

/**
 * Email plugin (RESUME step 8): registers the EmailService (console transport
 * unless one is already in the container) and subscribes the §3.2 trigger
 * table onto bus events. new_order fires once per order, guarded by the
 * new_order_email_sent row in order_events.
 *
 * Triggers wired here cover the events that exist in v1; review-request,
 * abandoned-cart, fulfillment and POS templates send via
 * sendTransactional() from their features when those land.
 */
export const EmailPlugin = defineSpcndPlugin({
  id: 'spacendigital/email',
  version: '0.1.0',
  setup({ bus, container }) {
    if (!container.has(EMAIL_TRANSPORT)) {
      container.register(EMAIL_TRANSPORT, new ConsoleTransport(container.tryResolve(LOGGER)));
    }
    container.registerFactory(EMAIL_SERVICE, (c) => {
      return new DbEmailService({
        settings: c.resolve(SETTINGS_SERVICE),
        orders: c.resolve(ORDER_SERVICE),
        transport: () => c.resolve(EMAIL_TRANSPORT),
      });
    });
    const emails = () => container.resolve(EMAIL_SERVICE);
    const orders = () => container.resolve(ORDER_SERVICE);

    bus.on(orderStatusChanged, async ({ orderId, from, to }) => {
      // Merchant "new order": pending/failed → processing|completed|on-hold, once.
      if (
        ['pending', 'failed'].includes(from) &&
        ['processing', 'completed', 'on-hold'].includes(to)
      ) {
        if (await orders().recordEvent(orderId, 'new_order_email_sent')) {
          await emails().sendTransactional('new_order', { orderId });
        }
      }
      if (to === 'cancelled' && ['pending', 'on-hold'].includes(from)) {
        await emails().sendTransactional('cancelled_order', { orderId });
      }
      if (to === 'failed') {
        await emails().sendTransactional('failed_order', { orderId });
        await emails().sendTransactional('customer_failed_order', { orderId });
      }
      if (to === 'on-hold') await emails().sendTransactional('customer_on_hold_order', { orderId });
      if (to === 'processing') {
        await emails().sendTransactional('customer_processing_order', { orderId });
      }
      if (to === 'completed') await emails().sendTransactional('customer_completed_order', { orderId });
      if (to === 'cancelled') await emails().sendTransactional('customer_cancelled_order', { orderId });
    });

    bus.on(orderFullyRefunded, async ({ orderId }) => {
      await emails().sendTransactional('customer_refunded_order', { orderId });
    });
    bus.on(orderPartiallyRefunded, async ({ orderId }) => {
      await emails().sendTransactional('customer_partially_refunded_order', { orderId });
    });
    bus.on(newCustomerNote, async ({ orderId, customerNote }) => {
      await emails().sendTransactional('customer_note', { orderId, note: customerNote });
    });
    bus.on(customerCreated, async (customer) => {
      await emails().sendTransactional('customer_new_account', {
        to: customer.email,
        customerName: customer.firstName || customer.displayName,
      });
    });
    bus.on(resetPasswordNotification, async ({ customer }) => {
      // TODO:security-blocked — SECURITY_WORK item S4: reset link generation
      // lives in the auth package; the template sends without a URL until then.
      await emails().sendTransactional('customer_reset_password', {
        to: customer.email,
        customerName: customer.firstName || customer.displayName,
      });
    });
  },
});

/** Pre-register a non-default transport before EmailPlugin runs. */
export function provideTransport(transport: EmailTransport) {
  return defineSpcndPlugin({
    id: 'spacendigital/email-transport',
    version: '0.1.0',
    setup({ container }) {
      container.register(EMAIL_TRANSPORT, transport);
    },
  });
}

export default EmailPlugin;
