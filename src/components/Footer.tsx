import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Mail, ExternalLink } from 'lucide-react';
import { db } from '../lib/firebase';
import { useApp } from '../context/AppContext';

const DEFAULT_CONTACT_EMAIL = 'obaedulhaque19@gmail.com';
const DEFAULT_FACEBOOK_URL = 'https://www.facebook.com/toolpotro';

export function Footer() {
  const { t } = useApp();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  const [contactEmail, setContactEmail] = useState(DEFAULT_CONTACT_EMAIL);
  const [facebookUrl, setFacebookUrl] = useState(DEFAULT_FACEBOOK_URL);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'contact'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setContactEmail(
            typeof data?.contactEmail === 'string' && data.contactEmail.trim()
              ? data.contactEmail.trim()
              : DEFAULT_CONTACT_EMAIL
          );
          setFacebookUrl(
            typeof data?.facebookUrl === 'string' && data.facebookUrl.trim()
              ? data.facebookUrl.trim()
              : DEFAULT_FACEBOOK_URL
          );
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  return (
    <footer
      className={
        isAdminRoute
          ? 'border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 mt-20'
          : 'border-t border-teal-900/15 dark:border-teal-500/20 bg-[#c3e0d9]/90 dark:bg-[#040e11]/95 backdrop-blur-sm mt-14'
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
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
          className={`flex flex-wrap items-center gap-x-5 gap-y-2.5 text-sm ${
            isAdminRoute
              ? 'text-slate-500 dark:text-zinc-400'
              : 'text-[#1c4b4f] dark:text-teal-100/70'
          }`}
        >
          <span>{t.footer.directDistribution}</span>

          {contactEmail && (
            <a
              href={`mailto:${contactEmail}`}
              className={`inline-flex items-center gap-1.5 transition-colors ${
                isAdminRoute
                  ? 'hover:text-slate-900 dark:hover:text-zinc-100'
                  : 'hover:text-[#062326] dark:hover:text-[#2ee6b8] font-medium'
              }`}
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span>{contactEmail}</span>
            </a>
          )}

          {facebookUrl && (
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 transition-colors ${
                isAdminRoute
                  ? 'hover:text-slate-900 dark:hover:text-zinc-100'
                  : 'hover:text-[#062326] dark:hover:text-[#2ee6b8] font-medium'
              }`}
            >
              <span>{t.footer.facebookLabel}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          )}

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
