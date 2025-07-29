/**
 * PR Poller - 定期的なPRコメント監視機能
 */

import { GitHubClient, RateLimitError } from './client';
import { Comment, PRState } from '../core/models';
import { PollingConfig } from '../core/config';

export interface PollingSession {
  prNumber: number;
  lastChecked: Date;
  isActive: boolean;
  intervalId?: NodeJS.Timeout;
  consecutiveErrors: number;
  lastError?: Error;
}

export interface NewCommentsResult {
  comments: Comment[];
  hasNewComments: boolean;
  lastChecked: Date;
}

export type PollingEventType = 'new_comments' | 'pr_updated' | 'error' | 'rate_limit';

// Type-safe event data interfaces
export interface NewCommentsEventData {
  comments: Comment[];
  count: number;
}

export interface PRUpdatedEventData {
  previousState: PRState;
  currentState: PRState;
}

export interface RateLimitEventData {
  resetTime: Date;
  remaining: number;
}

// Discriminated union for type-safe events
export type PollingEvent = 
  | {
      type: 'new_comments';
      prNumber: number;
      timestamp: Date;
      data: NewCommentsEventData;
    }
  | {
      type: 'pr_updated';
      prNumber: number;
      timestamp: Date;
      data: PRUpdatedEventData;
    }
  | {
      type: 'error';
      prNumber: number;
      timestamp: Date;
      error: Error;
    }
  | {
      type: 'rate_limit';
      prNumber: number;
      timestamp: Date;
      data: RateLimitEventData;
      error?: Error;
    };

export type PollingEventHandler = (event: PollingEvent) => void | Promise<void>;

export class PRPoller {
  private githubClient: GitHubClient;
  private config: PollingConfig;
  private sessions: Map<number, PollingSession> = new Map();
  private eventHandlers: Map<PollingEventType, PollingEventHandler[]> = new Map();
  private isShuttingDown = false;

  constructor(githubClient: GitHubClient, config: PollingConfig) {
    this.githubClient = githubClient;
    this.config = config;
    
    // イベントハンドラーマップを初期化
    this.eventHandlers.set('new_comments', []);
    this.eventHandlers.set('pr_updated', []);
    this.eventHandlers.set('error', []);
    this.eventHandlers.set('rate_limit', []);
  }

  /**
   * PRのポーリングを開始
   */
  startPolling(prNumber: number, customInterval?: number): void {
    if (this.sessions.has(prNumber)) {
      console.log(`PR #${prNumber} は既にポーリング中です`);
      return;
    }

    const session: PollingSession = {
      prNumber,
      lastChecked: new Date(),
      isActive: true,
      consecutiveErrors: 0,
    };

    this.sessions.set(prNumber, session);

    const interval = customInterval || this.config.intervalMs;
    
    // Use recursive setTimeout to avoid overlapping executions
    const scheduleNextPoll = async () => {
      if (session.isActive && !this.isShuttingDown) {
        await this.pollPR(prNumber);
        session.intervalId = setTimeout(scheduleNextPoll, interval);
      }
    };

    console.log(`PR #${prNumber} のポーリングを開始しました (間隔: ${interval}ms)`);
    
    // 初回実行
    scheduleNextPoll();
  }

  /**
   * PRのポーリングを停止
   */
  stopPolling(prNumber: number): void {
    const session = this.sessions.get(prNumber);
    if (!session) {
      console.log(`PR #${prNumber} はポーリングされていません`);
      return;
    }

    session.isActive = false;
    if (session.intervalId) {
      clearTimeout(session.intervalId);
    }

    this.sessions.delete(prNumber);
    console.log(`PR #${prNumber} のポーリングを停止しました`);
  }

  /**
   * すべてのポーリングを停止
   */
  stopAllPolling(): void {
    this.isShuttingDown = true;
    
    for (const prNumber of this.sessions.keys()) {
      this.stopPolling(prNumber);
    }
    
    console.log('すべてのポーリングを停止しました');
  }

  /**
   * 新しいコメントをチェック
   */
  async checkForNewComments(prNumber: number): Promise<NewCommentsResult> {
    const session = this.sessions.get(prNumber);
    if (!session) {
      throw new Error(`PR #${prNumber} はポーリングされていません`);
    }

    try {
      const comments = await this.githubClient.getAllComments(prNumber, session.lastChecked);
      const hasNewComments = comments.length > 0;
      
      if (hasNewComments) {
        console.log(`PR #${prNumber} で ${comments.length} 件の新しいコメントを検出しました`);
      }

      return {
        comments,
        hasNewComments,
        lastChecked: session.lastChecked,
      };
    } catch (error) {
      console.error(`PR #${prNumber} のコメントチェックに失敗:`, error);
      throw error;
    }
  }

  /**
   * PRの現在の状態を取得
   */
  async getCurrentPRState(prNumber: number): Promise<PRState> {
    try {
      return await this.githubClient.getPRState(prNumber);
    } catch (error) {
      console.error(`PR #${prNumber} の状態取得に失敗:`, error);
      throw error;
    }
  }

  /**
   * アクティブなポーリングセッション一覧を取得
   */
  getActiveSessions(): PollingSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  /**
   * 特定のPRのポーリングセッション情報を取得
   */
  getSession(prNumber: number): PollingSession | undefined {
    return this.sessions.get(prNumber);
  }

  /**
   * イベントハンドラーを登録
   */
  on(eventType: PollingEventType, handler: PollingEventHandler): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  /**
   * イベントハンドラーを削除
   */
  off(eventType: PollingEventType, handler: PollingEventHandler): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * 実際のPRポーリング処理
   */
  private async pollPR(prNumber: number): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    const session = this.sessions.get(prNumber);
    if (!session || !session.isActive) {
      return;
    }

    try {
      // レート制限チェック
      const hasRateLimit = await this.githubClient.checkRateLimit();
      if (!hasRateLimit) {
        const rateLimitInfo = this.githubClient.getLastRateLimitInfo();
        if (rateLimitInfo) {
          await this.emitEvent({
            type: 'rate_limit',
            prNumber,
            timestamp: new Date(),
            data: {
              resetTime: rateLimitInfo.reset,
              remaining: rateLimitInfo.remaining,
            },
          });
          
          // レート制限の場合はバックオフ
          await this.handleRateLimit(session, rateLimitInfo.reset);
          return;
        }
      }

      // 新しいコメントをチェック
      const result = await this.checkForNewComments(prNumber);
      
      if (result.hasNewComments) {
        await this.emitEvent({
          type: 'new_comments',
          prNumber,
          timestamp: new Date(),
          data: {
            comments: result.comments,
            count: result.comments.length,
          },
        });
      }

      // PRの状態変化をチェック
      const prState = await this.getCurrentPRState(prNumber);
      // Note: For now, we'll skip PR state change detection as it requires storing previous state
      // This would be implemented when we need to track actual state changes

      // 成功時は最終チェック時刻を更新し、エラーカウントをリセット
      session.lastChecked = new Date();
      session.consecutiveErrors = 0;
      session.lastError = undefined;

    } catch (error) {
      await this.handlePollingError(session, error as Error);
    }
  }

  /**
   * ポーリングエラーの処理
   */
  private async handlePollingError(session: PollingSession, error: Error): Promise<void> {
    session.consecutiveErrors++;
    session.lastError = error;

    console.error(`PR #${session.prNumber} ポーリングエラー (${session.consecutiveErrors}回目):`, error.message);

    await this.emitEvent({
      type: 'error',
      prNumber: session.prNumber,
      timestamp: new Date(),
      error,
    });

    // レート制限エラーの場合
    if (error instanceof RateLimitError) {
      await this.handleRateLimit(session, error.resetTime);
      return;
    }

    // 連続エラーが多い場合はバックオフ
    if (session.consecutiveErrors >= this.config.maxRetries) {
      console.warn(`PR #${session.prNumber} で連続エラーが発生したため、ポーリング間隔を延長します`);
      await this.applyBackoff(session);
    }
  }

  /**
   * レート制限の処理
   */
  private async handleRateLimit(session: PollingSession, resetTime: Date): Promise<void> {
    const waitTime = resetTime.getTime() - Date.now();
    
    if (waitTime > 0) {
      console.log(`PR #${session.prNumber}: レート制限のため ${Math.ceil(waitTime / 1000)} 秒待機します`);
      
      // 現在のインターバルを停止
      if (session.intervalId) {
        clearTimeout(session.intervalId);
      }
      
      // レート制限解除後に再開
      this.resumePolling(session, waitTime);
    }
  }

  /**
   * バックオフの適用
   */
  private async applyBackoff(session: PollingSession): Promise<void> {
    const backoffDelay = Math.min(
      this.config.intervalMs * Math.pow(this.config.backoffMultiplier, session.consecutiveErrors - 1),
      300000 // 最大5分
    );

    console.log(`PR #${session.prNumber}: ${backoffDelay}ms のバックオフを適用します`);

    // 現在のインターバルを停止
    if (session.intervalId) {
      clearTimeout(session.intervalId);
    }

    // バックオフ後に通常間隔で再開
    this.resumePolling(session, backoffDelay);
  }

  /**
   * ポーリングを再開する共通メソッド
   */
  private resumePolling(session: PollingSession, delay: number = 0): void {
    setTimeout(() => {
      if (session.isActive && !this.isShuttingDown) {
        const scheduleNextPoll = async () => {
          if (session.isActive && !this.isShuttingDown) {
            await this.pollPR(session.prNumber);
            session.intervalId = setTimeout(scheduleNextPoll, this.config.intervalMs);
          }
        };
        
        scheduleNextPoll();
        console.log(`PR #${session.prNumber}: ポーリングを再開しました`);
      }
    }, delay);
  }

  /**
   * イベントを発行
   */
  private async emitEvent(event: PollingEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type) || [];
    
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`イベントハンドラーでエラーが発生しました (${event.type}):`, error);
      }
    }
  }
}