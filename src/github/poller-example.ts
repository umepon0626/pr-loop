/**
 * PRPoller の使用例
 */

import { PRPoller } from './poller';
import { GitHubClient } from './client';
import { getConfigManager } from '../core/config';
import { Comment } from '../core/models';

async function demonstratePoller() {
  console.log('=== PR Poller デモンストレーション ===\n');

  // 設定を読み込み
  const configManager = getConfigManager();
  const githubConfig = configManager.getGitHubConfig();
  const pollingConfig = configManager.getPollingConfig();

  // 設定の妥当性をチェック
  const validation = configManager.validateConfig();
  if (!validation.valid) {
    console.error('設定エラー:');
    validation.errors.forEach(error => console.error(`- ${error}`));
    return;
  }

  // GitHub クライアントとポーラーを初期化
  const githubClient = new GitHubClient(githubConfig, pollingConfig);
  const poller = new PRPoller(githubClient, pollingConfig);

  // イベントハンドラーを設定
  poller.on('new_comments', (event) => {
    console.log(`🔔 PR #${event.prNumber} で新しいコメントを検出:`);
    console.log(`   - ${event.data.count} 件のコメント`);
    event.data.comments.forEach((comment: Comment, index: number) => {
      console.log(`   ${index + 1}. ${comment.user.login}: ${comment.body.substring(0, 50)}...`);
    });
    console.log();
  });

  poller.on('pr_updated', (event) => {
    console.log(`📝 PR #${event.prNumber} の状態が更新されました`);
  });

  poller.on('error', (event) => {
    console.error(`❌ PR #${event.prNumber} でエラーが発生: ${event.error?.message}`);
  });

  poller.on('rate_limit', (event) => {
    console.warn(`⏳ PR #${event.prNumber} でレート制限に達しました`);
    console.warn(`   リセット時刻: ${event.data.resetTime.toLocaleString()}`);
    console.warn(`   残り回数: ${event.data.remaining}`);
  });

  // デモ用のPR番号（実際の環境では有効なPR番号を使用）
  const demoPRNumber = 1;

  console.log(`PR #${demoPRNumber} のポーリングを開始します...`);
  console.log(`ポーリング間隔: ${pollingConfig.intervalMs}ms`);
  console.log(`最大リトライ回数: ${pollingConfig.maxRetries}`);
  console.log('Ctrl+C で停止できます\n');

  // ポーリング開始
  poller.startPolling(demoPRNumber);

  // 10秒後にセッション情報を表示
  setTimeout(() => {
    const session = poller.getSession(demoPRNumber);
    if (session) {
      console.log('\n=== セッション情報 ===');
      console.log(`PR番号: ${session.prNumber}`);
      console.log(`開始時刻: ${session.lastChecked.toLocaleString()}`);
      console.log(`アクティブ: ${session.isActive}`);
      console.log(`連続エラー回数: ${session.consecutiveErrors}`);
      if (session.lastError) {
        console.log(`最後のエラー: ${session.lastError.message}`);
      }
      console.log('==================\n');
    }
  }, 10000);

  // 30秒後にポーリングを停止
  setTimeout(() => {
    console.log('\nポーリングを停止します...');
    poller.stopAllPolling();
    
    console.log('\n=== デモ完了 ===');
    console.log('PRポーラーの主な機能:');
    console.log('✓ 定期的なPRコメント監視');
    console.log('✓ 新しいコメントの検出とフィルタリング');
    console.log('✓ レート制限の自動処理');
    console.log('✓ エラー時のバックオフ機能');
    console.log('✓ イベントベースの通知システム');
    console.log('✓ 複数PRの同時監視サポート');
    
    process.exit(0);
  }, 30000);

  // プロセス終了時のクリーンアップ
  process.on('SIGINT', () => {
    console.log('\n\nポーリングを停止しています...');
    poller.stopAllPolling();
    process.exit(0);
  });
}

// このファイルが直接実行された場合にデモを開始
if (require.main === module) {
  demonstratePoller().catch(error => {
    console.error('デモ実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}

export { demonstratePoller };