import "./style.css";
import { resolveLocale, applySharedLocale } from "./locale.js";
import { translations } from "./translations.js";

const locale = resolveLocale();
const text = translations[locale];
const privacyEyebrows = {
  en: "PRIVACY", ja: "プライバシー", "es-419": "PRIVACIDAD", "pt-BR": "PRIVACIDADE",
  id: "PRIVASI", hi: "गोपनीयता", ar: "الخصوصية", tr: "GİZLİLİK", vi: "QUYỀN RIÊNG TƯ",
  ko: "개인정보", th: "ความเป็นส่วนตัว", fr: "CONFIDENTIALITÉ", de: "DATENSCHUTZ",
};

applySharedLocale(locale, text);
renderPolicy();

/** プライバシーポリシーを選択言語で表示し、連絡先をクリック可能にする。 */
function renderPolicy() {
  document.title = `${text.privacy} | Lang Notify`;
  document.querySelector("#top-account").textContent = text.account;
  document.querySelector("#policy-title").textContent = text.policyTitle;
  document.querySelector(".policy .eyebrow").textContent = privacyEyebrows[locale];
  document.querySelector("#policy-updated").textContent = text.updated;
  document.querySelector("#policy-intro").textContent = text.policyIntro;
  document.querySelector("#policy-callout").textContent = text.policyCallout;

  const sections = document.querySelector("#policy-sections");
  sections.replaceChildren();
  text.sections.forEach((heading, index) => {
    const section = document.createElement("section");
    section.append(makeElement("h2", `${index + 1}. ${heading}`));
    const paragraph = document.createElement("p");
    if (index === 7) {
      paragraph.append(document.createTextNode(`${text.sectionText[index]} `));
      const email = makeElement("a", "nekoribocchi@gmail.com");
      email.href = "mailto:nekoribocchi@gmail.com";
      paragraph.append(email);
    } else {
      paragraph.textContent = text.sectionText[index];
    }
    section.append(paragraph);
    sections.append(section);
  });
}

/** 翻訳文をHTMLとして解釈せず、指定要素の文章にする。 */
function makeElement(tagName, value) {
  const element = document.createElement(tagName);
  element.textContent = value;
  return element;
}
