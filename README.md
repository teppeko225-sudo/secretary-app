# マイ秘書アプリ

自分専用のシンプルな秘書アプリです。メモ・タスク管理・週次振り返り・ダッシュボードを備えています。

2通りの動かし方があります。

- **ローカル版**：`node server.js` で起動。データは `data.json` に保存。Googleカレンダー連携あり。
- **クラウド版（Cloudflare Pages）**：静的フロント＋Pages Functions＋KV で動作。データはKVに保存され、複数端末から使えます。

## 使い方（ローカル版）

1. このフォルダで以下を実行します。

   ```
   node server.js
   ```

2. ブラウザで次のURLを開きます。

   http://localhost:3000

3. 終了するにはターミナルで `Ctrl + C` を押します。

## フォルダ構成

```
secretary-app/
  public/index.html   … 画面（フロントエンド／両版で共通）
  server.js           … ローカル版サーバー（ファイル保存）
  google.js           … ローカル版のGoogleカレンダー連携
  functions/api/…     … クラウド版のAPI（Cloudflare Pages Functions・KV保存）
  wrangler.toml       … Cloudflare設定
  package.json
```

## 機能

- **ダッシュボード**：メモ件数 / タスク件数 / 未完了タスク件数を画面上部に表示
- **メモ**：タイトルと本文を入力して追加、一覧表示、作成日時表示、削除
- **タスク**：内容を入力して追加、一覧表示、完了/未完了の切り替え、削除、作成日時と状態表示
- **週次の振り返り**：週（対象の週）を選んでコメントを記録。1週につき1件で、同じ週に保存すると上書き。履歴の一覧表示・編集・削除ができ、**ダッシュボードに最新の振り返り**を表示

## データ保存について

入力したメモ・タスクは同じフォルダの `data.json` に自動保存されます。
アプリ（サーバー）を閉じてもデータは消えず、次回起動時に読み込まれます。

---

## Googleカレンダー連携の設定

Googleカレンダーの「今後の予定」を画面に表示できます（読み取り専用）。
最初に一度だけ、以下の準備が必要です。

### 1. Google Cloud でOAuthクライアントを作成する

1. [Google Cloud Console](https://console.cloud.google.com/) を開く
2. 上部でプロジェクトを新規作成（既存のものでも可）
3. 「APIとサービス」→「ライブラリ」で **Google Calendar API** を検索し、**有効にする**
4. 「APIとサービス」→「OAuthに関する同意画面」を設定
   - User Type は **外部** を選択
   - アプリ名・メールなど必須項目を入力
   - 「テストユーザー」に **自分のGoogleアカウント** を追加（これをしないとログインできません）
5. 「APIとサービス」→「認証情報」→「認証情報を作成」→ **OAuthクライアントID**
   - アプリケーションの種類：**ウェブアプリケーション**
   - 「承認済みのリダイレクトURI」に次を **完全に一致** で追加：
     ```
     http://localhost:3000/oauth2callback
     ```
6. 作成後に表示される画面で **JSONをダウンロード**

### 2. 認証情報をアプリに置く

ダウンロードしたJSONファイルを、このフォルダに **`credentials.json`** という名前で保存します。

```
secretary-app/
  ├─ server.js
  ├─ credentials.json   ← ここに置く
  └─ ...
```

### 3. 連携する

1. サーバーを起動（`node server.js`）してブラウザで http://localhost:3000 を開く
2. 「📅 Googleカレンダー」欄の **「Googleと連携する」** ボタンを押す
3. Googleのログイン・同意画面で許可する
4. アプリに戻り、今後の予定が表示されれば成功です

- 一度連携すると `token.json` が作られ、次回以降は自動でログイン状態が保たれます。
- 連携を解除したいときは、画面の「連携解除」ボタンを押します（`token.json` が削除されます）。

### 注意
- `credentials.json` と `token.json` には秘密情報が含まれます。**他人に共有しないでください。**
- 同意画面が「テスト」状態のままでも、テストユーザーに登録した自分のアカウントなら利用できます。

---

## Cloudflare Pages へのデプロイ（クラウド版）

静的フロント（`public/`）＋ Pages Functions（`functions/`）＋ KV でクラウド公開します。
データは Cloudflare KV に保存され、複数端末から利用できます。

### 1. KV 名前空間を作成

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) → **Workers & Pages** → **KV**
2. **Create a namespace** を押し、名前（例：`secretary-data`）で作成

### 2. Pages プロジェクトを作成（GitHub 連携）

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. リポジトリ `secretary-app` を選択
3. ビルド設定：
   - **Framework preset**：`None`
   - **Build command**：（空欄でOK）
   - **Build output directory**：`public`
4. **Save and Deploy** を押す（初回デプロイが走ります）

### 3. KV をバインド（重要）

1. 作成した Pages プロジェクト → **Settings** → **Functions** → **KV namespace bindings**
2. **Add binding**：
   - **Variable name**：`DB`（← この名前でコードが参照します。固定）
   - **KV namespace**：手順1で作った `secretary-data` を選択
3. 保存後、**Deployments** から **Retry deployment**（再デプロイ）してバインドを反映

これで `https://<プロジェクト名>.pages.dev` にアクセスすれば動作します。
以降は `git push` するたびに自動でデプロイされます。

### ローカルでクラウド版を試す（任意）

```
npm install
npx wrangler pages dev --kv DB
```

`http://localhost:8788` で、KV（ローカル簡易版）を使った動作を確認できます。

### 現時点の制約
- **Googleカレンダー連携はローカル版のみ**対応しています（クラウド版では「今後対応予定」と表示）。
- クラウド版は**ログイン認証がありません**。URLを知っている人は誰でも閲覧・編集できます。個人用途にとどめるか、Cloudflare Access 等での保護を検討してください。
