import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/products', label: 'Products' },
  { to: '/orders', label: 'Orders' },
  { to: '/customers', label: 'Customers' },
  { to: '/coupons', label: 'Coupons' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/tax', label: 'Tax' },
  { to: '/shipping', label: 'Shipping' },
  { to: '/settings', label: 'Settings' },
  { to: '/webhooks', label: 'Webhooks' },
  { to: '/system-status', label: 'System status' },
];

export function App() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-4 py-4">
          <span className="text-lg font-bold text-violet-700">spcnd-ecom</span>
          <span className="ml-2 text-xs text-zinc-400">admin</span>
        </div>
        <nav className="space-y-0.5 p-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-violet-50 font-medium text-violet-700'
                    : 'text-zinc-600 hover:bg-zinc-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
