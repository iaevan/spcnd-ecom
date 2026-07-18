import { SHIPPING_SERVICE, SPCND_DB } from '@spacendigital/core';
import { defineSpcndPlugin } from '@spacendigital/plugin-system';
import { DbShippingService } from './shipping-service.js';

export { evaluateCost } from './cost-expression.js';
export {
  DbShippingService,
  type FlatRateSettings,
  type FreeShippingSettings,
  type LocalPickupSettings,
} from './shipping-service.js';

/** Registers the ShippingService implementation in the app container. */
export const ShippingPlugin = defineSpcndPlugin({
  id: 'spacendigital/shipping',
  version: '0.1.0',
  setup({ bus, container }) {
    container.registerFactory(SHIPPING_SERVICE, (c) => {
      return new DbShippingService({ db: c.resolve(SPCND_DB), bus });
    });
  },
});

export default ShippingPlugin;
