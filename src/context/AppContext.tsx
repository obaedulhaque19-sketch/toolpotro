import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider, ADMIN_EMAIL } from '../lib/firebase';
import { translations, type Translations } from '../i18n/translations';
import type { Language } from '../types';

type Theme = 'light' | 'dark';

interface AppContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  theme: Theme;
  toggleTheme: () => void;
  user: User | null;
  isAdmin: boolean;
  authLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('toolpotro_lang');
    return saved === 'bn' || saved === 'hi' ? saved : 'en';
  });

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('toolpotro_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('toolpotro_theme', theme);
  }, [theme]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('toolpotro_lang', lang);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.emailVerified) {
        const emailMatch = currentUser.email?.toLowerCase() === ADMIN_EMAIL;
        if (emailMatch) {
          setIsAdmin(true);
        } else {
          try {
            const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
            setIsAdmin(adminDoc.exists());
          } catch {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        t: translations[language],
        theme,
        toggleTheme,
        user,
        isAdmin,
        authLoading,
        signInWithGoogle,
        signInWithEmail,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
