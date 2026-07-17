import { bigint, bigserial, customType, integer, numeric, text } from 'drizzle-orm/pg-core';

/** NUMERIC(19,4) money — node-postgres returns numeric as string with full scale. */
export const money = (name: string) => numeric(name, { precision: 19, scale: 4 });

/** NUMERIC(12,3) stock quantities exposed as JS number. */
export const stock = customType<{ data: number; driverData: string }>({
  dataType: () => 'numeric(12, 3)',
  fromDriver: (value) => Number(value),
  toDriver: (value) => value.toFixed(3),
});

/** NUMERIC(3,2) ratings exposed as JS number. */
export const num2 = customType<{ data: number; driverData: string }>({
  dataType: () => 'numeric(3, 2)',
  fromDriver: (value) => Number(value),
  toDriver: (value) => value.toFixed(2),
});

/** TIMESTAMPTZ exposed as an ISO-8601 UTC string in app code. */
export const ts = customType<{ data: string; driverData: Date | string }>({
  dataType: () => 'timestamp with time zone',
  fromDriver: (value) => new Date(value).toISOString(),
  toDriver: (value) => value,
});

export const id = () => bigserial('id', { mode: 'number' }).primaryKey();
export const ref = (name: string) => bigint(name, { mode: 'number' });
export { integer as int, text };
