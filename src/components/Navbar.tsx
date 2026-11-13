import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Menu, X, Globe } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Language } from '../types';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'hi', label: 'हिं' },
];

export function Navbar() {
  const { language, setLanguage, t, theme, toggleTheme } = useApp();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdminRoute = location.pathname.startsWith('/admin');

  const navLinks = [
    { to: '/', label: t.nav.catalog },
    { to: '/?platform=Windows', label: t.nav.desktop },
    { to: '/?platform=Android', label: t.nav.android },
    { to: '/?platform=Chrome', label: t.nav.extensions },
    { to: '/admin', label: t.nav.admin },
  ];

  const isActive = (to: string) => {
    if (to === '/admin') return location.pathname === '/admin';
    if (to === '/') return location.pathname === '/' && !location.search;
    return location.pathname + location.search === to;
  };

  return (
    <header
      className={
        isAdminRoute
          ? 'sticky top-0 z-40 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md'
          : 'sticky top-0 z-40 border-b border-teal-900/15 dark:border-teal-500/20 bg-[#cbe4de]/90 dark:bg-[#051418]/92 backdrop-blur-md'
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Logo */}
        <Link
          to="/"
          className="flex items-center whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-xl transition-opacity hover:opacity-90"
          aria-label="Toolpotro Home"
        >
          <img
            src="/assets/aistudio/image_2e281797.png"
            alt="Toolpotro"
            className="h-8 sm:h-9 w-auto object-contain dark:invert dark:hue-rotate-180 dark:brightness-110"
            referrerPolicy="no-referrer"
          />
        </Link>

        {/* Zone 2: Single-line Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                isAdminRoute
                  ? isActive(link.to)
                    ? 'border-teal-600 text-slate-900 dark:text-zinc-50'
                    : 'border-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
                  : isActive(link.to)
                  ? 'border-[#0d9488] dark:border-[#10d9a0] text-[#062326] dark:text-white font-semibold'
                  : 'border-transparent text-[#184549] dark:text-teal-100/75 hover:text-[#062326] dark:hover:text-[#2ee6b8]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Zone 3: Language Switcher & Theme Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className={`hidden sm:flex items-center p-0.5 rounded-lg border ${
              isAdminRoute
                ? 'bg-slate-100 dark:bg-zinc-900 border-slate-200/70 dark:border-zinc-800'
                : 'bg-[#b8dbd2]/80 dark:bg-[#092026] border-teal-900/15 dark:border-teal-500/20'
            }`}
            role="group"
            aria-label="Language selector"
          >
            <Globe
              className={`w-3.5 h-3.5 ml-2 mr-1 ${
                isAdminRoute
                  ? 'text-slate-500 dark:text-zinc-400'
                  : 'text-[#184549] dark:text-teal-300/80'
              }`}
            />
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isAdminRoute
                    ? language === lang.code
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-50 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                    : language === lang.code
                    ? 'bg-[#07262a] text-[#2ee6b8] dark:bg-[#10d9a0] dark:text-slate-950 font-semibold shadow-xs'
                    : 'text-[#184549] hover:text-[#062326] dark:text-teal-100/75 dark:hover:text-white'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`h-10 w-10 flex items-center justify-center rounded-lg border transition-colors shrink-0 cursor-pointer ${
              isAdminRoute
                ? 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                : 'border-teal-900/15 dark:border-teal-500/20 bg-[#eaf6f3] dark:bg-[#092026] text-[#062326] dark:text-[#2ee6b8] hover:bg-white dark:hover:bg-[#0d2c34]'
            }`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className={`md:hidden h-11 w-11 flex items-center justify-center rounded-lg border cursor-pointer ${
              isAdminRoute
                ? 'border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
                : 'border-teal-900/15 dark:border-teal-500/20 text-[#062326] dark:text-teal-100'
            }`}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div
          className={`md:hidden border-t px-4 py-4 space-y-3 ${
            isAdminRoute
              ? 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
              : 'border-teal-900/15 dark:border-teal-500/20 bg-[#d5ece6] dark:bg-[#051418]'
          }`}
        >
          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isAdminRoute
                    ? isActive(link.to)
                      ? 'bg-slate-100 dark:bg-zinc-900 text-slate-900 dark:text-zinc-50'
                      : 'text-slate-600 dark:text-zinc-400'
                    : isActive(link.to)
                    ? 'bg-[#07262a] text-[#2ee6b8] dark:bg-[#10d9a0]/15 dark:text-[#2ee6b8]'
                    : 'text-[#184549] dark:text-teal-100/80'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div
            className={`pt-2 border-t flex items-center gap-1.5 ${
              isAdminRoute
                ? 'border-slate-200 dark:border-zinc-800'
                : 'border-teal-900/15 dark:border-teal-500/20'
            }`}
          >
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border cursor-pointer ${
                  isAdminRoute
                    ? language === lang.code
                      ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                      : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                    : language === lang.code
                    ? 'bg-[#07262a] text-[#2ee6b8] dark:bg-[#10d9a0] dark:text-slate-950 border-transparent font-semibold'
                    : 'border-teal-900/15 dark:border-teal-500/20 text-[#184549] dark:text-teal-100/80'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
