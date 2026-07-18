import { createSpcndCore, type SpcndCore } from '@spacendigital/core';
import { migrate, sqlite } from '@spacendigital/db';

export async function createTestCore(): Promise<SpcndCore> {
  const db = await sqlite(':memory:').connect();
  await migrate(db);
  return createSpcndCore({ db });
}

export const US_BILLING = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  company: '',
  address1: '1 Analytical Way',
  address2: '',
  city: 'San Francisco',
  state: 'CA',
  postcode: '94103',
  country: 'US',
  email: 'ada@example.com',
  phone: '415 555 0100',
};
