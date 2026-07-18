import { Button, Card, Field, Input } from '@spacendigital/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../api.js';

/** General settings tab; the full 11-tab layout arrives with later steps. */
const GENERAL_KEYS = [
  ['store_name', 'Store name'],
  ['store_url', 'Store URL'],
  ['default_country', 'Base location (COUNTRY[:STATE])'],
  ['currency', 'Currency'],
  ['price_num_decimals', 'Price decimals'],
  ['merchant_email', 'Merchant email'],
  ['email_from_address', 'Email from address'],
] as const;

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Record<string, unknown>>('/settings'),
  });
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    const next: Record<string, string> = {};
    for (const [key] of GENERAL_KEYS) next[key] = String(settings.data[key] ?? '');
    setForm(next);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => api.put('/settings', form),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>
      <Card title="General">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {GENERAL_KEYS.map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                value={form[key] ?? ''}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </Field>
          ))}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={save.isPending}>
              Save settings
            </Button>
            {saved && <span className="text-sm text-green-600">Saved.</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}
