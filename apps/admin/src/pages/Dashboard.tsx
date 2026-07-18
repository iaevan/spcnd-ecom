import { Card, money } from '@spacendigital/ui';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, type RevenueReport } from '../api.js';

interface Leaderboards {
  products: { productId: number; name: string; itemsSold: number; netRevenueMinor: number }[];
  coupons: { couponId: number; code: string; ordersCount: number; amountMinor: number }[];
  customers: { customerId: number; name: string; totalSpendMinor: number; ordersCount: number }[];
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const revenue = useQuery({
    queryKey: ['reports', 'revenue'],
    queryFn: () => api.get<RevenueReport>('/reports/revenue'),
  });
  const boards = useQuery({
    queryKey: ['reports', 'leaderboards'],
    queryFn: () => api.get<Leaderboards>('/reports/leaderboards'),
  });

  const r = revenue.data;
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Gross sales" value={r ? money(r.grossSalesMinor) : '—'} />
        <Stat label="Net revenue" value={r ? money(r.netRevenueMinor) : '—'} />
        <Stat label="Orders" value={r ? String(r.ordersCount) : '—'} />
        <Stat label="Avg order value" value={r ? money(r.avgOrderValueMinor) : '—'} />
      </div>

      <Card title="Revenue over time">
        {r && r.intervals.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={r.intervals.map((i) => ({ ...i, gross: i.grossSalesMinor / 10000 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
              <Line type="monotone" dataKey="gross" stroke="#7c3aed" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-10 text-center text-sm text-zinc-500">No sales in range yet.</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Top products">
          <ul className="space-y-2 text-sm">
            {(boards.data?.products ?? []).map((p) => (
              <li key={p.productId} className="flex justify-between">
                <span className="truncate">{p.name}</span>
                <span className="text-zinc-500">
                  {p.itemsSold} · {money(p.netRevenueMinor)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Top coupons">
          <ul className="space-y-2 text-sm">
            {(boards.data?.coupons ?? []).map((c) => (
              <li key={c.couponId} className="flex justify-between">
                <span>{c.code}</span>
                <span className="text-zinc-500">{money(c.amountMinor)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Top customers">
          <ul className="space-y-2 text-sm">
            {(boards.data?.customers ?? []).map((c) => (
              <li key={c.customerId} className="flex justify-between">
                <span className="truncate">{c.name}</span>
                <span className="text-zinc-500">{money(c.totalSpendMinor)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
