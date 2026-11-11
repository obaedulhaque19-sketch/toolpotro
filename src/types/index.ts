import type { Timestamp } from 'firebase/firestore';

export type Language = 'en' | 'bn' | 'hi';

export type SoftwareCategory = 'desktop' | 'android' | 'extension' | 'utility';
export type SoftwarePlatform = 'Windows' | 'Android' | 'Chrome' | 'macOS' | 'Cross-Platform';
export type SoftwareFileType = '.exe' | '.zip' | '.apk' | 'Store Link';
export type SoftwareStatus = 'active' | 'archived';

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
  installGuide?: string;
  price: number;
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
