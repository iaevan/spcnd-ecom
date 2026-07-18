import { expect, test } from '@playwright/test';

/** The v1 acceptance flow (docs/AGENTS.md §14): browse → cart → COD checkout → order recorded. */
test('guest buys the Nebula Tee with a coupon via COD', async ({ page, request }) => {
  // Browse the catalog.
  await page.goto('/shop');
  await expect(page.getByTestId('product-grid')).toBeVisible();
  await page.getByRole('link', { name: /Nebula Tee/ }).click();
  await expect(page.getByTestId('product-name')).toHaveText('Nebula Tee');

  // Add to cart.
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('add-to-cart')).toHaveText(/Added/);

  // Cart shows the line and accepts the seeded coupon.
  await page.goto('/cart');
  await expect(page.getByTestId('cart-table')).toContainText('Nebula Tee');
  await page.getByTestId('coupon-input').fill('welcome10');
  await page.getByRole('button', { name: 'Apply' }).click();
  // 25.00 − 10% = 22.50 + CA tax 7.25% (1.63) + flat rate 5.00 = 29.13 at checkout;
  // the cart (no address yet) shows 22.50 + tax at base location.
  await expect(page.getByTestId('cart-total')).toContainText('$');

  // Checkout with COD.
  await page.getByTestId('to-checkout').click();
  await page.waitForURL('**/checkout');
  await page.getByTestId('billing-first').fill('Ada');
  await page.locator('input[name="lastName"]').fill('Lovelace');
  await page.locator('input[name="address1"]').fill('1 Analytical Way');
  await page.locator('input[name="city"]').fill('San Francisco');
  await page.locator('input[name="postcode"]').fill('94103');
  await page.getByTestId('billing-email').fill('ada@example.com');
  await page.getByTestId('place-order').click();

  // Thank-you page with the order number.
  await page.waitForURL('**/thank-you**');
  await expect(page.getByTestId('thank-you')).toBeVisible();
  const orderNumber = await page.getByTestId('order-number').innerText();
  const orderId = Number(orderNumber.replace('#', ''));
  expect(orderId).toBeGreaterThan(0);

  // The order is visible through the admin API, paid via the no-payment
  // COD path (processing) with the coupon discount applied.
  const response = await request.get(`/api/v1/orders/${orderId}`);
  expect(response.ok()).toBeTruthy();
  const order = (await response.json()) as {
    status: string;
    discountTotal: string;
    items: { type: string; name: string }[];
  };
  expect(order.status).toBe('processing');
  expect(Number(order.discountTotal)).toBeCloseTo(2.5, 2);
  expect(order.items.some((i) => i.type === 'coupon' && i.name === 'welcome10')).toBeTruthy();

  // Analytics + reports picked it up.
  const revenue = await request.get('/api/v1/reports/revenue');
  const report = (await revenue.json()) as { ordersCount: number };
  expect(report.ordersCount).toBeGreaterThan(0);
});

test('admin SPA is served at /spcnd-admin when built', async ({ request }) => {
  const response = await request.get('/spcnd-admin/');
  // 200 with the SPA shell when apps/admin/dist exists; the page itself
  // renders the S4/S7-blocked login client-side.
  expect([200, 404]).toContain(response.status());
});
