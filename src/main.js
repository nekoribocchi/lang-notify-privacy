import { createClient } from "@supabase/supabase-js";
import "./style.css";
import { resolveLocale, applySharedLocale } from "./locale.js";
import { translations } from "./translations.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const locale = resolveLocale();
const text = translations[locale];
const requestForm = document.querySelector("#request-form");
const requestButton = document.querySelector("#request-button");
const requestMessage = document.querySelector("#request-message");
const requestView = document.querySelector("#request-view");
const verifyView = document.querySelector("#verify-view");
const confirmView = document.querySelector("#confirm-view");
const resultView = document.querySelector("#result-view");
const initialUrl = new URL(location.href);
const initialHash = new URLSearchParams(initialUrl.hash.slice(1));
const isDeletionFlow = initialUrl.searchParams.get("flow") === "delete-account";
const pendingTokenHash = initialUrl.searchParams.get("token_hash");
const hasAuthCallback = initialUrl.searchParams.has("code") ||
  initialUrl.searchParams.has("error") || initialUrl.searchParams.has("error_code") ||
  initialHash.has("access_token") || initialHash.has("error");
let supabase;
let confirmationCheckStarted = false;
let verifiedDeletionUserId;

applySharedLocale(locale, text);
renderDeletionPage();

if (supabaseUrl && publishableKey) {
  supabase = createClient(supabaseUrl, publishableKey, {
    auth: { storageKey: "lang-notify-account-deletion-auth", detectSessionInUrl: true },
  });
  // Magic link の戻り値を SDK が処理してから、確認画面へ切り替える。
  supabase.auth.onAuthStateChange((event) => {
    if (
      isDeletionFlow && hasAuthCallback &&
      (event === "INITIAL_SESSION" || event === "SIGNED_IN")
    ) {
      setTimeout(() => showConfirmedSession(), 0);
    }
  });
  if (isDeletionFlow && hasAuthCallback) {
    setRequestBusy(true, text.sending);
  } else if (isDeletionFlow && pendingTokenHash) {
    requestView.hidden = true;
    verifyView.hidden = false;
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete("token_hash");
    cleanUrl.searchParams.delete("type");
    history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}`);
  } else if (isDeletionFlow) {
    setRequestBusy(false, text.expired, true);
  }
}

// 削除ボタンが押された時にだけ本人確認し、成功したアカウントの削除を開始する。
document.querySelector("#verify-button").addEventListener("click", async () => {
  const button = document.querySelector("#verify-button");
  const message = document.querySelector("#verify-message");
  button.disabled = true;
  message.textContent = text.verifying;
  if (!supabase || !pendingTokenHash) {
    message.textContent = text.expired;
    button.disabled = false;
    return;
  }
  if (!verifiedDeletionUserId) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: pendingTokenHash, type: "email" });
      if (error || !data.session?.user?.id) {
        message.textContent = error?.code === "otp_expired" ? text.expired : text.deleteFailed;
        button.disabled = false;
        return;
      }
      verifiedDeletionUserId = data.session.user.id;
    } catch {
      message.textContent = text.deleteFailed;
      button.disabled = false;
      return;
    }
  }
  await deleteVerifiedAccount(button, message, verifiedDeletionUserId);
});

requestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = new FormData(requestForm).get("email").trim();
  setRequestBusy(true, text.sending);
  if (!supabase) {
    setRequestBusy(false, text.deleteFailed, true);
    return;
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
    // 既存のMagic Linkテンプレートでも、Supabaseに登録済みの公開トップへ戻す。
    const redirect = new URL(import.meta.env.BASE_URL, location.origin);
    redirect.searchParams.set("flow", "delete-account");
    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: redirect.toString(),
      },
    });
  } catch {
    // 登録状況を推測できないよう、送信結果の表示は常に同じにする。
  }
  setRequestBusy(false, text.sent, true);
});

// 既存メールの認証後に表示される削除ボタンも、同じ削除処理を使う。
document.querySelector("#delete-button").addEventListener("click", async () => {
  const button = document.querySelector("#delete-button");
  const message = document.querySelector("#delete-message");
  button.disabled = true;
  await deleteVerifiedAccount(button, message);
});

document.querySelector("#cancel-button").addEventListener("click", async () => {
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  const url = new URL(location.href);
  url.searchParams.delete("flow");
  history.replaceState({}, "", `${url.pathname}${url.search}`);
  confirmView.hidden = true;
  requestView.hidden = false;
});

/** 削除申請ページの案内、確認事項、結果表示を選択言語で組み立てる。 */
function renderDeletionPage() {
  document.title = `${text.deleteTitle} | Lang Notify`;
  setText("#account-eyebrow", locale === "en" ? "ACCOUNT & PRIVACY" : `${text.account} · ${text.privacy}`);
  setText("#delete-title", text.deleteTitle);
  setText("#delete-lead", text.deleteLead);
  setText("#before-title", text.before);
  setText("#request-title", text.requestTitle);
  setText("#request-lead", text.requestLead);
  setText("#verify-title", text.confirmTitle);
  setText("#verify-lead", text.confirmLead);
  setText("#verify-button", text.confirmDelete);
  setText("#email-label", text.email);
  setText("#request-button", text.send);
  setText("#verified-label", text.verified);
  setText("#confirm-title", text.confirmTitle);
  setText("#confirm-lead", text.confirmLead);
  setText("#delete-button", text.confirmDelete);
  setText("#cancel-button", text.cancel);
  setText("#what-deleted", text.whatDeleted);
  setText("#contact-question", text.contactQuestion);
  document.querySelector("#email").placeholder = text.emailPlaceholder;

  const warningList = document.querySelector("#warning-list");
  warningList.replaceChildren();
  for (const warning of text.warnings) warningList.append(makeElement("li", warning));

  const cardGrid = document.querySelector("#deletion-cards");
  cardGrid.replaceChildren();
  text.cards.forEach((title, index) => {
    const article = document.createElement("article");
    article.append(makeElement("span", `0${index + 1}`, "detail-icon"));
    article.append(makeElement("h3", title));
    article.append(makeElement("p", text.cardText[index]));
    cardGrid.append(article);
  });
}

/**
 * 本人確認済みのセッションで削除を実行する。
 * expectedUserId がある場合は同じアカウントか確認し、通信失敗時は再試行を可能にする。
 * 削除成功後はローカルの認証情報を破棄し、結果画面へ切り替える。
 */
async function deleteVerifiedAccount(button, message, expectedUserId) {
  message.textContent = text.deleting;
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session || (expectedUserId && session.user.id !== expectedUserId)) {
      message.textContent = text.expired;
      button.disabled = false;
      return;
    }
    const { data, error } = await supabase.functions.invoke("delete-account", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { confirmDeletion: true },
    });
    if (error || data?.status !== "completed") throw error || new Error("deletion failed");
    // アカウント削除後のローカルログアウトに失敗しても、削除成功は取り消せない。
    try { await supabase.auth.signOut({ scope: "local" }); } catch { /* 削除結果を優先する。 */ }
    showResult(text.deletedTitle, text.deletedCopy, true);
  } catch {
    message.textContent = text.deleteFailed;
    button.disabled = false;
  }
}

/** URL の一時リンクを確認し、本人確認に成功した場合だけ最終確認を見せる。 */
async function showConfirmedSession() {
  if (confirmationCheckStarted) return;
  confirmationCheckStarted = true;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      confirmationCheckStarted = false;
      setRequestBusy(false, text.expired, true);
      return;
    }
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      confirmationCheckStarted = false;
      setRequestBusy(false, text.expired, true);
      return;
    }
    requestView.hidden = true;
    verifyView.hidden = true;
    confirmView.hidden = false;
    document.querySelector("#confirm-email").textContent = user.email ?? "";
    const url = new URL(location.href);
    url.searchParams.set("flow", "delete-account");
    history.replaceState({}, "", `${url.pathname}${url.search}`);
  } catch {
    confirmationCheckStarted = false;
    setRequestBusy(false, text.expired, true);
  }
}

/** 申請中の表示と、登録有無を推測させない共通案内を更新する。 */
function setRequestBusy(busy, message, isStatus = false) {
  requestButton.disabled = busy;
  requestButton.textContent = busy ? text.sending : text.send;
  requestMessage.textContent = message;
  requestMessage.classList.toggle("status", isStatus);
}

/** 成功または失敗の結果を、読み上げやすいテキストとして表示する。 */
function showResult(title, copy, success) {
  requestView.hidden = true;
  verifyView.hidden = true;
  confirmView.hidden = true;
  resultView.hidden = false;
  document.querySelector("#result-mark").textContent = success ? "✓" : "!";
  document.querySelector("#result-title").textContent = title;
  document.querySelector("#result-copy").textContent = copy;
  document.querySelector("#result-policy").textContent = text.readPolicy;
}

/** 翻訳文をHTMLとして解釈せず、指定要素の読み上げ可能な文章にする。 */
function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}

/** 翻訳文を表示する要素を安全に作成する。 */
function makeElement(tagName, value, className) {
  const element = document.createElement(tagName);
  element.textContent = value;
  if (className) element.className = className;
  return element;
}
