import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowRight,
  Monitor,
  PackageOpen,
  Search,
  ShieldCheck,
  Smartphone,
  Wrench,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { SoftwareCard } from '../components/SoftwareCard';
import type { SoftwareItem, SoftwarePlatform } from '../types';

const PLATFORMS: ('All' | SoftwarePlatform)[] = [
  'All',
  'Windows',
  'Android',
  'Chrome',
  'macOS',
  'Cross-Platform',
];

export function HomePage() {
  const { t } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPlatform = (searchParams.get('platform') as 'All' | SoftwarePlatform) || 'All';

  const [items, setItems] = useState<SoftwareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<'All' | SoftwarePlatform>(initialPlatform);

  const [heroImage, setHeroImage] = useState<string>('');
  const [heroImgError, setHeroImgError] = useState(false);

  useEffect(() => {
    const unsubHero = onSnapshot(
      doc(db, 'settings', 'hero'),
      (snap) => {
        const nextUrl =
          snap.exists() && typeof snap.data()?.heroImageUrl === 'string'
            ? snap.data().heroImageUrl.trim()
            : '';
        setHeroImage(nextUrl);
        setHeroImgError(false);
      },
      () => {
        setHeroImage('');
      }
    );
    return () => unsubHero();
  }, []);

  useEffect(() => {
    const paramPlatform = searchParams.get('platform') as SoftwarePlatform | null;
    if (paramPlatform && PLATFORMS.includes(paramPlatform)) {
      setSelectedPlatform(paramPlatform);
    } else {
      setSelectedPlatform('All');
    }
  }, [searchParams]);

  useEffect(() => {
    const path = 'software';
    const q = query(collection(db, path), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: SoftwareItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<SoftwareItem, 'id'>),
        }));
        list.sort((a, b) => (b.downloadsCount || 0) - (a.downloadsCount || 0));
        setItems(list);
        setLoading(false);
        setErrorMsg(null);
      },
      (err) => {
        setLoading(false);
        setErrorMsg(err.message);
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    return () => unsubscribe();
  }, []);

  const handlePlatformSelect = (platform: 'All' | SoftwarePlatform) => {
    setSelectedPlatform(platform);
    if (platform === 'All') {
      setSearchParams({});
    } else {
      setSearchParams({ platform });
    }
  };

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesPlatform = selectedPlatform === 'All' || item.platform === selectedPlatform;
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.tagline.toLowerCase().includes(term) ||
        item.platform.toLowerCase().includes(term) ||
        item.fileType.toLowerCase().includes(term);
      return matchesPlatform && matchesSearch;
    });
  }, [items, searchTerm, selectedPlatform]);

  const platformLabel = (p: 'All' | SoftwarePlatform) => {
    switch (p) {
      case 'All':
        return t.filters.all;
      case 'Windows':
        return t.filters.windows;
      case 'Android':
        return t.filters.android;
      case 'Chrome':
        return t.filters.chrome;
      case 'macOS':
        return t.filters.macos;
      case 'Cross-Platform':
        return t.filters.crossPlatform;
    }
  };

  const handleQuickPlatform = (platform: SoftwarePlatform) => {
    handlePlatformSelect(platform);
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
  };

  const titleWords = t.hero.title.trim().split(' ');
  const firstHeroWord = titleWords[0] || '';
  const remainingHeroTitle = titleWords.slice(1).join(' ');

  const hasCustomBanner = Boolean(heroImage) && !heroImgError;

  return (
    <main className="w-full">
      {/* Hero Section (Auto seamless pattern with zero blur by default, or subtle-blurred custom banner when set in Admin) */}
      <section
        className={`relative w-full overflow-hidden transition-colors duration-200 ${
          hasCustomBanner
            ? 'bg-[#061316] text-white border-b border-slate-800/80'
            : 'bg-transparent text-[#062326] dark:text-white'
        }`}
      >
        {/* Full-Width Custom Background Image with subtle light blur (only when uploaded/set in Admin Panel) */}
        {hasCustomBanner && (
          <>
            <img
              src={heroImage}
              alt="Toolpotro verified software distribution"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgError(true)}
              className="absolute inset-0 w-full h-full object-cover object-center blur-[2px] scale-[1.02] transition-opacity duration-300"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-b from-[#061518]/75 via-[#071a1e]/72 to-[#051013]/88"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.12)_0%,transparent_70%)]"
            />
          </>
        )}

        {/* Centered Hero Content */}
        <div
          className={`relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center space-y-3.5 sm:space-y-4 ${
            hasCustomBanner
              ? 'py-6 sm:py-8 lg:py-9'
              : 'pt-7 sm:pt-9 pb-3 sm:pb-4'
          }`}
        >
          {/* Verified Note */}
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-xs font-medium ${
              hasCustomBanner
                ? 'border-teal-400/35 bg-teal-950/65 backdrop-blur-xs text-teal-300'
                : 'border-teal-700/25 bg-[#e6f4f0] text-[#0d625a] dark:border-teal-400/35 dark:bg-[#081d22] dark:text-teal-300'
            }`}
          >
            <ShieldCheck
              className={`w-3.5 h-3.5 shrink-0 ${
                hasCustomBanner
                  ? 'text-teal-400'
                  : 'text-[#0d9488] dark:text-teal-400'
              }`}
            />
            <span>{t.hero.verifiedNote}</span>
          </div>

          {/* Headline */}
          <h1
            className={`font-display text-2xl sm:text-3xl lg:text-[2.35rem] xl:text-[2.65rem] font-bold tracking-tight leading-[1.15] max-w-6xl ${
              hasCustomBanner ? 'text-white' : 'text-[#062326] dark:text-white'
            }`}
            style={{ textWrap: 'balance' }}
          >
            <span
              className={
                hasCustomBanner
                  ? 'text-[#2ee6b8]'
                  : 'text-[#0d9488] dark:text-[#2ee6b8]'
              }
            >
              {firstHeroWord}
            </span>
            {remainingHeroTitle ? ` ${remainingHeroTitle}` : ''}
          </h1>

          {/* Subtitle */}
          <p
            className={`text-sm sm:text-[15px] max-w-5xl leading-relaxed ${
              hasCustomBanner
                ? 'text-slate-300'
                : 'text-[#1e4347] dark:text-slate-300'
            }`}
          >
            {t.hero.subtitle}
          </p>

          {/* Unified Search + Browse Catalog CTA */}
          <form onSubmit={handleSearchSubmit} className="w-full max-w-2xl pt-0.5">
            <div
              className={`w-full rounded-2xl border p-1 sm:p-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shadow-xl ${
                hasCustomBanner
                  ? 'border-white/15 bg-slate-900/75 backdrop-blur-md shadow-2xl'
                  : 'border-teal-900/15 bg-[#f2faf8] shadow-teal-950/10 dark:border-teal-500/20 dark:bg-[#081a1f] dark:shadow-black/40'
              }`}
            >
              <div className="relative flex-1 flex items-center">
                <Search
                  className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                    hasCustomBanner
                      ? 'text-slate-400'
                      : 'text-[#356368] dark:text-slate-400'
                  }`}
                />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t.hero.searchPlaceholder}
                  className={`w-full h-10 pl-10 pr-4 bg-transparent text-sm focus:outline-none ${
                    hasCustomBanner
                      ? 'text-white placeholder:text-slate-400'
                      : 'text-[#062326] placeholder:text-[#4c767a] dark:text-white dark:placeholder:text-slate-400'
                  }`}
                />
              </div>
              <a
                href="#catalog"
                className={`h-10 px-5 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                  hasCustomBanner
                    ? 'bg-[#10d9a0] hover:bg-[#0ec28f] text-slate-950'
                    : 'bg-[#0d9488] hover:bg-[#0f766e] text-white dark:bg-[#10d9a0] dark:hover:bg-[#0ec28f] dark:text-slate-950'
                }`}
              >
                <span>{t.hero.exploreCta}</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </form>

          {/* Popular Platforms Quick Links */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span
              className={`text-xs mr-1 ${
                hasCustomBanner
                  ? 'text-slate-400'
                  : 'text-[#244e52] dark:text-slate-400'
              }`}
            >
              {t.hero.popularPlatforms}
            </span>

            <button
              type="button"
              onClick={() => handleQuickPlatform('Windows')}
              className={`px-3 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                hasCustomBanner
                  ? selectedPlatform === 'Windows'
                    ? 'border-teal-400/60 bg-teal-950/80 text-white'
                    : 'border-white/15 bg-slate-900/70 text-slate-200 hover:bg-slate-800/85 hover:border-white/25'
                  : selectedPlatform === 'Windows'
                  ? 'border-[#0d9488] bg-[#07262a] text-[#2ee6b8] dark:border-teal-400/60 dark:bg-teal-950/80 dark:text-white'
                  : 'border-teal-900/15 bg-[#f2faf8] text-[#062326] hover:bg-white dark:border-teal-500/20 dark:bg-[#081a1f] dark:text-slate-200 dark:hover:bg-[#0b2329]'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>{t.hero.quickWindows}</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickPlatform('Android')}
              className={`px-3 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                hasCustomBanner
                  ? selectedPlatform === 'Android'
                    ? 'border-teal-400/60 bg-teal-950/80 text-white'
                    : 'border-white/15 bg-slate-900/70 text-slate-200 hover:bg-slate-800/85 hover:border-white/25'
                  : selectedPlatform === 'Android'
                  ? 'border-[#0d9488] bg-[#07262a] text-[#2ee6b8] dark:border-teal-400/60 dark:bg-teal-950/80 dark:text-white'
                  : 'border-teal-900/15 bg-[#f2faf8] text-[#062326] hover:bg-white dark:border-teal-500/20 dark:bg-[#081a1f] dark:text-slate-200 dark:hover:bg-[#0b2329]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{t.hero.quickAndroid}</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickPlatform('Chrome')}
              className={`px-3 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                hasCustomBanner
                  ? selectedPlatform === 'Chrome'
                    ? 'border-teal-400/60 bg-teal-950/80 text-white'
                    : 'border-white/15 bg-slate-900/70 text-slate-200 hover:bg-slate-800/85 hover:border-white/25'
                  : selectedPlatform === 'Chrome'
                  ? 'border-[#0d9488] bg-[#07262a] text-[#2ee6b8] dark:border-teal-400/60 dark:bg-teal-950/80 dark:text-white'
                  : 'border-teal-900/15 bg-[#f2faf8] text-[#062326] hover:bg-white dark:border-teal-500/20 dark:bg-[#081a1f] dark:text-slate-200 dark:hover:bg-[#0b2329]'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{t.hero.quickExtensions}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Catalog Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <section id="catalog" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-teal-900/15 dark:border-teal-500/20 pb-4">
          <h2 className="font-display text-2xl font-bold tracking-tight text-[#062326] dark:text-white">
            {t.catalog.allSoftwareTitle}
          </h2>

          {/* Segmented Platform Filter */}
          <div className="flex items-center gap-1 p-1 bg-[#c1dfd7]/80 dark:bg-[#081d22]/90 rounded-xl border border-teal-900/15 dark:border-teal-500/20 overflow-x-auto">
            {PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => handlePlatformSelect(platform)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedPlatform === platform
                    ? 'bg-[#07262a] text-[#2ee6b8] dark:bg-[#10d9a0] dark:text-slate-950 font-semibold shadow-xs'
                    : 'text-[#184549] hover:text-[#062326] dark:text-teal-100/75 dark:hover:text-white'
                }`}
              >
                {platformLabel(platform)}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-300/70 dark:border-red-900/50 bg-red-50/90 dark:bg-red-950/30 p-4 text-sm text-red-800 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-2xl border border-teal-900/15 dark:border-teal-500/20 bg-[#f2faf8]/90 dark:bg-[#081a1f]/90 p-4 space-y-3 animate-pulse"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-teal-900/10 dark:bg-teal-500/15 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-teal-900/10 dark:bg-teal-500/15 rounded" />
                    <div className="h-3 w-1/2 bg-teal-900/10 dark:bg-teal-500/15 rounded" />
                  </div>
                </div>
                <div className="h-3 w-full bg-teal-900/10 dark:bg-teal-500/15 rounded" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-teal-900/15 dark:border-teal-500/20 bg-[#f2faf8]/92 dark:bg-[#081a1f]/92 backdrop-blur-xs p-12 text-center space-y-3">
            <PackageOpen className="w-10 h-10 mx-auto text-teal-700/70 dark:text-teal-300/70 stroke-[1.5]" />
            <h3 className="font-display text-lg font-semibold text-[#062326] dark:text-white">
              {t.catalog.emptyTitle}
            </h3>
            <p className="text-sm text-[#244e52] dark:text-teal-100/70 max-w-md mx-auto">
              {t.catalog.emptySubtitle}
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-teal-900/15 dark:border-teal-500/20 bg-[#f2faf8]/92 dark:bg-[#081a1f]/92 backdrop-blur-xs p-10 text-center space-y-3">
            <p className="text-sm text-[#1e4347] dark:text-slate-300">{t.catalog.noSearchResults}</p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                handlePlatformSelect('All');
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#07262a] text-[#2ee6b8] dark:bg-[#10d9a0] dark:text-slate-950 cursor-pointer"
            >
              {t.catalog.clearFilters}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredItems.map((item) => (
              <SoftwareCard key={item.id} item={item} />
            ))}
          </div>
        )}
        </section>
      </div>
    </main>
  );
}
