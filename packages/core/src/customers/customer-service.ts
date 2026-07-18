import type { SpcndDb } from '@spacendigital/db';
import type { TypedBus } from '@spacendigital/plugin-system';
import type { Address, AddressType, PaginatedResult } from '@spacendigital/types';
import { EMPTY_ADDRESS } from '@spacendigital/types';
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import type { Customer, CustomerAddress } from '../entities.js';
import { NotFoundError, SpcndError } from '../errors.js';
import { customerCreated, customerDeleted, customerUpdated } from '../events.js';
import { nowIso } from '../utils.js';

export interface CreateCustomerInput {
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  username?: string;
  role?: Customer['role'];
  /**
   * Pre-computed credential hash from @spacendigital/auth. Core never hashes
   * credentials itself; rows created without one carry '' and cannot log in
   * until the auth package binds a credential.
   */
  passwordHash?: string;
  billing?: Partial<Address>;
  shipping?: Partial<Address>;
}

export interface UpdateCustomerInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  username?: string;
  role?: Customer['role'];
  passwordHash?: string;
  billing?: Partial<Address>;
  shipping?: Partial<Address>;
}

export interface CustomerListQuery {
  page?: number;
  perPage?: number;
  /** LIKE match against email, first/last and display name. */
  search?: string;
  role?: Customer['role'];
  orderBy?: 'id' | 'date' | 'name' | 'email' | 'total_spent' | 'order_count';
  order?: 'asc' | 'desc';
}

interface Deps {
  db: SpcndDb;
  bus: TypedBus;
}

/** Customer CRUD + the per-type (billing/shipping) address book. */
export class CustomerService {
  constructor(private readonly deps: Deps) {}

  // --- Reads ---------------------------------------------------------------

  async get(id: number): Promise<Customer> {
    const customer = await this.find(id);
    if (!customer) throw new NotFoundError('Customer', id);
    return customer;
  }

  async find(id: number): Promise<Customer | undefined> {
    const { db } = this.deps;
    const rows = await db.drizzle
      .select()
      .from(db.schema.customers)
      .where(eq(db.schema.customers.id, id));
    return rows[0];
  }

  async findByEmail(email: string): Promise<Customer | undefined> {
    const { db } = this.deps;
    const rows = await db.drizzle
      .select()
      .from(db.schema.customers)
      .where(eq(db.schema.customers.email, email.toLowerCase()));
    return rows[0];
  }

  async list(query: CustomerListQuery = {}): Promise<PaginatedResult<Customer>> {
    const { db } = this.deps;
    const s = db.schema;
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.perPage ?? 10));

    const conds = [];
    if (query.role) conds.push(eq(s.customers.role, query.role));
    if (query.search) {
      const term = `%${query.search}%`;
      conds.push(
        or(
          like(s.customers.email, term),
          like(s.customers.firstName, term),
          like(s.customers.lastName, term),
          like(s.customers.displayName, term),
        ),
      );
    }
    const where = conds.length > 0 ? and(...conds) : undefined;
    const orderColumn = {
      id: s.customers.id,
      date: s.customers.dateCreated,
      name: s.customers.displayName,
      email: s.customers.email,
      total_spent: s.customers.totalSpent,
      order_count: s.customers.orderCount,
    }[query.orderBy ?? 'id'];
    const orderBy = (query.order === 'desc' ? desc : asc)(orderColumn);

    const base = db.drizzle.select().from(s.customers);
    const rows = await (where ? base.where(where) : base)
      .orderBy(orderBy, asc(s.customers.id))
      .limit(perPage)
      .offset((page - 1) * perPage);
    const countBase = db.drizzle.select({ count: sql<number>`count(*)` }).from(s.customers);
    const total = Number((await (where ? countBase.where(where) : countBase))[0]?.count ?? 0);

    return { items: rows, total, totalPages: Math.ceil(total / perPage), page, perPage };
  }

  // --- Writes --------------------------------------------------------------

  async create(input: CreateCustomerInput): Promise<Customer> {
    const { db, bus } = this.deps;
    const s = db.schema;
    const email = input.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new SpcndError(`"${input.email}" is not a valid email address`, 'registration-error-invalid-email');
    }
    if (await this.findByEmail(email)) {
      throw new SpcndError(
        'An account is already registered with your email address.',
        'registration-error-email-exists',
      );
    }
    const now = nowIso();
    const customer = await db.transaction(async (tx) => {
      await tx.drizzle.insert(s.customers).values({
        email,
        passwordHash: input.passwordHash ?? '',
        firstName: input.firstName ?? '',
        lastName: input.lastName ?? '',
        displayName:
          input.displayName ??
          ([input.firstName, input.lastName].filter(Boolean).join(' ') || email.split('@')[0] || email),
        username: input.username ?? email.split('@')[0],
        role: input.role ?? 'customer',
        dateCreated: now,
        dateModified: now,
      });
      const row = (await tx.drizzle.select().from(s.customers).where(eq(s.customers.email, email)))[0];
      if (!row) throw new SpcndError('Customer insert failed', 'customer_insert_failed', 500);
      if (input.billing) await this.writeAddress(tx, row.id, 'billing', input.billing);
      if (input.shipping) await this.writeAddress(tx, row.id, 'shipping', input.shipping);
      return row;
    });
    await bus.emit(customerCreated, customer);
    return customer;
  }

  async update(id: number, input: UpdateCustomerInput): Promise<Customer> {
    const { db, bus } = this.deps;
    const s = db.schema;
    const existing = await this.get(id);
    const { billing, shipping, ...fields } = input;
    if (fields.email) {
      fields.email = fields.email.trim().toLowerCase();
      if (fields.email !== existing.email && (await this.findByEmail(fields.email))) {
        throw new SpcndError('Email already in use', 'registration-error-email-exists');
      }
    }
    const updated = await db.transaction(async (tx) => {
      await tx.drizzle
        .update(s.customers)
        .set({ ...fields, dateModified: nowIso() })
        .where(eq(s.customers.id, id));
      if (billing) await this.writeAddress(tx, id, 'billing', billing);
      if (shipping) await this.writeAddress(tx, id, 'shipping', shipping);
      const row = (await tx.drizzle.select().from(s.customers).where(eq(s.customers.id, id)))[0];
      if (!row) throw new NotFoundError('Customer', id);
      return row;
    });
    await bus.emit(customerUpdated, updated);
    return updated;
  }

  /** Orders keep their rows (customer_id → NULL via FK); addresses cascade away. */
  async delete(id: number): Promise<void> {
    const { db, bus } = this.deps;
    await this.get(id);
    await db.drizzle.delete(db.schema.customers).where(eq(db.schema.customers.id, id));
    await bus.emit(customerDeleted, { id });
  }

  /**
   * Guest→registered conversion (WC checkout "create an account"): persists
   * the customer row from the guest's checkout data only.
   *
   * TODO:security-blocked — see docs/SECURITY_WORK.md item S4: the credential
   * creation/binding step is deferred to @spacendigital/auth; until it lands the
   * row carries an empty password_hash and cannot authenticate.
   */
  async registerFromGuest(input: {
    email: string;
    firstName?: string;
    lastName?: string;
    billing?: Partial<Address>;
    shipping?: Partial<Address>;
  }): Promise<Customer> {
    return this.create({ ...input, role: 'customer' });
  }

  /** Bump denormalized totals when an order's sales are recorded. */
  async recordOrderTotals(tx: SpcndDb, customerId: number, orderTotal: string): Promise<void> {
    const s = tx.schema;
    await tx.drizzle
      .update(s.customers)
      .set({
        isPayingCustomer: true,
        orderCount: sql`${s.customers.orderCount} + 1`,
        totalSpent: sql`${s.customers.totalSpent} + ${orderTotal}`,
        dateModified: nowIso(),
      })
      .where(eq(s.customers.id, customerId));
  }

  // --- Addresses -----------------------------------------------------------

  async getAddress(customerId: number, type: AddressType): Promise<Address> {
    const { db } = this.deps;
    const s = db.schema;
    const rows = await db.drizzle
      .select()
      .from(s.customerAddresses)
      .where(and(eq(s.customerAddresses.customerId, customerId), eq(s.customerAddresses.type, type)));
    const row = rows[0];
    if (!row) return { ...EMPTY_ADDRESS };
    return toAddress(row);
  }

  async setAddress(customerId: number, type: AddressType, address: Partial<Address>): Promise<void> {
    const { db, bus } = this.deps;
    await this.get(customerId);
    await db.transaction(async (tx) => this.writeAddress(tx, customerId, type, address));
    const customer = await this.get(customerId);
    await bus.emit(customerUpdated, customer);
  }

  private async writeAddress(
    tx: SpcndDb,
    customerId: number,
    type: AddressType,
    address: Partial<Address>,
  ): Promise<void> {
    const s = tx.schema;
    const existing = await tx.drizzle
      .select({ id: s.customerAddresses.id })
      .from(s.customerAddresses)
      .where(and(eq(s.customerAddresses.customerId, customerId), eq(s.customerAddresses.type, type)));
    const values = {
      firstName: address.firstName ?? '',
      lastName: address.lastName ?? '',
      company: address.company ?? '',
      address1: address.address1 ?? '',
      address2: address.address2 ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      postcode: address.postcode ?? '',
      country: address.country ?? '',
      email: address.email ?? null,
      phone: address.phone ?? '',
    };
    if (existing[0]) {
      await tx.drizzle
        .update(s.customerAddresses)
        .set(values)
        .where(eq(s.customerAddresses.id, existing[0].id));
    } else {
      await tx.drizzle.insert(s.customerAddresses).values({ customerId, type, ...values });
    }
  }
}

function toAddress(row: CustomerAddress): Address {
  return {
    firstName: row.firstName,
    lastName: row.lastName,
    company: row.company,
    address1: row.address1,
    address2: row.address2,
    city: row.city,
    state: row.state,
    postcode: row.postcode,
    country: row.country,
    email: row.email ?? '',
    phone: row.phone,
  };
}
