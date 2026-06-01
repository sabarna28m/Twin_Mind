import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Language, TranslationKey, translations } from '../i18n/translations';

interface LanguageContextValue {
  lang: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('twinmind_language');
    const valid: Language[] = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'es', 'fr', 'de', 'ja', 'zh', 'ar', 'pt', 'ko'];
    return valid.includes(saved as Language) ? (saved as Language) : 'en';
  });

  const setLanguage = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('twinmind_language', newLang);
  };

  const t = (key: TranslationKey, vars?: Record<string, string>): string => {
    let str = translations[lang][key] ?? translations.en[key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{${k}}`, v); });
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
