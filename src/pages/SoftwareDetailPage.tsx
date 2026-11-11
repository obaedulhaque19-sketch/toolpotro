import { useEffect, useMemo, useRef, useState } from 'react';
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
  limit,
} from 'firebase/firestore';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  HardDrive,
  Laptop,
  Calendar,
  Tag,
  ShieldCheck,
  Package,
  Share2,
  X,
  Maximize2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import type { CouponCode, SoftwareItem } from '../types';

export function SoftwareDetailPage() {
  const { id } = useParams<{ id: string }>();
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
        finalPrice,
        createdAt: serverTimestamp(),
      });

      if (appliedCoupon) {
        await updateDoc(doc(db, 'coupons', appliedCoupon.id), {
          usedCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      }

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
        <div className="h-4 w-32 bg-slate-200 dark:bg-zinc-800 rounded" />
        <div className="h-56 rounded-2xl bg-slate-200 dark:bg-zinc-800" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-72 rounded-2xl bg-slate-200 dark:bg-zinc-800" />
          <div className="lg:col-span-4 h-72 rounded-2xl bg-slate-200 dark:bg-zinc-800" />
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t.details.backToCatalog}
      </Link>

      {/* Store-Style Hero Banner */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-gradient-to-br from-white via-slate-50 to-teal-50/40 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
          {/* Compact App Icon */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
            {item.thumbnailUrl && !iconError ? (
              <img
                src={item.thumbnailUrl}
                alt={item.name}
                referrerPolicy="no-referrer"
                onError={() => setIconError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="w-10 h-10 text-slate-400 dark:text-zinc-500 stroke-[1.5]" />
            )}
          </div>

          {/* App Title, Meta, Tagline & Action Row */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="space-y-1.5">
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
                {item.name}
              </h1>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs font-mono text-slate-500 dark:text-zinc-400">
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

            <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-300 max-w-2xl leading-relaxed mx-auto md:mx-0">
              {item.tagline}
            </p>

            {/* Primary CTA Row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
              <button
                type="button"
                onClick={handleDirectDownload}
                disabled={downloading}
                className="h-11 px-7 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-zinc-950 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer min-w-[200px]"
              >
                <Download className="w-4 h-4" />
                <span>
                  {downloading
                    ? t.details.downloading
                    : item.price > 0
                    ? `${t.details.directDownload} ($${finalPrice.toFixed(2)})`
                    : `${t.details.directDownload} (${t.catalog.freeLabel})`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                aria-label="Share"
                className="h-11 px-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                {copiedShare && <span>Copied</span>}
              </button>

              <button
                type="button"
                onClick={() => setShowCouponBox((prev) => !prev)}
                className="h-11 px-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>{t.details.applyCoupon}</span>
              </button>
            </div>

            {downloadSuccess && (
              <div className="inline-flex items-center gap-2 text-xs text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30 px-3 py-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{t.details.downloadStarted}</span>
              </div>
            )}

            {/* Collapsible Coupon Input */}
            {(showCouponBox || appliedCoupon) && (
              <div className="max-w-md mx-auto md:mx-0 pt-2">
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
                      className="flex-1 h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
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
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 text-left">
                    {couponError}
                  </p>
                )}
              </div>
            )}

            <p className="flex items-center justify-center md:justify-start gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span>{t.details.zeroSpamNote}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Screenshots, Description, Specs & Install Guide */}
        <div className="lg:col-span-8 space-y-6">
          {/* Screenshots Carousel Card */}
          {galleryImages.length > 0 && (
            <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-50">
                  Screenshots
                </h2>
                {galleryImages.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => scrollGallery('left')}
                      aria-label="Scroll screenshots left"
                      className="h-8 w-8 rounded-lg border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollGallery('right')}
                      aria-label="Scroll screenshots right"
                      className="h-8 w-8 rounded-lg border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
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
                    className="group relative shrink-0 w-[80%] sm:w-[320px] md:w-[360px] aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-950 snap-start cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
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
          <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 space-y-6">
            <div className="space-y-3">
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-50">
                Description
              </h2>
              <p className="text-sm sm:text-[15px] text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                {item.description}
              </p>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-slate-100 dark:border-zinc-800 text-sm">
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
          </section>

          {/* Installation Guide */}
          <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-50">
              {t.details.installGuideTitle}
            </h2>
            <ol className="space-y-3">
              {guideSteps.map((step, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 text-sm text-slate-700 dark:text-zinc-300 leading-relaxed"
                >
                  <span className="font-mono text-xs font-semibold w-6 h-6 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                    {idx + 1}
                  </span>
                  <span>{step.replace(/^\d+\.\s*/, '')}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Right Sidebar: Discover More */}
        <aside className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-zinc-50">
              Discover more
            </h2>
            <Link
              to="/"
              className="text-xs font-medium text-teal-700 dark:text-sky-400 hover:underline"
            >
              {t.nav.catalog}
            </Link>
          </div>

          {relatedItems.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {t.catalog.emptyTitle}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {relatedItems.map((rel) => (
                <Link
                  key={rel.id}
                  to={`/software/${rel.id}`}
                  className="py-3 first:pt-1 last:pb-1 flex items-center gap-3 group"
                >
                  <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200/70 dark:border-zinc-700/70 overflow-hidden shrink-0 flex items-center justify-center">
                    {rel.thumbnailUrl ? (
                      <img
                        src={rel.thumbnailUrl}
                        alt={rel.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-5 h-5 text-slate-400 dark:text-zinc-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate group-hover:text-teal-700 dark:group-hover:text-sky-400 transition-colors">
                      {rel.name}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 truncate">
                      {rel.platform} · {rel.fileType}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 shrink-0 tabular-nums">
                    {rel.price > 0 ? `$${rel.price}` : t.catalog.freeLabel}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>

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
