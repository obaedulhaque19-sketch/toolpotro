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
      className="group flex flex-col justify-between rounded-2xl border border-teal-900/15 dark:border-teal-500/20 bg-[#f2faf8]/92 dark:bg-[#081a1f]/92 backdrop-blur-xs p-4 gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-950/10 dark:hover:shadow-black/50 hover:border-teal-700/35 dark:hover:border-[#10d9a0]/45 hover:bg-[#f8fdfc] dark:hover:bg-[#0b2228] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      {/* Top Row: Compact Icon + Single-line Title & Meta + Price */}
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-[#dff0ec] dark:bg-[#0d262d] border border-teal-900/10 dark:border-teal-500/20 overflow-hidden shrink-0 flex items-center justify-center">
          {item.thumbnailUrl && !imgError ? (
            <img
              src={item.thumbnailUrl}
              alt={item.name}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <Package className="w-6 h-6 text-teal-700/70 dark:text-teal-300/70 stroke-[1.5]" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-[#062326] dark:text-white group-hover:text-[#0d9488] dark:group-hover:text-[#2ee6b8] transition-colors truncate">
              {item.name}
            </h3>
            <span
              className={`font-mono text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md shrink-0 ${
                item.price > 0
                  ? 'bg-sky-600/15 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300'
                  : 'bg-teal-600/15 text-teal-800 dark:bg-[#10d9a0]/15 dark:text-[#2ee6b8]'
              }`}
            >
              {item.price > 0 ? `$${item.price}` : t.catalog.freeLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-[#2c595d] dark:text-teal-200/70 whitespace-nowrap overflow-hidden">
            <span>{item.platform}</span>
            <span aria-hidden="true">·</span>
            <span>{item.fileType}</span>
            <span aria-hidden="true">·</span>
            <span>{item.version}</span>
          </div>
        </div>
      </div>

      {/* Sleek Single-Line Tagline */}
      <p className="text-xs sm:text-[13px] text-[#1e4347] dark:text-slate-300 truncate">
        {item.tagline}
      </p>

      {/* Bottom Footer */}
      <div className="pt-2.5 border-t border-teal-900/10 dark:border-teal-500/15 flex items-center justify-between gap-2 text-xs text-[#2c595d] dark:text-teal-200/70">
        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums whitespace-nowrap">
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>
            {item.downloadsCount.toLocaleString()} {t.catalog.downloadsLabel}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-[#062326] dark:text-teal-50 group-hover:text-[#0d9488] dark:group-hover:text-[#2ee6b8] transition-colors shrink-0 whitespace-nowrap">
          <span>{t.catalog.viewDetails}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
