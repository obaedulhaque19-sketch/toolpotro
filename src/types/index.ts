import type { Timestamp } from 'firebase/firestore';

export type Language = 'en' | 'bn' | 'hi';

export type SoftwareCategory = 'desktop' | 'android' | 'extension' | 'utility';
export type SoftwarePlatform = 'Windows' | 'Android' | 'Chrome' | 'macOS' | 'Cross-Platform';
export type SoftwareFileType = '.exe' | '.zip' | '.apk' | 'Store Link';
export type SoftwareStatus = 'active' | 'archived';
export type SoftwarePricingMode = 'free' | 'paid_download' | 'freemium_license';
export type CurrencyCode = 'USD' | 'BDT';

export interface SubscriptionPlan {
  id: string;
  name: string;
  durationDays: number;
  price: number;
  badge?: string;
  description?: string;
}

export interface SoftwareItem {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category: SoftwareCategory;
  platform: SoftwarePlatform;
  fileType: SoftwareFileType;
  version: string;
  fileSize: string;
  downloadUrl: string;
  thumbnailUrl?: string;
  screenshots?: string[];
  installGuide?: string;
  price: number;
  pricingMode?: SoftwarePricingMode;
  currency?: CurrencyCode;
  plans?: SubscriptionPlan[];
  generateLicenseKey?: boolean;
  gracePeriodHours?: number;
  maxDevices?: number;
  downloadsCount: number;
  status: SoftwareStatus;
  featured: boolean;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export type DiscountType = 'percentage' | 'flat';
export type CouponScope = 'all' | 'specific';

export interface CouponCode {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  scope: CouponScope;
  targetSoftwareIds: string[];
  expiryDate: string;
  usageLimit: number;
  usedCount: number;
  active: boolean;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export interface DownloadEvent {
  id: string;
  softwareId: string;
  softwareName: string;
  platform: string;
  couponCode?: string;
  finalPrice: number;
  createdAt?: Timestamp | Date | string;
}

export type PaymentMethod = 'bkash' | 'nagad' | 'free';
export type LicenseStatus = 'provisional' | 'verified' | 'payment_required' | 'revoked';

export interface PaymentOrder {
  id: string;
  orderId: string;
  softwareId: string;
  softwareName: string;
  planId?: string;
  planName?: string;
  durationDays?: number;
  currency: CurrencyCode;
  amount: number;
  couponCode?: string;
  paymentMethod: PaymentMethod;
  customerName: string;
  customerEmail: string;
  senderPhone: string;
  trxId: string;
  licenseKey?: string;
  status: LicenseStatus;
  graceUntilMs: number;
  expiresAtMs: number;
  notes?: string;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export interface LicenseRecord {
  id: string;
  licenseKey: string;
  orderId: string;
  softwareId: string;
  softwareName: string;
  planId?: string;
  planName?: string;
  durationDays?: number;
  currency: CurrencyCode;
  amount: number;
  trxId: string;
  status: LicenseStatus;
  graceUntilMs: number;
  expiresAtMs: number;
  maxDevices: number;
  boundDevices: string[];
  resubmittedTrxId?: string;
  resubmittedPhone?: string;
  resubmittedAtMs?: number;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export interface SmsTransaction {
  id: string;
  trxId: string;
  provider: 'bkash' | 'nagad';
  sender?: string;
  amount: number;
  senderPhone?: string;
  rawMessage?: string;
  receivedAtMs: number;
  matchedOrderId?: string;
  matchedLicenseKey?: string;
  status: 'unused' | 'matched' | 'ignored';
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export interface PaymentDisplaySettings {
  bkashNumber: string;
  nagadNumber: string;
  bkashEnabled: boolean;
  nagadEnabled: boolean;
  paymentNote: string;
  defaultGraceHours: number;
}
