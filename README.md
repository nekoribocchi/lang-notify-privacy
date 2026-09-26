# Lang Notify 公開プライバシーページ

Lang Notify のアカウント削除申請ページとプライバシーポリシーを公開するためのリポジトリです。

## ページ

- アカウント削除：<https://nekoribocchi.github.io/lang-notify-privacy/>
- プライバシーポリシー：<https://nekoribocchi.github.io/lang-notify-privacy/privacy.html>

## 公開方法

GitHub Pages は Actions による手動デプロイです。リポジトリ設定で Pages の公開元を GitHub Actions にし、Actions variables に `VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLISHABLE_KEY` を登録してから、`Deploy GitHub Pages` を実行します。公開キーはブラウザーで使う公開用キーです。サービスロールキーや秘密鍵は登録しないでください。

公開前に、プライバシー・税務上の保存要件、バックアップの最長30日以内の失効、アプリ実挙動、Play Console の Data safety 回答、Google Play のアカウント削除URLを担当者が確認してください。これらの確認が完了するまでデプロイしないでください。

このリポジトリは個人情報保護の説明文を管理する公開リポジトリです。アカウント情報は含めず、削除申請は Supabase Auth と削除 Function に送信します。
