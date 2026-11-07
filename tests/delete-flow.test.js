import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = (await readFile(new URL("../src/main.js", import.meta.url), "utf8"))
  .replace(/^import .*;\n/gm, "")
  .replaceAll("import.meta.env.", "env.");

/** 実アカウントに接続せず、メールから開いたページと認証・削除通信を再現する。 */
function createPage({ verificationError = null, deletionResults = [{ status: "completed" }], sessionUserId = "verified-user" } = {}) {
  const elements = new Map();
  const calls = { verify: [], delete: [], signOut: 0 };
  const session = { user: { id: "verified-user" }, access_token: "test-access-token" };
  let currentSession = null;
  const client = {
    auth: {
      onAuthStateChange() {},
      async verifyOtp(params) {
        calls.verify.push(params);
        if (verificationError) return { data: { session: null }, error: verificationError };
        currentSession = session;
        return { data: { session }, error: null };
      },
      async getSession() {
        return { data: { session: currentSession && { ...currentSession, user: { id: sessionUserId } } }, error: null };
      },
      async signOut() { calls.signOut++; },
    },
    functions: {
      async invoke(name, options) {
        calls.delete.push({ name, options });
        const result = deletionResults[Math.min(calls.delete.length - 1, deletionResults.length - 1)];
        return result.error ? { data: null, error: result.error } : { data: result, error: null };
      },
    },
  };
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: selector !== "#request-view", disabled: false, textContent: "",
      classList: { toggle() {} }, addEventListener(_event, listener) { this.listener = listener; },
      replaceChildren() {}, append() {},
    });
    return elements.get(selector);
  };
  const text = {
    deleteTitle: "Delete", account: "Account", privacy: "Privacy", confirmTitle: "Delete account?",
    confirmLead: "This cannot be undone.", confirmDelete: "Permanently delete", verifying: "Verifying",
    deleting: "Deleting", expired: "Expired", deleteFailed: "Failed", deletedTitle: "Deleted",
    deletedCopy: "Deleted successfully", warnings: [], cards: [], cardText: [],
  };
  const context = {
    URL, URLSearchParams, setTimeout, env: { VITE_SUPABASE_URL: "https://example.invalid", VITE_SUPABASE_PUBLISHABLE_KEY: "test" },
    location: { href: "https://example.invalid/?flow=delete-account&token_hash=sample", origin: "https://example.invalid" },
    history: { replaceState() {} },
    document: { querySelector: element, createElement: () => ({ append() {} }) },
    resolveLocale: () => "en", translations: { en: text }, applySharedLocale() {}, createClient: () => client,
  };
  vm.runInNewContext(source, context);
  return { element, calls };
}

test("メールを開くだけでは認証や削除を実行せず、削除ボタンを表示する", () => {
  const { element, calls } = createPage();
  assert.equal(element("#verify-view").hidden, false);
  assert.equal(element("#verify-button").textContent, "Permanently delete");
  assert.equal(calls.verify.length, 0);
  assert.equal(calls.delete.length, 0);
});

test("削除ボタンで本人確認し、そのアカウントのトークンで削除する", async () => {
  const { element, calls } = createPage();
  await element("#verify-button").listener();
  assert.equal(calls.verify.length, 1);
  assert.equal(calls.verify[0].token_hash, "sample");
  assert.equal(calls.delete.length, 1);
  assert.equal(calls.delete[0].name, "delete-account");
  assert.equal(calls.delete[0].options.headers.Authorization, "Bearer test-access-token");
  assert.equal(calls.delete[0].options.body.confirmDeletion, true);
  assert.equal(element("#result-view").hidden, false);
});

test("無効な認証リンクでは削除しない", async () => {
  const { element, calls } = createPage({ verificationError: { code: "otp_expired" } });
  await element("#verify-button").listener();
  assert.equal(calls.delete.length, 0);
  assert.equal(element("#verify-message").textContent, "Expired");
});

test("別のアカウントのセッションに切り替わっていたら削除しない", async () => {
  const { element, calls } = createPage({ sessionUserId: "another-user" });
  await element("#verify-button").listener();
  assert.equal(calls.verify.length, 1);
  assert.equal(calls.delete.length, 0);
  assert.equal(element("#verify-message").textContent, "Expired");
});

test("削除通信が失敗したら認証リンクを再使用せずに再試行できる", async () => {
  const { element, calls } = createPage({ deletionResults: [{ error: new Error("offline") }, { status: "completed" }] });
  await element("#verify-button").listener();
  assert.equal(element("#verify-message").textContent, "Failed");
  assert.equal(element("#verify-button").disabled, false);
  await element("#verify-button").listener();
  assert.equal(calls.verify.length, 1);
  assert.equal(calls.delete.length, 2);
  assert.equal(element("#result-view").hidden, false);
});
