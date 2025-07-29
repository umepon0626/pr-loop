# AI PR Review Loop System

GitHub PRのAIレビューコメントを自動的に適用し、継続的な改善ループを作成するシステムです。

## 🚀 セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成し、以下の環境変数を設定してください：

```bash
# .env.example をコピーして作成
cp .env.example .env
```

`.env` ファイルの内容：

```env
# GitHub Configuration
GITHUB_TOKEN=your_github_personal_access_token_here
GITHUB_OWNER=your_github_username_or_organization
GITHUB_REPO=your_repository_name
GITHUB_API_URL=https://api.github.com

# Polling Configuration
POLLING_INTERVAL_MS=30000
POLLING_MAX_RETRIES=3
POLLING_BACKOFF_MULTIPLIER=2
POLLING_TIMEOUT_MS=10000

# Loop Configuration
MAX_LOOP_ITERATIONS=3
LOOP_DELAY_MS=120000
MAX_CONCURRENT_PRS=5

# IDE Configuration
KIRO_PATH=
IDE_SCRIPT_TIMEOUT=30000
IDE_MAX_RETRIES=2
```

### 3. GitHub Personal Access Token の取得

1. GitHub の [Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens) にアクセス
2. "Generate new token (classic)" をクリック
3. 以下の権限を選択：
   - `repo` (Full control of private repositories)
   - `pull_requests` (Access pull requests)
   - `issues` (Access issues)
4. 生成されたトークンを `GITHUB_TOKEN` に設定

## 🔧 使用方法

### 設定の確認

```bash
# TypeScript のコンパイル確認
pnpm run type-check

# プロジェクトのビルド
pnpm run build

# GitHub Client の動作確認
npx ts-node src/github/example.ts
```

### 開発モード

```bash
pnpm run dev
```

## 📁 プロジェクト構造

```
src/
├── core/
│   ├── config/           # 設定管理
│   └── models/           # データモデル
├── github/               # GitHub API統合
│   ├── client.ts         # GitHub APIクライアント
│   ├── client.test.ts    # テスト
│   └── example.ts        # 使用例
└── ...
```

## ⚙️ 設定項目

### GitHub設定
- `GITHUB_TOKEN`: GitHub Personal Access Token（必須）
- `GITHUB_OWNER`: GitHubユーザー名または組織名（必須）
- `GITHUB_REPO`: リポジトリ名（必須）
- `GITHUB_API_URL`: GitHub API URL（デフォルト: https://api.github.com）

### ポーリング設定
- `POLLING_INTERVAL_MS`: ポーリング間隔（ミリ秒、デフォルト: 30000）
- `POLLING_MAX_RETRIES`: 最大リトライ回数（デフォルト: 3）
- `POLLING_BACKOFF_MULTIPLIER`: バックオフ倍率（デフォルト: 2）
- `POLLING_TIMEOUT_MS`: タイムアウト時間（ミリ秒、デフォルト: 10000）

### ループ設定
- `MAX_LOOP_ITERATIONS`: 最大ループ回数（デフォルト: 3）
- `LOOP_DELAY_MS`: ループ間隔（ミリ秒、デフォルト: 120000）
- `MAX_CONCURRENT_PRS`: 同時処理PR数（デフォルト: 5）

### IDE設定
- `KIRO_PATH`: Kiro IDEのパス（オプション）
- `IDE_SCRIPT_TIMEOUT`: スクリプトタイムアウト（ミリ秒、デフォルト: 30000）
- `IDE_MAX_RETRIES`: IDE操作の最大リトライ回数（デフォルト: 2）

## 🔍 トラブルシューティング

### 設定エラー
設定に問題がある場合、以下のコマンドで設定状況を確認できます：

```bash
npx ts-node src/github/example.ts
```

### よくあるエラー
- **401 Unauthorized**: GitHub tokenが無効または権限不足
- **404 Not Found**: リポジトリまたはPRが見つからない
- **403 Rate Limit**: API制限に達している

## 📝 ライセンス

ISC License