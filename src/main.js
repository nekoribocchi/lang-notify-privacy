import { createClient } from "@supabase/supabase-js";
import "./style.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const requestForm = document.querySelector("#request-form");
const requestButton = document.querySelector("#request-button");
const requestMessage = document.querySelector("#request-message");
const requestView = document.querySelector("#request-view");
const confirmView = document.querySelector("#confirm-view");
const resultView = document.querySelector("#result-view");
let supabase;

if (supabaseUrl && publishableKey) {
  supabase = createClient(supabaseUrl, publishableKey, {
    auth: { storageKey: "lang-notify-account-deletion-auth", detectSessionInUrl: true },
  });
  showConfirmedSession();
}

requestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = new FormData(requestForm).get("email").trim();
  setRequestBusy(true, "送信しています…");
  if (!supabase) {
    setRequestBusy(false, "現在、申請を受け付けられません。時間をおいて再度お試しください。", true);
    return;
  }

  try {
    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${location.origin}${location.pathname}?flow=delete-account`,
      },
    });
  } catch {
    // 登録状況を推測できないよう、送信結果の表示は常に同じにする。
  }
  setRequestBusy(false, "該当するアカウントがある場合、確認リンクを記載したメールをお送りします。メールをご確認ください。", true);
});

document.querySelector("#delete-button").addEventListener("click", async () => {
  const button = document.querySelector("#delete-button");
  const message = document.querySelector("#delete-message");
  button.disabled = true;
  message.textContent = "削除しています…";
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    message.textContent = "確認リンクの有効期限が切れたようです。最初からやり直してください。";
    button.disabled = false;
    return;
  }
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { confirmDeletion: true },
  });
  if (error || data?.status !== "completed") {
    message.innerHTML = "削除を完了できませんでした。時間をおいて再度お試しいただくか、<a href=\"mailto:nekoribocchi@gmail.com\">サポートへご連絡</a>ください。";
    button.disabled = false;
    return;
  }
  await supabase.auth.signOut({ scope: "local" });
  confirmView.hidden = true;
  showResult("アカウントを削除しました", "アカウントと紐づくクラウドデータを削除しました。Google Play の定期購入は別途解約してください。", true);
});

document.querySelector("#cancel-button").addEventListener("click", async () => {
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  history.replaceState({}, "", location.pathname);
  confirmView.hidden = true;
  requestView.hidden = false;
});

/** URL の一時リンクを確認し、本人確認に成功した場合だけ最終確認を見せる。 */
async function showConfirmedSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  requestView.hidden = true;
  confirmView.hidden = false;
  document.querySelector("#confirm-email").textContent = user.email ?? "確認済みアカウント";
  history.replaceState({}, "", `${location.pathname}?flow=delete-account`);
}

/** 申請フォームの状態と、登録有無を推測させない共通案内を更新する。 */
function setRequestBusy(busy, message, isStatus = false) {
  requestButton.disabled = busy;
  requestButton.textContent = busy ? "送信中…" : "確認リンクを送る";
  requestMessage.textContent = message;
  requestMessage.classList.toggle("status", isStatus);
}

/** 完了またはエラーの結果画面を表示する。 */
function showResult(title, copy, success) {
  requestView.hidden = true;
  confirmView.hidden = true;
  resultView.hidden = false;
  document.querySelector("#result-mark").textContent = success ? "✓" : "!";
  document.querySelector("#result-title").textContent = title;
  document.querySelector("#result-copy").textContent = copy;
}
