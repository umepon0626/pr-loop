/**
 * Configuration management for the AI PR Review Loop System
 */

import * as fs from 'fs';
import * as path from 'path';
import { config as loadDotenv } from 'dotenv';

export interface SystemConfig {
  github: GitHubConfig;
  polling: PollingConfig;
  loop: LoopConfig;
  ide: IDEConfig;
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  apiUrl?: string;
}

export interface PollingConfig {
  intervalMs: number;
  maxRetries: number;
  backoffMultiplier: number;
  timeoutMs: number;
}

export interface LoopConfig {
  maxIterations: number;
  delayBetweenIterationsMs: number;
  maxConcurrentPRs: number;
}

export interface IDEConfig {
  kiroPath?: string;
  scriptTimeout: number;
  maxRetries: number;
}

// デフォルト設定
const DEFAULT_CONFIG: SystemConfig = {
  github: {
    token: process.env.GITHUB_TOKEN || '',
    owner: process.env.GITHUB_OWNER || '',
    repo: process.env.GITHUB_REPO || '',
    apiUrl: 'https://api.github.com'
  },
  polling: {
    intervalMs: 30000, // 30秒
    maxRetries: 3,
    backoffMultiplier: 2,
    timeoutMs: 10000
  },
  loop: {
    maxIterations: 3,
    delayBetweenIterationsMs: 120000, // 2分
    maxConcurrentPRs: 5
  },
  ide: {
    kiroPath: undefined, // システムが自動検出
    scriptTimeout: 30000, // 30秒
    maxRetries: 2
  }
};

export class ConfigManager {
  private config: SystemConfig;
  private configPath: string;

  constructor(configPath?: string) {
    // .envファイルを読み込む
    this.loadEnvironmentFile();
    
    this.configPath = configPath || path.join(process.cwd(), 'config', 'system.json');
    this.config = this.loadConfig();
  }

  /**
   * .envファイルを読み込む
   */
  private loadEnvironmentFile(): void {
    try {
      // プロジェクトルートの.envファイルを読み込む
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        loadDotenv({ path: envPath });
        console.log('✓ .envファイルを読み込みました');
      } else {
        console.log('ℹ .envファイルが見つかりません。環境変数またはデフォルト値を使用します');
      }
    } catch (error) {
      console.warn(`⚠ .envファイルの読み込みに失敗しました: ${error}`);
    }
  }

  /**
   * 設定を読み込む
   */
  private loadConfig(): SystemConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        const userConfig = JSON.parse(fileContent);
        return this.mergeConfig(DEFAULT_CONFIG, userConfig);
      }
    } catch (error) {
      console.warn(`設定ファイルの読み込みに失敗しました: ${error}`);
    }

    // 環境変数から設定を読み込む
    return this.loadFromEnvironment();
  }

  /**
   * 環境変数から設定を読み込む
   */
  private loadFromEnvironment(): SystemConfig {
    const config = { ...DEFAULT_CONFIG };

    // GitHub設定
    if (process.env.GITHUB_TOKEN) {
      config.github.token = process.env.GITHUB_TOKEN;
    }
    if (process.env.GITHUB_OWNER) {
      config.github.owner = process.env.GITHUB_OWNER;
    }
    if (process.env.GITHUB_REPO) {
      config.github.repo = process.env.GITHUB_REPO;
    }
    if (process.env.GITHUB_API_URL) {
      config.github.apiUrl = process.env.GITHUB_API_URL;
    }

    // ポーリング設定
    if (process.env.POLLING_INTERVAL_MS) {
      config.polling.intervalMs = parseInt(process.env.POLLING_INTERVAL_MS, 10);
    }
    if (process.env.POLLING_MAX_RETRIES) {
      config.polling.maxRetries = parseInt(process.env.POLLING_MAX_RETRIES, 10);
    }
    if (process.env.POLLING_BACKOFF_MULTIPLIER) {
      config.polling.backoffMultiplier = parseFloat(process.env.POLLING_BACKOFF_MULTIPLIER);
    }
    if (process.env.POLLING_TIMEOUT_MS) {
      config.polling.timeoutMs = parseInt(process.env.POLLING_TIMEOUT_MS, 10);
    }

    // ループ設定
    if (process.env.MAX_LOOP_ITERATIONS) {
      config.loop.maxIterations = parseInt(process.env.MAX_LOOP_ITERATIONS, 10);
    }
    if (process.env.LOOP_DELAY_MS) {
      config.loop.delayBetweenIterationsMs = parseInt(process.env.LOOP_DELAY_MS, 10);
    }
    if (process.env.MAX_CONCURRENT_PRS) {
      config.loop.maxConcurrentPRs = parseInt(process.env.MAX_CONCURRENT_PRS, 10);
    }

    // IDE設定
    if (process.env.KIRO_PATH) {
      config.ide.kiroPath = process.env.KIRO_PATH;
    }
    if (process.env.IDE_SCRIPT_TIMEOUT) {
      config.ide.scriptTimeout = parseInt(process.env.IDE_SCRIPT_TIMEOUT, 10);
    }
    if (process.env.IDE_MAX_RETRIES) {
      config.ide.maxRetries = parseInt(process.env.IDE_MAX_RETRIES, 10);
    }

    return config;
  }

  /**
   * 設定をマージする
   */
  private mergeConfig(defaultConfig: SystemConfig, userConfig: Partial<SystemConfig>): SystemConfig {
    return {
      github: { ...defaultConfig.github, ...userConfig.github },
      polling: { ...defaultConfig.polling, ...userConfig.polling },
      loop: { ...defaultConfig.loop, ...userConfig.loop },
      ide: { ...defaultConfig.ide, ...userConfig.ide }
    };
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): SystemConfig {
    return { ...this.config };
  }

  /**
   * GitHub設定を取得
   */
  getGitHubConfig(): GitHubConfig {
    return { ...this.config.github };
  }

  /**
   * ポーリング設定を取得
   */
  getPollingConfig(): PollingConfig {
    return { ...this.config.polling };
  }

  /**
   * ループ設定を取得
   */
  getLoopConfig(): LoopConfig {
    return { ...this.config.loop };
  }

  /**
   * IDE設定を取得
   */
  getIDEConfig(): IDEConfig {
    return { ...this.config.ide };
  }

  /**
   * 設定を更新
   */
  updateConfig(updates: Partial<SystemConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  /**
   * 設定をファイルに保存
   */
  saveConfig(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(`設定ファイルの保存に失敗しました: ${error}`);
    }
  }

  /**
   * 設定の妥当性をチェック
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // GitHub設定のチェック
    if (!this.config.github.token) {
      errors.push('GitHub tokenが設定されていません (.envファイルのGITHUB_TOKENを確認してください)');
    }
    if (!this.config.github.owner) {
      errors.push('GitHub ownerが設定されていません (.envファイルのGITHUB_OWNERを確認してください)');
    }
    if (!this.config.github.repo) {
      errors.push('GitHub repoが設定されていません (.envファイルのGITHUB_REPOを確認してください)');
    }

    // ポーリング設定のチェック
    if (this.config.polling.intervalMs < 1000) {
      errors.push('ポーリング間隔は1秒以上である必要があります');
    }
    if (this.config.polling.maxRetries < 0) {
      errors.push('最大リトライ回数は0以上である必要があります');
    }

    // ループ設定のチェック
    if (this.config.loop.maxIterations < 1) {
      errors.push('最大ループ回数は1以上である必要があります');
    }
    if (this.config.loop.delayBetweenIterationsMs < 0) {
      errors.push('ループ間隔は0以上である必要があります');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 設定の読み込み状況を表示
   */
  printConfigStatus(): void {
    console.log('\n=== 設定状況 ===');
    console.log(`GitHub Token: ${this.config.github.token ? '✓ 設定済み' : '✗ 未設定'}`);
    console.log(`GitHub Owner: ${this.config.github.owner || '✗ 未設定'}`);
    console.log(`GitHub Repo: ${this.config.github.repo || '✗ 未設定'}`);
    console.log(`GitHub API URL: ${this.config.github.apiUrl}`);
    console.log(`ポーリング間隔: ${this.config.polling.intervalMs}ms`);
    console.log(`最大リトライ回数: ${this.config.polling.maxRetries}`);
    console.log(`最大ループ回数: ${this.config.loop.maxIterations}`);
    console.log(`ループ間隔: ${this.config.loop.delayBetweenIterationsMs}ms`);
    console.log('================\n');
  }
}

// シングルトンインスタンス
let configManager: ConfigManager | null = null;

/**
 * ConfigManagerのシングルトンインスタンスを取得
 */
export function getConfigManager(configPath?: string): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager(configPath);
  }
  return configManager;
}