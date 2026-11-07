import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { localeOrder, translations } from "../src/translations.js";
import { localePath } from "../src/locale-paths.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const accountTemplate = await readFile(resolve(projectRoot, "src/templates/account.html"), "utf8");
const privacyTemplate = await readFile(resolve(projectRoot, "src/templates/privacy.html"), "utf8");

for (const locale of localeOrder) {
  const text = translations[locale];
  const route = locale === "en" ? "" : `${localePath(locale)}/`;
  const accountPage = renderAccountPage(accountTemplate, locale, text);
  const privacyPage = renderPrivacyPage(privacyTemplate, locale, text);
  await writePage(resolve(projectRoot, `${route}index.html`), accountPage);
  await writePage(resolve(projectRoot, `${route}privacy.html`), privacyPage);
}

/** 申請フォームの文章を埋め込み、JavaScriptが無効でも説明を読めるHTMLにする。 */
function renderAccountPage(template, locale, text) {
  let html = setDocumentLanguage(template, locale, text.dir);
  html = setMetaDescription(html, text.deleteLead);
  html = setTitle(html, `${text.deleteTitle} | Lang Notify`);
  html = setElement(html, "account-eyebrow", escapeHtml(`${text.account} · ${text.privacy}`));

  const fields = {
    "delete-title": text.deleteTitle,
    "delete-lead": text.deleteLead,
    "before-title": text.before,
    "request-title": text.requestTitle,
    "request-lead": text.requestLead,
    "email-label": text.email,
    "request-button": text.send,
    "verified-label": text.verified,
    "confirm-title": text.confirmTitle,
    "confirm-lead": text.confirmLead,
    "delete-button": text.confirmDelete,
    "cancel-button": text.cancel,
    "what-deleted": text.whatDeleted,
    "contact-question": text.contactQuestion,
    "footer-privacy": text.privacy,
    "footer-contact": text.contact,
    "top-privacy": text.privacy,
    "result-policy": text.readPolicy,
  };
  for (const [id, value] of Object.entries(fields)) html = setElement(html, id, escapeHtml(value));
  html = setAttribute(html, "email", "placeholder", text.emailPlaceholder);
  html = setElement(html, "language-label", escapeHtml(text.languageLabel));
  html = setAttribute(html, "language-switcher", "aria-label", text.languageLabel);
  html = setAttribute(html, "top-privacy", "href", `./privacy.html?lang=${encodeURIComponent(localePath(locale))}`);
  html = setAttribute(html, "footer-privacy", "href", `./privacy.html?lang=${encodeURIComponent(localePath(locale))}`);
  html = setAttribute(html, "result-policy", "href", `./privacy.html?lang=${encodeURIComponent(localePath(locale))}`);
  html = setElement(html, "language-switcher", languageOptions(locale));
  html = setElement(html, "warning-list", text.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join(""));
  html = setElement(html, "deletion-cards", text.cards.map((heading, index) =>
    `<article><span class="detail-icon">0${index + 1}</span><h3>${escapeHtml(heading)}</h3><p>${escapeHtml(text.cardText[index])}</p></article>`
  ).join(""));
  html = replaceNoscript(html, `${text.javascriptRequired} <a href="mailto:nekoribocchi@gmail.com">nekoribocchi@gmail.com</a>.`);
  return html;
}

/** ポリシー本文と見出しを埋め込み、検索・共有時にも言語が分かるページを作る。 */
function renderPrivacyPage(template, locale, text) {
  let html = setDocumentLanguage(template, locale, text.dir);
  html = setMetaDescription(html, text.policyIntro);
  html = setTitle(html, `${text.privacy} | Lang Notify`);
  html = setElement(html, "top-account", escapeHtml(text.account));
  html = setAttribute(html, "top-account", "href", `./?lang=${encodeURIComponent(localePath(locale))}`);
  html = setElement(html, "footer-account", escapeHtml(text.account));
  html = setAttribute(html, "footer-account", "href", `./?lang=${encodeURIComponent(localePath(locale))}`);
  html = setElement(html, "footer-contact", escapeHtml(text.contact));
  html = setElement(html, "policy-title", escapeHtml(text.policyTitle));
  html = setElement(html, "policy-updated", escapeHtml(text.updated));
  html = setElement(html, "policy-intro", escapeHtml(text.policyIntro));
  html = setElement(html, "policy-callout", escapeHtml(text.policyCallout));
  html = setElement(html, "language-label", escapeHtml(text.languageLabel));
  html = setAttribute(html, "language-switcher", "aria-label", text.languageLabel);
  html = setElement(html, "language-switcher", languageOptions(locale));
  const sections = text.sections.map((heading, index) => {
    let paragraph = escapeHtml(text.sectionText[index]);
    if (index === 7) paragraph += ` <a href="mailto:nekoribocchi@gmail.com">nekoribocchi@gmail.com</a>`;
    return `<section><h2>${index + 1}. ${escapeHtml(heading)}</h2><p>${paragraph}</p></section>`;
  }).join("\n");
  return setElement(html, "policy-sections", sections);
}

/** ページに言語と右から左への表示方向を設定する。 */
function setDocumentLanguage(html, locale, direction) {
  return html.replace('<html lang="en">', `<html lang="${escapeAttribute(locale)}" dir="${direction}">`);
}

/** ページのtitle要素をローカライズする。 */
function setTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
}

/** ページのdescriptionをローカライズする。 */
function setMetaDescription(html, description) {
  return html.replace(/(<meta name="description" content=")[^"]*("\s*\/?>)/, `$1${escapeAttribute(description)}$2`);
}

/** 指定IDの要素内容を置き換える。 */
function setElement(html, id, contents) {
  const expression = new RegExp(`(<([a-z][a-z0-9-]*)\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(<\\/\\2>)`, "i");
  if (!expression.test(html)) throw new Error(`Template element not found: ${id}`);
  return html.replace(expression, (_, opening, _tag, closing) => `${opening}${contents}${closing}`);
}

/** 指定要素の属性値を置き換える。 */
function setAttribute(html, id, name, value) {
  const expression = new RegExp(`(<[a-z][a-z0-9-]*\\b[^>]*\\bid="${id}"[^>]*\\b${name}=")[^"]*(")`, "i");
  if (!expression.test(html)) throw new Error(`Template attribute not found: ${id}.${name}`);
  return html.replace(expression, `$1${escapeAttribute(value)}$2`);
}

/** 言語選択欄をHTMLに含め、JavaScriptなしでも全言語が選べるようにする。 */
function languageOptions(selected) {
  return localeOrder.map((locale) => {
    const optionSelected = locale === selected ? " selected" : "";
    return `<option value="${escapeAttribute(locale)}"${optionSelected}>${escapeHtml(translations[locale].name)}</option>`;
  }).join("");
}

/** noscript要素の案内文を指定言語に置き換える。 */
function replaceNoscript(html, message) {
  return html.replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript>${message}</noscript>`);
}

/** HTML本文に安全に挿入できる文字列にする。 */
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

/** HTML属性に安全に挿入できる文字列にする。 */
function escapeAttribute(value) {
  return escapeHtml(value);
}

/** 生成したHTMLを保存し、親ディレクトリがなければ作成する。 */
async function writePage(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}
