import { defaultLocale, localeOrder, translations } from "./translations.js";
import { localeFromPath, localePath } from "./locale-paths.js";

/** URL指定を優先し、端末の言語設定が対応する場合はその言語を初期表示する。 */
export function resolveLocale() {
  const requested = new URLSearchParams(location.search).get("lang");
  const requestedLocale = localeFromPath(requested) || requested;
  if (requestedLocale && translations[requestedLocale]) return requestedLocale;
  const pathLocales = location.pathname.split("/").filter(Boolean).reverse();
  const pathLocale = pathLocales.map(localeFromPath).find(Boolean);
  if (pathLocale) return pathLocale;

  const preferred = navigator.languages?.[0] || navigator.language || defaultLocale;
  const lower = preferred.toLowerCase();
  if (lower.startsWith("es")) return "es-419";
  if (lower === "pt-br" || lower.startsWith("pt")) return "pt-BR";
  const match = Object.keys(translations).find((key) => key.toLowerCase() === lower);
  if (match) return match;
  const base = lower.split("-")[0];
  return Object.keys(translations).find((key) => key.toLowerCase() === base) || defaultLocale;
}

/** 共通ヘッダーとフッターに言語切替・相互リンクを設定する。 */
export function applySharedLocale(locale, text) {
  document.documentElement.lang = locale;
  document.documentElement.dir = text.dir;
  document.title = `${document.body.dataset.page === "privacy" ? text.privacy : text.account} | Lang Notify`;

  const switcher = document.querySelector("#language-switcher");
  if (switcher.options.length === 0) {
    for (const code of localeOrder) {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = translations[code].name;
      switcher.append(option);
    }
  }
  switcher.value = locale;
  switcher.setAttribute("aria-label", text.languageLabel);
  document.querySelector("#language-label").textContent = text.languageLabel;
  switcher.addEventListener("change", () => navigateToLocale(switcher.value));

  for (const link of document.querySelectorAll("#top-privacy, #footer-privacy")) {
    if (link) {
      link.textContent = text.privacy;
      link.href = localizedUrl("privacy.html", locale);
    }
  }
  for (const link of document.querySelectorAll("#top-account, #footer-account")) {
    if (link) {
      link.textContent = text.account;
      link.href = localizedUrl("", locale);
    }
  }
  const contact = document.querySelector("#footer-contact");
  if (contact) contact.textContent = text.contact;
  for (const link of document.querySelectorAll("#result-policy")) {
    link.href = localizedUrl("privacy.html", locale);
    link.textContent = text.readPolicy;
  }
}

/** 言語を選び直しても現在のページ種別を保ち、localeをURLに記録する。 */
function navigateToLocale(locale) {
  const page = document.body.dataset.page === "privacy" ? "privacy.html" : "";
  location.href = localizedUrl(page, locale);
}

/** GitHub Pages のベースパスを保ったまま指定言語のURLを作る。 */
function localizedUrl(page, locale) {
  const languagePath = locale === "en" ? "" : `${localePath(locale)}/`;
  const target = new URL(`${import.meta.env.BASE_URL}${languagePath}${page}`, location.origin);
  target.searchParams.set("lang", localePath(locale));
  return `${target.pathname}${target.search}`;
}
