import { bigint, customType, decimal } from 'drizzle-orm/mysql-core';

/** DECIMAL(19,4) money — mysql2 returns DECIMAL as string. */
export const money = (name: string) => decimal(name, { precision: 19, scale: 4 });

/** DECIMAL(12,3) stock quantities exposed as JS number. */
export const stock = customType<{ data: number; driverData: string }>({
  dataType: () => 'decimal(12, 3)',
  fromDriver: (value) => Number(value),
  toDriver: (value) => value.toFixed(3),
});

/** DECIMAL(3,2) ratings exposed as JS number. */
export const num2 = customType<{ data: number; driverData: string }>({
  dataType: () => 'decimal(3, 2)',
  fromDriver: (value) => Number(value),
  toDriver: (value) => value.toFixed(2),
});

function toMySqlDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
}

/**
 * DATETIME(3) storing UTC (connections are opened with timezone 'Z'), exposed
 * as an ISO-8601 UTC string in app code.
 */
export const ts = customType<{ data: string; driverData: Date | string }>({
  dataType: () => 'datetime(3)',
  fromDriver: (value) =>
    value instanceof Date ? value.toISOString() : new Date(`${value.replace(' ', 'T')}Z`).toISOString(),
  toDriver: (value) => toMySqlDatetime(value),
});

export const id = () => bigint('id', { mode: 'number' }).autoincrement().primaryKey();
export const ref = (name: string) => bigint(name, { mode: 'number' });
