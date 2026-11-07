import { localeOrder } from "./translations.js";

const pathOverrides = { "es-419": "es", "pt-BR": "pt" };

/** 言語コードを、公開ページで使うURLの言語部分に変換する。 */
export function localePath(locale) {
  return pathOverrides[locale] || locale;
}

/** 公開URLの言語部分を、翻訳データで使う言語コードに戻す。 */
export function localeFromPath(path) {
  return localeOrder.find((locale) => localePath(locale) === path);
}
