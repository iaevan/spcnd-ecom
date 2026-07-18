import { Button, Card, EmptyState, Field, Input, moneyString, Select, Table } from '@spacendigital/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type CouponRow } from '../api.js';

export function CouponsPage() {
  const queryClient = useQueryClient();
  const coupons = useQuery({
    queryKey: ['coupons'],
    queryFn: () => api.get<CouponRow[]>('/coupons?per_page=50'),
  });
  const [code, setCode] = useState('');
  const [type, setType] = useState('percent');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post('/coupons', { code, discountType: type, amount }),
    onSuccess: () => {
      setCode('');
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
    onError: (err) => setError((err as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/coupons/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coupons'] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Coupons</h1>
      <Card title="Add coupon">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            create.mutate();
          }}
        >
          <Field label="Code">
            <Input value={code} onChange={(e) => setCode(e.target.value)} required />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="percent">Percentage</option>
              <option value="fixed_cart">Fixed cart</option>
              <option value="fixed_product">Fixed product</option>
            </Select>
          </Field>
          <Field label="Amount">
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <Button type="submit" disabled={create.isPending}>
            Create
          </Button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      </Card>
      <div className="rounded-lg border border-zinc-200 bg-white">
        {coupons.data && coupons.data.length > 0 ? (
          <Table headers={['Code', 'Type', 'Amount', 'Usage', 'Expires', '']}>
            {coupons.data.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-mono font-medium">{c.code}</td>
                <td className="px-3 py-2 text-zinc-500">{c.discountType}</td>
                <td className="px-3 py-2">
                  {c.discountType === 'percent' ? `${Number(c.amount)}%` : moneyString(c.amount)}
                </td>
                <td className="px-3 py-2">
                  {c.usageCount}
                  {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                </td>
                <td className="px-3 py-2 text-zinc-500">{c.dateExpires?.slice(0, 10) ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" onClick={() => remove.mutate(c.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState message={coupons.isLoading ? 'Loading…' : 'No coupons yet.'} />
        )}
      </div>
    </div>
  );
}
