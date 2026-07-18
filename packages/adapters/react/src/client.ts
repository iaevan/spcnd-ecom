/**
 * Typed fetch client over the spcnd-ecom HTTP surface (storefront + v1
 * browse). Framework-free; the hooks in hooks.ts wrap it for React.
 */

export interface StoreCart {
  items: {
    key: string;
    productId: number;
    variationId: number | null;
    name: string;
    quantity: number;
    unitPriceMinor: number;
    totalMinor: number;
  }[];
  coupons: string[];
  removedCoupons: string[];
  totals: {
    subtotalMinor: number;
    discountTotalMinor: number;
    shippingTotalMinor: number;
    totalTaxMinor: number;
    totalMinor: number;
  };
  needsShipping: boolean;
  needsPayment: boolean;
}

export interface StoreProduct {
  id: number;
  name: string;
  slug: string;
  price: string | null;
  regularPrice: string | null;
  salePrice: string | null;
  shortDescription: string;
  description: string;
  stockStatus: string;
  type: string;
}

export interface CheckoutPayload {
  billing: Record<string, string>;
  shipping?: Record<string, string>;
  shipToDifferentAddress?: boolean;
  paymentMethod?: string;
  customerNote?: string;
  createAccount?: boolean;
  termsAccepted?: boolean;
}

export interface CheckoutResult {
  result: 'success';
  orderId: number;
  orderKey: string;
  redirect: string;
  removedCoupons: string[];
}

export class SpcndClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface SpcndClientOptions {
  /** Origin of the spcnd-ecom API, '' for same-origin. */
  baseUrl?: string;
  /** Custom fetch (tests, SSR with cookie forwarding). */
  fetch?: typeof fetch;
}

export function createClient(options: SpcndClientOptions = {}) {
  const base = (options.baseUrl ?? '').replace(/\/$/, '');
  const doFetch = options.fetch ?? fetch;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await doFetch(`${base}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
      throw new SpcndClientError(
        response.status,
        body.code ?? 'error',
        body.message ?? response.statusText,
      );
    }
    return (await response.json()) as T;
  }

  return {
    products: {
      list: (query: Record<string, string> = {}) =>
        request<StoreProduct[]>(`/api/v1/products?${new URLSearchParams(query)}`),
      get: (id: number) => request<StoreProduct>(`/api/v1/products/${id}`),
    },
    cart: {
      get: () => request<StoreCart>('/api/store/cart'),
      addItem: (input: { productId: number; quantity?: number; variationId?: number }) =>
        request<{ key: string; cart: StoreCart }>('/api/store/cart/items', {
          method: 'POST',
          body: JSON.stringify(input),
        }),
      setQuantity: (key: string, quantity: number) =>
        request<StoreCart>(`/api/store/cart/items/${key}`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity }),
        }),
      removeItem: (key: string) =>
        request<StoreCart>(`/api/store/cart/items/${key}`, { method: 'DELETE' }),
      applyCoupon: (code: string) =>
        request<StoreCart>('/api/store/cart/coupons', {
          method: 'POST',
          body: JSON.stringify({ code }),
        }),
      removeCoupon: (code: string) =>
        request<StoreCart>(`/api/store/cart/coupons/${encodeURIComponent(code)}`, {
          method: 'DELETE',
        }),
    },
    checkout: (payload: CheckoutPayload) =>
      request<CheckoutResult>('/api/store/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    orderReceived: (orderId: number, orderKey: string) =>
      request<Record<string, unknown>>(`/api/store/order-received/${orderId}?key=${orderKey}`),
  };
}

export type SpcndClient = ReturnType<typeof createClient>;
