import { Money, type Address } from '@spacendigital/types';
import type { ReactNode } from 'react';

/**
 * Shared email building blocks mirroring WC's email partials
 * (email-header/footer, email-order-details, email-addresses). Plain React
 * rendered with renderToStaticMarkup (DECISION-9) — styles are inline so no
 * CSS inliner is needed.
 */

export interface EmailTheme {
  baseColor: string;
  backgroundColor: string;
  bodyBackgroundColor: string;
  textColor: string;
  storeName: string;
  footerText: string;
}

export interface OrderEmailData {
  orderNumber: string;
  dateCreated: string;
  currencySymbol: string;
  items: { name: string; quantity: number; totalMinor: number }[];
  subtotalMinor: number;
  discountTotalMinor: number;
  shippingTotalMinor: number;
  totalTaxMinor: number;
  totalMinor: number;
  paymentMethodTitle: string;
  customerNote: string | null;
  billing: Address;
  shipping: Address | null;
}

const cell: React.CSSProperties = {
  padding: '12px',
  borderBottom: '1px solid #e5e5e5',
  textAlign: 'left',
  verticalAlign: 'top',
};

export function formatAmount(minor: number, symbol: string): string {
  return `${symbol}${Money.fromMinor(minor).toFixed(2)}`;
}

export function EmailLayout({
  theme,
  heading,
  children,
}: {
  theme: EmailTheme;
  heading: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div style={{ backgroundColor: theme.backgroundColor, padding: '32px 0', fontFamily: 'Helvetica, Arial, sans-serif' }}>
      <table width="600" cellPadding={0} cellSpacing={0} style={{ margin: '0 auto', width: '600px', maxWidth: '100%' }}>
        <tbody>
          <tr>
            <td style={{ backgroundColor: theme.baseColor, borderRadius: '6px 6px 0 0', padding: '28px 40px' }}>
              <h1 style={{ color: '#ffffff', margin: 0, fontSize: '24px' }}>{heading}</h1>
            </td>
          </tr>
          <tr>
            <td style={{ backgroundColor: theme.bodyBackgroundColor, padding: '32px 40px', color: theme.textColor, fontSize: '14px', lineHeight: '1.6' }}>
              {children}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '20px 40px', textAlign: 'center', color: '#8a8a8a', fontSize: '12px' }}>
              {theme.footerText}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function OrderTable({ order }: { order: OrderEmailData }): JSX.Element {
  const symbol = order.currencySymbol;
  return (
    <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse', margin: '16px 0' }}>
      <thead>
        <tr>
          <th style={cell}>Product</th>
          <th style={cell}>Quantity</th>
          <th style={cell}>Price</th>
        </tr>
      </thead>
      <tbody>
        {order.items.map((item, i) => (
          <tr key={i}>
            <td style={cell}>{item.name}</td>
            <td style={cell}>{item.quantity}</td>
            <td style={cell}>{formatAmount(item.totalMinor, symbol)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td style={cell} colSpan={2}>Subtotal:</td>
          <td style={cell}>{formatAmount(order.subtotalMinor, symbol)}</td>
        </tr>
        {order.discountTotalMinor > 0 && (
          <tr>
            <td style={cell} colSpan={2}>Discount:</td>
            <td style={cell}>-{formatAmount(order.discountTotalMinor, symbol)}</td>
          </tr>
        )}
        {order.shippingTotalMinor > 0 && (
          <tr>
            <td style={cell} colSpan={2}>Shipping:</td>
            <td style={cell}>{formatAmount(order.shippingTotalMinor, symbol)}</td>
          </tr>
        )}
        {order.totalTaxMinor > 0 && (
          <tr>
            <td style={cell} colSpan={2}>Tax:</td>
            <td style={cell}>{formatAmount(order.totalTaxMinor, symbol)}</td>
          </tr>
        )}
        <tr>
          <td style={{ ...cell, fontWeight: 700 }} colSpan={2}>Total:</td>
          <td style={{ ...cell, fontWeight: 700 }}>{formatAmount(order.totalMinor, symbol)}</td>
        </tr>
        <tr>
          <td style={cell} colSpan={2}>Payment method:</td>
          <td style={cell}>{order.paymentMethodTitle || '—'}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export function AddressBlock({ title, address }: { title: string; address: Address }): JSX.Element {
  return (
    <div style={{ margin: '8px 0' }}>
      <strong>{title}</strong>
      <br />
      {[address.firstName, address.lastName].filter(Boolean).join(' ')}
      <br />
      {address.address1}
      {address.address2 ? (
        <>
          <br />
          {address.address2}
        </>
      ) : null}
      <br />
      {[address.city, address.state, address.postcode].filter(Boolean).join(', ')}
      <br />
      {address.country}
      {address.email ? (
        <>
          <br />
          {address.email}
        </>
      ) : null}
      {address.phone ? (
        <>
          <br />
          {address.phone}
        </>
      ) : null}
    </div>
  );
}

export function Addresses({ order }: { order: OrderEmailData }): JSX.Element {
  return (
    <table width="100%" cellPadding={0} cellSpacing={0} style={{ margin: '16px 0' }}>
      <tbody>
        <tr>
          <td style={{ verticalAlign: 'top' }}>
            <AddressBlock title="Billing address" address={order.billing} />
          </td>
          {order.shipping && order.shipping.address1 !== '' ? (
            <td style={{ verticalAlign: 'top' }}>
              <AddressBlock title="Shipping address" address={order.shipping} />
            </td>
          ) : null}
        </tr>
      </tbody>
    </table>
  );
}
