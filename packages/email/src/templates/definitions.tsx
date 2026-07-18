import type { ReactNode } from 'react';
import { Addresses, type EmailTheme, EmailLayout, type OrderEmailData, OrderTable } from './shared.js';

/**
 * The 22 WC transactional emails (feature-parity report §3.2), each a React
 * component keyed by its WC email id. Subjects/headings use WC's placeholder
 * vocabulary: {site_title}, {order_number}, {order_date}, {customer_name}.
 */

export type EmailTemplateId =
  | 'new_order'
  | 'cancelled_order'
  | 'failed_order'
  | 'customer_on_hold_order'
  | 'customer_processing_order'
  | 'customer_completed_order'
  | 'customer_refunded_order'
  | 'customer_partially_refunded_order'
  | 'customer_invoice'
  | 'customer_note'
  | 'customer_new_account'
  | 'customer_reset_password'
  | 'customer_cancelled_order'
  | 'customer_failed_order'
  | 'customer_review_request'
  | 'customer_abandoned_cart_recovery'
  | 'customer_fulfillment_created'
  | 'customer_fulfillment_updated'
  | 'customer_fulfillment_deleted'
  | 'customer_pos_completed_order'
  | 'customer_pos_refunded_order'
  | 'admin_payment_gateway_enabled';

export interface TemplatePayload {
  theme: EmailTheme;
  order?: OrderEmailData;
  customerName?: string;
  note?: string;
  /** Extra free-form values (gateway id, refund amount, ...). */
  extra?: Record<string, string>;
  additionalContent?: string;
}

export interface TemplateDefinition {
  id: EmailTemplateId;
  /** Merchant-facing (recipient = merchant_email) vs customer-facing. */
  customerFacing: boolean;
  defaultEnabled: boolean;
  defaultSubject: string;
  defaultHeading: string;
  render(payload: TemplatePayload, heading: string): JSX.Element;
}

function orderEmail(
  payload: TemplatePayload,
  heading: string,
  intro: ReactNode,
  showAddresses = true,
): JSX.Element {
  return (
    <EmailLayout theme={payload.theme} heading={heading}>
      <p>{intro}</p>
      {payload.order ? <OrderTable order={payload.order} /> : null}
      {payload.order?.customerNote ? (
        <p>
          <strong>Note:</strong> {payload.order.customerNote}
        </p>
      ) : null}
      {payload.order && showAddresses ? <Addresses order={payload.order} /> : null}
      {payload.additionalContent ? <p>{payload.additionalContent}</p> : null}
    </EmailLayout>
  );
}

function simpleEmail(payload: TemplatePayload, heading: string, body: ReactNode): JSX.Element {
  return (
    <EmailLayout theme={payload.theme} heading={heading}>
      {body}
      {payload.additionalContent ? <p>{payload.additionalContent}</p> : null}
    </EmailLayout>
  );
}

const first = (payload: TemplatePayload) =>
  payload.customerName || payload.order?.billing.firstName || 'there';

export const EMAIL_TEMPLATES: Record<EmailTemplateId, TemplateDefinition> = {
  new_order: {
    id: 'new_order',
    customerFacing: false,
    defaultEnabled: true,
    defaultSubject: '[{site_title}]: New order #{order_number}',
    defaultHeading: 'New Order: #{order_number}',
    render: (p, h) =>
      orderEmail(
        p,
        h,
        `You've received the following order from ${first(p)} ${p.order?.billing.lastName ?? ''}:`,
      ),
  },
  cancelled_order: {
    id: 'cancelled_order',
    customerFacing: false,
    defaultEnabled: true,
    defaultSubject: '[{site_title}]: Order #{order_number} has been cancelled',
    defaultHeading: 'Order Cancelled: #{order_number}',
    render: (p, h) => orderEmail(p, h, 'The following order has been cancelled:'),
  },
  failed_order: {
    id: 'failed_order',
    customerFacing: false,
    defaultEnabled: true,
    defaultSubject: '[{site_title}]: Order #{order_number} has failed',
    defaultHeading: 'Order Failed: #{order_number}',
    render: (p, h) => orderEmail(p, h, 'Payment for the following order has failed:'),
  },
  customer_on_hold_order: {
    id: 'customer_on_hold_order',
    customerFacing: true,
    defaultEnabled: true,
    defaultSubject: 'Your {site_title} order has been received!',
    defaultHeading: 'Thank you for your order',
    render: (p, h) =>
      orderEmail(
        p,
        h,
        `Hi ${first(p)}, thanks for your order. It's on hold until we confirm that payment has been received.`,
      ),
  },
  customer_processing_order: {
    id: 'customer_processing_order',
    customerFacing: true,
    defaultEnabled: true,
    defaultSubject: 'Your {site_title} order has been received!',
    defaultHeading: 'Thank you for your order',
    render: (p, h) =>
      orderEmail(
        p,
        h,
        `Hi ${first(p)}, just to let you know — we've received your order #${p.order?.orderNumber}, and it is now being processed:`,
      ),
  },
  customer_completed_order: {
    id: 'customer_completed_order',
    customerFacing: true,
    defaultEnabled: true,
    defaultSubject: 'Your {site_title} order is now complete',
    defaultHeading: 'Thanks for shopping with us',
    render: (p, h) =>
      orderEmail(p, h, `Hi ${first(p)}, your order on {site_title} is now complete:`),
  },
  customer_refunded_order: {
    id: 'customer_refunded_order',
    customerFacing: true,
    defaultEnabled: true,
    defaultSubject: 'Your {site_title} order has been refunded',
    defaultHeading: 'Order Refunded: #{order_number}',
    render: (p, h) =>
      orderEmail(p, h, `Hi ${first(p)}, your order on {site_title} has been refunded:`),
  },
  customer_partially_refunded_order: {
    id: 'customer_partially_refunded_order',
    customerFacing: true,
    defaultEnabled: true,
    defaultSubject: 'Your {site_title} order has been partially refunded',
    defaultHeading: 'Partial Refund: Order #{order_number}',
    render: (p, h) =>
      orderEmail(p, h, `Hi ${first(p)}, your order on {site_title} has been partially refunded:`),
  },
  customer_invoice: {
    id: 'customer_invoice',
    customerFacing: true,
    defaultEnabled: true,
    defaultSubject: 'Invoice for order #{order_number} on {site_title}',
    defaultHeading: 'Invoice for order #{order_number}',
    render: (p, h) =>
      orderEmail(p, h, `Hi ${first(p)}, here are the details of your order placed on {order_date}:`),
  },
  customer_note: {
    id: 'customer_note',
    customerFacing: true,
    defaultEnabled: true,
    defaultSubject: 'A note has been added to your {site_title} order',
    defaultHeading: 'A note has been added to your order',
    render: (p, h) =>
      orderEmail(
        p,
        h,
        <>
          Hi {first(p)}, the following note has been added to your order:
          <br />
          <em>{p.note ?? ''}</em>
        </>,
      ),
  },
  customer_new_account: {
    id: 'customer_new_account',
    customerFacing: true,
    defaultEnabled: true,
    defaultSubject: 'Your {site_title} account has been created!',
    defaultHeading: 'Welcome to {site_title}',
    render: (p, h) =>
      simpleEmail(
        p,
        h,
        <p>
          Hi {first(p)}, thanks for creating an account on {'{site_title}'}. You can access your
          account area to view orders and change your details.
        </p>,
      ),
  },
  customer_reset_password: {
    id: 'customer_reset_password',
    customerFacing: true,
    defaultEnabled: true,
    defaultSubject: 'Password Reset Request for {site_title}',
    defaultHeading: 'Password Reset Request',
    render: (p, h) =>
      simpleEmail(
        p,
        h,
        <p>
          Hi {first(p)}, someone has requested a new password for your account on {'{site_title}'}.
          {/* TODO:security-blocked — SECURITY_WORK item S4: the reset link is
              generated by the auth package; until S4 lands this email carries
              no reset URL. */}
          {p.extra?.resetUrl ? (
            <>
              {' '}
              <a href={p.extra.resetUrl}>Click here to reset your password.</a>
            </>
          ) : (
            ' Password resets are not available yet on this store.'
          )}
        </p>,
      ),
  },
  customer_cancelled_order: {
    id: 'customer_cancelled_order',
    customerFacing: true,
    defaultEnabled: false,
    defaultSubject: 'Your {site_title} order has been cancelled',
    defaultHeading: 'Order Cancelled: #{order_number}',
    render: (p, h) => orderEmail(p, h, `Hi ${first(p)}, your order has been cancelled:`),
  },
  customer_failed_order: {
    id: 'customer_failed_order',
    customerFacing: true,
    defaultEnabled: false,
    defaultSubject: 'Your {site_title} order could not be processed',
    defaultHeading: 'Order Failed: #{order_number}',
    render: (p, h) =>
      orderEmail(
        p,
        h,
        `Hi ${first(p)}, unfortunately your order could not be processed as the payment failed:`,
      ),
  },
  customer_review_request: {
    id: 'customer_review_request',
    customerFacing: true,
    defaultEnabled: false,
    defaultSubject: 'How was your {site_title} order?',
    defaultHeading: 'Tell us what you think',
    render: (p, h) =>
      orderEmail(p, h, `Hi ${first(p)}, we'd love to hear what you think of your recent order:`, false),
  },
  customer_abandoned_cart_recovery: {
    id: 'customer_abandoned_cart_recovery',
    customerFacing: true,
    defaultEnabled: false,
    defaultSubject: 'You left something in your cart at {site_title}',
    defaultHeading: 'Still thinking it over?',
    render: (p, h) =>
      simpleEmail(p, h, <p>Hi {first(p)}, you left items in your cart on {'{site_title}'}. They're still waiting for you.</p>),
  },
  customer_fulfillment_created: {
    id: 'customer_fulfillment_created',
    customerFacing: true,
    defaultEnabled: false,
    defaultSubject: 'Your {site_title} order #{order_number} has shipped',
    defaultHeading: 'Your order has shipped',
    render: (p, h) =>
      orderEmail(p, h, `Hi ${first(p)}, part or all of your order is on its way:`, false),
  },
  customer_fulfillment_updated: {
    id: 'customer_fulfillment_updated',
    customerFacing: true,
    defaultEnabled: false,
    defaultSubject: 'Shipping update for your {site_title} order #{order_number}',
    defaultHeading: 'Shipping update',
    render: (p, h) =>
      orderEmail(p, h, `Hi ${first(p)}, there's an update to your shipment:`, false),
  },
  customer_fulfillment_deleted: {
    id: 'customer_fulfillment_deleted',
    customerFacing: true,
    defaultEnabled: false,
    defaultSubject: 'Shipment cancelled for your {site_title} order #{order_number}',
    defaultHeading: 'Shipment cancelled',
    render: (p, h) =>
      orderEmail(p, h, `Hi ${first(p)}, a shipment for your order was cancelled:`, false),
  },
  customer_pos_completed_order: {
    id: 'customer_pos_completed_order',
    customerFacing: true,
    defaultEnabled: false,
    defaultSubject: 'Your {site_title} receipt',
    defaultHeading: 'Your receipt',
    render: (p, h) => orderEmail(p, h, `Hi ${first(p)}, here is your receipt:`, false),
  },
  customer_pos_refunded_order: {
    id: 'customer_pos_refunded_order',
    customerFacing: true,
    defaultEnabled: false,
    defaultSubject: 'Your {site_title} refund receipt',
    defaultHeading: 'Refund receipt',
    render: (p, h) => orderEmail(p, h, `Hi ${first(p)}, your in-store refund has been processed:`, false),
  },
  admin_payment_gateway_enabled: {
    id: 'admin_payment_gateway_enabled',
    customerFacing: false,
    defaultEnabled: true,
    defaultSubject: '[{site_title}] Payment gateway enabled',
    defaultHeading: 'Payment gateway enabled',
    render: (p, h) =>
      simpleEmail(
        p,
        h,
        <p>The payment gateway "{p.extra?.gatewayId ?? 'unknown'}" was enabled on {'{site_title}'}.</p>,
      ),
  },
};
