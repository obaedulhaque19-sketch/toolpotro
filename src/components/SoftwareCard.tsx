import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Download, Package } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { SoftwareItem } from '../types';

export function SoftwareCard({ item }: { item: SoftwareItem }) {
  const { t } = useApp();
  const [imgError, setImgError] = useState(false);

  return (
    <Link
      to={`/software/${item.id}`}
      className="group flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/5 dark:hover:shadow-black/30 hover:border-slate-300 dark:hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
    >
      {/* Top Row: Compact Icon + Single-line Title & Meta + Price */}
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200/70 dark:border-zinc-700/70 overflow-hidden shrink-0 flex items-center justify-center">
          {item.thumbnailUrl && !imgError ? (
            <img
              src={item.thumbnailUrl}
              alt={item.name}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <Package className="w-6 h-6 text-slate-400 dark:text-zinc-500 stroke-[1.5]" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-zinc-50 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors truncate">
              {item.name}
            </h3>
            <span
              className={`font-mono text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md shrink-0 ${
                item.price > 0
                  ? 'bg-sky-500/15 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300'
                  : 'bg-teal-500/10 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300'
              }`}
            >
              {item.price > 0 ? `$${item.price}` : t.catalog.freeLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap overflow-hidden">
            <span>{item.platform}</span>
            <span aria-hidden="true">·</span>
            <span>{item.fileType}</span>
            <span aria-hidden="true">·</span>
            <span>{item.version}</span>
          </div>
        </div>
      </div>

      {/* Sleek Single-Line Tagline */}
      <p className="text-xs sm:text-[13px] text-slate-600 dark:text-zinc-400 truncate">
        {item.tagline}
      </p>

      {/* Bottom Footer */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums whitespace-nowrap">
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>
            {item.downloadsCount.toLocaleString()} {t.catalog.downloadsLabel}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-slate-900 dark:text-zinc-200 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors shrink-0 whitespace-nowrap">
          <span>{t.catalog.viewDetails}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
