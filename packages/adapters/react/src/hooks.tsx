import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createClient, type SpcndClient, type StoreCart, type StoreProduct } from './client.js';

/** Dependency-free hooks over the typed client (no query library required). */

const ClientContext = createContext<SpcndClient | null>(null);

export function SpcndProvider({
  baseUrl,
  children,
}: {
  baseUrl?: string;
  children: ReactNode;
}) {
  const client = useMemo(() => createClient({ baseUrl }), [baseUrl]);
  return <ClientContext.Provider value={client}>{children}</ClientContext.Provider>;
}

export function useSpcnd(): SpcndClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error('Wrap your app in <SpcndProvider> to use spcnd-ecom hooks');
  return client;
}

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useProducts(query: Record<string, string> = {}): AsyncState<StoreProduct[]> {
  const client = useSpcnd();
  const [state, setState] = useState<AsyncState<StoreProduct[]>>({ data: null, loading: true, error: null });
  const key = JSON.stringify(query);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    client.products
      .list(JSON.parse(key) as Record<string, string>)
      .then((data) => live && setState({ data, loading: false, error: null }))
      .catch((error) => live && setState({ data: null, loading: false, error: error as Error }));
    return () => {
      live = false;
    };
  }, [client, key]);
  return state;
}

export function useCart() {
  const client = useSpcnd();
  const [cart, setCart] = useState<StoreCart | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setCart(await client.cart.get());
    setLoading(false);
  }, [client]);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  const wrap = useCallback(
    async (action: () => Promise<unknown>) => {
      await action();
      await refresh();
    },
    [refresh],
  );

  return {
    cart,
    loading,
    refresh,
    addItem: (productId: number, quantity = 1, variationId?: number) =>
      wrap(() => client.cart.addItem({ productId, quantity, variationId })),
    setQuantity: (key: string, quantity: number) => wrap(() => client.cart.setQuantity(key, quantity)),
    removeItem: (key: string) => wrap(() => client.cart.removeItem(key)),
    applyCoupon: (code: string) => wrap(() => client.cart.applyCoupon(code)),
    removeCoupon: (code: string) => wrap(() => client.cart.removeCoupon(code)),
  };
}

/** Format integer minor units for display. */
export function formatMinor(minor: number, symbol = '$'): string {
  const sign = minor < 0 ? '-' : '';
  return `${sign}${symbol}${(Math.abs(minor) / 10000).toFixed(2)}`;
}
