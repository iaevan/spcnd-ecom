import { Button, Card, Field, Input, Select } from '@spacendigital/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type ProductRow } from '../api.js';

interface FormState {
  name: string;
  sku: string;
  regularPrice: string;
  salePrice: string;
  status: string;
  manageStock: boolean;
  stockQuantity: string;
}

const EMPTY: FormState = {
  name: '',
  sku: '',
  regularPrice: '',
  salePrice: '',
  status: 'publish',
  manageStock: false,
  stockQuantity: '',
};

export function ProductEditPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<ProductRow>(`/products/${id}`),
    enabled: !isNew,
  });

  useEffect(() => {
    const p = existing.data;
    if (!p) return;
    setForm({
      name: p.name,
      sku: p.sku ?? '',
      regularPrice: p.regularPrice ? String(Number(p.regularPrice)) : '',
      salePrice: p.salePrice ? String(Number(p.salePrice)) : '',
      status: p.status,
      manageStock: p.manageStock,
      stockQuantity: p.stockQuantity === null ? '' : String(p.stockQuantity),
    });
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        sku: form.sku || null,
        regularPrice: form.regularPrice || null,
        salePrice: form.salePrice || null,
        status: form.status,
        manageStock: form.manageStock,
        stockQuantity: form.manageStock && form.stockQuantity !== '' ? Number(form.stockQuantity) : null,
      };
      return isNew
        ? api.post<ProductRow>('/products', body)
        : api.put<ProductRow>(`/products/${id}`, body);
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate(`/products/${product.id}`);
    },
    onError: (err) => setError((err as Error).message),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">{isNew ? 'Add product' : `Edit: ${form.name}`}</h1>
      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
        >
          <Field label="Name">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU">
              <Input value={form.sku} onChange={(e) => set('sku', e.target.value)} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => set('status', e.target.value)} className="w-full">
                {['publish', 'draft', 'pending', 'private'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Regular price">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.regularPrice}
                onChange={(e) => set('regularPrice', e.target.value)}
              />
            </Field>
            <Field label="Sale price">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.salePrice}
                onChange={(e) => set('salePrice', e.target.value)}
              />
            </Field>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.manageStock}
                onChange={(e) => set('manageStock', e.target.checked)}
              />
              Manage stock
            </label>
            {form.manageStock && (
              <Input
                type="number"
                className="w-32"
                placeholder="Quantity"
                value={form.stockQuantity}
                onChange={(e) => set('stockQuantity', e.target.value)}
              />
            )}
          </div>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save product'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/products')}>
              Back
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
