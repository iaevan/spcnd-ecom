/**
 * All money arithmetic in spcnd-ecom happens on integers. A Money value is an
 * integer count of minor units at 4 decimal places — the exact resolution of
 * the NUMERIC(19,4) storage columns — so DB round-trips are lossless and no
 * float ever touches a price (docs/AGENTS.md §12).
 */

export const MONEY_DECIMALS = 4;
const MONEY_SCALE = 10 ** MONEY_DECIMALS;

/**
 * PHP's round(): half away from zero. WC rounds with PHP semantics, and
 * JS Math.round differs for negative halves, so every rounding step in the
 * calculation engines goes through this.
 */
export function roundHalfAwayFromZero(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  // Counter float artifacts like 1.0000000000000002 before rounding.
  const nudged = Number(scaled.toPrecision(12));
  const rounded = Math.sign(nudged) * Math.round(Math.abs(nudged));
  return rounded / factor;
}

function parseDecimalToMinor(input: string, scaleDecimals: number): number {
  const trimmed = input.trim();
  if (trimmed === '') return 0;
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(trimmed.replace(/,/g, ''));
  if (!match) throw new TypeError(`Invalid decimal string: ${JSON.stringify(input)}`);
  const [, sign, intPart = '', fracRaw = ''] = match;
  const frac = fracRaw.slice(0, scaleDecimals).padEnd(scaleDecimals, '0');
  const overflowDigit = fracRaw.length > scaleDecimals ? Number(fracRaw[scaleDecimals]) : 0;
  let minor = Number(intPart || '0') * 10 ** scaleDecimals + Number(frac || '0');
  if (overflowDigit >= 5) minor += 1;
  return sign === '-' ? -minor : minor;
}

/** Immutable integer-backed money value with 4 decimal places of resolution. */
export class Money {
  private constructor(readonly minor: number) {
    if (!Number.isSafeInteger(minor)) {
      throw new RangeError(`Money out of safe integer range: ${minor}`);
    }
  }

  static readonly ZERO = new Money(0);

  /** Parse a decimal amount ("12.34", 12.34) into Money without float drift. */
  static fromDecimal(value: string | number | null | undefined): Money {
    if (value === null || value === undefined || value === '') return Money.ZERO;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new TypeError(`Invalid money number: ${value}`);
      return new Money(Math.round(Number((value * MONEY_SCALE).toPrecision(12))));
    }
    return new Money(parseDecimalToMinor(value, MONEY_DECIMALS));
  }

  /** Wrap an integer count of 1/10000ths. */
  static fromMinor(minor: number): Money {
    return new Money(Math.trunc(minor));
  }

  /** Read a NUMERIC(19,4) column value. Accepts what each driver returns. */
  static fromDb(value: string | number | null | undefined): Money {
    return Money.fromDecimal(value);
  }

  add(other: Money): Money {
    return new Money(this.minor + other.minor);
  }

  sub(other: Money): Money {
    return new Money(this.minor - other.minor);
  }

  /** Multiply by an integer quantity. */
  times(qty: number): Money {
    return new Money(this.minor * Math.trunc(qty));
  }

  /** Multiply by an arbitrary ratio, rounding half away from zero. */
  mul(ratio: number): Money {
    return new Money(roundHalfAwayFromZero(this.minor * ratio));
  }

  /** Divide, rounding half away from zero. */
  div(divisor: number): Money {
    if (divisor === 0) throw new RangeError('Division by zero');
    return new Money(roundHalfAwayFromZero(this.minor / divisor));
  }

  neg(): Money {
    return new Money(-this.minor);
  }

  abs(): Money {
    return new Money(Math.abs(this.minor));
  }

  isZero(): boolean {
    return this.minor === 0;
  }

  isNegative(): boolean {
    return this.minor < 0;
  }

  isPositive(): boolean {
    return this.minor > 0;
  }

  cmp(other: Money): -1 | 0 | 1 {
    if (this.minor < other.minor) return -1;
    if (this.minor > other.minor) return 1;
    return 0;
  }

  lt(other: Money): boolean {
    return this.minor < other.minor;
  }

  lte(other: Money): boolean {
    return this.minor <= other.minor;
  }

  gt(other: Money): boolean {
    return this.minor > other.minor;
  }

  gte(other: Money): boolean {
    return this.minor >= other.minor;
  }

  static min(a: Money, b: Money): Money {
    return a.minor <= b.minor ? a : b;
  }

  static max(a: Money, b: Money): Money {
    return a.minor >= b.minor ? a : b;
  }

  static sum(values: Iterable<Money>): Money {
    let total = 0;
    for (const v of values) total += v.minor;
    return new Money(total);
  }

  /** Round to `decimals` places (display or per-line rounding), staying Money. */
  round(decimals: number): Money {
    const keep = 10 ** (MONEY_DECIMALS - decimals);
    return new Money(roundHalfAwayFromZero(this.minor / keep) * keep);
  }

  /** Numeric value (floats allowed at the display edge only). */
  toNumber(): number {
    return this.minor / MONEY_SCALE;
  }

  /** Fixed 4-decimal string, the storage format for NUMERIC(19,4) columns. */
  toDbString(): string {
    const sign = this.minor < 0 ? '-' : '';
    const abs = Math.abs(this.minor);
    const intPart = Math.floor(abs / MONEY_SCALE);
    const frac = String(abs % MONEY_SCALE).padStart(MONEY_DECIMALS, '0');
    return `${sign}${intPart}.${frac}`;
  }

  /** Decimal string rounded to `decimals` places (WC displays at 2 by default). */
  toFixed(decimals: number): string {
    const rounded = this.round(decimals);
    const sign = rounded.minor < 0 ? '-' : '';
    const abs = Math.abs(rounded.minor);
    const intPart = Math.floor(abs / MONEY_SCALE);
    const fracFull = String(abs % MONEY_SCALE).padStart(MONEY_DECIMALS, '0');
    return decimals <= 0
      ? `${sign}${intPart}`
      : `${sign}${intPart}.${fracFull.slice(0, decimals).padEnd(decimals, '0')}`;
  }

  toString(): string {
    return this.toDbString();
  }

  toJSON(): string {
    return this.toDbString();
  }
}

/**
 * WC-style precision helpers (wc_add_number_precision / wc_remove_number_precision):
 * shift a decimal value into integer space at the given precision.
 */
export function addNumberPrecision(value: number, precision = MONEY_DECIMALS): number {
  return roundHalfAwayFromZero(value * 10 ** precision);
}

export function removeNumberPrecision(value: number, precision = MONEY_DECIMALS): number {
  return value / 10 ** precision;
}
