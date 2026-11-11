import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Search, ShieldCheck, PackageOpen } from 'lucide-react';
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

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-14">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-teal-700 dark:text-teal-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{t.hero.verifiedNote}</span>
          </div>

          <h1
            className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 leading-[1.12]"
            style={{ textWrap: 'balance' }}
          >
            {t.hero.title}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
            {t.hero.subtitle}
          </p>

          {/* Search Input */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.hero.searchPlaceholder}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <a
              href="#catalog"
              className="h-11 px-5 inline-flex items-center justify-center rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors whitespace-nowrap shrink-0"
            >
              {t.hero.exploreCta}
            </a>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="lg:col-span-5">
          <div className="h-full min-h-[240px] rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900">
            <img
              src="/src/assets/images/hero_toolpotro_showcase_1794404735444.jpg"
              alt="Toolpotro verified software distribution"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Catalog Section */}
      <section id="catalog" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
            {t.catalog.allSoftwareTitle}
          </h2>

          {/* Segmented Platform Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200/70 dark:border-zinc-800 overflow-x-auto">
            {PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => handlePlatformSelect(platform)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  selectedPlatform === platform
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-50 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                {platformLabel(platform)}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden animate-pulse"
              >
                <div className="aspect-[4/3] bg-slate-200 dark:bg-zinc-800" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-1/3 bg-slate-200 dark:bg-zinc-800 rounded" />
                  <div className="h-5 w-2/3 bg-slate-200 dark:bg-zinc-800 rounded" />
                  <div className="h-4 w-full bg-slate-200 dark:bg-zinc-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-3">
            <PackageOpen className="w-10 h-10 mx-auto text-slate-400 dark:text-zinc-500 stroke-[1.5]" />
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-100">
              {t.catalog.emptyTitle}
            </h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
              {t.catalog.emptySubtitle}
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center space-y-3">
            <p className="text-sm text-slate-600 dark:text-zinc-400">{t.catalog.noSearchResults}</p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                handlePlatformSelect('All');
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
            >
              {t.catalog.clearFilters}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <SoftwareCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
