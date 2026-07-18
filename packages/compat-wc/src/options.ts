import {
  SETTING_DEFINITIONS,
  type SettingsService,
  currencySymbol,
} from '@spacendigital/core';
import { Money } from '@spacendigital/types';

/**
 * `get_option` / `update_option` shim (DECISION-6): canonical keys are the WC
 * option names with the `woocommerce_` prefix stripped; this shim restores
 * the WC surface — prefixed names in, `'yes'`/`'no'` strings out for
 * booleans — so WC-porting plugin code reads settings unchanged.
 */
export interface WcOptionsShim {
  getOption(name: string, defaultValue?: unknown): Promise<unknown>;
  updateOption(name: string, value: unknown): Promise<void>;
  getWoocommerceCurrency(): Promise<string>;
  getWoocommerceCurrencySymbol(code?: string): Promise<string>;
  wcGetPriceDecimals(): Promise<number>;
  /** `wc_price` — formatted amount per store currency settings (plain text). */
  wcPrice(amount: string | number): Promise<string>;
}

const PREFIX = 'woocommerce_';

function stripPrefix(name: string): string {
  return name.startsWith(PREFIX) ? name.slice(PREFIX.length) : name;
}

export function createOptionsShim(settings: SettingsService): WcOptionsShim {
  return {
    /** WC returns `false` for missing options; booleans come back 'yes'/'no'. */
    async getOption(name, defaultValue = false) {
      const key = stripPrefix(name);
      const kind = SETTING_DEFINITIONS[key]?.kind;
      const value = await settings.get(key);
      if (value === undefined) return defaultValue;
      if (kind === 'boolean') return (await settings.getBool(key)) ? 'yes' : 'no';
      if (kind === 'integer') return String(await settings.getInt(key));
      return value;
    },

    async updateOption(name, value) {
      await settings.set(stripPrefix(name), value);
    },

    async getWoocommerceCurrency() {
      return settings.getString('currency');
    },

    async getWoocommerceCurrencySymbol(code) {
      return currencySymbol(code ?? (await settings.getString('currency')));
    },

    async wcGetPriceDecimals() {
      return settings.getInt('price_num_decimals');
    },

    async wcPrice(amount) {
      const decimals = await settings.getInt('price_num_decimals');
      const thousandSep = await settings.getString('price_thousand_sep');
      const decimalSep = await settings.getString('price_decimal_sep');
      const position = await settings.getString('currency_pos');
      const symbol = currencySymbol(await settings.getString('currency'));

      const money = typeof amount === 'number' ? Money.fromDecimal(amount) : Money.fromDb(amount);
      const fixed = money.abs().toFixed(decimals);
      const [intPart = '0', fracPart] = fixed.split('.');
      const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
      const number = fracPart !== undefined ? `${grouped}${decimalSep}${fracPart}` : grouped;
      const sign = money.isNegative() ? '-' : '';

      switch (position) {
        case 'right':
          return `${sign}${number}${symbol}`;
        case 'left_space':
          return `${sign}${symbol} ${number}`;
        case 'right_space':
          return `${sign}${number} ${symbol}`;
        default:
          return `${sign}${symbol}${number}`;
      }
    },
  };
}
