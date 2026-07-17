import { Money } from '@spcnd-ecom/types';
import { customType, integer, text } from 'drizzle-orm/sqlite-core';

/**
 * SQLite stores money as INTEGER minor units at 4 decimal places (exact and
 * SQL-comparable — see DECISIONS.md) but exposes the same fixed 4-decimal
 * string every dialect exposes, so app code never sees the difference.
 */
export const money = customType<{ data: string; driverData: number }>({
  dataType: () => 'integer',
  fromDriver: (value) => Money.fromMinor(value).toDbString(),
  toDriver: (value) => Money.fromDecimal(value).minor,
});

/** Stock quantities: INTEGER milli-units on SQLite, exposed as JS number (3dp). */
export const stock = customType<{ data: number; driverData: number }>({
  dataType: () => 'integer',
  fromDriver: (value) => value / 1000,
  toDriver: (value) => Math.round(value * 1000),
});

/** Ratings etc: NUMERIC(3,2)-shaped, stored as INTEGER hundredths. */
export const num2 = customType<{ data: number; driverData: number }>({
  dataType: () => 'integer',
  fromDriver: (value) => value / 100,
  toDriver: (value) => Math.round(value * 100),
});

export const id = () => integer('id').primaryKey({ autoIncrement: true });
export const ts = (name: string) => text(name);
export const bool = (name: string) => integer(name, { mode: 'boolean' });
export const json = (name: string) => text(name, { mode: 'json' });
export const bigintNum = (name: string) => integer(name);
export { integer as int, text };
