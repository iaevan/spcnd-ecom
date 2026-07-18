import { Badge, Button, Card, EmptyState, Field, Input, Table } from '@spacendigital/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api.js';

interface WebhookRow {
  id: number;
  name: string;
  status: string;
  topic: string;
  deliveryUrl: string;
  failureCount: number;
}

export function WebhooksPage() {
  const queryClient = useQueryClient();
  const webhooks = useQuery({ queryKey: ['webhooks'], queryFn: () => api.get<WebhookRow[]>('/webhooks') });
  const [form, setForm] = useState({ name: '', topic: 'order.created', deliveryUrl: '' });
  const create = useMutation({
    mutationFn: () => api.post('/webhooks', { ...form, status: 'active', secret: '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Webhooks</h1>
      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Delivery (signatures, retries, auto-disable) ships with SECURITY_WORK item S3 — rows
        created here are stored but not yet delivered.
      </p>
      <Card title="Add webhook">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Topic">
            <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
          </Field>
          <Field label="Delivery URL">
            <Input
              className="w-72"
              type="url"
              value={form.deliveryUrl}
              onChange={(e) => setForm({ ...form, deliveryUrl: e.target.value })}
              required
            />
          </Field>
          <Button type="submit">Create</Button>
        </form>
      </Card>
      <div className="rounded-lg border border-zinc-200 bg-white">
        {webhooks.data && webhooks.data.length > 0 ? (
          <Table headers={['Name', 'Topic', 'URL', 'Status', 'Failures']}>
            {webhooks.data.map((w) => (
              <tr key={w.id}>
                <td className="px-3 py-2 font-medium">{w.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{w.topic}</td>
                <td className="max-w-xs truncate px-3 py-2 text-zinc-500">{w.deliveryUrl}</td>
                <td className="px-3 py-2">
                  <Badge tone={w.status === 'active' ? 'green' : 'zinc'}>{w.status}</Badge>
                </td>
                <td className="px-3 py-2">{w.failureCount}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState message={webhooks.isLoading ? 'Loading…' : 'No webhooks yet.'} />
        )}
      </div>
    </div>
  );
}
