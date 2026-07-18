import { Badge, Button, Card, EmptyState, Field, Input } from '@spacendigital/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api.js';

interface ZoneRow {
  id: number;
  zoneName: string;
  zoneOrder: number;
  locations: { id: number; locationCode: string; locationType: string }[];
  methods: { id: number; methodId: string; isEnabled: boolean; settings: Record<string, unknown> }[];
}

export function ShippingPage() {
  const queryClient = useQueryClient();
  const zones = useQuery({ queryKey: ['zones'], queryFn: () => api.get<ZoneRow[]>('/shipping/zones') });
  const [zoneName, setZoneName] = useState('');
  const createZone = useMutation({
    mutationFn: () => api.post('/shipping/zones', { zoneName }),
    onSuccess: () => {
      setZoneName('');
      queryClient.invalidateQueries({ queryKey: ['zones'] });
    },
  });
  const addMethod = useMutation({
    mutationFn: ({ zoneId, methodId }: { zoneId: number; methodId: string }) =>
      api.post(`/shipping/zones/${zoneId}/methods`, {
        methodId,
        settings: methodId === 'flat_rate' ? { cost: '5' } : {},
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Shipping zones</h1>
      <Card title="Add zone">
        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (zoneName.trim()) createZone.mutate();
          }}
        >
          <Field label="Zone name">
            <Input value={zoneName} onChange={(e) => setZoneName(e.target.value)} />
          </Field>
          <Button type="submit">Add zone</Button>
        </form>
      </Card>
      {zones.data && zones.data.length > 0 ? (
        zones.data.map((zone) => (
          <Card key={zone.id} title={zone.zoneName}>
            <div className="space-y-2 text-sm">
              <p className="text-zinc-500">
                Locations:{' '}
                {zone.locations.length > 0
                  ? zone.locations.map((l) => `${l.locationType}:${l.locationCode}`).join(', ')
                  : 'Rest of world'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {zone.methods.map((m) => (
                  <Badge key={m.id} tone={m.isEnabled ? 'violet' : 'zinc'}>
                    {m.methodId}
                  </Badge>
                ))}
                {['flat_rate', 'free_shipping', 'local_pickup'].map((methodId) => (
                  <Button
                    key={methodId}
                    variant="outline"
                    onClick={() => addMethod.mutate({ zoneId: zone.id, methodId })}
                  >
                    + {methodId}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        ))
      ) : (
        <EmptyState message={zones.isLoading ? 'Loading…' : 'No zones configured.'} />
      )}
    </div>
  );
}
