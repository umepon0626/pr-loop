/**
 * Tests for CommentMonitor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CommentMonitor } from './comment-monitor';
import { Comment } from '../core/models';

describe('CommentMonitor', () => {
  let commentMonitor: CommentMonitor;

  beforeEach(() => {
    commentMonitor = new CommentMonitor();
  });

  describe('isGeminiComment', () => {
    it('should identify Gemini Code Assist comments by username', () => {
      const geminiComment: Comment = {
        id: '123',
        body: 'This is a suggestion',
        user: {
          login: 'gemini-code-assist[bot]',
          type: 'Bot',
        },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      expect(commentMonitor.isGeminiComment(geminiComment)).toBe(true);
    });

    it('should identify Gemini Code Assist comments by user ID', () => {
      const geminiComment: Comment = {
        id: '123',
        body: 'This is a suggestion',
        user: {
          login: 'some-other-name',
          type: 'Bot',
          id: '176961590',
        },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      expect(commentMonitor.isGeminiComment(geminiComment)).toBe(true);
    });

    it('should identify Gemini Code Assist comments by content patterns', () => {
      const geminiComment: Comment = {
        id: '123',
        body: '![critical](https://www.gstatic.com/codereviewagent/critical.svg)\n\nThis is a critical issue.',
        user: {
          login: 'unknown-user',
          type: 'User',
        },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      expect(commentMonitor.isGeminiComment(geminiComment)).toBe(true);
    });

    it('should not identify regular user comments', () => {
      const regularComment: Comment = {
        id: '123',
        body: 'This looks good to me!',
        user: {
          login: 'regular-user',
          type: 'User',
        },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      expect(commentMonitor.isGeminiComment(regularComment)).toBe(false);
    });
  });

  describe('extractActionableComments', () => {
    it('should extract actionable Gemini comments with suggestions', () => {
      const comments: Comment[] = [
        {
          id: '1',
          body: '![critical](https://www.gstatic.com/codereviewagent/critical.svg)\n\n`datetime` と `hashlib` がインポートされていません。ファイルの先頭に `from datetime import datetime` と `import hashlib` を追加してください。',
          user: {
            login: 'gemini-code-assist[bot]',
            type: 'Bot',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          path: 'core/serializer.py',
          line: 1,
        },
        {
          id: '2',
          body: 'This looks good to me!',
          user: {
            login: 'regular-user',
            type: 'User',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      const actionableComments = commentMonitor.extractActionableComments(comments);

      expect(actionableComments).toHaveLength(1);
      expect(actionableComments[0].id).toBe('1');
      expect(actionableComments[0].isGeminiComment).toBe(true);
      expect(actionableComments[0].suggestions).toHaveLength(1);
      expect(actionableComments[0].suggestions[0].type).toBe('bug_fix');
      expect(actionableComments[0].suggestions[0].targetFile).toBe('core/serializer.py');
    });

    it('should handle comments with code suggestion blocks', () => {
      const comments: Comment[] = [
        {
          id: '1',
          body: '![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)\n\n型ヒントを改善してください。\n\n```suggestion\ndef save_to_file(self, schema: VisualSchema, file_path: Path | str) -> None:\n```',
          user: {
            login: 'gemini-code-assist[bot]',
            type: 'Bot',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          path: 'core/serializer.py',
          line: 50,
        },
      ];

      const actionableComments = commentMonitor.extractActionableComments(comments);

      expect(actionableComments).toHaveLength(1);
      expect(actionableComments[0].suggestions[0].instruction).toContain('def save_to_file');
      expect(actionableComments[0].suggestions[0].confidence).toBeGreaterThan(0.5);
    });

    it('should skip comments that are already resolved', () => {
      const comments: Comment[] = [
        {
          id: '1',
          body: '![critical](https://www.gstatic.com/codereviewagent/critical.svg)\n\nThis is a critical issue.',
          user: {
            login: 'gemini-code-assist[bot]',
            type: 'Bot',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      // Mark comment as resolved
      commentMonitor.trackCommentStatus('1', 'resolved');

      const actionableComments = commentMonitor.extractActionableComments(comments);

      expect(actionableComments).toHaveLength(0);
    });

    it('should filter by enabled severity levels', () => {
      const customMonitor = new CommentMonitor({
        enabledSeverityLevels: ['critical'], // Only critical
      });

      const comments: Comment[] = [
        {
          id: '1',
          body: '![critical](https://www.gstatic.com/codereviewagent/critical.svg)\n\nCritical issue',
          user: {
            login: 'gemini-code-assist[bot]',
            type: 'Bot',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        {
          id: '2',
          body: '![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)\n\nMedium issue',
          user: {
            login: 'gemini-code-assist[bot]',
            type: 'Bot',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      const actionableComments = customMonitor.extractActionableComments(comments);

      expect(actionableComments).toHaveLength(1);
      expect(actionableComments[0].id).toBe('1');
    });
  });

  describe('trackCommentStatus', () => {
    it('should track and retrieve comment status', () => {
      commentMonitor.trackCommentStatus('123', 'processing');
      expect(commentMonitor.getCommentStatus('123')).toBe('processing');

      commentMonitor.trackCommentStatus('123', 'resolved');
      expect(commentMonitor.getCommentStatus('123')).toBe('resolved');
    });

    it('should return pending for unknown comments', () => {
      expect(commentMonitor.getCommentStatus('unknown')).toBe('pending');
    });
  });

  describe('suggestion parsing', () => {
    it('should determine correct suggestion types', () => {
      const bugFixComment: Comment = {
        id: '1',
        body: '![critical](https://www.gstatic.com/codereviewagent/critical.svg)\n\nThis will cause a runtime error. Fix the import statement.',
        user: {
          login: 'gemini-code-assist[bot]',
          type: 'Bot',
        },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const actionableComments = commentMonitor.extractActionableComments([bugFixComment]);
      expect(actionableComments[0].suggestions[0].type).toBe('bug_fix');
    });

    it('should calculate confidence scores correctly', () => {
      const highConfidenceComment: Comment = {
        id: '1',
        body: '![critical](https://www.gstatic.com/codereviewagent/critical.svg)\n\nMissing import statement.\n\n```suggestion\nimport hashlib\n```',
        user: {
          login: 'gemini-code-assist[bot]',
          type: 'Bot',
        },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        path: 'core/serializer.py',
        line: 1,
      };

      const actionableComments = commentMonitor.extractActionableComments([highConfidenceComment]);
      expect(actionableComments[0].suggestions[0].confidence).toBeGreaterThan(0.8);
    });

    it('should identify non-actionable suggestions', () => {
      const nonActionableComment: Comment = {
        id: '1',
        body: '![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)\n\nConsider refactoring this method for better readability.',
        user: {
          login: 'gemini-code-assist[bot]',
          type: 'Bot',
        },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const actionableComments = commentMonitor.extractActionableComments([nonActionableComment]);
      expect(actionableComments).toHaveLength(0); // Should be filtered out as non-actionable
    });
  });

  describe('real-world Gemini comment examples', () => {
    it('should handle actual Gemini Code Assist comment format', () => {
      const realGeminiComment: Comment = {
        id: '2233684589',
        body: '![critical](https://www.gstatic.com/codereviewagent/critical.svg)\n\n`datetime` と `hashlib` がインポートされていません。ファイルの先頭に `from datetime import datetime` と `import hashlib` を追加してください。[^1]\n\nこれらのインポートがないと、実行時に `NameError` が発生します。\n\n#### Style Guide References\n[^1]: コードは日本語で記述する必要がありますが、Pythonの標準的なコーディング規約（PEP 8など）にも従うべきです。',
        user: {
          login: 'gemini-code-assist[bot]',
          type: 'Bot',
          id: '176961590',
        },
        created_at: '2025-07-27T04:56:29Z',
        updated_at: '2025-07-27T04:56:30Z',
        path: 'core/serializer.py',
        line: 27,
      };

      const actionableComments = commentMonitor.extractActionableComments([realGeminiComment]);

      expect(actionableComments).toHaveLength(1);
      expect(actionableComments[0].isGeminiComment).toBe(true);
      expect(actionableComments[0].suggestions[0].type).toBe('bug_fix');
      expect(actionableComments[0].suggestions[0].targetFile).toBe('core/serializer.py');
      expect(actionableComments[0].suggestions[0].lineRange?.start).toBe(27);
      expect(actionableComments[0].suggestions[0].confidence).toBeGreaterThan(0.7);
    });

    it('should handle suggestion block format', () => {
      const suggestionComment: Comment = {
        id: '2233685674',
        body: '![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)\n\n`file_path`の型ヒントが`str`に限定されていますが、`pathlib.Path`オブジェクトも受け入れるように`Path | str`に変更することを推奨します。\n\n```suggestion\n    def save_to_file(self, schema: VisualSchema, file_path: Path | str) -> None:\n```',
        user: {
          login: 'gemini-code-assist[bot]',
          type: 'Bot',
          id: '176961590',
        },
        created_at: '2025-07-27T04:58:13Z',
        updated_at: '2025-07-27T04:58:13Z',
        path: 'core/serializer.py',
        line: 70,
      };

      const actionableComments = commentMonitor.extractActionableComments([suggestionComment]);

      expect(actionableComments).toHaveLength(1);
      expect(actionableComments[0].suggestions[0].instruction).toContain('def save_to_file');
      expect(actionableComments[0].suggestions[0].instruction).toContain('Path | str');
      expect(actionableComments[0].suggestions[0].type).toBe('style_improvement');
    });
  });
});