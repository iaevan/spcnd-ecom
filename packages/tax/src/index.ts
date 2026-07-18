import { SETTINGS_SERVICE, SPCND_DB, TAX_SERVICE } from '@spacendigital/core';
import { defineSpcndPlugin } from '@spacendigital/plugin-system';
import { DbTaxService } from './tax-service.js';

export { DbTaxService, calcExclusiveTax, calcInclusiveTax } from './tax-service.js';

/** Registers the TaxService implementation in the app container. */
export const TaxPlugin = defineSpcndPlugin({
  id: 'spacendigital/tax',
  version: '0.1.0',
  setup({ bus, container }) {
    container.registerFactory(TAX_SERVICE, (c) => {
      return new DbTaxService({
        db: c.resolve(SPCND_DB),
        settings: c.resolve(SETTINGS_SERVICE),
        bus,
      });
    });
  },
});

export default TaxPlugin;
