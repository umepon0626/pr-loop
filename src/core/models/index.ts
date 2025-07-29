/**
 * Core data models for the AI PR Review Loop System
 */

// PRループセッション
export interface LoopSession {
  prNumber: number;
  iteration: number;
  maxIterations: number;
  startTime: Date;
  status: 'running' | 'completed' | 'failed';
  processedComments: string[];
  appliedFixes: AppliedFix[];
}

// 解析済み提案
export interface ParsedSuggestion {
  commentId: string;
  type: 'code_change' | 'refactor' | 'bug_fix' | 'style_improvement';
  targetFile: string;
  lineRange?: { start: number; end: number };
  description: string;
  instruction: string;
  confidence: number;
}

// ファイル変更
export interface FileChange {
  filePath: string;
  changeType: 'modify' | 'create' | 'delete';
  content?: string;
  lineChanges?: LineChange[];
}

// 行変更
export interface LineChange {
  lineNumber: number;
  oldContent: string;
  newContent: string;
}

// 適用済み修正
export interface AppliedFix {
  suggestionId: string;
  timestamp: Date;
  success: boolean;
  changes: FileChange[];
  commitHash?: string;
  error?: string;
}

// GitHub関連の型定義
export interface Comment {
  id: string;
  body: string;
  user: {
    login: string;
    type: string;
    id?: string;
  };
  created_at: string;
  updated_at: string;
  path?: string;
  line?: number;
  position?: number;
}

export interface PRState {
  number: number;
  state: 'open' | 'closed' | 'merged';
  head: {
    sha: string;
    ref: string;
  };
  base: {
    sha: string;
    ref: string;
  };
  updated_at: string;
}

// 実行可能なコメント
export interface ActionableComment extends Comment {
  isGeminiComment: boolean;
  suggestions: ParsedSuggestion[];
}

// コメントステータス
export type CommentStatus = 'pending' | 'processing' | 'resolved' | 'skipped' | 'failed';

// ループ進捗
export interface LoopProgress {
  currentIteration: number;
  totalIterations: number;
  processedComments: number;
  totalComments: number;
  appliedFixes: number;
  failedFixes: number;
  status: string;
}

// 修正結果
export interface FixResult {
  success: boolean;
  appliedFixes: AppliedFix[];
  errors: string[];
  skippedSuggestions: ParsedSuggestion[];
}