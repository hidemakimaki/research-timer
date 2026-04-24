# 研究タイマー

研究時間を記録・可視化するWebアプリです。Supabaseによるクラウド同期に対応しており、複数デバイスから同じ記録にアクセスできます。

## 機能

- **自由計測**: 開始・一時停止・終了で自由に研究時間を記録
- **ポモドーロ**: 25分作業 + 5分休憩のサイクルで集中管理
- **今日の合計**: 当日の研究時間をリアルタイム表示
- **日別グラフ**: 過去7日間の研究時間を棒グラフで可視化（Recharts）
- **セッション履歴**: 直近10件のセッションを一覧表示
- **クラウド同期**: Supabase Authによるログイン＋クロスデバイス同期
- **ローカル移行**: 既存のlocalStorageデータをSupabaseへワンクリック移行

---

## ローカル起動方法

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、Supabaseの値を入力します：

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. 開発サーバー起動

```bash
npm run dev
```

ブラウザで http://localhost:5173 を開いてください。

### その他のコマンド

```bash
npm run build    # 本番ビルド（dist/ に出力）
npm run preview  # ビルド済みファイルをローカルでプレビュー
```

---

## Supabase設定手順

### 1. プロジェクト作成

[https://supabase.com](https://supabase.com) でアカウントを作成し、新しいプロジェクトを作成します。

### 2. sessionsテーブルの作成

Supabaseダッシュボードの **SQL Editor** で以下を実行します：

```sql
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date text not null,
  started_at timestamptz not null,
  duration integer not null,
  mode text not null,
  created_at timestamptz default now()
);

alter table sessions enable row level security;

create policy "Users can read own sessions"
  on sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on sessions for delete
  using (auth.uid() = user_id);
```

### 3. APIキーの取得

ダッシュボードの **Settings → API** から以下を取得します：
- **Project URL** → `VITE_SUPABASE_URL`
- **anon (public) key** → `VITE_SUPABASE_ANON_KEY`

---

## GitHubへのpush方法

```bash
cd ~/research-timer
git add .
git commit -m "Add Supabase auth and cloud sync"
git push
```

---

## Vercelでの公開手順

### 1. 初回デプロイ

1. [vercel.com](https://vercel.com) にGitHubアカウントでログイン
2. **Add New Project** → GitHubの `research-timer` リポジトリを選択
3. **Environment Variables** に以下を追加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy** をクリック

### 2. 既存プロジェクトへの環境変数追加

Vercelダッシュボード → プロジェクト → **Settings → Environment Variables** で追加します。

> 環境変数を追加・変更した後は **Redeploy** が必要です。

以降は `git push` するたびに自動デプロイされます。
