import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

export const STARTER_SOFTWARE = [
  {
    id: 'potro-sync-desktop',
    name: 'PotroSync Studio',
    slug: 'potro-sync-desktop',
    tagline: 'High-speed local folder mirroring and encrypted archive utility for Windows.',
    description:
      'PotroSync Studio is a lightweight Windows desktop utility engineered for developers and creators who need deterministic folder synchronization, SHA-256 checksum verification, and zero-bloat background backups.',
    category: 'desktop',
    platform: 'Windows',
    fileType: '.exe',
    version: 'v2.4.1',
    fileSize: '18.4 MB',
    downloadUrl: 'https://github.com/toolpotro/releases/download/v2.4.1/PotroSync-Setup.exe',
    thumbnailUrl: '/src/assets/images/app_preview_desktop_1794404736026.jpg',
    installGuide:
      '1. Download PotroSync-Setup.exe.\n2. Run the signed installer and choose your target directory.\n3. Launch PotroSync Studio from the Start Menu and select your first sync pair.',
    price: 0,
    downloadsCount: 1420,
    status: 'active',
    featured: true,
  },
  {
    id: 'netguard-apk',
    name: 'NetGuard Monitor',
    slug: 'netguard-apk',
    tagline: 'Clean Android network diagnostics, DNS latency tracker, and Wi-Fi analyzer.',
    description:
      'NetGuard Monitor gives Android power users real-time insight into packet latency, DNS resolution speed, and local network devices—with zero background telemetry or intrusive ads.',
    category: 'android',
    platform: 'Android',
    fileType: '.apk',
    version: 'v1.9.0',
    fileSize: '11.2 MB',
    downloadUrl: 'https://github.com/toolpotro/releases/download/v1.9.0/NetGuard-Monitor.apk',
    thumbnailUrl: '/src/assets/images/app_preview_mobile_1794404735226.jpg',
    installGuide:
      '1. Download NetGuard-Monitor.apk to your Android phone.\n2. Enable "Install unknown apps" for your browser in Android Settings.\n3. Tap the APK file and confirm installation.',
    price: 0,
    downloadsCount: 2890,
    status: 'active',
    featured: true,
  },
  {
    id: 'focusflow-extension',
    name: 'FocusFlow Blocker',
    slug: 'focusflow-extension',
    tagline: 'Distraction-free tab timer and workspace session manager for Chromium.',
    description:
      'FocusFlow Blocker helps engineers and writers stay in deep work by scheduling site blocks, tracking focus intervals, and saving clean tab sessions locally without cloud tracking.',
    category: 'extension',
    platform: 'Chrome',
    fileType: '.zip',
    version: 'v3.1.2',
    fileSize: '2.6 MB',
    downloadUrl: 'https://github.com/toolpotro/releases/download/v3.1.2/FocusFlow-Extension.zip',
    thumbnailUrl: '/src/assets/images/app_preview_extension_1794404735775.jpg',
    installGuide:
      '1. Download and extract FocusFlow-Extension.zip.\n2. Open chrome://extensions in Chrome, Edge, or Brave.\n3. Enable Developer Mode and click "Load unpacked" on the extracted folder.',
    price: 19,
    downloadsCount: 965,
    status: 'active',
    featured: true,
  },
];

export const STARTER_COUPON = {
  id: 'LAUNCH25',
  code: 'LAUNCH25',
  discountType: 'percentage',
  discountValue: 25,
  scope: 'all',
  targetSoftwareIds: [],
  expiryDate: '2027-12-31',
  usageLimit: 500,
  usedCount: 0,
  active: true,
};

export async function seedStarterCatalog() {
  for (const item of STARTER_SOFTWARE) {
    try {
      await setDoc(doc(db, 'software', item.id), {
        ...item,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `software/${item.id}`);
    }
  }

  try {
    await setDoc(doc(db, 'coupons', STARTER_COUPON.id), {
      ...STARTER_COUPON,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `coupons/${STARTER_COUPON.id}`);
  }
}
