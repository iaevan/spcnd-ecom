import { EmptyState, moneyString, Select, StatusBadge, Table } from '@spacendigital/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type OrderRow } from '../api.js';

const STATUSES = ['', 'pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'];

export function OrdersPage() {
  const [status, setStatus] = useState('');
  const orders = useQuery({
    queryKey: ['orders', status],
    queryFn: () => api.get<OrderRow[]>(`/orders?per_page=50${status ? `&status=${status}` : ''}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Orders</h1>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'All statuses' : s}
            </option>
          ))}
        </Select>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white">
        {orders.data && orders.data.length > 0 ? (
          <Table headers={['Order', 'Date', 'Customer', 'Status', 'Total']}>
            {orders.data.map((o) => (
              <tr key={o.id} className="hover:bg-zinc-50">
                <td className="px-3 py-2">
                  <Link className="font-medium text-violet-700 hover:underline" to={`/orders/${o.id}`}>
                    #{o.id}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-500">{o.dateCreated.slice(0, 10)}</td>
                <td className="px-3 py-2">
                  {o.billingFirstName} {o.billingLastName}
                  <span className="ml-1 text-zinc-400">{o.billingEmail}</span>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-3 py-2 font-medium">{moneyString(o.total)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState message={orders.isLoading ? 'Loading…' : 'No orders yet.'} />
        )}
      </div>
    </div>
  );
}
