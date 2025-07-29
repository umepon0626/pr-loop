/**
 * GitHub API Client with authentication, rate limiting, and error handling
 */

import { Octokit } from '@octokit/rest';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import { GitHubConfig, PollingConfig } from '../core/config';
import { Comment, PRState } from '../core/models';

export type GitHubPullRequest = RestEndpointMethodTypes['pulls']['get']['response']['data'];
export type GitHubComment = RestEndpointMethodTypes['pulls']['listReviewComments']['response']['data'][0];
export type GitHubIssueComment = RestEndpointMethodTypes['issues']['listComments']['response']['data'][0];

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'GitHubAPIError';
  }
}

export class RateLimitError extends GitHubAPIError {
  constructor(
    message: string,
    public resetTime: Date
  ) {
    super(message, 403);
    this.name = 'RateLimitError';
  }
}

export class GitHubClient {
  private octokit: Octokit;
  private config: GitHubConfig;
  private pollingConfig: PollingConfig;
  private lastRateLimitInfo?: RateLimitInfo;

  constructor(githubConfig: GitHubConfig, pollingConfig: PollingConfig) {
    this.config = githubConfig;
    this.pollingConfig = pollingConfig;
    
    this.octokit = new Octokit({
      auth: githubConfig.token,
      baseUrl: githubConfig.apiUrl || 'https://api.github.com',
      request: {
        timeout: pollingConfig.timeoutMs,
      },
    });
  }

  /**
   * PR の詳細情報を取得
   */
  async getPullRequest(prNumber: number): Promise<GitHubPullRequest> {
    try {
      const response = await this.executeWithRetry(async () => {
        return await this.octokit.pulls.get({
          owner: this.config.owner,
          repo: this.config.repo,
          pull_number: prNumber,
        });
      });

      this.updateRateLimitInfo(response.headers);
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to get PR #${prNumber}`);
    }
  }

  /**
   * PR の状態情報を取得
   */
  async getPRState(prNumber: number): Promise<PRState> {
    const pr = await this.getPullRequest(prNumber);
    
    return {
      number: pr.number,
      state: pr.state as 'open' | 'closed' | 'merged',
      head: {
        sha: pr.head.sha,
        ref: pr.head.ref,
      },
      base: {
        sha: pr.base.sha,
        ref: pr.base.ref,
      },
      updated_at: pr.updated_at,
    };
  }

  /**
   * PR のレビューコメントを取得
   */
  async getReviewComments(prNumber: number, since?: Date): Promise<Comment[]> {
    try {
      const response = await this.executeWithRetry(async () => {
        const params: any = {
          owner: this.config.owner,
          repo: this.config.repo,
          pull_number: prNumber,
          per_page: 100,
        };

        if (since) {
          params.since = since.toISOString();
        }

        return await this.octokit.pulls.listReviewComments(params);
      });

      this.updateRateLimitInfo(response.headers);
      return this.convertToComments(response.data);
    } catch (error) {
      throw this.handleError(error, `Failed to get review comments for PR #${prNumber}`);
    }
  }

  /**
   * PR のイシューコメントを取得
   */
  async getIssueComments(prNumber: number, since?: Date): Promise<Comment[]> {
    try {
      const response = await this.executeWithRetry(async () => {
        const params: any = {
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: prNumber,
          per_page: 100,
        };

        if (since) {
          params.since = since.toISOString();
        }

        return await this.octokit.issues.listComments(params);
      });

      this.updateRateLimitInfo(response.headers);
      return this.convertIssueCommentsToComments(response.data);
    } catch (error) {
      throw this.handleError(error, `Failed to get issue comments for PR #${prNumber}`);
    }
  }

  /**
   * すべてのコメント（レビューコメント + イシューコメント）を取得
   */
  async getAllComments(prNumber: number, since?: Date): Promise<Comment[]> {
    const [reviewComments, issueComments] = await Promise.all([
      this.getReviewComments(prNumber, since),
      this.getIssueComments(prNumber, since),
    ]);

    return [...reviewComments, ...issueComments].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  /**
   * コメントを作成
   */
  async createComment(prNumber: number, body: string): Promise<Comment> {
    try {
      const response = await this.executeWithRetry(async () => {
        return await this.octokit.issues.createComment({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: prNumber,
          body,
        });
      });

      this.updateRateLimitInfo(response.headers);
      return this.convertIssueCommentToComment(response.data);
    } catch (error) {
      throw this.handleError(error, `Failed to create comment on PR #${prNumber}`);
    }
  }

  /**
   * コメントを更新
   */
  async updateComment(commentId: string, body: string): Promise<Comment> {
    try {
      const response = await this.executeWithRetry(async () => {
        return await this.octokit.issues.updateComment({
          owner: this.config.owner,
          repo: this.config.repo,
          comment_id: parseInt(commentId, 10),
          body,
        });
      });

      this.updateRateLimitInfo(response.headers);
      return this.convertIssueCommentToComment(response.data);
    } catch (error) {
      throw this.handleError(error, `Failed to update comment ${commentId}`);
    }
  }

  /**
   * レビューコメントを解決済みにマーク
   */
  async resolveReviewComment(commentId: string): Promise<void> {
    try {
      await this.executeWithRetry(async () => {
        return await this.octokit.pulls.updateReviewComment({
          owner: this.config.owner,
          repo: this.config.repo,
          comment_id: parseInt(commentId, 10),
          body: '[RESOLVED] ' + (await this.getReviewComment(commentId)).body,
        });
      });
    } catch (error) {
      throw this.handleError(error, `Failed to resolve review comment ${commentId}`);
    }
  }

  /**
   * 現在のレート制限情報を取得
   */
  async getRateLimitInfo(): Promise<RateLimitInfo> {
    try {
      const response = await this.octokit.rateLimit.get();
      const rateLimit = response.data.rate;
      
      return {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        reset: new Date(rateLimit.reset * 1000),
        used: rateLimit.used,
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get rate limit info');
    }
  }

  /**
   * 最後に取得したレート制限情報を返す
   */
  getLastRateLimitInfo(): RateLimitInfo | undefined {
    return this.lastRateLimitInfo;
  }

  /**
   * レート制限チェック
   */
  async checkRateLimit(): Promise<boolean> {
    const rateLimitInfo = await this.getRateLimitInfo();
    return rateLimitInfo.remaining > 10; // 10リクエスト以上残っている場合のみ実行
  }

  /**
   * リトライ機能付きでAPIを実行
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.pollingConfig.maxRetries; attempt++) {
      try {
        // レート制限チェック
        if (this.lastRateLimitInfo && this.lastRateLimitInfo.remaining <= 5) {
          const waitTime = this.lastRateLimitInfo.reset.getTime() - Date.now();
          if (waitTime > 0) {
            throw new RateLimitError(
              `Rate limit exceeded. Reset at ${this.lastRateLimitInfo.reset.toISOString()}`,
              this.lastRateLimitInfo.reset
            );
          }
        }

        return await operation();
      } catch (error: any) {
        lastError = error;

        // レート制限エラーの場合は即座に例外を投げる
        if (error.status === 403 && error.response?.headers?.['x-ratelimit-remaining'] === '0') {
          const resetTime = new Date(parseInt(error.response.headers['x-ratelimit-reset']) * 1000);
          throw new RateLimitError('Rate limit exceeded', resetTime);
        }

        // 最後の試行の場合は例外を投げる
        if (attempt === this.pollingConfig.maxRetries) {
          break;
        }

        // 一時的なエラーの場合はリトライ
        if (this.isRetryableError(error)) {
          const delay = this.calculateBackoffDelay(attempt);
          await this.sleep(delay);
          continue;
        }

        // リトライ不可能なエラーの場合は即座に例外を投げる
        throw error;
      }
    }

    throw lastError!;
  }

  /**
   * リトライ可能なエラーかどうかを判定
   */
  private isRetryableError(error: any): boolean {
    if (!error.status) return false;
    
    // 5xx系エラー、408 (Request Timeout), 429 (Too Many Requests) はリトライ可能
    return error.status >= 500 || error.status === 408 || error.status === 429;
  }

  /**
   * バックオフ遅延時間を計算
   */
  private calculateBackoffDelay(attempt: number): number {
    return Math.min(
      1000 * Math.pow(this.pollingConfig.backoffMultiplier, attempt),
      30000 // 最大30秒
    );
  }

  /**
   * 指定時間待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * レート制限情報を更新
   */
  private updateRateLimitInfo(headers: any): void {
    if (headers['x-ratelimit-limit']) {
      this.lastRateLimitInfo = {
        limit: parseInt(headers['x-ratelimit-limit'], 10),
        remaining: parseInt(headers['x-ratelimit-remaining'], 10),
        reset: new Date(parseInt(headers['x-ratelimit-reset']) * 1000),
        used: parseInt(headers['x-ratelimit-used'], 10),
      };
    }
  }

  /**
   * エラーハンドリング
   */
  private handleError(error: any, context: string): GitHubAPIError {
    if (error instanceof GitHubAPIError) {
      return error;
    }

    const message = `${context}: ${error.message || 'Unknown error'}`;
    return new GitHubAPIError(message, error.status, error.response);
  }

  /**
   * GitHub レビューコメントを共通のComment型に変換
   */
  private convertToComments(githubComments: GitHubComment[]): Comment[] {
    return githubComments.map(comment => ({
      id: comment.id.toString(),
      body: comment.body,
      user: {
        login: comment.user?.login || 'unknown',
        type: comment.user?.type || 'User',
      },
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      path: comment.path,
      line: comment.line || undefined,
      position: comment.position || undefined,
    }));
  }

  /**
   * GitHub イシューコメントを共通のComment型に変換
   */
  private convertIssueCommentsToComments(githubComments: GitHubIssueComment[]): Comment[] {
    return githubComments.map(comment => this.convertIssueCommentToComment(comment));
  }

  /**
   * 単一のGitHub イシューコメントを共通のComment型に変換
   */
  private convertIssueCommentToComment(githubComment: GitHubIssueComment): Comment {
    return {
      id: githubComment.id.toString(),
      body: githubComment.body || '',
      user: {
        login: githubComment.user?.login || 'unknown',
        type: githubComment.user?.type || 'User',
      },
      created_at: githubComment.created_at,
      updated_at: githubComment.updated_at,
    };
  }

  /**
   * レビューコメントを取得（内部用）
   */
  private async getReviewComment(commentId: string): Promise<GitHubComment> {
    const response = await this.octokit.pulls.getReviewComment({
      owner: this.config.owner,
      repo: this.config.repo,
      comment_id: parseInt(commentId, 10),
    });
    return response.data;
  }
}