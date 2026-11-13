import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export function Footer() {
  const { t } = useApp();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <footer
      className={
        isAdminRoute
          ? 'border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 mt-20'
          : 'border-t border-teal-900/15 dark:border-teal-500/20 bg-[#c3e0d9]/90 dark:bg-[#040e11]/95 backdrop-blur-sm mt-14'
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center">
            <img
              src="/assets/aistudio/image_2e281797.png"
              alt="Toolpotro"
              className="h-7 w-auto object-contain dark:invert dark:hue-rotate-180 dark:brightness-110"
              referrerPolicy="no-referrer"
            />
          </div>
          <p
            className={`text-sm max-w-md ${
              isAdminRoute
                ? 'text-slate-500 dark:text-zinc-400'
                : 'text-[#1c4b4f] dark:text-teal-100/70'
            }`}
          >
            {t.footer.tagline}
          </p>
        </div>

        <div
          className={`flex flex-wrap items-center gap-6 text-sm ${
            isAdminRoute
              ? 'text-slate-500 dark:text-zinc-400'
              : 'text-[#1c4b4f] dark:text-teal-100/70'
          }`}
        >
          <span>{t.footer.directDistribution}</span>
          <Link
            to="/admin"
            className={
              isAdminRoute
                ? 'hover:text-slate-900 dark:hover:text-zinc-100 transition-colors'
                : 'hover:text-[#062326] dark:hover:text-[#2ee6b8] transition-colors font-medium'
            }
          >
            {t.nav.admin}
          </Link>
          <span>© {new Date().getFullYear()} Toolpotro. {t.footer.rights}</span>
        </div>
      </div>
    </footer>
  );
}
