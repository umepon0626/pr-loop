/**
 * Configuration management for the AI PR Review Loop System
 */

import * as fs from 'fs';
import * as path from 'path';

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
    this.configPath = configPath || path.join(process.cwd(), 'config', 'system.json');
    this.config = this.loadConfig();
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

    // ポーリング設定
    if (process.env.POLLING_INTERVAL_MS) {
      config.polling.intervalMs = parseInt(process.env.POLLING_INTERVAL_MS, 10);
    }

    // ループ設定
    if (process.env.MAX_LOOP_ITERATIONS) {
      config.loop.maxIterations = parseInt(process.env.MAX_LOOP_ITERATIONS, 10);
    }
    if (process.env.LOOP_DELAY_MS) {
      config.loop.delayBetweenIterationsMs = parseInt(process.env.LOOP_DELAY_MS, 10);
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
      errors.push('GitHub tokenが設定されていません');
    }
    if (!this.config.github.owner) {
      errors.push('GitHub ownerが設定されていません');
    }
    if (!this.config.github.repo) {
      errors.push('GitHub repoが設定されていません');
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