import { Badge, EmptyState, Table } from '@spacendigital/ui';
import { useQuery } from '@tanstack/react-query';
import { api, type ReviewRow } from '../api.js';

export function ReviewsPage() {
  const reviews = useQuery({
    queryKey: ['reviews'],
    queryFn: () => api.get<ReviewRow[]>('/products-reviews'),
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Reviews</h1>
      <div className="rounded-lg border border-zinc-200 bg-white">
        {reviews.data && reviews.data.length > 0 ? (
          <Table headers={['Author', 'Rating', 'Review', 'Status', 'Verified', 'Date']}>
            {reviews.data.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-medium">{r.authorName}</td>
                <td className="px-3 py-2">{'★'.repeat(r.rating)}</td>
                <td className="max-w-md truncate px-3 py-2 text-zinc-600">{r.content}</td>
                <td className="px-3 py-2">
                  <Badge tone={r.status === 'approved' ? 'green' : r.status === 'pending' ? 'amber' : 'red'}>
                    {r.status}
                  </Badge>
                </td>
                <td className="px-3 py-2">{r.verifiedOwner ? '✓' : '—'}</td>
                <td className="px-3 py-2 text-zinc-500">{r.dateCreated.slice(0, 10)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState message={reviews.isLoading ? 'Loading…' : 'No reviews yet.'} />
        )}
      </div>
    </div>
  );
}
