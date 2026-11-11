import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  increment,
} from 'firebase/firestore';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  HardDrive,
  Laptop,
  Calendar,
  Tag,
  ShieldCheck,
  Package,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import type { CouponCode, SoftwareItem } from '../types';

export function SoftwareDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useApp();

  const [item, setItem] = useState<SoftwareItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imgError, setImgError] = useState(false);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponCode | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    const path = `software/${id}`;
    const unsubscribe = onSnapshot(
      doc(db, 'software', id),
      (snap) => {
        if (!snap.exists()) {
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
  }, [id]);

  const finalPrice = useMemo(() => {
    if (!item) return 0;
    if (!appliedCoupon || item.price <= 0) return item.price;
    if (appliedCoupon.discountType === 'percentage') {
      return Math.max(0, Number((item.price * (1 - appliedCoupon.discountValue / 100)).toFixed(2)));
    }
    return Math.max(0, Number((item.price - appliedCoupon.discountValue).toFixed(2)));
  }, [item, appliedCoupon]);

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

      if (
        coupon.scope === 'specific' &&
        !coupon.targetSoftwareIds.includes(item.id)
      ) {
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

  const handleDirectDownload = async () => {
    if (!item || downloading) return;
    setDownloading(true);
    setDownloadSuccess(false);

    try {
      // Increment downloadsCount atomically
      await updateDoc(doc(db, 'software', item.id), {
        downloadsCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      // Log download event for analytics
      const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await setDoc(doc(db, 'downloadEvents', eventId), {
        softwareId: item.id,
        softwareName: item.name,
        platform: item.platform,
        ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
        finalPrice,
        createdAt: serverTimestamp(),
      });

      // Increment coupon usage if applied
      if (appliedCoupon) {
        await updateDoc(doc(db, 'coupons', appliedCoupon.id), {
          usedCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      }

      // Trigger direct download without spam/popups
      const anchor = document.createElement('a');
      anchor.href = item.downloadUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.download = `${item.slug}-${item.version}${item.fileType === 'Store Link' ? '' : item.fileType}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setDownloadSuccess(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `software/${item.id}`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-32 bg-slate-200 dark:bg-zinc-800 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 h-80 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
            <div className="lg:col-span-5 h-80 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  if (notFound || !item) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-zinc-50">
          {t.details.notFoundTitle}
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          {t.details.notFoundSubtitle}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium"
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t.details.backToCatalog}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Left Column: Preview, Overview, Installation Guide */}
        <div className="lg:col-span-7 space-y-8">
          <div className="aspect-[16/10] rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900">
            {item.thumbnailUrl && !imgError ? (
              <img
                src={item.thumbnailUrl}
                alt={item.name}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-zinc-500">
                <Package className="w-12 h-12 stroke-[1.5]" />
                <span className="font-mono text-xs">{item.platform}</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-zinc-400">
              <span>{item.platform}</span>
              <span aria-hidden="true">·</span>
              <span>{item.fileType}</span>
              <span aria-hidden="true">·</span>
              <span>{item.version}</span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
              {item.name}
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-zinc-300 leading-relaxed">
              {item.description}
            </p>
          </div>

          {/* Installation Guide Card */}
          <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 space-y-5">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-zinc-50">
              {t.details.installGuideTitle}
            </h2>
            <ol className="space-y-3.5">
              {guideSteps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3.5 text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
                  <span className="font-mono text-xs font-semibold w-6 h-6 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                    {idx + 1}
                  </span>
                  <span>{step.replace(/^\d+\.\s*/, '')}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Right Column: Contiguous Download & Specs Module */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 space-y-6">
          {/* Price & Version Header */}
          <div className="flex items-baseline justify-between gap-4 pb-5 border-b border-slate-100 dark:border-zinc-800">
            <div>
              <p className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                {t.details.version}
              </p>
              <p className="font-mono text-lg font-semibold text-slate-900 dark:text-zinc-50 mt-0.5">
                {item.version}
              </p>
            </div>
            <div className="text-right">
              {item.price > 0 ? (
                <div className="space-y-0.5">
                  {appliedCoupon && finalPrice < item.price && (
                    <p className="font-mono text-xs line-through text-slate-400 dark:text-zinc-500 tabular-nums">
                      ${item.price.toFixed(2)}
                    </p>
                  )}
                  <p className="font-display text-2xl font-bold text-slate-900 dark:text-zinc-50 tabular-nums">
                    ${finalPrice.toFixed(2)}
                  </p>
                </div>
              ) : (
                <p className="font-display text-2xl font-bold text-teal-700 dark:text-teal-400">
                  {t.catalog.freeLabel}
                </p>
              )}
            </div>
          </div>

          {/* Technical Specifications Grid */}
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <dt className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <HardDrive className="w-3.5 h-3.5" />
                {t.details.fileSize}
              </dt>
              <dd className="font-mono font-medium text-slate-900 dark:text-zinc-100 tabular-nums">
                {item.fileSize}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <Laptop className="w-3.5 h-3.5" />
                {t.details.platform}
              </dt>
              <dd className="font-medium text-slate-900 dark:text-zinc-100">
                {item.platform} ({item.fileType})
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <Calendar className="w-3.5 h-3.5" />
                {t.details.lastUpdated}
              </dt>
              <dd className="font-mono text-slate-900 dark:text-zinc-100 tabular-nums">
                {formattedDate}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <Download className="w-3.5 h-3.5" />
                {t.details.totalDownloads}
              </dt>
              <dd className="font-mono font-semibold text-slate-900 dark:text-zinc-100 tabular-nums">
                {item.downloadsCount.toLocaleString()}
              </dd>
            </div>
          </dl>

          {/* Coupon Code Box */}
          <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-2.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400">
              <Tag className="w-3.5 h-3.5" />
              {t.details.couponLabel}
            </label>
            {appliedCoupon ? (
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-xs">
                <span className="font-mono font-semibold text-teal-800 dark:text-teal-300">
                  {appliedCoupon.code} — {t.details.couponApplied} (
                  {appliedCoupon.discountType === 'percentage'
                    ? `${appliedCoupon.discountValue}%`
                    : `$${appliedCoupon.discountValue}`}
                  )
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput('');
                  }}
                  className="text-teal-700 dark:text-teal-300 hover:opacity-75 p-1"
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
                  className="flex-1 h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 font-mono text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  type="submit"
                  disabled={checkingCoupon || !couponInput.trim()}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  {t.details.applyCoupon}
                </button>
              </form>
            )}
            {couponError && (
              <p className="text-xs text-red-600 dark:text-red-400">{couponError}</p>
            )}
          </div>

          {/* Primary One-Click Direct Download CTA */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleDirectDownload}
              disabled={downloading}
              className="w-full h-12 px-6 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold text-sm inline-flex items-center justify-center gap-2.5 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {downloading ? t.details.downloading : t.details.directDownload}
            </button>

            {downloadSuccess && (
              <div className="flex items-center gap-2 text-xs text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30 px-3 py-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{t.details.downloadStarted}</span>
              </div>
            )}

            <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span>{t.details.zeroSpamNote}</span>
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
