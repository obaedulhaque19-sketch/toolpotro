import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  AlertCircle,
  Archive,
  BarChart3,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  Globe,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tag,
  Trash2,
  Unlock,
  Upload,
  Image as ImageIcon,
  FileArchive,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { seedStarterCatalog } from '../lib/seedData';
import { useApp } from '../context/AppContext';
import type {
  CouponCode,
  CouponScope,
  CurrencyCode,
  DiscountType,
  DownloadEvent,
  LicenseRecord,
  LicenseStatus,
  PaymentOrder,
  SmsTransaction,
  SoftwareCategory,
  SoftwareFileType,
  SoftwareItem,
  SoftwarePlatform,
  SoftwarePricingMode,
  SubscriptionPlan,
} from '../types';

type AdminTab = 'software' | 'payments' | 'coupons' | 'analytics' | 'heroBanner' | 'seoSettings';

const DEFAULT_CONTACT_EMAIL = 'obaedulhaque19@gmail.com';
const DEFAULT_FACEBOOK_URL = 'https://www.facebook.com/toolpotro';

const EMPTY_SOFTWARE_FORM = {
  id: '',
  name: '',
  slug: '',
  tagline: '',
  description: '',
  category: 'desktop' as SoftwareCategory,
  platform: 'Windows' as SoftwarePlatform,
  fileType: '.exe' as SoftwareFileType,
  version: 'v1.0.0',
  fileSize: '12.0 MB',
  downloadUrl: '',
  thumbnailUrl: '/src/assets/images/app_preview_desktop_1794404736026.jpg',
  screenshots: [] as string[],
  installGuide: '',
  price: 0,
  pricingMode: 'free' as SoftwarePricingMode,
  currency: 'BDT' as CurrencyCode,
  plans: [] as SubscriptionPlan[],
  generateLicenseKey: false,
  gracePeriodHours: 2,
  maxDevices: 1,
  featured: false,
};

const EMPTY_COUPON_FORM = {
  code: '',
  discountType: 'percentage' as DiscountType,
  discountValue: 20,
  scope: 'all' as CouponScope,
  targetSoftwareIds: [] as string[],
  expiryDate: '2027-12-31',
  usageLimit: 100,
};

export function AdminPage() {
  const {
    t,
    user,
    isAdmin,
    authLoading,
    signInWithGoogle,
    signInWithEmail,
    logout,
  } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('software');
  const [softwareList, setSoftwareList] = useState<SoftwareItem[]>([]);
  const [coupons, setCoupons] = useState<CouponCode[]>([]);
  const [events, setEvents] = useState<DownloadEvent[]>([]);
  const [seeding, setSeeding] = useState(false);

  // Payments, Licenses & SMS Sync State
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [smsList, setSmsList] = useState<SmsTransaction[]>([]);
  const [orderFilter, setOrderFilter] = useState<'all' | LicenseStatus>('all');
  const [bkashNumber, setBkashNumber] = useState('');
  const [nagadNumber, setNagadNumber] = useState('');
  const [bkashEnabled, setBkashEnabled] = useState(true);
  const [nagadEnabled, setNagadEnabled] = useState(true);
  const [paymentNote, setPaymentNote] = useState('');
  const [defaultGraceHours, setDefaultGraceHours] = useState(2);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<{
    webhookSecretConfigured: boolean;
    firebaseAdminConfigured: boolean;
    bufferedReceiptsCount: number;
    unsyncedCount: number;
  } | null>(null);
  const [syncingSms, setSyncingSms] = useState(false);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Software Modal State
  const [showSoftwareModal, setShowSoftwareModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [softwareForm, setSoftwareForm] = useState(EMPTY_SOFTWARE_FORM);
  const [savingSoftware, setSavingSoftware] = useState(false);
  const [packageUploadProgress, setPackageUploadProgress] = useState<number | null>(null);
  const [imageUploadProgress, setImageUploadProgress] = useState<number | null>(null);
  const [screenshotsUploading, setScreenshotsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [githubConfigured, setGithubConfigured] = useState<boolean | null>(null);

  // Hero Banner State
  const [heroBannerUrl, setHeroBannerUrl] = useState<string>('');
  const [heroBannerUploading, setHeroBannerUploading] = useState(false);
  const [heroBannerUploadProgress, setHeroBannerUploadProgress] = useState<number | null>(null);
  const [heroBannerSaving, setHeroBannerSaving] = useState(false);
  const [heroBannerSuccess, setHeroBannerSuccess] = useState(false);
  const [heroBannerError, setHeroBannerError] = useState<string | null>(null);

  // Track original & session-uploaded GitHub Release URLs for automatic orphan cleanup
  const originalSoftwareAssetsRef = useRef<string[]>([]);
  const sessionSoftwareUploadsRef = useRef<string[]>([]);
  const savedHeroBannerRef = useRef<string>('');
  const sessionHeroUploadsRef = useRef<string[]>([]);

  // SEO, Contact & Redirect Settings State
  const [contactEmail, setContactEmail] = useState<string>(DEFAULT_CONTACT_EMAIL);
  const [facebookUrl, setFacebookUrl] = useState<string>(DEFAULT_FACEBOOK_URL);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [slugRedirects, setSlugRedirects] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/github/status')
      .then((r) => r.json())
      .then((d) => setGithubConfigured(Boolean(d.configured)))
      .catch(() => setGithubConfigured(false));
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const uploadToGitHubReleases = async (
    file: File,
    onProgress: (pct: number) => void
  ): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    const idToken = await user.getIdToken();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/github/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${idToken}`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-File-Name', file.name);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300 && res.downloadUrl) {
            resolve(res.downloadUrl);
          } else {
            reject(new Error(res.error || `Upload failed (${xhr.status})`));
          }
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(file);
    });
  };

  const getReferencedGitHubUrls = (excludeIds: string[] = [], excludeHero = false): Set<string> => {
    const excludeSet = new Set(excludeIds);
    const used = new Set<string>();
    for (const s of softwareList) {
      if (excludeSet.has(s.id)) continue;
      if (s.downloadUrl) used.add(s.downloadUrl.trim());
      if (s.thumbnailUrl) used.add(s.thumbnailUrl.trim());
      for (const sc of s.screenshots || []) {
        if (sc) used.add(sc.trim());
      }
    }
    if (!excludeHero && savedHeroBannerRef.current) {
      used.add(savedHeroBannerRef.current.trim());
    }
    return used;
  };

  const deleteGitHubAssets = async (urls: string[]) => {
    if (!user) return;
    const uniqueGitHubUrls = Array.from(
      new Set(
        urls
          .map((u) => u.trim())
          .filter((u) => u.includes('github.com/'))
      )
    );
    if (uniqueGitHubUrls.length === 0) return;

    try {
      const idToken = await user.getIdToken();
      await fetch('/api/github/asset', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls: uniqueGitHubUrls }),
      });
    } catch {
      // Non-fatal cleanup error; never block primary Firestore save/delete
    }
  };

  const handlePackageUpload = async (file: File) => {
    setUploadError(null);
    const detectedSize = formatBytes(file.size);
    const lowerName = file.name.toLowerCase();
    let detectedType: SoftwareFileType = softwareForm.fileType;
    if (lowerName.endsWith('.exe')) detectedType = '.exe';
    else if (lowerName.endsWith('.apk')) detectedType = '.apk';
    else if (lowerName.endsWith('.zip')) detectedType = '.zip';

    setSoftwareForm((prev) => ({
      ...prev,
      fileSize: detectedSize,
      fileType: detectedType,
    }));

    setPackageUploadProgress(0);
    try {
      const url = await uploadToGitHubReleases(file, setPackageUploadProgress);
      sessionSoftwareUploadsRef.current.push(url);
      setSoftwareForm((prev) => ({ ...prev, downloadUrl: url }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Package upload failed');
    } finally {
      setPackageUploadProgress(null);
    }
  };

  const handleThumbnailUpload = async (file: File) => {
    setUploadError(null);
    setImageUploadProgress(0);
    try {
      const url = await uploadToGitHubReleases(file, setImageUploadProgress);
      sessionSoftwareUploadsRef.current.push(url);
      setSoftwareForm((prev) => ({ ...prev, thumbnailUrl: url }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setImageUploadProgress(null);
    }
  };

  const handleScreenshotsUpload = async (files: FileList) => {
    setUploadError(null);
    const remainingSlots = Math.max(0, 10 - softwareForm.screenshots.length);
    const selected = Array.from(files).slice(0, remainingSlots);
    if (selected.length === 0) return;

    setScreenshotsUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of selected) {
        const url = await uploadToGitHubReleases(file, () => {});
        sessionSoftwareUploadsRef.current.push(url);
        uploadedUrls.push(url);
      }
      setSoftwareForm((prev) => ({
        ...prev,
        screenshots: [...prev.screenshots, ...uploadedUrls].slice(0, 10),
      }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Screenshot upload failed');
    } finally {
      setScreenshotsUploading(false);
    }
  };

  // Coupon Modal State
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponForm, setCouponForm] = useState(EMPTY_COUPON_FORM);
  const [savingCoupon, setSavingCoupon] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubSoftware = onSnapshot(
      collection(db, 'software'),
      (snap) => {
        setSoftwareList(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SoftwareItem, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'software')
    );

    const unsubCoupons = onSnapshot(
      collection(db, 'coupons'),
      (snap) => {
        setCoupons(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CouponCode, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'coupons')
    );

    const eventsQuery = query(collection(db, 'downloadEvents'), orderBy('createdAt', 'desc'));
    const unsubEvents = onSnapshot(
      eventsQuery,
      (snap) => {
        setEvents(
          snap.docs.slice(0, 50).map((d) => ({
            id: d.id,
            ...(d.data() as Omit<DownloadEvent, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'downloadEvents')
    );

    const unsubHero = onSnapshot(
      doc(db, 'settings', 'hero'),
      (snap) => {
        if (snap.exists() && snap.data()?.heroImageUrl) {
          const savedUrl = String(snap.data().heroImageUrl).trim();
          savedHeroBannerRef.current = savedUrl;
          setHeroBannerUrl(savedUrl);
        } else {
          savedHeroBannerRef.current = '';
          setHeroBannerUrl('');
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/hero')
    );

    const unsubContact = onSnapshot(
      doc(db, 'settings', 'contact'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setContactEmail(
            typeof data?.contactEmail === 'string' && data.contactEmail.trim()
              ? data.contactEmail
              : DEFAULT_CONTACT_EMAIL
          );
          setFacebookUrl(
            typeof data?.facebookUrl === 'string' && data.facebookUrl.trim()
              ? data.facebookUrl
              : DEFAULT_FACEBOOK_URL
          );
        }
      },
      () => {}
    );

    const unsubRedirects = onSnapshot(
      doc(db, 'settings', 'redirects'),
      (snap) => {
        if (snap.exists() && snap.data()?.redirects && typeof snap.data().redirects === 'object') {
          setSlugRedirects(snap.data().redirects as Record<string, string>);
        } else {
          setSlugRedirects({});
        }
      },
      () => {}
    );

    const unsubPaymentSettings = onSnapshot(
      doc(db, 'settings', 'payment'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setBkashNumber(typeof d?.bkashNumber === 'string' ? d.bkashNumber : '');
          setNagadNumber(typeof d?.nagadNumber === 'string' ? d.nagadNumber : '');
          setBkashEnabled(d?.bkashEnabled !== false);
          setNagadEnabled(d?.nagadEnabled !== false);
          setPaymentNote(typeof d?.paymentNote === 'string' ? d.paymentNote : '');
          setDefaultGraceHours(Number(d?.defaultGraceHours ?? 2));
        }
      },
      () => {}
    );

    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(
      ordersQuery,
      (snap) => {
        setOrders(
          snap.docs.slice(0, 150).map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PaymentOrder, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
    );

    const licensesQuery = query(collection(db, 'licenses'), orderBy('createdAt', 'desc'));
    const unsubLicenses = onSnapshot(
      licensesQuery,
      (snap) => {
        setLicenses(
          snap.docs.slice(0, 150).map((d) => ({
            id: d.id,
            ...(d.data() as Omit<LicenseRecord, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'licenses')
    );

    const smsQuery = query(collection(db, 'smsTransactions'), orderBy('receivedAtMs', 'desc'));
    const unsubSms = onSnapshot(
      smsQuery,
      (snap) => {
        setSmsList(
          snap.docs.slice(0, 150).map((d) => ({
            id: d.id,
            ...(d.data() as Omit<SmsTransaction, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'smsTransactions')
    );

    return () => {
      unsubSoftware();
      unsubCoupons();
      unsubEvents();
      unsubHero();
      unsubContact();
      unsubRedirects();
      unsubPaymentSettings();
      unsubOrders();
      unsubLicenses();
      unsubSms();
    };
  }, [isAdmin]);

  const loadWebhookStatus = useCallback(async () => {
    if (!user || !isAdmin) return;
    try {
      const idToken = await user.getIdToken();
      const resp = await fetch('/api/payments/webhook-status', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (resp.ok) {
        const data = (await resp.json()) as {
          webhookSecretConfigured: boolean;
          firebaseAdminConfigured: boolean;
          bufferedReceiptsCount: number;
          unsyncedCount: number;
        };
        setWebhookStatus(data);
      }
    } catch {
      // Ignore network hiccup
    }
  }, [user, isAdmin]);

  const syncSmsQueueAndMatch = useCallback(async () => {
    if (!user || !isAdmin || syncingSms) return;
    setSyncingSms(true);
    setSyncSummary(null);

    try {
      const idToken = await user.getIdToken();
      const queueResp = await fetch('/api/payments/sms-queue', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!queueResp.ok) {
        setSyncingSms(false);
        return;
      }

      const queueJson = (await queueResp.json()) as {
        receipts?: Array<{
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
          syncedToFirestore?: boolean;
        }>;
      };

      const incomingReceipts = queueJson.receipts || [];
      const existingSmsMap = new Map(smsList.map((s) => [s.trxId.toUpperCase(), s]));
      const syncedTrxIds: string[] = [];
      let newSmsCount = 0;

      // 1. Write new buffered SMS receipts into Firestore smsTransactions
      for (const r of incomingReceipts) {
        const cleanTrx = r.trxId.toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
        if (!cleanTrx) continue;
        const existing = existingSmsMap.get(r.trxId.toUpperCase());
        if (!existing) {
          await setDoc(doc(db, 'smsTransactions', cleanTrx), {
            trxId: r.trxId.toUpperCase(),
            provider: r.provider,
            sender: r.sender || r.provider,
            amount: Number(r.amount) || 0,
            senderPhone: r.senderPhone || '',
            rawMessage: (r.rawMessage || '').slice(0, 1000),
            receivedAtMs: Math.floor(r.receivedAtMs || Date.now()),
            matchedOrderId: r.matchedOrderId || '',
            matchedLicenseKey: r.matchedLicenseKey || '',
            status: r.status || 'unused',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          newSmsCount += 1;
        }
        if (!r.syncedToFirestore) {
          syncedTrxIds.push(r.trxId);
        }
      }

      if (syncedTrxIds.length > 0) {
        await fetch('/api/payments/sms-queue/ack', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trxIds: syncedTrxIds }),
        });
      }

      // 2. Auto-match any pending licenses/orders against unused SMS receipts (checking both Firestore & fresh queue)
      const combinedSms = new Map<string, { trxId: string; amount: number; status: string }>();
      for (const s of smsList) {
        combinedSms.set(s.trxId.toUpperCase(), {
          trxId: s.trxId.toUpperCase(),
          amount: Number(s.amount),
          status: s.status,
        });
      }
      for (const r of incomingReceipts) {
        combinedSms.set(r.trxId.toUpperCase(), {
          trxId: r.trxId.toUpperCase(),
          amount: Number(r.amount),
          status: r.status,
        });
      }

      const licenseByOrderId = new Map(licenses.map((l) => [l.orderId, l]));
      let autoMatchedCount = 0;

      for (const ord of orders) {
        if (ord.status !== 'provisional' && ord.status !== 'payment_required') continue;
        const lic = licenseByOrderId.get(ord.orderId);
        const primaryTrx = ord.trxId.toUpperCase().trim();
        const resubmittedTrx = (lic?.resubmittedTrxId || '').toUpperCase().trim();
        const smsCandidate =
          (resubmittedTrx && combinedSms.get(resubmittedTrx)) || combinedSms.get(primaryTrx);

        if (
          smsCandidate &&
          smsCandidate.amount + 0.01 >= ord.amount &&
          smsCandidate.status !== 'ignored'
        ) {
          const batch = writeBatch(db);
          batch.update(doc(db, 'orders', ord.orderId), {
            status: 'verified',
            updatedAt: serverTimestamp(),
          });
          if (lic) {
            batch.update(doc(db, 'licenses', lic.licenseKey), {
              status: 'verified',
              updatedAt: serverTimestamp(),
            });
          }
          const safeSmsId = smsCandidate.trxId.replace(/[^A-Z0-9_-]/g, '_');
          batch.update(doc(db, 'smsTransactions', safeSmsId), {
            status: 'matched',
            matchedOrderId: ord.orderId,
            matchedLicenseKey: lic?.licenseKey || '',
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
          autoMatchedCount += 1;
        }
      }

      await loadWebhookStatus();
      setSyncSummary(
        `Synced ${newSmsCount} new SMS · Auto-verified ${autoMatchedCount} order(s).`
      );
    } catch {
      setSyncSummary('Sync completed with partial errors.');
    } finally {
      setSyncingSms(false);
    }
  }, [user, isAdmin, syncingSms, smsList, orders, licenses, loadWebhookStatus]);

  useEffect(() => {
    if (isAdmin) {
      void loadWebhookStatus();
    }
  }, [isAdmin, loadWebhookStatus]);

  const stats = useMemo(() => {
    const totalDownloads = softwareList.reduce((acc, s) => acc + (s.downloadsCount || 0), 0);
    const activePackages = softwareList.filter((s) => s.status === 'active').length;
    const activeCoupons = coupons.filter((c) => c.active).length;
    return {
      totalDownloads,
      activePackages,
      activeCoupons,
      recentEvents: events.length,
    };
  }, [softwareList, coupons, events]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed');
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Email Sign-In failed');
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedStarterCatalog();
    } finally {
      setSeeding(false);
    }
  };

  const openAddSoftware = () => {
    setUploadError(null);
    setEditingId(null);
    originalSoftwareAssetsRef.current = [];
    sessionSoftwareUploadsRef.current = [];
    setSoftwareForm(EMPTY_SOFTWARE_FORM);
    setShowSoftwareModal(true);
  };

  const openEditSoftware = (item: SoftwareItem) => {
    setUploadError(null);
    setEditingId(item.id);
    originalSoftwareAssetsRef.current = [
      item.downloadUrl,
      item.thumbnailUrl || '',
      ...(item.screenshots || []),
    ]
      .map((u) => u.trim())
      .filter(Boolean);
    sessionSoftwareUploadsRef.current = [];
    const inferredMode: SoftwarePricingMode =
      item.pricingMode ||
      (item.price > 0 || (item.plans?.length ?? 0) > 0 ? 'paid_download' : 'free');
    setSoftwareForm({
      id: item.id,
      name: item.name,
      slug: item.slug,
      tagline: item.tagline,
      description: item.description,
      category: item.category,
      platform: item.platform,
      fileType: item.fileType,
      version: item.version,
      fileSize: item.fileSize,
      downloadUrl: item.downloadUrl,
      thumbnailUrl: item.thumbnailUrl || '',
      screenshots: item.screenshots || [],
      installGuide: item.installGuide || '',
      price: item.price,
      pricingMode: inferredMode,
      currency: item.currency || 'USD',
      plans: item.plans || [],
      generateLicenseKey: Boolean(item.generateLicenseKey ?? inferredMode !== 'free'),
      gracePeriodHours: typeof item.gracePeriodHours === 'number' ? item.gracePeriodHours : 2,
      maxDevices: typeof item.maxDevices === 'number' ? item.maxDevices : 1,
      featured: item.featured,
    });
    setShowSoftwareModal(true);
  };

  const closeSoftwareModal = () => {
    const referenced = getReferencedGitHubUrls([], false);
    const canceledOrphans = sessionSoftwareUploadsRef.current.filter(
      (url) => !referenced.has(url.trim())
    );
    if (canceledOrphans.length > 0) {
      void deleteGitHubAssets(canceledOrphans);
    }
    sessionSoftwareUploadsRef.current = [];
    originalSoftwareAssetsRef.current = [];
    setShowSoftwareModal(false);
  };

  const cleanSlugPreview = useMemo(() => {
    return (
      softwareForm.slug
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .toLowerCase()
        .replace(/^-+|-+$/g, '') ||
      softwareForm.name
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .toLowerCase()
        .replace(/^-+|-+$/g, '')
    );
  }, [softwareForm.slug, softwareForm.name]);

  const seoAudit = useMemo(() => {
    const name = softwareForm.name.trim();
    const slug = cleanSlugPreview;
    const tagline = softwareForm.tagline.trim();
    const desc = softwareForm.description.trim();
    const titlePreview = name ? `${name} (${softwareForm.version.trim() || 'v1.0'}) — Toolpotro` : 'Toolpotro Software';
    const keywords = name
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter((w) => w.length >= 3);

    const checks = [
      {
        label: `SEO Title length (${titlePreview.length} chars, ideal 30–65)`,
        ok: titlePreview.length >= 25 && titlePreview.length <= 70 && name.length >= 3,
        points: 15,
      },
      {
        label: 'Clean keyword-friendly URL Slug (3–60 chars)',
        ok: slug.length >= 3 && slug.length <= 60 && /^[a-z0-9][a-z0-9_-]*$/.test(slug),
        points: 15,
      },
      {
        label: `Tagline / Meta Description (${tagline.length} chars, ideal 45–160)`,
        ok: tagline.length >= 45 && tagline.length <= 165,
        points: 20,
      },
      {
        label: `Full Description depth (${desc.length} chars, recommended 120+)`,
        ok: desc.length >= 120,
        points: 20,
      },
      {
        label: 'Main keyword present in Slug, Tagline, or Description',
        ok:
          keywords.length > 0 &&
          keywords.some(
            (kw) =>
              slug.includes(kw) ||
              tagline.toLowerCase().includes(kw) ||
              desc.toLowerCase().includes(kw)
          ),
        points: 15,
      },
      {
        label: 'Custom App Logo & Screenshots uploaded',
        ok:
          Boolean(softwareForm.thumbnailUrl.trim()) &&
          !softwareForm.thumbnailUrl.includes('app_preview_desktop_1794404736026.jpg'),
        points: 15,
      },
    ];

    const score = checks.reduce((sum, c) => sum + (c.ok ? c.points : 0), 0);
    return { score, titlePreview, checks };
  }, [softwareForm, cleanSlugPreview]);

  const handleSaveSoftware = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    const cleanSlug = cleanSlugPreview;
    if (!cleanSlug) {
      setUploadError('Please enter a valid Name or Slug (letters, numbers, hyphens).');
      return;
    }

    if (editingId && cleanSlug !== editingId && softwareList.some((s) => s.id === cleanSlug)) {
      setUploadError(`Slug "${cleanSlug}" is already used by another software item.`);
      return;
    }

    if (!editingId && softwareList.some((s) => s.id === cleanSlug)) {
      setUploadError(`Slug "${cleanSlug}" already exists. Please use a unique Slug (ID).`);
      return;
    }

    setSavingSoftware(true);
    const docId = cleanSlug;

    const cleanPlans = softwareForm.plans
      .filter((p) => p.name.trim().length > 0)
      .slice(0, 8)
      .map((p, idx) => ({
        id: (p.id || `plan_${idx + 1}`).trim().slice(0, 60),
        name: p.name.trim().slice(0, 80),
        durationDays: Math.max(0, Math.floor(Number(p.durationDays) || 0)),
        price: Math.max(0, Number(p.price) || 0),
        badge: (p.badge || '').trim().slice(0, 30),
        description: (p.description || '').trim().slice(0, 160),
      }));

    const pricingFields = {
      price:
        softwareForm.pricingMode === 'free'
          ? 0
          : cleanPlans.length > 0
          ? Math.min(...cleanPlans.map((p) => p.price))
          : Number(softwareForm.price) || 0,
      pricingMode: softwareForm.pricingMode,
      currency: softwareForm.currency,
      plans: softwareForm.pricingMode === 'free' ? [] : cleanPlans,
      generateLicenseKey:
        softwareForm.pricingMode === 'free' ? false : Boolean(softwareForm.generateLicenseKey),
      gracePeriodHours: Math.max(0, Math.min(168, Number(softwareForm.gracePeriodHours) || 0)),
      maxDevices: Math.max(1, Math.min(50, Math.floor(Number(softwareForm.maxDevices) || 1))),
    };

    try {
      if (editingId && cleanSlug === editingId) {
        await updateDoc(doc(db, 'software', docId), {
          name: softwareForm.name.trim(),
          slug: cleanSlug,
          tagline: softwareForm.tagline.trim(),
          description: softwareForm.description.trim(),
          category: softwareForm.category,
          platform: softwareForm.platform,
          fileType: softwareForm.fileType,
          version: softwareForm.version.trim(),
          fileSize: softwareForm.fileSize.trim(),
          downloadUrl: softwareForm.downloadUrl.trim(),
          thumbnailUrl: softwareForm.thumbnailUrl.trim(),
          screenshots: softwareForm.screenshots,
          installGuide: softwareForm.installGuide.trim(),
          ...pricingFields,
          featured: Boolean(softwareForm.featured),
          updatedAt: serverTimestamp(),
        });
      } else if (editingId && cleanSlug !== editingId) {
        const existingItem = softwareList.find((s) => s.id === editingId);
        await setDoc(doc(db, 'software', cleanSlug), {
          name: softwareForm.name.trim(),
          slug: cleanSlug,
          tagline: softwareForm.tagline.trim(),
          description: softwareForm.description.trim(),
          category: softwareForm.category,
          platform: softwareForm.platform,
          fileType: softwareForm.fileType,
          version: softwareForm.version.trim(),
          fileSize: softwareForm.fileSize.trim(),
          downloadUrl: softwareForm.downloadUrl.trim(),
          thumbnailUrl: softwareForm.thumbnailUrl.trim(),
          screenshots: softwareForm.screenshots,
          installGuide: softwareForm.installGuide.trim(),
          ...pricingFields,
          downloadsCount: existingItem?.downloadsCount ?? 0,
          status: existingItem?.status ?? 'active',
          featured: Boolean(softwareForm.featured),
          createdAt: existingItem?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Preserve old links via 301 redirect map without deleting shared GitHub Release files
        const nextRedirects: Record<string, string> = {};
        for (const [oldKey, targetVal] of Object.entries(slugRedirects)) {
          nextRedirects[oldKey] = targetVal === editingId ? cleanSlug : targetVal;
        }
        nextRedirects[editingId] = cleanSlug;
        delete nextRedirects[cleanSlug];

        await setDoc(
          doc(db, 'settings', 'redirects'),
          {
            redirects: nextRedirects,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Update any coupons targeting the old software ID
        for (const coupon of coupons) {
          if (coupon.targetSoftwareIds?.includes(editingId)) {
            const nextTargets = coupon.targetSoftwareIds.map((tid) =>
              tid === editingId ? cleanSlug : tid
            );
            await updateDoc(doc(db, 'coupons', coupon.id), {
              targetSoftwareIds: Array.from(new Set(nextTargets)),
              updatedAt: serverTimestamp(),
            });
          }
        }

        await deleteDoc(doc(db, 'software', editingId));
      } else {
        await setDoc(doc(db, 'software', docId), {
          name: softwareForm.name.trim(),
          slug: cleanSlug,
          tagline: softwareForm.tagline.trim(),
          description: softwareForm.description.trim(),
          category: softwareForm.category,
          platform: softwareForm.platform,
          fileType: softwareForm.fileType,
          version: softwareForm.version.trim(),
          fileSize: softwareForm.fileSize.trim(),
          downloadUrl: softwareForm.downloadUrl.trim(),
          thumbnailUrl: softwareForm.thumbnailUrl.trim(),
          screenshots: softwareForm.screenshots,
          installGuide: softwareForm.installGuide.trim(),
          ...pricingFields,
          downloadsCount: 0,
          status: 'active',
          featured: Boolean(softwareForm.featured),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      // Remove any replaced or discarded GitHub Release files no longer referenced anywhere
      const finalKeptSet = new Set(
        [
          softwareForm.downloadUrl.trim(),
          softwareForm.thumbnailUrl.trim(),
          ...softwareForm.screenshots.map((s) => s.trim()),
        ].filter(Boolean)
      );
      const referencedElsewhere = getReferencedGitHubUrls(
        editingId ? [editingId, cleanSlug] : [cleanSlug],
        false
      );
      const orphanedUrls = [
        ...originalSoftwareAssetsRef.current,
        ...sessionSoftwareUploadsRef.current,
      ].filter((url) => {
        const trimmed = url.trim();
        return trimmed && !finalKeptSet.has(trimmed) && !referencedElsewhere.has(trimmed);
      });
      if (orphanedUrls.length > 0) {
        void deleteGitHubAssets(orphanedUrls);
      }

      sessionSoftwareUploadsRef.current = [];
      originalSoftwareAssetsRef.current = [];
      setShowSoftwareModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `software/${docId}`);
    } finally {
      setSavingSoftware(false);
    }
  };

  const toggleArchiveSoftware = async (item: SoftwareItem) => {
    const nextStatus = item.status === 'active' ? 'archived' : 'active';
    try {
      await updateDoc(doc(db, 'software', item.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `software/${item.id}`);
    }
  };

  const handleDeleteSoftware = async (item: SoftwareItem) => {
    try {
      const referencedElsewhere = getReferencedGitHubUrls([item.id], false);
      const candidateUrls = [
        item.downloadUrl,
        item.thumbnailUrl || '',
        ...(item.screenshots || []),
      ]
        .map((u) => u.trim())
        .filter((u) => u && !referencedElsewhere.has(u));

      await deleteGitHubAssets(candidateUrls);
      await deleteDoc(doc(db, 'software', item.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `software/${item.id}`);
    }
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = couponForm.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (cleanCode.length < 2) return;
    setSavingCoupon(true);
    try {
      await setDoc(doc(db, 'coupons', cleanCode), {
        code: cleanCode,
        discountType: couponForm.discountType,
        discountValue: Number(couponForm.discountValue),
        scope: couponForm.scope,
        targetSoftwareIds: couponForm.scope === 'specific' ? couponForm.targetSoftwareIds : [],
        expiryDate: couponForm.expiryDate,
        usageLimit: Number(couponForm.usageLimit) || 100,
        usedCount: 0,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCouponForm(EMPTY_COUPON_FORM);
      setShowCouponModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `coupons/${cleanCode}`);
    } finally {
      setSavingCoupon(false);
    }
  };

  const toggleCouponActive = async (c: CouponCode) => {
    try {
      await updateDoc(doc(db, 'coupons', c.id), {
        active: !c.active,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `coupons/${c.id}`);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'coupons', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `coupons/${id}`);
    }
  };

  const handleHeroBannerUpload = async (file: File) => {
    setHeroBannerError(null);
    setHeroBannerSuccess(false);
    setHeroBannerUploading(true);
    setHeroBannerUploadProgress(0);
    try {
      const url = await uploadToGitHubReleases(file, setHeroBannerUploadProgress);
      sessionHeroUploadsRef.current.push(url);
      setHeroBannerUrl(url);
    } catch (err) {
      setHeroBannerError(err instanceof Error ? err.message : 'Hero banner upload failed');
    } finally {
      setHeroBannerUploading(false);
      setHeroBannerUploadProgress(null);
    }
  };

  const handleSaveHeroBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setHeroBannerSaving(true);
    setHeroBannerError(null);
    setHeroBannerSuccess(false);
    const finalBannerUrl = heroBannerUrl.trim();
    try {
      await setDoc(
        doc(db, 'settings', 'hero'),
        {
          heroImageUrl: finalBannerUrl,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      const referencedInSoftware = getReferencedGitHubUrls([], true);
      const orphanedBannerUrls = [
        savedHeroBannerRef.current,
        ...sessionHeroUploadsRef.current,
      ]
        .map((u) => u.trim())
        .filter((u) => u && u !== finalBannerUrl && !referencedInSoftware.has(u));
      if (orphanedBannerUrls.length > 0) {
        void deleteGitHubAssets(orphanedBannerUrls);
      }
      savedHeroBannerRef.current = finalBannerUrl;
      sessionHeroUploadsRef.current = [];

      setHeroBannerSuccess(true);
      setTimeout(() => setHeroBannerSuccess(false), 4000);
    } catch (err) {
      setHeroBannerError(err instanceof Error ? err.message : 'Failed to save hero banner');
      handleFirestoreError(err, OperationType.WRITE, 'settings/hero');
    } finally {
      setHeroBannerSaving(false);
    }
  };

  const handleResetHeroBanner = async () => {
    setHeroBannerSaving(true);
    setHeroBannerError(null);
    setHeroBannerSuccess(false);
    try {
      await setDoc(
        doc(db, 'settings', 'hero'),
        {
          heroImageUrl: '',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      const referencedInSoftware = getReferencedGitHubUrls([], true);
      const orphanedBannerUrls = [
        savedHeroBannerRef.current,
        ...sessionHeroUploadsRef.current,
      ]
        .map((u) => u.trim())
        .filter((u) => u && !referencedInSoftware.has(u));
      if (orphanedBannerUrls.length > 0) {
        void deleteGitHubAssets(orphanedBannerUrls);
      }
      savedHeroBannerRef.current = '';
      sessionHeroUploadsRef.current = [];
      setHeroBannerUrl('');
      setHeroBannerSuccess(true);
      setTimeout(() => setHeroBannerSuccess(false), 4000);
    } catch (err) {
      setHeroBannerError(err instanceof Error ? err.message : 'Failed to reset hero banner');
      handleFirestoreError(err, OperationType.WRITE, 'settings/hero');
    } finally {
      setHeroBannerSaving(false);
    }
  };

  const handleSaveContactSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactSaving(true);
    setContactError(null);
    setContactSuccess(false);
    try {
      await setDoc(
        doc(db, 'settings', 'contact'),
        {
          contactEmail: contactEmail.trim(),
          facebookUrl: facebookUrl.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setContactSuccess(true);
      setTimeout(() => setContactSuccess(false), 4000);
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'Failed to save contact settings');
      handleFirestoreError(err, OperationType.WRITE, 'settings/contact');
    } finally {
      setContactSaving(false);
    }
  };

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentSaving(true);
    setPaymentSuccess(false);
    try {
      await setDoc(
        doc(db, 'settings', 'payment'),
        {
          bkashNumber: bkashNumber.trim(),
          nagadNumber: nagadNumber.trim(),
          bkashEnabled: Boolean(bkashEnabled),
          nagadEnabled: Boolean(nagadEnabled),
          paymentNote: paymentNote.trim(),
          defaultGraceHours: Math.max(0, Math.min(168, Number(defaultGraceHours) || 0)),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setPaymentSuccess(true);
      setTimeout(() => setPaymentSuccess(false), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/payment');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleUpdateOrderStatus = async (order: PaymentOrder, nextStatus: LicenseStatus) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'orders', order.orderId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      if (order.licenseKey) {
        batch.update(doc(db, 'licenses', order.licenseKey), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.orderId}`);
    }
  };

  const handleDeleteOrderAndLicense = async (order: PaymentOrder) => {
    try {
      await deleteDoc(doc(db, 'orders', order.orderId));
      if (order.licenseKey) {
        await deleteDoc(doc(db, 'licenses', order.licenseKey));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${order.orderId}`);
    }
  };

  if (authLoading) {
    return (
      <main className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="h-8 w-8 mx-auto rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-md mx-auto px-4 py-16">
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-zinc-50">
              {t.admin.signInTitle}
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {t.admin.signInSubtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full h-11 px-4 rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            {t.admin.signInGoogle}
          </button>

          <div className="relative flex items-center justify-center">
            <span className="border-t border-slate-200 dark:border-zinc-800 w-full" />
            <span className="bg-white dark:bg-zinc-900 px-3 text-xs text-slate-400 whitespace-nowrap">
              {t.admin.orEmail}
            </span>
            <span className="border-t border-slate-200 dark:border-zinc-800 w-full" />
          </div>

          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                {t.admin.emailLabel}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-zinc-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                {t.admin.passwordLabel}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-zinc-100"
              />
            </div>
            <button
              type="submit"
              className="w-full h-10 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-slate-900 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {t.admin.signInEmail}
            </button>
          </form>

          {authError && (
            <p className="text-xs text-red-600 dark:text-red-400 text-center">{authError}</p>
          )}
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="max-w-md mx-auto px-4 py-16">
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 mx-auto text-amber-600" />
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-zinc-50">
            {t.admin.unauthorizedTitle}
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {t.admin.unauthorizedSubtitle}
          </p>
          <p className="text-xs font-mono text-slate-400">{user.email}</p>
          <button
            type="button"
            onClick={logout}
            className="h-10 px-5 rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold"
          >
            {t.admin.signOut}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-zinc-50">
            {t.admin.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">{t.admin.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {softwareList.length === 0 && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="h-10 px-4 rounded-xl border border-teal-600/30 bg-teal-50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-300 text-xs font-semibold inline-flex items-center gap-2 hover:bg-teal-100 dark:hover:bg-teal-950/50 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {t.admin.seedStarter}
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 inline-flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t.admin.signOut}
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            {t.admin.stats.totalDownloads}
          </p>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-zinc-50 tabular-nums">
            {stats.totalDownloads.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />
            {t.admin.stats.activePackages}
          </p>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-zinc-50 tabular-nums">
            {stats.activePackages}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            {t.admin.stats.activeCoupons}
          </p>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-zinc-50 tabular-nums">
            {stats.activeCoupons}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            {t.admin.stats.recentEvents}
          </p>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-zinc-50 tabular-nums">
            {stats.recentEvents}
          </p>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200/70 dark:border-zinc-800 overflow-x-auto">
          {(['software', 'payments', 'coupons', 'analytics', 'heroBanner', 'seoSettings'] as AdminTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-50 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              {t.admin.tabs[tab]}
            </button>
          ))}
        </div>

        {activeTab === 'software' && (
          <button
            type="button"
            onClick={openAddSoftware}
            className="h-10 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t.admin.addSoftware}
          </button>
        )}

        {activeTab === 'coupons' && (
          <button
            type="button"
            onClick={() => setShowCouponModal(true)}
            className="h-10 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t.admin.addCoupon}
          </button>
        )}
      </div>

      {/* Tab 1: Software Management */}
      {activeTab === 'software' && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-5">Name</th>
                <th className="py-3.5 px-4">Platform</th>
                <th className="py-3.5 px-4">Version</th>
                <th className="py-3.5 px-4 text-right">Downloads</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {softwareList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
                  <td className="py-3.5 px-5">
                    <div className="font-semibold text-slate-900 dark:text-zinc-100">{item.name}</div>
                    <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                      {item.fileType} · {item.fileSize}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">{item.platform}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-zinc-300">
                    {item.version}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-zinc-100">
                    {item.downloadsCount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`text-xs font-medium ${
                        item.status === 'active'
                          ? 'text-teal-700 dark:text-teal-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {item.status === 'active' ? t.admin.active : t.admin.archived}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditSoftware(item)}
                        className="p-2 rounded-lg text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                        title={t.admin.editSoftware}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleArchiveSoftware(item)}
                        className="p-2 rounded-lg text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                        title={item.status === 'active' ? t.admin.archive : t.admin.restore}
                      >
                        {item.status === 'active' ? (
                          <Archive className="w-4 h-4" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSoftware(item)}
                        className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                        title={t.admin.delete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Payments, Webhooks, Orders & Licenses */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Top Row: bKash/Nagad Settings + Android PaySync Webhook Status */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* bKash & Nagad Receiver Numbers Form */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                  bKash &amp; Nagad Checkout Numbers
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Displayed to customers inside the checkout popup on paid &amp; freemium software pages.
                </p>
              </div>

              {paymentSuccess && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Payment numbers &amp; grace period settings saved!
                </div>
              )}

              <form onSubmit={handleSavePaymentSettings} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                        bKash Personal Number
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bkashEnabled}
                          onChange={(e) => setBkashEnabled(e.target.checked)}
                        />
                        Enabled
                      </label>
                    </div>
                    <input
                      type="text"
                      value={bkashNumber}
                      onChange={(e) => setBkashNumber(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                        Nagad Personal Number
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={nagadEnabled}
                          onChange={(e) => setNagadEnabled(e.target.checked)}
                        />
                        Enabled
                      </label>
                    </div>
                    <input
                      type="text"
                      value={nagadNumber}
                      onChange={(e) => setNagadNumber(e.target.value)}
                      placeholder="018XXXXXXXX"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 block mb-1">
                      Default Grace Period (Hours)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="168"
                      step="0.5"
                      value={defaultGraceHours}
                      onChange={(e) => setDefaultGraceHours(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 font-mono text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 block mb-1">
                      Checkout Instruction Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="Send Money করে TrxID ও নাম্বার দিন — সাথে সাথেই লিংক পাবেন।"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={paymentSaving}
                  className="h-10 px-5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {paymentSaving ? 'Saving...' : 'Save Payment Settings'}
                </button>
              </form>
            </div>

            {/* Android PaySync Webhook & Auto-Sync Card */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                  Android PaySync Webhook
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Paste this URL into your Android SMS forwarder app with your <span className="font-mono">SMS_WEBHOOK_SECRET</span>.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-3 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase">
                  Webhook Endpoint URL
                </span>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs font-mono text-slate-900 dark:text-teal-300 truncate">
                    {`${window.location.origin}/api/payments/sms-webhook`}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `${window.location.origin}/api/payments/sms-webhook`
                      );
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 2000);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-zinc-800 text-white text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedWebhook ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3">
                  <span className="text-slate-500 dark:text-zinc-400 block text-[11px]">
                    SMS_WEBHOOK_SECRET
                  </span>
                  <span
                    className={`font-mono font-bold mt-0.5 inline-block ${
                      webhookStatus?.webhookSecretConfigured
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {webhookStatus === null
                      ? 'Checking...'
                      : webhookStatus.webhookSecretConfigured
                      ? 'Configured'
                      : 'Not Set'}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3">
                  <span className="text-slate-500 dark:text-zinc-400 block text-[11px]">
                    Buffered / Unsynced SMS
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 mt-0.5 inline-block">
                    {webhookStatus
                      ? `${webhookStatus.bufferedReceiptsCount} / ${webhookStatus.unsyncedCount}`
                      : '—'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void syncSmsQueueAndMatch()}
                disabled={syncingSms}
                className="w-full h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncingSms ? 'animate-spin' : ''}`} />
                <span>
                  {syncingSms ? 'Syncing & Matching...' : 'Sync Server SMS & Auto-Match Orders'}
                </span>
              </button>

              {syncSummary && (
                <p className="text-xs font-mono text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/50 rounded-lg px-3 py-2">
                  {syncSummary}
                </p>
              )}
            </div>
          </div>

          {/* Orders & License Management Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                Orders &amp; Generated Licenses ({orders.length})
              </h3>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {(['all', 'provisional', 'verified', 'payment_required', 'revoked'] as const).map(
                  (f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setOrderFilter(f)}
                      className={`px-2.5 py-1 rounded-lg font-medium capitalize cursor-pointer ${
                        orderFilter === f
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      {f.replace('_', ' ')}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-500 dark:text-zinc-400">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Software &amp; Plan</th>
                    <th className="py-3 px-4">Payment &amp; TrxID</th>
                    <th className="py-3 px-4">License Key</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {orders
                    .filter((o) => orderFilter === 'all' || o.status === orderFilter)
                    .map((ord) => {
                      const lic = licenses.find((l) => l.orderId === ord.orderId);
                      const sym = ord.currency === 'BDT' ? '৳' : '$';
                      return (
                        <tr key={ord.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-zinc-100">
                              {ord.customerName}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-zinc-400">
                              {ord.customerEmail}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900 dark:text-zinc-100">
                              {ord.softwareName}
                            </div>
                            <div className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                              {ord.planName || 'Standard'} · {sym}{ord.amount}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            <div className="uppercase font-bold text-slate-800 dark:text-zinc-200">
                              {ord.paymentMethod}: {ord.trxId}
                            </div>
                            <div className="text-slate-500 dark:text-zinc-400">
                              From: {ord.senderPhone}
                            </div>
                            {lic?.resubmittedTrxId && (
                              <div className="text-amber-600 dark:text-amber-400 font-semibold">
                                Resubmitted: {lic.resubmittedTrxId}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-teal-700 dark:text-teal-300">
                            {ord.licenseKey || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${
                                ord.status === 'verified'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : ord.status === 'provisional'
                                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                  : ord.status === 'payment_required'
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                  : 'bg-red-500/15 text-red-700 dark:text-red-400'
                              }`}
                            >
                              {ord.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              {ord.status !== 'verified' && (
                                <button
                                  type="button"
                                  onClick={() => void handleUpdateOrderStatus(ord, 'verified')}
                                  className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
                                  title="Approve / Verify License"
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                </button>
                              )}
                              {ord.status !== 'payment_required' && (
                                <button
                                  type="button"
                                  onClick={() => void handleUpdateOrderStatus(ord, 'payment_required')}
                                  className="p-1.5 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer"
                                  title="Lock License (Payment Required)"
                                >
                                  <Lock className="w-4 h-4" />
                                </button>
                              )}
                              {ord.status === 'payment_required' && (
                                <button
                                  type="button"
                                  onClick={() => void handleUpdateOrderStatus(ord, 'verified')}
                                  className="p-1.5 rounded-lg text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 cursor-pointer"
                                  title="Unlock License"
                                >
                                  <Unlock className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleDeleteOrderAndLicense(ord)}
                                className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                                title={t.admin.delete}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                        No orders recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Synced SMS Inbox Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-zinc-50">
                Received bKash / Nagad SMS Log ({smsList.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-500 dark:text-zinc-400">
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">TrxID</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Sender Phone</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Matched Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {smsList.map((sms) => (
                    <tr key={sms.id}>
                      <td className="py-2.5 px-4 uppercase font-bold text-xs text-slate-800 dark:text-zinc-200">
                        {sms.provider}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-zinc-100">
                        {sms.trxId}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs tabular-nums">৳{sms.amount}</td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-500 dark:text-zinc-400">
                        {sms.senderPhone || '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`text-xs font-semibold capitalize ${
                            sms.status === 'matched'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-zinc-400'
                          }`}
                        >
                          {sms.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-teal-700 dark:text-teal-400">
                        {sms.matchedLicenseKey || '—'}
                      </td>
                    </tr>
                  ))}
                  {smsList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                        No SMS receipts synced yet. Forwarded SMS from Android will appear here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Coupons Management */}
      {activeTab === 'coupons' && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-5">Code</th>
                <th className="py-3.5 px-4">Discount</th>
                <th className="py-3.5 px-4">Scope</th>
                <th className="py-3.5 px-4">Expiry</th>
                <th className="py-3.5 px-4 text-right">Usage</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
                  <td className="py-3.5 px-5 font-mono font-semibold text-slate-900 dark:text-zinc-100">
                    {c.code}
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                    {c.discountType === 'percentage' ? `${c.discountValue}%` : `$${c.discountValue}`}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400 text-xs">
                    {c.scope === 'all'
                      ? t.admin.scopeAll
                      : `${t.admin.scopeSpecific} (${c.targetSoftwareIds.length})`}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-zinc-400 tabular-nums">
                    {c.expiryDate}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-zinc-100">
                    {c.usedCount} / {c.usageLimit}
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => toggleCouponActive(c)}
                      className={`text-xs font-medium cursor-pointer ${
                        c.active
                          ? 'text-teal-700 dark:text-teal-400'
                          : 'text-slate-400 dark:text-zinc-500'
                      }`}
                    >
                      {c.active ? t.admin.active : t.admin.inactive}
                    </button>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteCoupon(c.id)}
                      className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                      title={t.admin.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Download Analytics */}
      {activeTab === 'analytics' && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-5">Software</th>
                <th className="py-3.5 px-4">Platform</th>
                <th className="py-3.5 px-4">Coupon</th>
                <th className="py-3.5 px-5 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {events.map((evt) => (
                <tr key={evt.id}>
                  <td className="py-3 px-5 font-medium text-slate-900 dark:text-zinc-100">
                    {evt.softwareName}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{evt.platform}</td>
                  <td className="py-3 px-4 font-mono text-xs text-teal-700 dark:text-teal-400">
                    {evt.couponCode || '—'}
                  </td>
                  <td className="py-3 px-5 text-right font-mono tabular-nums text-slate-900 dark:text-zinc-100">
                    {evt.finalPrice > 0 ? `$${evt.finalPrice.toFixed(2)}` : t.catalog.freeLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Hero Banner Management */}
      {activeTab === 'heroBanner' && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              {t.admin.heroBannerTitle}
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              {t.admin.heroBannerSubtitle}
            </p>
            <p className="text-xs text-teal-700 dark:text-teal-400 font-medium mt-1.5 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-teal-500" />
              {t.admin.heroBannerSizeRecommendation}
            </p>
          </div>

          {heroBannerError && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
              {heroBannerError}
            </div>
          )}

          {heroBannerSuccess && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {t.admin.heroImageUpdated}
            </div>
          )}

          {/* Live Preview Card */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Current Live Preview
            </label>
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 aspect-16/9 max-w-2xl shadow-lg">
              {heroBannerUrl.trim() ? (
                <>
                  <img
                    src={heroBannerUrl}
                    alt="Toolpotro hero preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-xs text-[11px] font-mono font-medium text-white/90">
                    Custom Banner (16:9)
                  </div>
                </>
              ) : (
                <div className="w-full h-full toolpotro-pattern-dark flex flex-col items-center justify-center p-6 text-center">
                  <span className="px-3 py-1 rounded-full border border-teal-400/35 bg-teal-950/70 text-xs font-medium text-teal-300 mb-2">
                    Default Auto Mode
                  </span>
                  <p className="font-display text-base font-semibold text-white">
                    Seamless Site Doodle Pattern Active
                  </p>
                  <p className="text-xs text-slate-300 mt-1 max-w-md">
                    No custom banner image set. The homepage hero automatically matches the site&apos;s software &amp; extension pattern background.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Form Controls */}
          <form onSubmit={handleSaveHeroBanner} className="space-y-4 max-w-2xl">
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 block mb-1">
                Image URL or Uploaded Link
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={heroBannerUrl}
                  onChange={(e) => setHeroBannerUrl(e.target.value)}
                  placeholder="https://... or upload below"
                  className="flex-1 h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm font-mono text-slate-900 dark:text-zinc-100"
                />
                <label className="h-10 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-100 inline-flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer shrink-0">
                  <Upload className="w-4 h-4" />
                  {heroBannerUploading
                    ? `Uploading ${heroBannerUploadProgress ?? 0}%`
                    : t.admin.uploadHeroImage}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={heroBannerUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleHeroBannerUpload(file);
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Supported formats: JPG, PNG, WebP. Recommended: 1200 × 675 px (16:9).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={heroBannerSaving || heroBannerUploading}
                className="h-10 px-5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {heroBannerSaving ? 'Saving...' : t.admin.saveHeroImage}
              </button>

              <button
                type="button"
                disabled={heroBannerSaving || heroBannerUploading}
                onClick={handleResetHeroBanner}
                className="h-10 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 inline-flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t.admin.resetHeroImage}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 5: SEO, Contact & Sitemap Settings */}
      {activeTab === 'seoSettings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Contact & Social Profile Form */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                <Mail className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                Contact &amp; Brand Identity (Footer + Google Schema)
              </h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                Displayed in the public footer and embedded in Schema.org Organization metadata for Google trust signals.
              </p>
            </div>

            {contactError && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
                {contactError}
              </div>
            )}

            {contactSuccess && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Contact &amp; social details saved successfully!
              </div>
            )}

            <form onSubmit={handleSaveContactSettings} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 block mb-1">
                  Support / Contact Email (Gmail)
                </label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="obaedulhaque19@gmail.com"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 block mb-1">
                  Facebook Page URL (Demo placeholder — update when page is created)
                </label>
                <input
                  type="url"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://www.facebook.com/toolpotro"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm font-mono text-slate-900 dark:text-zinc-100"
                />
              </div>

              <button
                type="submit"
                disabled={contactSaving}
                className="h-10 px-5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {contactSaving ? 'Saving...' : 'Save Contact & Brand Info'}
              </button>
            </form>
          </div>

          {/* Search Engine Indexing Endpoints & Verification */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                <Globe className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                Google &amp; AI Crawler Endpoints
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Automatically updated whenever you publish, edit, or archive software packages.
              </p>
            </div>

            <div className="space-y-2.5 text-xs">
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 hover:border-teal-600/40 transition-colors"
              >
                <div>
                  <p className="font-mono font-semibold text-slate-900 dark:text-zinc-100">/sitemap.xml</p>
                  <p className="text-slate-500 dark:text-zinc-400">Dynamic XML sitemap of all active software</p>
                </div>
                <ExternalLink className="w-4 h-4 text-teal-600 shrink-0" />
              </a>

              <a
                href="/robots.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 hover:border-teal-600/40 transition-colors"
              >
                <div>
                  <p className="font-mono font-semibold text-slate-900 dark:text-zinc-100">/robots.txt</p>
                  <p className="text-slate-500 dark:text-zinc-400">Allows public pages; hides /admin &amp; /api</p>
                </div>
                <ExternalLink className="w-4 h-4 text-teal-600 shrink-0" />
              </a>
            </div>

            {Object.keys(slugRedirects).length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Active 301 Slug Redirects ({Object.keys(slugRedirects).length})
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1 text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                  {Object.entries(slugRedirects).map(([oldId, newId]) => (
                    <div key={oldId} className="truncate">
                      /{oldId} → /{newId}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Software Add/Edit Modal */}
      {showSoftwareModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start sm:items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 shrink-0">
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-zinc-50">
                {editingId ? t.admin.editSoftware : t.admin.addSoftware}
              </h2>
              <button
                type="button"
                onClick={closeSoftwareModal}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSoftware} className="flex-1 overflow-y-auto p-6 space-y-4">
              {githubConfigured === false && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
                  GitHub Releases upload requires <span className="font-mono">GITHUB_TOKEN</span>, <span className="font-mono">GITHUB_REPO_OWNER</span>, and <span className="font-mono">GITHUB_REPO_NAME</span> in your server environment variables (Render / <span className="font-mono">.env</span>).
                </div>
              )}

              {uploadError && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
                  {uploadError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">Name</label>
                  <input
                    required
                    value={softwareForm.name}
                    onChange={(e) => setSoftwareForm({ ...softwareForm, name: e.target.value })}
                    placeholder="PotroSync Studio"
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">Slug (ID)</label>
                  <input
                    required
                    value={softwareForm.slug}
                    onChange={(e) => setSoftwareForm({ ...softwareForm, slug: e.target.value })}
                    placeholder="potro-sync-desktop"
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm font-mono"
                  />
                  {editingId && cleanSlugPreview && cleanSlugPreview !== editingId && (
                    <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                      Old URL /software/{editingId} will auto-redirect (301) to /software/{cleanSlugPreview}.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">Tagline</label>
                <input
                  required
                  value={softwareForm.tagline}
                  onChange={(e) => setSoftwareForm({ ...softwareForm, tagline: e.target.value })}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">Description</label>
                <textarea
                  required
                  rows={3}
                  value={softwareForm.description}
                  onChange={(e) => setSoftwareForm({ ...softwareForm, description: e.target.value })}
                  className="mt-1 w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">Category</label>
                  <select
                    value={softwareForm.category}
                    onChange={(e) =>
                      setSoftwareForm({ ...softwareForm, category: e.target.value as SoftwareCategory })
                    }
                    className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm"
                  >
                    <option value="desktop">Desktop</option>
                    <option value="android">Android</option>
                    <option value="extension">Extension</option>
                    <option value="utility">Utility</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">Platform</label>
                  <select
                    value={softwareForm.platform}
                    onChange={(e) =>
                      setSoftwareForm({ ...softwareForm, platform: e.target.value as SoftwarePlatform })
                    }
                    className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm"
                  >
                    <option value="Windows">Windows</option>
                    <option value="Android">Android</option>
                    <option value="Chrome">Chrome</option>
                    <option value="macOS">macOS</option>
                    <option value="Cross-Platform">Cross-Platform</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">Format</label>
                  <select
                    value={softwareForm.fileType}
                    onChange={(e) =>
                      setSoftwareForm({ ...softwareForm, fileType: e.target.value as SoftwareFileType })
                    }
                    className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm"
                  >
                    <option value=".exe">.exe</option>
                    <option value=".zip">.zip</option>
                    <option value=".apk">.apk</option>
                    <option value="Store Link">Store Link</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                    Base Price ({softwareForm.currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={softwareForm.pricingMode === 'free'}
                    value={softwareForm.pricingMode === 'free' ? 0 : softwareForm.price}
                    onChange={(e) => setSoftwareForm({ ...softwareForm, price: Number(e.target.value) })}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Pricing Mode, Currency, License & Subscription Packages Builder */}
              <div className="space-y-3 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 bg-slate-50/70 dark:bg-zinc-950/60">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                      Pricing Model
                    </label>
                    <select
                      value={softwareForm.pricingMode}
                      onChange={(e) => {
                        const mode = e.target.value as SoftwarePricingMode;
                        setSoftwareForm({
                          ...softwareForm,
                          pricingMode: mode,
                          generateLicenseKey: mode !== 'free',
                        });
                      }}
                      className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium"
                    >
                      <option value="free">100% Free Download</option>
                      <option value="paid_download">Paid Before Download</option>
                      <option value="freemium_license">Free Download + Paid In-App License</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                      Currency
                    </label>
                    <select
                      value={softwareForm.currency}
                      onChange={(e) =>
                        setSoftwareForm({ ...softwareForm, currency: e.target.value as CurrencyCode })
                      }
                      className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono"
                    >
                      <option value="BDT">BDT (৳)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                        Grace (Hrs)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="168"
                        step="0.5"
                        value={softwareForm.gracePeriodHours}
                        onChange={(e) =>
                          setSoftwareForm({
                            ...softwareForm,
                            gracePeriodHours: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                        Max Devices
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={softwareForm.maxDevices}
                        onChange={(e) =>
                          setSoftwareForm({
                            ...softwareForm,
                            maxDevices: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {softwareForm.pricingMode !== 'free' && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-zinc-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Subscription Packages ({softwareForm.plans.length}/8)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: '+ 1 Year', name: '1 Year Pro', days: 365, price: 499 },
                          { label: '+ 2 Years', name: '2 Years Pro', days: 730, price: 899 },
                          { label: '+ Lifetime', name: 'Lifetime License', days: 0, price: 1499 },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            disabled={softwareForm.plans.length >= 8}
                            onClick={() =>
                              setSoftwareForm((prev) => ({
                                ...prev,
                                plans: [
                                  ...prev.plans,
                                  {
                                    id: `plan_${Date.now()}_${prev.plans.length + 1}`,
                                    name: preset.name,
                                    durationDays: preset.days,
                                    price: preset.price,
                                    badge: preset.days === 0 ? 'Best Value' : '',
                                    description: '',
                                  },
                                ],
                              }))
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-zinc-800 text-[11px] font-semibold text-slate-800 dark:text-zinc-200 hover:bg-teal-600 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                          >
                            {preset.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={softwareForm.plans.length >= 8}
                          onClick={() =>
                            setSoftwareForm((prev) => ({
                              ...prev,
                              plans: [
                                ...prev.plans,
                                {
                                  id: `plan_${Date.now()}_${prev.plans.length + 1}`,
                                  name: 'Custom Plan',
                                  durationDays: 365,
                                  price: 300,
                                  badge: '',
                                  description: '',
                                },
                              ],
                            }))
                          }
                          className="px-2.5 py-1 rounded-lg bg-teal-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                        >
                          + Custom
                        </button>
                      </div>
                    </div>

                    {softwareForm.plans.length === 0 ? (
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        No package tiers added yet. Uses Base Price above, or click preset buttons to add 1 Year / 2 Years / Lifetime plans.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {softwareForm.plans.map((plan, idx) => (
                          <div
                            key={plan.id}
                            className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5"
                          >
                            <input
                              type="text"
                              value={plan.name}
                              onChange={(e) => {
                                const next = [...softwareForm.plans];
                                next[idx] = { ...plan, name: e.target.value };
                                setSoftwareForm({ ...softwareForm, plans: next });
                              }}
                              placeholder="Plan Name (e.g. 1 Year)"
                              className="sm:col-span-4 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs"
                            />
                            <input
                              type="number"
                              min="0"
                              value={plan.durationDays}
                              onChange={(e) => {
                                const next = [...softwareForm.plans];
                                next[idx] = { ...plan, durationDays: Number(e.target.value) };
                                setSoftwareForm({ ...softwareForm, plans: next });
                              }}
                              placeholder="Days (0=Lifetime)"
                              title="Duration in Days (0 = Lifetime)"
                              className="sm:col-span-3 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs font-mono"
                            />
                            <input
                              type="number"
                              min="0"
                              value={plan.price}
                              onChange={(e) => {
                                const next = [...softwareForm.plans];
                                next[idx] = { ...plan, price: Number(e.target.value) };
                                setSoftwareForm({ ...softwareForm, plans: next });
                              }}
                              placeholder="Price"
                              className="sm:col-span-2 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs font-mono"
                            />
                            <input
                              type="text"
                              value={plan.badge || ''}
                              onChange={(e) => {
                                const next = [...softwareForm.plans];
                                next[idx] = { ...plan, badge: e.target.value };
                                setSoftwareForm({ ...softwareForm, plans: next });
                              }}
                              placeholder="Badge"
                              className="sm:col-span-2 h-8 px-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setSoftwareForm({
                                  ...softwareForm,
                                  plans: softwareForm.plans.filter((_, i) => i !== idx),
                                })
                              }
                              className="sm:col-span-1 h-8 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                              aria-label="Remove plan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">Version</label>
                  <input
                    required
                    value={softwareForm.version}
                    onChange={(e) => setSoftwareForm({ ...softwareForm, version: e.target.value })}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                    File Size (Auto-detected on upload)
                  </label>
                  <input
                    required
                    value={softwareForm.fileSize}
                    onChange={(e) => setSoftwareForm({ ...softwareForm, fileSize: e.target.value })}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Direct Package Upload to Firebase Storage */}
              <div className="space-y-2 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 bg-slate-50/70 dark:bg-zinc-950/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <FileArchive className="w-4 h-4 text-teal-600" />
                    Upload Software File (.exe, .apk, .zip) to GitHub Releases
                  </label>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold cursor-pointer hover:opacity-90">
                    <Upload className="w-3.5 h-3.5" />
                    Choose File
                    <input
                      type="file"
                      accept=".exe,.apk,.zip,.msi,.dmg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePackageUpload(file);
                      }}
                    />
                  </label>
                </div>

                {packageUploadProgress !== null && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-600 transition-all"
                        style={{ width: `${packageUploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs font-mono text-teal-700 dark:text-teal-400">
                      Uploading package... {packageUploadProgress}%
                    </p>
                  </div>
                )}

                <input
                  required
                  type="url"
                  value={softwareForm.downloadUrl}
                  onChange={(e) => setSoftwareForm({ ...softwareForm, downloadUrl: e.target.value })}
                  placeholder="Firebase Storage URL auto-fills here (or paste Store Link)"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono"
                />
              </div>

              {/* Direct Thumbnail Image Upload to Firebase Storage */}
              <div className="space-y-2 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 bg-slate-50/70 dark:bg-zinc-950/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-teal-600" />
                    Upload Preview Image from PC
                  </label>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold cursor-pointer hover:opacity-90">
                    <Upload className="w-3.5 h-3.5" />
                    Choose Image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleThumbnailUpload(file);
                      }}
                    />
                  </label>
                </div>

                {imageUploadProgress !== null && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-600 transition-all"
                        style={{ width: `${imageUploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs font-mono text-teal-700 dark:text-teal-400">
                      Uploading image... {imageUploadProgress}%
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {softwareForm.thumbnailUrl && (
                    <img
                      src={softwareForm.thumbnailUrl}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      className="w-16 h-12 rounded-lg object-cover border border-slate-200 dark:border-zinc-800 shrink-0"
                    />
                  )}
                  <input
                    value={softwareForm.thumbnailUrl}
                    onChange={(e) => setSoftwareForm({ ...softwareForm, thumbnailUrl: e.target.value })}
                    placeholder="Image URL auto-fills after upload"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Multiple App Screenshots Upload */}
              <div className="space-y-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 bg-slate-50/70 dark:bg-zinc-950/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-teal-600" />
                    App Screenshots ({softwareForm.screenshots.length}/10)
                  </label>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold cursor-pointer hover:opacity-90">
                    <Upload className="w-3.5 h-3.5" />
                    {screenshotsUploading ? 'Uploading...' : 'Add Screenshots'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={screenshotsUploading || softwareForm.screenshots.length >= 10}
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleScreenshotsUpload(e.target.files);
                        }
                      }}
                    />
                  </label>
                </div>

                {softwareForm.screenshots.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1">
                    {softwareForm.screenshots.map((url, idx) => (
                      <div key={`${url}-${idx}`} className="relative group aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                        <img
                          src={url}
                          alt={`Screenshot ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setSoftwareForm((prev) => ({
                              ...prev,
                              screenshots: prev.screenshots.filter((_, i) => i !== idx),
                            }))
                          }
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove screenshot"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                  Custom Installation Guide (optional, one step per line)
                </label>
                <textarea
                  rows={3}
                  value={softwareForm.installGuide}
                  onChange={(e) => setSoftwareForm({ ...softwareForm, installGuide: e.target.value })}
                  className="mt-1 w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm"
                />
              </div>

              {/* Live Rank Math-Style SEO Score & Google Search Preview */}
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/70 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    SEO Health &amp; Google Snippet Preview
                  </span>
                  <span
                    className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-md ${
                      seoAudit.score >= 80
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : seoAudit.score >= 50
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        : 'bg-red-500/15 text-red-700 dark:text-red-400'
                    }`}
                  >
                    {seoAudit.score} / 100
                  </span>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-1">
                  <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 truncate">
                    toolpotro › software › {cleanSlugPreview || 'slug'}
                  </p>
                  <p className="text-sm font-semibold text-blue-700 dark:text-sky-400 truncate">
                    {seoAudit.titlePreview}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2">
                    {softwareForm.tagline.trim() || 'Add a concise tagline describing key features and target OS.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {seoAudit.checks.map((chk) => (
                    <div
                      key={chk.label}
                      className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-zinc-400"
                    >
                      {chk.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <span>{chk.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={closeSoftwareModal}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold"
                >
                  {t.admin.cancel}
                </button>
                <button
                  type="submit"
                  disabled={savingSoftware || packageUploadProgress !== null || imageUploadProgress !== null}
                  className="h-10 px-5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold disabled:opacity-60"
                >
                  {t.admin.saveSoftware}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coupon Creation Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-zinc-50">
                {t.admin.addCoupon}
              </h2>
              <button
                type="button"
                onClick={() => setShowCouponModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                  Coupon Code
                </label>
                <input
                  required
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="LAUNCH25"
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                    Discount Type
                  </label>
                  <select
                    value={couponForm.discountType}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, discountType: e.target.value as DiscountType })
                    }
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat ($)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                    Value
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={couponForm.discountType === 'percentage' ? 100 : 10000}
                    value={couponForm.discountValue}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, discountValue: Number(e.target.value) })
                    }
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    required
                    value={couponForm.expiryDate}
                    onChange={(e) => setCouponForm({ ...couponForm, expiryDate: e.target.value })}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={couponForm.usageLimit}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, usageLimit: Number(e.target.value) })
                    }
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                  Scope Control
                </label>
                <select
                  value={couponForm.scope}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, scope: e.target.value as CouponScope })
                  }
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm"
                >
                  <option value="all">{t.admin.scopeAll}</option>
                  <option value="specific">{t.admin.scopeSpecific}</option>
                </select>
              </div>

              {couponForm.scope === 'specific' && (
                <div className="space-y-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-800 p-3 bg-slate-50 dark:bg-zinc-950">
                  {softwareList.map((s) => {
                    const checked = couponForm.targetSoftwareIds.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...couponForm.targetSoftwareIds, s.id]
                              : couponForm.targetSoftwareIds.filter((id) => id !== s.id);
                            setCouponForm({ ...couponForm, targetSoftwareIds: next });
                          }}
                        />
                        <span>{s.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCouponModal(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold"
                >
                  {t.admin.cancel}
                </button>
                <button
                  type="submit"
                  disabled={savingCoupon}
                  className="h-10 px-5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold disabled:opacity-60"
                >
                  {t.admin.createCoupon}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
