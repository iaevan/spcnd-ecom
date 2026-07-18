/** Thin typed client over /api/v1 (same origin; Vite proxies in dev). */

const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new ApiError(response.status, body.code ?? 'error', body.message ?? response.statusText);
  }
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// Row shapes as the v1 API returns them (drizzle rows).
export interface ProductRow {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  type: string;
  status: string;
  price: string | null;
  regularPrice: string | null;
  salePrice: string | null;
  stockStatus: string;
  stockQuantity: number | null;
  manageStock: boolean;
  totalSales: number;
}

export interface OrderRow {
  id: number;
  status: string;
  currency: string;
  total: string;
  totalTax: string;
  discountTotal: string;
  shippingTotal: string;
  dateCreated: string;
  datePaid: string | null;
  billingFirstName: string;
  billingLastName: string;
  billingEmail: string;
  paymentMethodTitle: string;
  customerNote: string | null;
  items?: OrderItemRow[];
}

export interface OrderItemRow {
  id: number;
  type: string;
  name: string;
  quantity: number | null;
  subtotal: string | null;
  total: string | null;
  totalTax: string | null;
}

export interface CustomerRow {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: string;
  orderCount: number;
  totalSpent: string;
  dateCreated: string;
}

export interface CouponRow {
  id: number;
  code: string;
  discountType: string;
  amount: string;
  usageCount: number;
  usageLimit: number | null;
  dateExpires: string | null;
}

export interface ReviewRow {
  id: number;
  productId: number;
  rating: number;
  content: string;
  status: string;
  authorName: string;
  verifiedOwner: boolean;
  dateCreated: string;
}

export interface RevenueReport {
  ordersCount: number;
  numItemsSold: number;
  grossSalesMinor: number;
  netRevenueMinor: number;
  taxesMinor: number;
  shippingMinor: number;
  refundsMinor: number;
  totalSalesMinor: number;
  avgOrderValueMinor: number;
  intervals: { date: string; ordersCount: number; grossSalesMinor: number; netRevenueMinor: number }[];
}
