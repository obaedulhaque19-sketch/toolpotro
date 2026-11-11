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
      className="group flex flex-col rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5 dark:hover:shadow-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
    >
      {/* 4:3 Preview Container */}
      <div className="relative aspect-[4/3] w-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
        {item.thumbnailUrl && !imgError ? (
          <img
            src={item.thumbnailUrl}
            alt={item.name}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-zinc-800 dark:to-zinc-900 text-slate-400 dark:text-zinc-500">
            <Package className="w-10 h-10 stroke-[1.5]" />
            <span className="text-xs font-mono">{item.platform}</span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="flex-1 p-5 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          {/* Unboxed Metadata Line */}
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-zinc-400">
            <span>{item.platform}</span>
            <span aria-hidden="true">·</span>
            <span>{item.fileType}</span>
            <span aria-hidden="true">·</span>
            <span>{item.version}</span>
          </div>

          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
              {item.name}
            </h3>
            <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-zinc-100 shrink-0">
              {item.price > 0 ? `$${item.price}` : t.catalog.freeLabel}
            </span>
          </div>

          <p className="text-sm text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
            {item.tagline}
          </p>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
            <Download className="w-3.5 h-3.5" />
            {item.downloadsCount.toLocaleString()} {t.catalog.downloadsLabel}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-slate-900 dark:text-zinc-200 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
            {t.catalog.viewDetails}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
