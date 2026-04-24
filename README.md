# 研究タイマー

研究時間を記録・可視化するWebアプリです。

## 機能

- **自由計測**: 開始・一時停止・終了で自由に研究時間を記録
- **ポモドーロ**: 25分作業 + 5分休憩のサイクルで集中管理
- **今日の合計**: 当日の研究時間をリアルタイム表示
- **日別グラフ**: 過去7日間の研究時間を棒グラフで可視化（Recharts）
- **セッション履歴**: 直近10件のセッションを一覧表示
- データはブラウザの `localStorage` に保存されます

---

## ローカル起動方法

```bash
# 依存パッケージのインストール（初回のみ）
npm install

# 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:5173 を開いてください。

### その他のコマンド

```bash
npm run build    # 本番ビルド（dist/ に出力）
npm run preview  # ビルド済みファイルをローカルでプレビュー
```

---

## GitHubへのpush方法

1. [GitHub](https://github.com/new) で新しいリポジトリを作成（空のまま・READMEなし）

2. ローカルリポジトリをリモートに接続してpush:

```bash
git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git
git push -u origin main
```

---

## Vercelでの公開手順

1. [vercel.com](https://vercel.com) にGitHubアカウントでログイン
2. **Add New Project** → GitHubのリポジトリを選択してインポート
3. 設定はデフォルトのままで **Deploy** をクリック

Vercelは `package.json` の `build` スクリプトと出力先 `dist/` を自動検出します。
`vercel.json` によりSPAのルーティングも正しく機能します。

デプロイ後、自動で公開URLが発行されます。以降は `git push` するたびに自動デプロイされます。
