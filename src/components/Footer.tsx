import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export function Footer() {
  const { t } = useApp();

  return (
    <footer className="border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center">
            <img
              src="/assets/aistudio/image_2e281797.png"
              alt="Toolpotro"
              className="h-7 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md">
            {t.footer.tagline}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500 dark:text-zinc-400">
          <span>{t.footer.directDistribution}</span>
          <Link
            to="/admin"
            className="hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
          >
            {t.nav.admin}
          </Link>
          <span>© {new Date().getFullYear()} Toolpotro. {t.footer.rights}</span>
        </div>
      </div>
    </footer>
  );
}
