/**
 * Example usage of GitHub API Client
 * This demonstrates how to use the GitHubClient for PR monitoring with .env configuration
 */

import { GitHubClient } from "./client";
import { getConfigManager } from "../core/config";

async function exampleUsage() {
  console.log("🚀 GitHub API Client Example");
  console.log("==============================");

  // Get configuration (automatically loads from .env file)
  const configManager = getConfigManager();

  // Display current configuration status
  configManager.printConfigStatus();

  // Validate configuration
  const validation = configManager.validateConfig();
  if (!validation.valid) {
    console.error("❌ Configuration validation failed:");
    validation.errors.forEach((error) => console.error(`  - ${error}`));
    console.log("\n💡 解決方法:");
    console.log("1. プロジェクトルートに .env ファイルを作成してください");
    console.log(
      "2. .env.example ファイルを参考に必要な環境変数を設定してください"
    );
    console.log("3. 特に GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO は必須です");
    return;
  }

  console.log("✅ 設定の検証が完了しました");

  // Get configuration objects
  const githubConfig = configManager.getGitHubConfig();
  const pollingConfig = configManager.getPollingConfig();

  // Create GitHub client
  const client = new GitHubClient(githubConfig, pollingConfig);

  try {
    // Example: Get PR information
    const prNumber = 123; // 実際のPR番号に変更してください
    console.log(`\n📋 PR #${prNumber} の情報を取得中...`);

    // Get PR state
    const prState = await client.getPRState(prNumber);
    console.log("PR State:", {
      number: prState.number,
      state: prState.state,
      head: prState.head.ref,
      base: prState.base.ref,
    });

    // Get all comments
    const comments = await client.getAllComments(prNumber);
    console.log(`💬 コメント数: ${comments.length}`);

    // Get rate limit info
    const rateLimitInfo = await client.getRateLimitInfo();
    console.log("📊 Rate Limit:", {
      remaining: rateLimitInfo.remaining,
      limit: rateLimitInfo.limit,
      reset: rateLimitInfo.reset.toLocaleString(),
    });

    // Example: Create a status comment (コメントアウト - 実際に実行する場合は有効化)
    /*
    const statusComment = await client.createComment(
      prNumber,
      '🤖 AI PR Review Loop started - monitoring for Gemini Code Assist comments...'
    );
    console.log('Created status comment:', statusComment.id);
    */

    console.log("\n✅ GitHub API Client の動作確認が完了しました");
  } catch (error: any) {
    console.error("❌ エラーが発生しました:", error.message);
    if (error.status === 401) {
      console.log(
        "💡 GitHub tokenが無効または権限が不足している可能性があります"
      );
    } else if (error.status === 404) {
      console.log("💡 指定されたリポジトリまたはPRが見つかりません");
    }
  }
}

// Export for use in other modules
export { exampleUsage };

/**
 * .env ファイルの設定例を表示
 */
export function showEnvExample() {
  console.log("\n📝 .env ファイルの設定例:");
  console.log("========================");
  console.log("GITHUB_TOKEN=ghp_your_personal_access_token_here");
  console.log("GITHUB_OWNER=your_github_username");
  console.log("GITHUB_REPO=your_repository_name");
  console.log("GITHUB_API_URL=https://api.github.com");
  console.log("");
  console.log("POLLING_INTERVAL_MS=30000");
  console.log("POLLING_MAX_RETRIES=3");
  console.log("POLLING_BACKOFF_MULTIPLIER=2");
  console.log("POLLING_TIMEOUT_MS=10000");
  console.log("");
  console.log("MAX_LOOP_ITERATIONS=3");
  console.log("LOOP_DELAY_MS=120000");
  console.log("MAX_CONCURRENT_PRS=5");
  console.log("");
  console.log("KIRO_PATH=");
  console.log("IDE_SCRIPT_TIMEOUT=30000");
  console.log("IDE_MAX_RETRIES=2");
  console.log("========================\n");
}

// 実行時の処理
if (require.main === module) {
  console.log("🔧 GitHub Client with .env Configuration");
  console.log("=========================================");
  console.log("✅ GitHub REST API client with token authentication");
  console.log("✅ PR details fetching (getPullRequest, getPRState)");
  console.log("✅ Comment operations (get, create, update, resolve)");
  console.log("✅ Rate limiting with automatic retry and backoff");
  console.log("✅ Comprehensive error handling");
  console.log("✅ TypeScript interfaces and type safety");
  console.log("✅ .env file configuration support");
  console.log("✅ Environment variable validation");

  showEnvExample();

  // 実際の使用例を実行（非同期）
  exampleUsage().catch(console.error);
}
