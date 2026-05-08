import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { LANGS, type Lang, type Translations } from './types';
import { ru } from './dictionaries/ru';
import { en } from './dictionaries/en';
import { lv } from './dictionaries/lv';

export type { Lang } from './types';
export { LANGS } from './types';
export { I18nError } from './types';

const DICTIONARIES: Record<Lang, Translations> = { ru, en, lv };

export type TFunction = (
  key: string,
  params?: Record<string, string | number>,
) => string;

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunction;
}

const STORAGE_KEY = 'lang';

function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

function detectInitialLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLang(stored)) return stored;
  const browser = navigator.language.toLowerCase();
  if (browser.startsWith('ru')) return 'ru';
  if (browser.startsWith('lv')) return 'lv';
  return 'en';
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/{{(\w+)}}/g, (_, k) => String(params[k] ?? `{{${k}}}`));
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors (private mode etc.)
    }
  }, []);

  const t = useCallback<TFunction>(
    (key, params = {}) => {
      const fromLang = DICTIONARIES[lang][key];
      const fromFallback = DICTIONARIES.en[key];
      const template = fromLang ?? fromFallback ?? key;
      return interpolate(template, params);
    },
    [lang],
  );

  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
