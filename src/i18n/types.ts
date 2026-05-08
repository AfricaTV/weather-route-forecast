export const LANGS = ['ru', 'en', 'lv'] as const;
export type Lang = (typeof LANGS)[number];

export type Translations = Record<string, string>;

export class I18nError extends Error {
  readonly key: string;
  readonly params: Record<string, string | number>;
  constructor(key: string, params: Record<string, string | number> = {}) {
    super(key);
    this.name = 'I18nError';
    this.key = key;
    this.params = params;
  }
}
