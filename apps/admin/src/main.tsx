import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { App } from './App.js';
import './styles.css';
import { CouponsPage } from './pages/Coupons.js';
import { CustomersPage } from './pages/Customers.js';
import { DashboardPage } from './pages/Dashboard.js';
import { LoginPage } from './pages/Login.js';
import { OrderDetailPage } from './pages/OrderDetail.js';
import { OrdersPage } from './pages/Orders.js';
import { ProductEditPage } from './pages/ProductEdit.js';
import { ProductsPage } from './pages/Products.js';
import { ReviewsPage } from './pages/Reviews.js';
import { SettingsPage } from './pages/Settings.js';
import { ShippingPage } from './pages/Shipping.js';
import { SystemStatusPage } from './pages/SystemStatus.js';
import { TaxPage } from './pages/Tax.js';
import { WebhooksPage } from './pages/Webhooks.js';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    {
      path: '/',
      element: <App />,
      children: [
        { index: true, element: <DashboardPage /> },
        { path: 'products', element: <ProductsPage /> },
        { path: 'products/:id', element: <ProductEditPage /> },
        { path: 'orders', element: <OrdersPage /> },
        { path: 'orders/:id', element: <OrderDetailPage /> },
        { path: 'customers', element: <CustomersPage /> },
        { path: 'coupons', element: <CouponsPage /> },
        { path: 'reviews', element: <ReviewsPage /> },
        { path: 'tax', element: <TaxPage /> },
        { path: 'shipping', element: <ShippingPage /> },
        { path: 'settings', element: <SettingsPage /> },
        { path: 'webhooks', element: <WebhooksPage /> },
        { path: 'system-status', element: <SystemStatusPage /> },
      ],
    },
  ],
  { basename: '/spcnd-admin' },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
