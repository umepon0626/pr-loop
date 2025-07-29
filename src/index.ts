/**
 * AI PR Review Loop System
 * Entry point for the automated GitHub PR review and fix system
 */

import { getConfigManager } from './core/config';
import { LoopSession, ParsedSuggestion, FileChange } from './core/models';

async function main() {
  console.log('AI PR Review Loop System starting...');
  
  // 設定の読み込みと検証
  const configManager = getConfigManager();
  const validation = configManager.validateConfig();
  
  if (!validation.valid) {
    console.error('設定エラー:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
  
  const config = configManager.getConfig();
  console.log('設定が正常に読み込まれました');
  console.log(`GitHub Repository: ${config.github.owner}/${config.github.repo}`);
  console.log(`最大ループ回数: ${config.loop.maxIterations}`);
  console.log(`ポーリング間隔: ${config.polling.intervalMs}ms`);
  
  // TODO: 実際のシステム起動処理はタスク2以降で実装
  console.log('システムの初期化が完了しました');
}

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('予期しないエラーが発生しました:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未処理のPromise拒否:', reason);
  process.exit(1);
});

// メイン処理の実行
if (require.main === module) {
  main().catch((error) => {
    console.error('アプリケーションの起動に失敗しました:', error);
    process.exit(1);
  });
}