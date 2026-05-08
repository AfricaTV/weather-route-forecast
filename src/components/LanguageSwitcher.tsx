import { useI18n, LANGS, type Lang } from '../i18n';

const LABELS: Record<Lang, string> = {
  ru: 'RU',
  en: 'EN',
  lv: 'LV',
};

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-switcher" role="group" aria-label="Language">
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          className={code === lang ? 'active' : ''}
          onClick={() => setLang(code)}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}
