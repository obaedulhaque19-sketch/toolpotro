import { useEffect, useMemo, useState } from 'react';
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
} from 'firebase/firestore';
import {
  Archive,
  BarChart3,
  Download,
  Edit3,
  LogOut,
  Package,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
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
  DiscountType,
  DownloadEvent,
  SoftwareCategory,
  SoftwareFileType,
  SoftwareItem,
  SoftwarePlatform,
} from '../types';

type AdminTab = 'software' | 'coupons' | 'analytics';

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

    return () => {
      unsubSoftware();
      unsubCoupons();
      unsubEvents();
    };
  }, [isAdmin]);

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
    setEditingId(null);
    setSoftwareForm(EMPTY_SOFTWARE_FORM);
    setShowSoftwareModal(true);
  };

  const openEditSoftware = (item: SoftwareItem) => {
    setEditingId(item.id);
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
      featured: item.featured,
    });
    setShowSoftwareModal(true);
  };

  const handleSaveSoftware = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSoftware(true);
    const cleanSlug =
      softwareForm.slug.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase() ||
      softwareForm.name.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const docId = editingId || cleanSlug;

    try {
      if (editingId) {
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
          price: Number(softwareForm.price) || 0,
          featured: Boolean(softwareForm.featured),
          updatedAt: serverTimestamp(),
        });
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
          price: Number(softwareForm.price) || 0,
          downloadsCount: 0,
          status: 'active',
          featured: Boolean(softwareForm.featured),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
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
      if (user && (item.downloadUrl?.includes('github.com/') || item.thumbnailUrl?.includes('github.com/'))) {
        const idToken = await user.getIdToken();
        await fetch('/api/github/asset', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            downloadUrl: item.downloadUrl,
            thumbnailUrl: item.thumbnailUrl,
          }),
        }).catch(() => {});
      }
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
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200/70 dark:border-zinc-800">
          {(['software', 'coupons', 'analytics'] as AdminTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
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
                onClick={() => setShowSoftwareModal(false)}
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
                    disabled={Boolean(editingId)}
                    value={softwareForm.slug}
                    onChange={(e) => setSoftwareForm({ ...softwareForm, slug: e.target.value })}
                    placeholder="potro-sync-desktop"
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm font-mono disabled:opacity-50"
                  />
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
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={softwareForm.price}
                    onChange={(e) => setSoftwareForm({ ...softwareForm, price: Number(e.target.value) })}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm font-mono"
                  />
                </div>
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

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowSoftwareModal(false)}
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
