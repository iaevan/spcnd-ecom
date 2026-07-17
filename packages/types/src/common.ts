import type { MediaId } from './brands.js';

/** Flat address shape shared by orders, customers and tax lookups. */
export interface Address {
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

export const EMPTY_ADDRESS: Address = {
  firstName: '',
  lastName: '',
  company: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  postcode: '',
  country: '',
  email: '',
  phone: '',
};

/** WC-shaped meta data entry, used on order items and via the compat layer. */
export interface MetaDataEntry {
  id?: number;
  key: string;
  value: unknown;
}

/** Tax amounts keyed by tax rate id, stored as fixed 4-decimal strings. */
export interface ItemTaxes {
  total: Record<string, string>;
  subtotal?: Record<string, string>;
}

export interface ProductDownload {
  id: string;
  name: string;
  file: string;
}

/** Product attribute as stored in the products.attributes JSONB column. */
export interface ProductAttributeData {
  id: number;
  name: string;
  position: number;
  visible: boolean;
  variation: boolean;
  options: string[];
}

export interface DefaultAttributeData {
  id: number;
  name: string;
  option: string;
}

export type RatingCounts = Record<'1' | '2' | '3' | '4' | '5', number>;

export const EMPTY_RATING_COUNTS: RatingCounts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

export type GalleryImageIds = MediaId[];

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
}
