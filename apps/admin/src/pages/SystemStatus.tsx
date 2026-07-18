import { Badge, Card } from '@spacendigital/ui';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';

interface SystemStatus {
  environment: { dialect: string; node: string };
  database: { migrated: boolean };
  security: { pending: string[] };
}

export function SystemStatusPage() {
  const status = useQuery({
    queryKey: ['system_status'],
    queryFn: () => api.get<SystemStatus>('/system_status'),
  });
  const s = status.data;
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">System status</h1>
      <Card title="Environment">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-zinc-500">Database dialect</dt>
          <dd>{s?.environment.dialect ?? '—'}</dd>
          <dt className="text-zinc-500">Runtime</dt>
          <dd>{s?.environment.node ?? '—'}</dd>
          <dt className="text-zinc-500">Migrations</dt>
          <dd>{s?.database.migrated ? <Badge tone="green">applied</Badge> : '—'}</dd>
        </dl>
      </Card>
      <Card title="Deferred security work (SECURITY_WORK.md)">
        <ul className="space-y-1 text-sm">
          {(s?.security.pending ?? []).map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Badge tone="amber">pending</Badge>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
