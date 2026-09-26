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
  setRequestBusy(true, "Sending…");
  if (!supabase) {
    setRequestBusy(false, "We cannot accept requests right now. Please try again later.", true);
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
  setRequestBusy(false, "If an account exists for this address, we will email you a verification link. Please check your inbox.", true);
});

document.querySelector("#delete-button").addEventListener("click", async () => {
  const button = document.querySelector("#delete-button");
  const message = document.querySelector("#delete-message");
  button.disabled = true;
  message.textContent = "Deleting your account…";
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    message.textContent = "This verification link may have expired. Please start again.";
    button.disabled = false;
    return;
  }
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { confirmDeletion: true },
  });
  if (error || data?.status !== "completed") {
    message.innerHTML = "We could not complete the deletion. Please try again later or <a href=\"mailto:nekoribocchi@gmail.com\">contact support</a>.";
    button.disabled = false;
    return;
  }
  await supabase.auth.signOut({ scope: "local" });
  confirmView.hidden = true;
  showResult("Your account has been deleted", "Your account and linked cloud data have been deleted. Remember to cancel your Google Play subscription separately.", true);
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
  document.querySelector("#confirm-email").textContent = user.email ?? "Verified account";
  history.replaceState({}, "", `${location.pathname}?flow=delete-account`);
}

/** 申請フォームの状態と、登録有無を推測させない共通案内を更新する。 */
function setRequestBusy(busy, message, isStatus = false) {
  requestButton.disabled = busy;
  requestButton.textContent = busy ? "Sending…" : "Send verification link";
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
