import { Button, Card, EmptyState, Field, Input, Table } from '@spacendigital/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api.js';

interface TaxRateRow {
  id: number;
  country: string;
  state: string;
  name: string;
  rate: string;
  priority: number;
  compound: boolean;
  shipping: boolean;
}

export function TaxPage() {
  const queryClient = useQueryClient();
  const rates = useQuery({ queryKey: ['taxes'], queryFn: () => api.get<TaxRateRow[]>('/taxes') });
  const [form, setForm] = useState({ country: '', state: '', name: 'Tax', rate: '' });
  const create = useMutation({
    mutationFn: () =>
      api.post('/taxes', { ...form, country: form.country.toUpperCase(), state: form.state.toUpperCase(), rate: Number(form.rate).toFixed(4) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['taxes'] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Tax rates</h1>
      <Card title="Add rate">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Country">
            <Input className="w-20" maxLength={2} placeholder="US" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </Field>
          <Field label="State">
            <Input className="w-20" placeholder="CA" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </Field>
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Rate %">
            <Input className="w-24" type="number" step="0.0001" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} required />
          </Field>
          <Button type="submit">Add</Button>
        </form>
      </Card>
      <div className="rounded-lg border border-zinc-200 bg-white">
        {rates.data && rates.data.length > 0 ? (
          <Table headers={['Country', 'State', 'Name', 'Rate %', 'Priority', 'Compound', 'Shipping']}>
            {rates.data.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">{r.country || '*'}</td>
                <td className="px-3 py-2">{r.state || '*'}</td>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">{Number(r.rate).toFixed(4)}</td>
                <td className="px-3 py-2">{r.priority}</td>
                <td className="px-3 py-2">{r.compound ? 'yes' : 'no'}</td>
                <td className="px-3 py-2">{r.shipping ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState message={rates.isLoading ? 'Loading…' : 'No tax rates configured.'} />
        )}
      </div>
    </div>
  );
}
