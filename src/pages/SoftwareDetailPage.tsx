import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  increment,
  limit,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  HardDrive,
  KeyRound,
  Laptop,
  Calendar,
  Tag,
  ShieldCheck,
  Package,
  Share2,
  X,
  Maximize2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import type {
  CouponCode,
  PaymentDisplaySettings,
  PaymentMethod,
  SoftwareItem,
  SubscriptionPlan,
} from '../types';

function generateLicenseKeyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `TP-${seg()}-${seg()}-${seg()}`;
}

export function SoftwareDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useApp();

  const [item, setItem] = useState<SoftwareItem | null>(null);
  const [relatedItems, setRelatedItems] = useState<SoftwareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [iconError, setIconError] = useState(false);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponCode | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [showCouponBox, setShowCouponBox] = useState(false);

  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // Payment Settings & Subscription Plans State
  const [paymentSettings, setPaymentSettings] = useState<PaymentDisplaySettings>({
    bkashNumber: '',
    nagadNumber: '',
    bkashEnabled: true,
    nagadEnabled: true,
    paymentNote: '',
    defaultGraceHours: 2,
  });
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [trxId, setTrxId] = useState('');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [copiedPayNum, setCopiedPayNum] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [orderResult, setOrderResult] = useState<{
    orderId: string;
    licenseKey: string;
    status: 'verified' | 'provisional';
    planName: string;
    amount: number;
    currency: 'BDT' | 'USD';
    graceUntilMs: number;
  } | null>(null);

  // Screenshots Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setIconError(false);
    setLightboxIndex(null);
    const path = `software/${id}`;
    const unsubscribe = onSnapshot(
      doc(db, 'software', id),
      async (snap) => {
        if (!snap.exists()) {
          try {
            const redirSnap = await getDoc(doc(db, 'settings', 'redirects'));
            const map = redirSnap.exists()
              ? (redirSnap.data()?.redirects as Record<string, string> | undefined)
              : undefined;
            const nextSlug = map?.[id];
            if (nextSlug && nextSlug !== id) {
              navigate(`/software/${nextSlug}`, { replace: true });
              return;
            }
          } catch {
            // Fall through to notFound
          }
          setNotFound(true);
          setItem(null);
        } else {
          setItem({ id: snap.id, ...(snap.data() as Omit<SoftwareItem, 'id'>) });
          setNotFound(false);
        }
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.GET, path);
      }
    );
    return () => unsubscribe();
  }, [id, navigate]);

  useEffect(() => {
    if (item) {
      document.title = `${item.name} (${item.version}) — Toolpotro`;
    }
    return () => {
      document.title = 'Toolpotro — Verified Software, Apps & Extensions';
    };
  }, [item]);

  // Fetch "Discover more" items
  useEffect(() => {
    const q = query(
      collection(db, 'software'),
      where('status', '==', 'active'),
      limit(6)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<SoftwareItem, 'id'>) }))
          .filter((s) => s.id !== id)
          .slice(0, 4);
        setRelatedItems(list);
      },
      () => {}
    );
    return () => unsubscribe();
  }, [id]);

  // Fetch admin payment display settings (bKash / Nagad personal numbers)
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'payment'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setPaymentSettings({
            bkashNumber: typeof d?.bkashNumber === 'string' ? d.bkashNumber.trim() : '',
            nagadNumber: typeof d?.nagadNumber === 'string' ? d.nagadNumber.trim() : '',
            bkashEnabled: d?.bkashEnabled !== false,
            nagadEnabled: d?.nagadEnabled !== false,
            paymentNote: typeof d?.paymentNote === 'string' ? d.paymentNote.trim() : '',
            defaultGraceHours: Number(d?.defaultGraceHours ?? 2),
          });
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  // Initialize selected plan and support ?buy=license deep link
  useEffect(() => {
    if (!item) return;
    if (item.plans && item.plans.length > 0 && !item.plans.some((p) => p.id === selectedPlanId)) {
      setSelectedPlanId(item.plans[0].id);
    }
    if (searchParams.get('buy') === 'license') {
      const mode =
        item.pricingMode ||
        (item.price > 0 || (item.plans?.length ?? 0) > 0 ? 'paid_download' : 'free');
      if (mode !== 'free') {
        setShowCheckoutModal(true);
      }
    }
  }, [item, searchParams, selectedPlanId]);

  // Keep payment method synced to enabled providers
  useEffect(() => {
    if (!paymentSettings.bkashEnabled && paymentSettings.nagadEnabled) {
      setPaymentMethod('nagad');
    } else if (paymentSettings.bkashEnabled && !paymentSettings.nagadEnabled) {
      setPaymentMethod('bkash');
    }
  }, [paymentSettings.bkashEnabled, paymentSettings.nagadEnabled]);

  const galleryImages = useMemo(() => {
    if (!item) return [];
    if (item.screenshots && item.screenshots.length > 0) {
      return item.screenshots;
    }
    return item.thumbnailUrl ? [item.thumbnailUrl] : [];
  }, [item]);

  // Keyboard navigation inside lightbox
  useEffect(() => {
    if (lightboxIndex === null || galleryImages.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev + 1) % galleryImages.length
        );
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) =>
          prev === null
            ? null
            : (prev - 1 + galleryImages.length) % galleryImages.length
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, galleryImages.length]);

  const pricingMode = useMemo(() => {
    if (!item) return 'free';
    return (
      item.pricingMode ||
      (item.price > 0 || (item.plans && item.plans.length > 0) ? 'paid_download' : 'free')
    );
  }, [item]);

  const currencySymbol = item?.currency === 'BDT' ? '৳' : '$';
  const currencyCode = item?.currency === 'BDT' ? 'BDT' : 'USD';

  const selectedPlan: SubscriptionPlan | null = useMemo(() => {
    if (!item?.plans || item.plans.length === 0) return null;
    return item.plans.find((p) => p.id === selectedPlanId) || item.plans[0];
  }, [item?.plans, selectedPlanId]);

  const basePrice = useMemo(() => {
    if (!item) return 0;
    if (selectedPlan) return Number(selectedPlan.price) || 0;
    return Number(item.price) || 0;
  }, [item, selectedPlan]);

  const finalPrice = useMemo(() => {
    if (!item) return 0;
    if (!appliedCoupon || basePrice <= 0) return basePrice;
    if (appliedCoupon.discountType === 'percentage') {
      return Math.max(0, Number((basePrice * (1 - appliedCoupon.discountValue / 100)).toFixed(2)));
    }
    return Math.max(0, Number((basePrice - appliedCoupon.discountValue).toFixed(2)));
  }, [item, basePrice, appliedCoupon]);

  const formattedDate = useMemo(() => {
    if (!item?.updatedAt) return '—';
    const raw = item.updatedAt as { toDate?: () => Date } | string | Date;
    const dateObj =
      typeof raw === 'object' && raw !== null && 'toDate' in raw && typeof raw.toDate === 'function'
        ? raw.toDate()
        : new Date(raw as string | Date);
    if (Number.isNaN(dateObj.getTime())) return '—';
    return dateObj.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [item?.updatedAt]);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    setCheckingCoupon(true);
    setCouponError(null);

    try {
      const q = query(
        collection(db, 'coupons'),
        where('code', '==', code),
        where('active', '==', true)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setCouponError(t.details.couponInvalid);
        setCheckingCoupon(false);
        return;
      }

      const couponDoc = snap.docs[0];
      const coupon: CouponCode = {
        id: couponDoc.id,
        ...(couponDoc.data() as Omit<CouponCode, 'id'>),
      };

      const today = new Date().toISOString().slice(0, 10);
      if (coupon.expiryDate && coupon.expiryDate < today) {
        setCouponError(t.details.couponExpired);
        setCheckingCoupon(false);
        return;
      }

      if (coupon.usedCount >= coupon.usageLimit) {
        setCouponError(t.details.couponLimitReached);
        setCheckingCoupon(false);
        return;
      }

      if (coupon.scope === 'specific' && !coupon.targetSoftwareIds.includes(item.id)) {
        setCouponError(t.details.couponNotApplicable);
        setCheckingCoupon(false);
        return;
      }

      setAppliedCoupon(coupon);
      setCouponError(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'coupons');
    } finally {
      setCheckingCoupon(false);
    }
  };

  const triggerFileDownload = () => {
    if (!item) return;
    const anchor = document.createElement('a');
    anchor.href = item.downloadUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.download = `${item.slug}-${item.version}${item.fileType === 'Store Link' ? '' : item.fileType}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleDirectDownload = async () => {
    if (!item || downloading) return;
    setDownloading(true);
    setDownloadSuccess(false);

    try {
      await updateDoc(doc(db, 'software', item.id), {
        downloadsCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await setDoc(doc(db, 'downloadEvents', eventId), {
        softwareId: item.id,
        softwareName: item.name,
        platform: item.platform,
        ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
        finalPrice: pricingMode === 'freemium_license' ? 0 : finalPrice,
        createdAt: serverTimestamp(),
      });

      if (appliedCoupon && pricingMode !== 'freemium_license') {
        await updateDoc(doc(db, 'coupons', appliedCoupon.id), {
          usedCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      }

      triggerFileDownload();
      setDownloadSuccess(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `software/${item.id}`);
    } finally {
      setDownloading(false);
    }
  };

  const openCheckoutModal = (planId?: string) => {
    if (planId) setSelectedPlanId(planId);
    setOrderResult(null);
    setCheckoutError(null);
    setShowCheckoutModal(true);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || checkoutSubmitting) return;

    const cleanName = customerName.trim();
    const cleanEmail = customerEmail.trim();
    const cleanPhone = senderPhone.trim();
    const cleanTrx = trxId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

    if (cleanName.length < 1 || cleanEmail.length < 3 || !cleanEmail.includes('@')) {
      setCheckoutError('Please enter a valid Name and Email / Gmail address.');
      return;
    }
    if (cleanPhone.length < 4) {
      setCheckoutError('Please enter your sender bKash or Nagad phone number.');
      return;
    }
    if (cleanTrx.length < 4) {
      setCheckoutError('Please enter a valid Transaction ID (TrxID).');
      return;
    }

    setCheckoutSubmitting(true);
    setCheckoutError(null);

    const nowMs = Date.now();
    const orderId = `ord_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;
    const licenseKey = generateLicenseKeyCode();
    const graceHours =
      typeof item.gracePeriodHours === 'number' && item.gracePeriodHours >= 0
        ? item.gracePeriodHours
        : paymentSettings.defaultGraceHours || 2;
    const graceUntilMs = Math.floor(nowMs + graceHours * 3600 * 1000);
    const durationDays = selectedPlan ? Math.max(0, Math.floor(selectedPlan.durationDays)) : 365;
    const expiresAtMs = durationDays > 0 ? Math.floor(nowMs + durationDays * 86400 * 1000) : 0;
    const maxDevices = Math.max(1, Math.min(50, Math.floor(item.maxDevices || 1)));
    const planName = selectedPlan?.name || 'Standard License';
    const planId = selectedPlan?.id || 'standard';

    try {
      const batch = writeBatch(db);

      batch.set(doc(db, 'orders', orderId), {
        orderId,
        softwareId: item.id,
        softwareName: item.name,
        planId,
        planName,
        durationDays,
        currency: currencyCode,
        amount: finalPrice,
        ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
        paymentMethod,
        customerName: cleanName.slice(0, 100),
        customerEmail: cleanEmail.slice(0, 200),
        senderPhone: cleanPhone.slice(0, 30),
        trxId: cleanTrx.slice(0, 60),
        licenseKey,
        status: 'provisional',
        graceUntilMs,
        expiresAtMs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'licenses', licenseKey), {
        licenseKey,
        orderId,
        softwareId: item.id,
        softwareName: item.name,
        planId,
        planName,
        durationDays,
        currency: currencyCode,
        amount: finalPrice,
        trxId: cleanTrx.slice(0, 60),
        status: 'provisional',
        graceUntilMs,
        expiresAtMs,
        maxDevices,
        boundDevices: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (pricingMode === 'paid_download') {
        const eventId = `evt_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;
        batch.update(doc(db, 'software', item.id), {
          downloadsCount: increment(1),
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(db, 'downloadEvents', eventId), {
          softwareId: item.id,
          softwareName: item.name,
          platform: item.platform,
          ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
          finalPrice,
          createdAt: serverTimestamp(),
        });
      }

      if (appliedCoupon) {
        batch.update(doc(db, 'coupons', appliedCoupon.id), {
          usedCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      // Check instant SMS match against server PaySync inbox
      let effectiveStatus: 'verified' | 'provisional' = 'provisional';
      try {
        const matchResp = await fetch('/api/payments/match-trx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trxId: cleanTrx,
            licenseKey,
            orderId,
            amount: finalPrice,
          }),
        });
        if (matchResp.ok) {
          const matchData = (await matchResp.json()) as { matched?: boolean };
          if (matchData.matched) {
            effectiveStatus = 'verified';
          }
        }
      } catch {
        // Ignore network failure; provisional grace access remains active
      }

      setOrderResult({
        orderId,
        licenseKey,
        status: effectiveStatus,
        planName,
        amount: finalPrice,
        currency: currencyCode,
        graceUntilMs,
      });

      if (pricingMode === 'paid_download') {
        triggerFileDownload();
        setDownloadSuccess(true);
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: item?.name, url: shareUrl });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const scrollGallery = (dir: 'left' | 'right') => {
    if (!galleryRef.current) return;
    const offset = dir === 'left' ? -360 : 360;
    galleryRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 animate-pulse">
        <div className="h-4 w-32 bg-teal-900/15 dark:bg-teal-500/15 rounded" />
        <div className="h-56 rounded-2xl bg-[#f2faf8]/80 dark:bg-[#081a1f]/90 border border-teal-900/15 dark:border-teal-500/20" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-72 rounded-2xl bg-[#f2faf8]/80 dark:bg-[#081a1f]/90 border border-teal-900/15 dark:border-teal-500/20" />
          <div className="lg:col-span-4 h-72 rounded-2xl bg-[#f2faf8]/80 dark:bg-[#081a1f]/90 border border-teal-900/15 dark:border-teal-500/20" />
        </div>
      </main>
    );
  }

  if (notFound || !item) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-[#062326] dark:text-white">
          {t.details.notFoundTitle}
        </h1>
        <p className="text-sm text-[#244e52] dark:text-teal-100/70">
          {t.details.notFoundSubtitle}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#07262a] text-[#2ee6b8] dark:bg-[#10d9a0] dark:text-slate-950 text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.details.backToCatalog}
        </Link>
      </main>
    );
  }

  const guideSteps = item.installGuide
    ? item.installGuide.split('\n').filter((line) => line.trim().length > 0)
    : t.details.defaultGuides[item.platform] || t.details.defaultGuides['Cross-Platform'];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-[#184549] hover:text-[#062326] dark:text-teal-200/80 dark:hover:text-[#2ee6b8] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t.details.backToCatalog}
      </Link>

      {/* Store-Style Hero Banner */}
      <section className="rounded-2xl border border-teal-900/15 dark:border-teal-500/20 bg-gradient-to-br from-[#f2faf8]/95 via-[#e2f3ef]/95 to-[#cfeae3]/95 dark:from-[#081d22]/95 dark:via-[#061519]/95 dark:to-[#040e11]/95 backdrop-blur-xs p-6 sm:p-8 lg:p-10 shadow-sm">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
          {/* Compact App Icon */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#dff0ec] dark:bg-[#0d262d] border border-teal-900/15 dark:border-teal-500/20 overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
            {item.thumbnailUrl && !iconError ? (
              <img
                src={item.thumbnailUrl}
                alt={item.name}
                referrerPolicy="no-referrer"
                onError={() => setIconError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="w-10 h-10 text-teal-700/70 dark:text-teal-300/70 stroke-[1.5]" />
            )}
          </div>

          {/* App Title, Meta, Tagline & Action Row */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="space-y-1.5">
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#062326] dark:text-white">
                {item.name}
              </h1>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs font-mono text-[#2c595d] dark:text-teal-200/70">
                <span>{item.platform}</span>
                <span aria-hidden="true">·</span>
                <span>{item.fileType}</span>
                <span aria-hidden="true">·</span>
                <span>{item.version}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{item.fileSize}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {item.downloadsCount.toLocaleString()} {t.catalog.downloadsLabel}
                </span>
              </div>
            </div>

            <p className="text-sm sm:text-base text-[#1c4448] dark:text-slate-300 max-w-2xl leading-relaxed mx-auto md:mx-0">
              {item.tagline}
            </p>

            {/* Primary CTA Row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
              {pricingMode === 'free' && (
                <button
                  type="button"
                  onClick={handleDirectDownload}
                  disabled={downloading}
                  className="h-11 px-7 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] text-white dark:bg-[#10d9a0] dark:hover:bg-[#0ec28f] dark:text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer min-w-[200px]"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {downloading
                      ? t.details.downloading
                      : `${t.details.directDownload} (${t.catalog.freeLabel})`}
                  </span>
                </button>
              )}

              {pricingMode === 'paid_download' && finalPrice > 0 && (
                <button
                  type="button"
                  onClick={() => openCheckoutModal()}
                  className="h-11 px-7 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] text-white dark:bg-[#10d9a0] dark:hover:bg-[#0ec28f] dark:text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer min-w-[210px]"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {t.details.buyAndDownload} ({currencySymbol}{finalPrice})
                  </span>
                </button>
              )}

              {pricingMode === 'paid_download' && finalPrice <= 0 && (
                <button
                  type="button"
                  onClick={handleDirectDownload}
                  disabled={downloading}
                  className="h-11 px-7 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] text-white dark:bg-[#10d9a0] dark:hover:bg-[#0ec28f] dark:text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer min-w-[200px]"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {downloading
                      ? t.details.downloading
                      : `${t.details.directDownload} (${t.catalog.freeLabel})`}
                  </span>
                </button>
              )}

              {pricingMode === 'freemium_license' && (
                <>
                  <button
                    type="button"
                    onClick={handleDirectDownload}
                    disabled={downloading}
                    className="h-11 px-6 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] text-white dark:bg-[#10d9a0] dark:hover:bg-[#0ec28f] dark:text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{downloading ? t.details.downloading : t.details.downloadFreeVersion}</span>
                  </button>

                  {basePrice > 0 && (
                    <button
                      type="button"
                      onClick={() => openCheckoutModal()}
                      className="h-11 px-6 rounded-xl border border-teal-800/30 dark:border-[#10d9a0]/45 bg-[#07262a] hover:bg-[#0b3338] text-[#2ee6b8] dark:bg-[#0c2d33] dark:hover:bg-[#103b42] dark:text-[#2ee6b8] font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>
                        {t.details.buyLicense} ({currencySymbol}{finalPrice})
                      </span>
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={handleShare}
                aria-label="Share"
                className="h-11 px-3.5 rounded-xl border border-teal-900/15 dark:border-teal-500/25 bg-[#f7fcfa] dark:bg-[#0b2329] text-[#062326] dark:text-teal-100 hover:bg-white dark:hover:bg-[#0f2e36] transition-colors inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                {copiedShare && <span>Copied</span>}
              </button>

              {pricingMode !== 'free' && (
                <button
                  type="button"
                  onClick={() => setShowCouponBox((prev) => !prev)}
                  className="h-11 px-3.5 rounded-xl border border-teal-900/15 dark:border-teal-500/25 bg-[#f7fcfa] dark:bg-[#0b2329] text-[#062326] dark:text-teal-100 hover:bg-white dark:hover:bg-[#0f2e36] transition-colors inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>{t.details.applyCoupon}</span>
                </button>
              )}
            </div>

            {downloadSuccess && (
              <div className="inline-flex items-center gap-2 text-xs text-teal-800 dark:text-[#2ee6b8] bg-teal-500/15 dark:bg-[#10d9a0]/15 border border-teal-700/20 dark:border-[#10d9a0]/30 px-3 py-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{t.details.downloadStarted}</span>
              </div>
            )}

            {/* Collapsible Coupon Input */}
            {(showCouponBox || appliedCoupon) && (
              <div className="max-w-md mx-auto md:mx-0 pt-2">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-teal-500/15 dark:bg-[#10d9a0]/15 border border-teal-700/25 dark:border-[#10d9a0]/30 text-xs">
                    <span className="font-mono font-semibold text-[#062326] dark:text-[#2ee6b8]">
                      {appliedCoupon.code} — {t.details.couponApplied} (
                      {appliedCoupon.discountType === 'percentage'
                        ? `${appliedCoupon.discountValue}%`
                        : `${currencySymbol}${appliedCoupon.discountValue}`}
                      )
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponInput('');
                      }}
                      className="text-[#0d9488] dark:text-[#2ee6b8] hover:opacity-75 p-1 cursor-pointer"
                      aria-label={t.details.removeCoupon}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder={t.details.couponPlaceholder}
                      className="flex-1 h-10 px-3 rounded-xl border border-teal-900/20 dark:border-teal-500/25 bg-white/90 dark:bg-[#07181c] font-mono text-xs text-[#062326] dark:text-white placeholder:text-[#4e777b] dark:placeholder:text-teal-200/45 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="submit"
                      disabled={checkingCoupon || !couponInput.trim()}
                      className="h-10 px-4 rounded-xl border border-teal-900/20 dark:border-teal-500/25 bg-[#07262a] text-[#2ee6b8] dark:bg-[#10d9a0] dark:text-slate-950 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
                    >
                      {t.details.applyCoupon}
                    </button>
                  </form>
                )}
                {couponError && (
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1.5 text-left">
                    {couponError}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1 text-xs text-[#2c595d] dark:text-teal-200/70">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0d9488] dark:text-[#2ee6b8] shrink-0" />
                <span>{t.details.zeroSpamNote}</span>
              </span>
              {(pricingMode !== 'free' || item.generateLicenseKey) && (
                <Link
                  to="/license"
                  className="inline-flex items-center gap-1 font-semibold text-[#0d9488] dark:text-[#2ee6b8] hover:underline"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{t.details.checkLicenseStatus}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Subscription Packages Strip */}
      {pricingMode !== 'free' && item.plans && item.plans.length > 0 && (
        <section className="rounded-2xl border border-teal-900/15 dark:border-teal-500/20 bg-[#f2faf8]/92 dark:bg-[#081a1f]/92 backdrop-blur-xs p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-[#062326] dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0d9488] dark:text-[#2ee6b8]" />
                {t.details.plansTitle}
              </h2>
              <p className="text-xs text-[#2c595d] dark:text-teal-200/70 mt-0.5">
                {t.details.plansSubtitle}
              </p>
            </div>
            {item.maxDevices && (
              <span className="text-xs font-mono text-[#184549] dark:text-teal-200/80 bg-[#dff0ec] dark:bg-[#0d262d] px-2.5 py-1 rounded-lg self-start sm:self-auto">
                Up to {item.maxDevices} device{item.maxDevices > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {item.plans.map((plan) => {
              const isSelected = selectedPlan?.id === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPlanId(plan.id);
                    }
                  }}
                  className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#0d9488] dark:border-[#10d9a0] bg-white/95 dark:bg-[#0c262d] shadow-md shadow-teal-950/5 ring-1 ring-[#0d9488]/40 dark:ring-[#10d9a0]/40'
                      : 'border-teal-900/15 dark:border-teal-500/20 bg-white/60 dark:bg-[#061519]/70 hover:border-teal-700/35 dark:hover:border-teal-400/35'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-sm text-[#062326] dark:text-white">
                        {plan.name}
                      </span>
                      {plan.badge && (
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-teal-500/15 text-teal-800 dark:bg-[#10d9a0]/20 dark:text-[#2ee6b8]">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-2xl font-bold text-[#062326] dark:text-[#2ee6b8] tabular-nums">
                      {currencySymbol}{plan.price}
                    </p>
                    <p className="text-xs font-mono text-[#2c595d] dark:text-teal-200/70">
                      {plan.durationDays > 0
                        ? `${plan.durationDays} ${t.details.daysLabel}`
                        : t.details.lifetimeLabel}
                    </p>
                    {plan.description && (
                      <p className="text-xs text-[#1e4347] dark:text-slate-300 pt-1">
                        {plan.description}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCheckoutModal(plan.id);
                    }}
                    className={`w-full h-9 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#0d9488] hover:bg-[#0f766e] text-white dark:bg-[#10d9a0] dark:hover:bg-[#0ec28f] dark:text-slate-950'
                        : 'bg-[#d6ede7] hover:bg-[#c3e2da] text-[#062326] dark:bg-[#11333b] dark:hover:bg-[#16424c] dark:text-teal-100'
                    }`}
                  >
                    {pricingMode === 'paid_download' ? t.details.buyAndDownload : t.details.buyLicense}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Screenshots, Description, Specs & Install Guide */}
        <div className="lg:col-span-8 space-y-6">
          {/* Screenshots Carousel Card */}
          {galleryImages.length > 0 && (
            <section className="rounded-2xl border border-teal-900/15 dark:border-teal-500/20 bg-[#f2faf8]/92 dark:bg-[#081a1f]/92 backdrop-blur-xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base sm:text-lg font-bold text-[#062326] dark:text-white">
                  Screenshots
                </h2>
                {galleryImages.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => scrollGallery('left')}
                      aria-label="Scroll screenshots left"
                      className="h-8 w-8 rounded-lg border border-teal-900/15 dark:border-teal-500/25 flex items-center justify-center text-[#184549] dark:text-teal-200 hover:bg-teal-900/5 dark:hover:bg-[#0d272e] cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollGallery('right')}
                      aria-label="Scroll screenshots right"
                      className="h-8 w-8 rounded-lg border border-teal-900/15 dark:border-teal-500/25 flex items-center justify-center text-[#184549] dark:text-teal-200 hover:bg-teal-900/5 dark:hover:bg-[#0d272e] cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div
                ref={galleryRef}
                className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 snap-x snap-mandatory"
              >
                {galleryImages.map((src, idx) => (
                  <button
                    key={`${src}-${idx}`}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className="group relative shrink-0 w-[80%] sm:w-[320px] md:w-[360px] aspect-video rounded-xl overflow-hidden border border-teal-900/15 dark:border-teal-500/20 bg-[#dff0ec] dark:bg-[#051114] snap-start cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    <img
                      src={src}
                      alt={`${item.name} screenshot ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <span className="absolute bottom-2.5 right-2.5 h-7 w-7 rounded-lg bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Description & Technical Specs */}
          <section className="rounded-2xl border border-teal-900/15 dark:border-teal-500/20 bg-[#f2faf8]/92 dark:bg-[#081a1f]/92 backdrop-blur-xs p-5 sm:p-6 space-y-6">
            <div className="space-y-3">
              <h2 className="font-display text-base sm:text-lg font-bold text-[#062326] dark:text-white">
                Description
              </h2>
              <p className="text-sm sm:text-[15px] text-[#1e4347] dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {item.description}
              </p>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-teal-900/10 dark:border-teal-500/15 text-sm">
              <div className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs text-[#2c595d] dark:text-teal-200/70">
                  <HardDrive className="w-3.5 h-3.5" />
                  {t.details.fileSize}
                </dt>
                <dd className="font-mono font-medium text-[#062326] dark:text-white tabular-nums">
                  {item.fileSize}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs text-[#2c595d] dark:text-teal-200/70">
                  <Laptop className="w-3.5 h-3.5" />
                  {t.details.platform}
                </dt>
                <dd className="font-medium text-[#062326] dark:text-white">
                  {item.platform} ({item.fileType})
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs text-[#2c595d] dark:text-teal-200/70">
                  <Calendar className="w-3.5 h-3.5" />
                  {t.details.lastUpdated}
                </dt>
                <dd className="font-mono text-[#062326] dark:text-white tabular-nums">
                  {formattedDate}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs text-[#2c595d] dark:text-teal-200/70">
                  <Download className="w-3.5 h-3.5" />
                  {t.details.totalDownloads}
                </dt>
                <dd className="font-mono font-semibold text-[#062326] dark:text-white tabular-nums">
                  {item.downloadsCount.toLocaleString()}
                </dd>
              </div>
            </dl>
          </section>

          {/* Installation Guide */}
          <section className="rounded-2xl border border-teal-900/15 dark:border-teal-500/20 bg-[#f2faf8]/92 dark:bg-[#081a1f]/92 backdrop-blur-xs p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-base sm:text-lg font-bold text-[#062326] dark:text-white">
              {t.details.installGuideTitle}
            </h2>
            <ol className="space-y-3">
              {guideSteps.map((step, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 text-sm text-[#1e4347] dark:text-slate-300 leading-relaxed"
                >
                  <span className="font-mono text-xs font-semibold w-6 h-6 rounded-md bg-[#d6ede7] dark:bg-[#0f2c33] text-[#062326] dark:text-[#2ee6b8] flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                    {idx + 1}
                  </span>
                  <span>{step.replace(/^\d+\.\s*/, '')}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Right Sidebar: Discover More */}
        <aside className="lg:col-span-4 rounded-2xl border border-teal-900/15 dark:border-teal-500/20 bg-[#f2faf8]/92 dark:bg-[#081a1f]/92 backdrop-blur-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#062326] dark:text-white">
              Discover more
            </h2>
            <Link
              to="/"
              className="text-xs font-semibold text-[#0d9488] dark:text-[#2ee6b8] hover:underline"
            >
              {t.nav.catalog}
            </Link>
          </div>

          {relatedItems.length === 0 ? (
            <p className="text-xs text-[#2c595d] dark:text-teal-200/70">
              {t.catalog.emptyTitle}
            </p>
          ) : (
            <div className="divide-y divide-teal-900/10 dark:divide-teal-500/15">
              {relatedItems.map((rel) => (
                <Link
                  key={rel.id}
                  to={`/software/${rel.id}`}
                  className="py-3 first:pt-1 last:pb-1 flex items-center gap-3 group"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#dff0ec] dark:bg-[#0d262d] border border-teal-900/10 dark:border-teal-500/20 overflow-hidden shrink-0 flex items-center justify-center">
                    {rel.thumbnailUrl ? (
                      <img
                        src={rel.thumbnailUrl}
                        alt={rel.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-5 h-5 text-teal-700/70 dark:text-teal-300/70" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#062326] dark:text-white truncate group-hover:text-[#0d9488] dark:group-hover:text-[#2ee6b8] transition-colors">
                      {rel.name}
                    </p>
                    <p className="text-[11px] font-mono text-[#2c595d] dark:text-teal-200/70 truncate">
                      {rel.platform} · {rel.fileType}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-[#d6ede7] dark:bg-[#10d9a0]/15 text-[#062326] dark:text-[#2ee6b8] shrink-0 tabular-nums">
                    {rel.price > 0 ? `${rel.currency === 'BDT' ? '৳' : '$'}${rel.price}` : t.catalog.freeLabel}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* bKash / Nagad Checkout & Instant License Modal */}
      {showCheckoutModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowCheckoutModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-teal-900/20 dark:border-teal-500/25 bg-[#f7fcfa] dark:bg-[#07181c] shadow-2xl overflow-hidden my-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-teal-900/15 dark:border-teal-500/20 bg-[#e8f5f1] dark:bg-[#0a2228]">
              <div>
                <h2 className="font-display text-lg font-bold text-[#062326] dark:text-white">
                  {orderResult ? t.details.orderSuccessTitle : t.details.checkoutTitle}
                </h2>
                <p className="text-xs text-[#2c595d] dark:text-teal-200/70 mt-0.5">
                  {item.name} {selectedPlan ? `· ${selectedPlan.name}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="p-2 rounded-lg text-[#2c595d] dark:text-teal-200/70 hover:bg-teal-900/10 dark:hover:bg-teal-500/15 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {orderResult ? (
              <div className="p-6 space-y-5">
                <div
                  className={`rounded-xl border p-4 flex items-start gap-3 ${
                    orderResult.status === 'verified'
                      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
                      : 'border-teal-600/30 bg-teal-500/10 text-[#062326] dark:text-teal-100'
                  }`}
                >
                  {orderResult.status === 'verified' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="w-5 h-5 text-[#0d9488] dark:text-[#2ee6b8] shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-sm">
                      {orderResult.status === 'verified'
                        ? t.details.orderVerifiedBadge
                        : t.details.orderProvisionalBadge}
                    </p>
                    <p className="opacity-85">{t.details.graceNote}</p>
                  </div>
                </div>

                {/* License Key Box */}
                <div className="rounded-xl border border-teal-900/20 dark:border-teal-500/25 bg-white dark:bg-[#051114] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#2c595d] dark:text-teal-200/70">
                    <span className="font-semibold flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-[#0d9488] dark:text-[#2ee6b8]" />
                      {t.details.licenseKeyLabel}
                    </span>
                    <span className="font-mono">{orderResult.planName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-[#eef8f5] dark:bg-[#0b2329] rounded-lg px-3 py-2.5 border border-teal-900/10 dark:border-teal-500/20">
                    <code className="font-mono text-base sm:text-lg font-bold tracking-wider text-[#062326] dark:text-[#2ee6b8] select-all">
                      {orderResult.licenseKey}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(orderResult.licenseKey);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      className="px-2.5 py-1.5 rounded-md bg-[#0d9488] text-white dark:bg-[#10d9a0] dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey ? t.details.copied : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-[#2c595d] dark:text-teal-200/60">
                    Order ID: {orderResult.orderId}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={triggerFileDownload}
                    className="flex-1 h-11 px-5 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] text-white dark:bg-[#10d9a0] dark:hover:bg-[#0ec28f] dark:text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.details.directDownload}</span>
                  </button>
                  <Link
                    to={`/license?key=${encodeURIComponent(orderResult.licenseKey)}`}
                    className="h-11 px-4 rounded-xl border border-teal-900/20 dark:border-teal-500/25 bg-white dark:bg-[#0b2329] text-xs font-semibold text-[#062326] dark:text-teal-100 inline-flex items-center justify-center gap-1.5 hover:bg-teal-50 dark:hover:bg-[#103038]"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{t.details.checkLicenseStatus}</span>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCheckoutSubmit} className="p-6 space-y-4">
                <p className="text-xs text-[#1e4347] dark:text-slate-300 leading-relaxed">
                  {t.details.checkoutSubtitle}
                </p>

                {/* Package Switcher inside modal if multiple plans */}
                {item.plans && item.plans.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {item.plans.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlanId(p.id)}
                        className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          selectedPlan?.id === p.id
                            ? 'border-[#0d9488] dark:border-[#10d9a0] bg-teal-500/10 dark:bg-[#10d9a0]/15'
                            : 'border-teal-900/15 dark:border-teal-500/20 bg-white/80 dark:bg-[#051114]'
                        }`}
                      >
                        <div className="text-xs font-semibold text-[#062326] dark:text-white truncate">
                          {p.name}
                        </div>
                        <div className="font-mono text-sm font-bold text-[#0d9488] dark:text-[#2ee6b8]">
                          {currencySymbol}{p.price}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Total Payable Strip */}
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#dff0ec] dark:bg-[#0c262d] border border-teal-900/15 dark:border-teal-500/20">
                  <span className="text-xs font-semibold text-[#062326] dark:text-teal-100">
                    {t.details.finalPrice} {appliedCoupon ? `(${appliedCoupon.code})` : ''}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    {appliedCoupon && basePrice !== finalPrice && (
                      <span className="text-xs line-through text-[#4e777b] dark:text-teal-200/50">
                        {currencySymbol}{basePrice}
                      </span>
                    )}
                    <span className="text-lg font-bold text-[#062326] dark:text-[#2ee6b8]">
                      {currencySymbol}{finalPrice}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#062326] dark:text-teal-100 block">
                    {t.details.paymentMethodLabel}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {paymentSettings.bkashEnabled && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bkash')}
                        className={`h-10 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          paymentMethod === 'bkash'
                            ? 'border-pink-600 bg-pink-600/15 text-pink-700 dark:text-pink-300 ring-1 ring-pink-500/40'
                            : 'border-teal-900/15 dark:border-teal-500/20 bg-white dark:bg-[#051114] text-[#1e4347] dark:text-slate-300'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-pink-500" />
                        bKash (Personal)
                      </button>
                    )}
                    {paymentSettings.nagadEnabled && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('nagad')}
                        className={`h-10 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          paymentMethod === 'nagad'
                            ? 'border-orange-600 bg-orange-600/15 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500/40'
                            : 'border-teal-900/15 dark:border-teal-500/20 bg-white dark:bg-[#051114] text-[#1e4347] dark:text-slate-300'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        Nagad (Personal)
                      </button>
                    )}
                  </div>

                  {/* Admin Receiver Number Card */}
                  {(() => {
                    const activeNumber =
                      paymentMethod === 'bkash'
                        ? paymentSettings.bkashNumber
                        : paymentSettings.nagadNumber;
                    return (
                      <div className="rounded-xl border border-teal-900/15 dark:border-teal-500/20 bg-white dark:bg-[#051114] p-3 space-y-2">
                        <p className="text-[11px] text-[#2c595d] dark:text-teal-200/75">
                          {t.details.sendMoneyInstruction}
                        </p>
                        {activeNumber ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-base font-bold text-[#062326] dark:text-white select-all">
                              {activeNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(activeNumber);
                                setCopiedPayNum(true);
                                setTimeout(() => setCopiedPayNum(false), 2000);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#dff0ec] dark:bg-[#0e2a31] text-[#062326] dark:text-[#2ee6b8] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              {copiedPayNum ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedPayNum ? t.details.copied : t.details.copyNumber}</span>
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Payment number not set yet. Admin can set it in Admin → Payments &amp; Licenses.
                          </p>
                        )}
                        {paymentSettings.paymentNote && (
                          <p className="text-[11px] text-[#1e4347] dark:text-slate-400 border-t border-teal-900/10 dark:border-teal-500/15 pt-1.5">
                            {paymentSettings.paymentNote}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Customer & Transaction Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[#062326] dark:text-teal-100">
                      {t.details.customerNameLabel}
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Arif Rahman"
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-teal-900/20 dark:border-teal-500/25 bg-white dark:bg-[#051114] text-sm text-[#062326] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#062326] dark:text-teal-100">
                      {t.details.customerEmailLabel}
                    </label>
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="example@gmail.com"
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-teal-900/20 dark:border-teal-500/25 bg-white dark:bg-[#051114] text-sm text-[#062326] dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[#062326] dark:text-teal-100">
                      {t.details.senderPhoneLabel}
                    </label>
                    <input
                      type="tel"
                      required
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-teal-900/20 dark:border-teal-500/25 bg-white dark:bg-[#051114] text-sm font-mono text-[#062326] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#062326] dark:text-teal-100">
                      {t.details.trxIdLabel}
                    </label>
                    <input
                      type="text"
                      required
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                      placeholder="BKA9X72LMQ"
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-teal-900/20 dark:border-teal-500/25 bg-white dark:bg-[#051114] text-sm font-mono uppercase text-[#062326] dark:text-white"
                    />
                  </div>
                </div>

                {checkoutError && (
                  <div className="rounded-xl border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
                    {checkoutError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={checkoutSubmitting}
                  className="w-full h-11 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] text-white dark:bg-[#10d9a0] dark:hover:bg-[#0ec28f] dark:text-slate-950 font-bold text-sm transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {checkoutSubmitting ? t.details.submittingCheckout : t.details.submitCheckout}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Screenshot Lightbox Modal */}
      {lightboxIndex !== null && galleryImages[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close screenshot preview"
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {galleryImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(
                    (lightboxIndex - 1 + galleryImages.length) % galleryImages.length
                  );
                }}
                aria-label="Previous screenshot"
                className="absolute left-3 sm:left-6 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex + 1) % galleryImages.length);
                }}
                aria-label="Next screenshot"
                className="absolute right-3 sm:right-6 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div
            className="max-w-5xl w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={galleryImages[lightboxIndex]}
              alt={`${item.name} screenshot ${lightboxIndex + 1}`}
              referrerPolicy="no-referrer"
              className="max-h-[82vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
            />
            <span className="font-mono text-xs text-zinc-300 tabular-nums">
              {lightboxIndex + 1} / {galleryImages.length}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
