import { Badge, EmptyState, moneyString, Table } from '@spacendigital/ui';
import { useQuery } from '@tanstack/react-query';
import { api, type CustomerRow } from '../api.js';

export function CustomersPage() {
  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<CustomerRow[]>('/customers?per_page=50'),
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Customers</h1>
      <div className="rounded-lg border border-zinc-200 bg-white">
        {customers.data && customers.data.length > 0 ? (
          <Table headers={['Name', 'Email', 'Role', 'Orders', 'Total spent', 'Registered']}>
            {customers.data.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-medium">{c.displayName || `${c.firstName} ${c.lastName}`}</td>
                <td className="px-3 py-2 text-zinc-500">{c.email}</td>
                <td className="px-3 py-2">
                  <Badge tone={c.role === 'admin' ? 'violet' : 'zinc'}>{c.role}</Badge>
                </td>
                <td className="px-3 py-2">{c.orderCount}</td>
                <td className="px-3 py-2">{moneyString(c.totalSpent)}</td>
                <td className="px-3 py-2 text-zinc-500">{c.dateCreated.slice(0, 10)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState message={customers.isLoading ? 'Loading…' : 'No customers yet.'} />
        )}
      </div>
    </div>
  );
}
