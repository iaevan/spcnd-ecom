import {
  ANALYTICS_SYNC,
  customerCreated,
  customerUpdated,
  orderStatusChanged,
  SPCND_DB,
} from '@spacendigital/core';
import { defineSpcndPlugin } from '@spacendigital/plugin-system';
import { DbAnalyticsSync } from './sync.js';

export { DbAnalyticsSync, REPORTING_STATUSES, rebuildAllLookups } from './sync.js';
export * from './reports.js';

/**
 * Registers the sync engine (order creation/recalc call it inside their own
 * transactions via core's OrderService) and re-syncs on the events that
 * change lookup-relevant state outside those paths: status transitions and
 * customer writes.
 */
export const AnalyticsPlugin = defineSpcndPlugin({
  id: 'spacendigital/analytics',
  version: '0.1.0',
  setup({ bus, container }) {
    const sync = new DbAnalyticsSync();
    container.register(ANALYTICS_SYNC, sync);
    const db = () => container.resolve(SPCND_DB);

    bus.on(orderStatusChanged, async ({ orderId }) => {
      await db().transaction(async (tx) => sync.syncOrder(tx, orderId));
    });
    bus.on(customerCreated, async (customer) => {
      await db().transaction(async (tx) => sync.syncCustomer(tx, customer.id));
    });
    bus.on(customerUpdated, async (customer) => {
      await db().transaction(async (tx) => sync.syncCustomer(tx, customer.id));
    });
  },
});

export default AnalyticsPlugin;
