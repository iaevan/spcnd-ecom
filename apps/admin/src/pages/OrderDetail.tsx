import { Button, Card, Field, Input, moneyString, Select, StatusBadge, Table } from '@spacendigital/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type OrderRow } from '../api.js';

interface NoteRow {
  id: number;
  note: string;
  type: string;
  createdAt: string;
}

interface RefundRow {
  id: number;
  amount: string;
  reason: string | null;
  dateCreated: string;
}

const STATUSES = ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'];

export function OrderDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['order', id] });

  const order = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<OrderRow>(`/orders/${id}`),
  });
  const notes = useQuery({
    queryKey: ['order', id, 'notes'],
    queryFn: () => api.get<NoteRow[]>(`/orders/${id}/notes`),
  });
  const refunds = useQuery({
    queryKey: ['order', id, 'refunds'],
    queryFn: () => api.get<RefundRow[]>(`/orders/${id}/refunds`),
  });

  const [nextStatus, setNextStatus] = useState('');
  const [noteText, setNoteText] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setStatus = useMutation({
    mutationFn: () => api.put(`/orders/${id}/status`, { status: nextStatus }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err) => setError((err as Error).message),
  });
  const addNote = useMutation({
    mutationFn: () => api.post(`/orders/${id}/notes`, { note: noteText, type: 'private' }),
    onSuccess: () => {
      setNoteText('');
      queryClient.invalidateQueries({ queryKey: ['order', id, 'notes'] });
    },
  });
  const refund = useMutation({
    mutationFn: () => api.post(`/orders/${id}/refunds`, { amount: refundAmount, reason: refundReason }),
    onSuccess: () => {
      setRefundAmount('');
      setRefundReason('');
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['order', id, 'refunds'] });
    },
    onError: (err) => setError((err as Error).message),
  });

  const o = order.data;
  if (!o) return <p className="text-sm text-zinc-500">Loading…</p>;
  const lineItems = (o.items ?? []).filter((i) => i.type === 'line_item');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Order #{o.id}</h1>
        <StatusBadge status={o.status} />
        <span className="text-sm text-zinc-500">{o.dateCreated.slice(0, 19).replace('T', ' ')}</span>
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Items">
            <Table headers={['Item', 'Qty', 'Subtotal', 'Total']}>
              {lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.quantity}</td>
                  <td className="px-3 py-2">{moneyString(item.subtotal)}</td>
                  <td className="px-3 py-2">{moneyString(item.total)}</td>
                </tr>
              ))}
            </Table>
            <div className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-right text-sm">
              <p>Discount: {moneyString(o.discountTotal)}</p>
              <p>Shipping: {moneyString(o.shippingTotal)}</p>
              <p>Tax: {moneyString(o.totalTax)}</p>
              <p className="text-base font-semibold">Total: {moneyString(o.total)}</p>
            </div>
          </Card>

          <Card title="Notes">
            <div className="space-y-3">
              {(notes.data ?? []).map((n) => (
                <div key={n.id} className="rounded-md bg-zinc-50 px-3 py-2 text-sm">
                  <p>{n.note}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {n.type} · {n.createdAt.slice(0, 19).replace('T', ' ')}
                  </p>
                </div>
              ))}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (noteText.trim()) addNote.mutate();
                }}
              >
                <Input placeholder="Add a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <Button type="submit">Add</Button>
              </form>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Customer">
            <div className="space-y-1 text-sm">
              <p className="font-medium">
                {o.billingFirstName} {o.billingLastName}
              </p>
              <p className="text-zinc-500">{o.billingEmail}</p>
              <p className="text-zinc-500">{o.paymentMethodTitle || '—'}</p>
              {o.customerNote && <p className="rounded bg-amber-50 p-2 text-xs">{o.customerNote}</p>}
            </div>
          </Card>

          <Card title="Change status">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (nextStatus) setStatus.mutate();
              }}
            >
              <Select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className="w-full">
                <option value="">Choose…</option>
                {STATUSES.filter((s) => s !== o.status).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              <Button type="submit" disabled={setStatus.isPending}>
                Apply
              </Button>
            </form>
          </Card>

          <Card title="Refund">
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (refundAmount) refund.mutate();
              }}
            >
              <Field label="Amount">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </Field>
              <Field label="Reason">
                <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
              </Field>
              <Button type="submit" variant="destructive" disabled={refund.isPending}>
                Refund
              </Button>
            </form>
            <ul className="mt-3 space-y-1 text-xs text-zinc-500">
              {(refunds.data ?? []).map((r) => (
                <li key={r.id}>
                  -{moneyString(r.amount)} {r.reason ? `— ${r.reason}` : ''}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
