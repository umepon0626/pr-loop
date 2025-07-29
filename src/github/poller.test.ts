/**
 * PRPoller のテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { PRPoller, PollingEvent } from './poller';
import { GitHubClient, RateLimitError } from './client';
import { PollingConfig } from '../core/config';
import { Comment, PRState } from '../core/models';

// GitHubClientのモック
const mockGitHubClient = {
  getAllComments: vi.fn(),
  getPRState: vi.fn(),
  checkRateLimit: vi.fn(),
  getLastRateLimitInfo: vi.fn(),
} as unknown as GitHubClient;

const mockPollingConfig: PollingConfig = {
  intervalMs: 1000,
  maxRetries: 3,
  backoffMultiplier: 2,
  timeoutMs: 5000,
};

describe('PRPoller', () => {
  let poller: PRPoller;
  let eventHandler: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    poller = new PRPoller(mockGitHubClient, mockPollingConfig);
    eventHandler = vi.fn();
    
    // デフォルトのモック設定
    vi.mocked(mockGitHubClient.checkRateLimit).mockResolvedValue(true);
    vi.mocked(mockGitHubClient.getAllComments).mockResolvedValue([]);
    vi.mocked(mockGitHubClient.getPRState).mockResolvedValue({
      number: 123,
      state: 'open',
      head: { sha: 'abc123', ref: 'feature-branch' },
      base: { sha: 'def456', ref: 'main' },
      updated_at: '2024-01-01T00:00:00Z',
    });
  });

  afterEach(() => {
    poller.stopAllPolling();
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('startPolling', () => {
    it('新しいポーリングセッションを開始できる', () => {
      const prNumber = 123;
      
      poller.startPolling(prNumber);
      
      const session = poller.getSession(prNumber);
      expect(session).toBeDefined();
      expect(session?.prNumber).toBe(prNumber);
      expect(session?.isActive).toBe(true);
    });

    it('既にポーリング中のPRに対しては重複開始しない', () => {
      const prNumber = 123;
      
      poller.startPolling(prNumber);
      poller.startPolling(prNumber); // 重複開始
      
      const activeSessions = poller.getActiveSessions();
      expect(activeSessions).toHaveLength(1);
    });

    it('カスタム間隔でポーリングを開始できる', () => {
      const prNumber = 123;
      const customInterval = 5000;
      
      poller.startPolling(prNumber, customInterval);
      
      const session = poller.getSession(prNumber);
      expect(session).toBeDefined();
      expect(session?.isActive).toBe(true);
    });
  });

  describe('stopPolling', () => {
    it('ポーリングセッションを停止できる', () => {
      const prNumber = 123;
      
      poller.startPolling(prNumber);
      expect(poller.getSession(prNumber)).toBeDefined();
      
      poller.stopPolling(prNumber);
      expect(poller.getSession(prNumber)).toBeUndefined();
    });

    it('存在しないPRの停止要求は無視される', () => {
      expect(() => poller.stopPolling(999)).not.toThrow();
    });
  });

  describe('checkForNewComments', () => {
    it('新しいコメントを正しく検出できる', async () => {
      const prNumber = 123;
      const mockComments: Comment[] = [
        {
          id: '1',
          body: 'Test comment',
          user: { login: 'testuser', type: 'User' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      poller.startPolling(prNumber);
      vi.mocked(mockGitHubClient.getAllComments).mockResolvedValue(mockComments);

      const result = await poller.checkForNewComments(prNumber);

      expect(result.hasNewComments).toBe(true);
      expect(result.comments).toEqual(mockComments);
      expect(result.comments).toHaveLength(1);
    });

    it('新しいコメントがない場合は空配列を返す', async () => {
      const prNumber = 123;
      
      poller.startPolling(prNumber);
      vi.mocked(mockGitHubClient.getAllComments).mockResolvedValue([]);

      const result = await poller.checkForNewComments(prNumber);

      expect(result.hasNewComments).toBe(false);
      expect(result.comments).toEqual([]);
    });

    it('ポーリングされていないPRに対してはエラーを投げる', async () => {
      const prNumber = 999;

      await expect(poller.checkForNewComments(prNumber)).rejects.toThrow(
        'PR #999 はポーリングされていません'
      );
    });
  });

  describe('getCurrentPRState', () => {
    it('PRの状態を正しく取得できる', async () => {
      const prNumber = 123;
      const mockPRState: PRState = {
        number: 123,
        state: 'open',
        head: { sha: 'abc123', ref: 'feature-branch' },
        base: { sha: 'def456', ref: 'main' },
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockGitHubClient.getPRState).mockResolvedValue(mockPRState);

      const result = await poller.getCurrentPRState(prNumber);

      expect(result).toEqual(mockPRState);
      expect(mockGitHubClient.getPRState).toHaveBeenCalledWith(prNumber);
    });
  });

  describe('イベントハンドリング', () => {
    it('new_commentsイベントを正しく発行する', async () => {
      const prNumber = 123;
      const mockComments: Comment[] = [
        {
          id: '1',
          body: 'Test comment',
          user: { login: 'testuser', type: 'User' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      poller.on('new_comments', eventHandler);
      poller.startPolling(prNumber);
      
      vi.mocked(mockGitHubClient.getAllComments).mockResolvedValue(mockComments);

      // ポーリング実行を待つ
      await vi.advanceTimersByTimeAsync(mockPollingConfig.intervalMs);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'new_comments',
          prNumber,
          data: expect.objectContaining({
            comments: mockComments,
            count: 1,
          }),
        })
      );
    });

    it('errorイベントを正しく発行する', async () => {
      const prNumber = 123;
      const error = new Error('API Error');

      poller.on('error', eventHandler);
      poller.startPolling(prNumber);
      
      vi.mocked(mockGitHubClient.getAllComments).mockRejectedValue(error);

      // ポーリング実行を待つ
      await vi.advanceTimersByTimeAsync(mockPollingConfig.intervalMs);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          prNumber,
          error,
        })
      );
    });
  });

  describe('レート制限処理', () => {
    it('レート制限時にrate_limitイベントを発行する', async () => {
      const prNumber = 123;
      const rateLimitInfo = {
        limit: 5000,
        remaining: 0,
        reset: new Date(Date.now() + 60000),
        used: 5000,
      };

      poller.on('rate_limit', eventHandler);
      
      vi.mocked(mockGitHubClient.checkRateLimit).mockResolvedValue(false);
      vi.mocked(mockGitHubClient.getLastRateLimitInfo).mockReturnValue(rateLimitInfo);
      
      poller.startPolling(prNumber);

      // ポーリング実行を待つ（少し長めに待機）
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rate_limit',
          prNumber,
          data: rateLimitInfo,
        })
      );
    });

    it('RateLimitErrorが発生した場合に適切に処理する', async () => {
      const prNumber = 123;
      const resetTime = new Date(Date.now() + 60000);
      const rateLimitError = new RateLimitError('Rate limit exceeded', resetTime);

      poller.on('error', eventHandler);
      poller.startPolling(prNumber);
      
      vi.mocked(mockGitHubClient.getAllComments).mockRejectedValue(rateLimitError);

      // ポーリング実行を待つ
      await vi.advanceTimersByTimeAsync(mockPollingConfig.intervalMs);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          prNumber,
          error: rateLimitError,
          data: expect.objectContaining({
            isRateLimitError: true,
          }),
        })
      );
    });
  });

  describe('バックオフ機能', () => {
    it('連続エラー時にバックオフが適用される', async () => {
      const prNumber = 123;
      const error = new Error('Persistent error');

      poller.startPolling(prNumber);
      
      // 連続してエラーを発生させる
      vi.mocked(mockGitHubClient.getAllComments).mockRejectedValue(error);

      // 複数回のポーリング実行を待つ
      await new Promise(resolve => setTimeout(resolve, 500));

      const session = poller.getSession(prNumber);
      expect(session?.consecutiveErrors).toBeGreaterThan(0);
    });
  });

  describe('セッション管理', () => {
    it('アクティブなセッション一覧を取得できる', () => {
      poller.startPolling(123);
      poller.startPolling(456);
      
      const activeSessions = poller.getActiveSessions();
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.map(s => s.prNumber)).toContain(123);
      expect(activeSessions.map(s => s.prNumber)).toContain(456);
    });

    it('すべてのポーリングを停止できる', () => {
      poller.startPolling(123);
      poller.startPolling(456);
      
      expect(poller.getActiveSessions()).toHaveLength(2);
      
      poller.stopAllPolling();
      
      expect(poller.getActiveSessions()).toHaveLength(0);
    });
  });
});