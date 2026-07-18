import { Badge, Button, EmptyState, Input, moneyString, StatusBadge, Table } from '@spacendigital/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ProductRow } from '../api.js';

export function ProductsPage() {
  const [search, setSearch] = useState('');
  const products = useQuery({
    queryKey: ['products', search],
    queryFn: () =>
      api.get<ProductRow[]>(`/products?per_page=50&status=any${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Products</h1>
        <div className="flex w-80 gap-2">
          <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Link to="/products/new">
            <Button>Add</Button>
          </Link>
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white">
        {products.data && products.data.length > 0 ? (
          <Table headers={['Name', 'SKU', 'Price', 'Stock', 'Status', 'Sold']}>
            {products.data.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-50">
                <td className="px-3 py-2">
                  <Link className="font-medium text-violet-700 hover:underline" to={`/products/${p.id}`}>
                    {p.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-500">{p.sku ?? '—'}</td>
                <td className="px-3 py-2">{moneyString(p.price)}</td>
                <td className="px-3 py-2">
                  <Badge tone={p.stockStatus === 'instock' ? 'green' : p.stockStatus === 'onbackorder' ? 'amber' : 'red'}>
                    {p.manageStock && p.stockQuantity !== null
                      ? `${p.stockStatus} (${p.stockQuantity})`
                      : p.stockStatus}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-3 py-2 text-zinc-500">{p.totalSales}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState message={products.isLoading ? 'Loading…' : 'No products yet.'} />
        )}
      </div>
    </div>
  );
}
