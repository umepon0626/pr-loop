# AI PR Review Loop System

GitHub PRの自動修正ループシステム - Gemini Code AssistのAIレビューコメントを監視し、Kiro IDEを使用して自動修正を行うCIツール

## プロジェクト構造

```
src/
├── core/                   # コアビジネスロジック
│   ├── models/            # データモデルとインターフェース
│   │   └── index.ts       # LoopSession, ParsedSuggestion, FileChange等
│   └── config/            # 設定管理
│       └── index.ts       # ConfigManager, システム設定
├── github/                # GitHub API統合 (今後実装)
├── parser/                # コメント解析 (今後実装)
├── ide/                   # IDE統合 (今後実装)
├── loop/                  # ループ制御 (今後実装)
├── status/                # ステータス管理 (今後実装)
└── index.ts               # エントリーポイント
```

## 設定

### 環境変数による設定

```bash
export GITHUB_TOKEN="your_github_token"
export GITHUB_OWNER="your_username_or_org"
export GITHUB_REPO="your_repository"
export POLLING_INTERVAL_MS="30000"
export MAX_LOOP_ITERATIONS="3"
export LOOP_DELAY_MS="120000"
```

### 設定ファイルによる設定

`config/system.json`ファイルを作成（`config/system.json.example`を参考）:

```json
{
  "github": {
    "token": "your_github_token_here",
    "owner": "your_github_username_or_org",
    "repo": "your_repository_name"
  },
  "polling": {
    "intervalMs": 30000,
    "maxRetries": 3
  },
  "loop": {
    "maxIterations": 3,
    "delayBetweenIterationsMs": 120000
  }
}
```

## 使用方法

### 開発モード

```bash
npm run dev
```

### ビルドと実行

```bash
npm run build
npm start
```

### 型チェック

```bash
npm run type-check
```

## 主要なデータモデル

### LoopSession
PRのレビュー・修正ループセッションを管理

### ParsedSuggestion
解析されたAIレビューコメントの修正提案

### FileChange
ファイルに対する変更内容

### SystemConfig
システム全体の設定（GitHub、ポーリング、ループ、IDE設定）

## 要件

- Node.js 20以上
- TypeScript
- GitHub Personal Access Token
- Kiro IDE (AppleScript経由で操作)

## 開発状況

- ✅ タスク1: プロジェクト構造とコアインターフェースの設定
- ⏳ タスク2: GitHub API統合の実装
- ⏳ タスク3: コメント解析エンジンの実装
- ⏳ タスク4: AppleScript統合の実装
- ⏳ タスク5: ループ制御システムの実装
- ⏳ タスク6: ステータス管理とレポート機能
- ⏳ タスク7: エラーハンドリングとロバストネス
- ⏳ タスク8: 統合とテスト