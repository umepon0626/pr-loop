/**
 * Comment Monitor for identifying and filtering Gemini Code Assist comments
 */

import {
  Comment,
  ActionableComment,
  ParsedSuggestion,
  CommentStatus,
} from "../core/models";

export interface CommentMonitorConfig {
  geminiUserId: string;
  geminiUsername: string;
  enabledSeverityLevels: string[];
}

export class CommentMonitor {
  // Confidence calculation constants
  private static readonly CONFIDENCE_BASE = 0.5;
  private static readonly CONFIDENCE_CRITICAL = 0.3;
  private static readonly CONFIDENCE_MEDIUM = 0.2;
  private static readonly CONFIDENCE_LOW = 0.1;
  private static readonly CONFIDENCE_BUG_FIX = 0.2;
  private static readonly CONFIDENCE_STYLE_IMPROVEMENT = 0.15;
  private static readonly CONFIDENCE_REFACTOR = 0.1;
  private static readonly CONFIDENCE_CODE_CHANGE = 0.05;
  private static readonly CONFIDENCE_FILE_CONTEXT = 0.1;
  private static readonly CONFIDENCE_SUGGESTION_BLOCK = 0.15;
  private static readonly CONFIDENCE_MAX = 1.0;

  private config: CommentMonitorConfig;
  private commentStatusMap: Map<string, CommentStatus>;

  constructor(config?: Partial<CommentMonitorConfig>) {
    this.config = {
      geminiUserId: "176961590",
      geminiUsername: "gemini-code-assist[bot]",
      enabledSeverityLevels: ["critical", "medium", "low"],
      ...config,
    };
    this.commentStatusMap = new Map();
  }

  /**
   * Check if a comment is from Gemini Code Assist
   */
  isGeminiComment(comment: Comment): boolean {
    // Check user ID (most reliable identifier)
    if (comment.user.id && comment.user.id === this.config.geminiUserId) {
      return true;
    }

    // Fallback check for username
    if (comment.user.login === this.config.geminiUsername) {
      return true;
    }

    // Additional pattern matching for comment content
    return this.hasGeminiCommentPatterns(comment.body);
  }

  /**
   * Extract actionable comments from a list of comments
   */
  extractActionableComments(comments: Comment[]): ActionableComment[] {
    const actionableComments: ActionableComment[] = [];

    for (const comment of comments) {
      if (!this.isGeminiComment(comment)) {
        continue;
      }

      // Skip if comment is already processed or resolved
      const status = this.getCommentStatus(comment.id);
      if (status === "resolved" || status === "skipped") {
        continue;
      }

      // Parse suggestions from the comment
      const suggestions = this.parseSuggestionsFromComment(comment);

      if (suggestions.length > 0) {
        const actionableComment: ActionableComment = {
          ...comment,
          isGeminiComment: true,
          suggestions,
        };
        actionableComments.push(actionableComment);
      }
    }

    return actionableComments;
  }

  /**
   * Track the status of a comment
   */
  trackCommentStatus(commentId: string, status: CommentStatus): void {
    this.commentStatusMap.set(commentId, status);
  }

  /**
   * Get the current status of a comment
   */
  getCommentStatus(commentId: string): CommentStatus {
    return this.commentStatusMap.get(commentId) || "pending";
  }

  /**
   * Check if comment body contains Gemini Code Assist patterns
   */
  private hasGeminiCommentPatterns(body: string): boolean {
    const geminiPatterns = [
      // Severity indicators with specific image URLs
      /!\[critical\]\(https:\/\/www\.gstatic\.com\/codereviewagent\/critical\.svg\)/,
      /!\[medium\]\(https:\/\/www\.gstatic\.com\/codereviewagent\/medium-priority\.svg\)/,
      /!\[low\]\(https:\/\/www\.gstatic\.com\/codereviewagent\/low-priority\.svg\)/,

      // Style guide references pattern
      /#### Style Guide References/,
      /\[\^[0-9]+\]:/,

      // Code suggestion blocks
      /```suggestion/,

      // Common Gemini phrases (in Japanese and English)
      /を推奨します/,
      /をお勧めします/,
      /を検討してください/,
      /recommend/i,
      /suggest/i,
      /consider/i,
    ];

    return geminiPatterns.some((pattern) => pattern.test(body));
  }

  /**
   * Parse suggestions from a Gemini Code Assist comment
   */
  private parseSuggestionsFromComment(comment: Comment): ParsedSuggestion[] {
    const suggestions: ParsedSuggestion[] = [];

    // Extract severity level
    const severity = this.extractSeverityLevel(comment.body);

    // Skip if severity level is not enabled
    if (!this.config.enabledSeverityLevels.includes(severity)) {
      return suggestions;
    }

    // Extract suggestion type based on content analysis
    const suggestionType = this.determineSuggestionType(comment.body);

    // Extract description and instruction
    const description = this.extractDescription(comment.body);
    const instruction = this.extractInstruction(comment.body);

    // Calculate confidence based on various factors
    const confidence = this.calculateConfidence(
      comment,
      severity,
      suggestionType
    );

    // Only create suggestion if we have actionable content
    if (instruction && this.isActionableInstruction(instruction)) {
      const suggestion: ParsedSuggestion = {
        commentId: comment.id,
        type: suggestionType,
        targetFile: comment.path || "",
        lineRange: comment.line
          ? { start: comment.line, end: comment.line }
          : undefined,
        description,
        instruction,
        confidence,
      };

      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /**
   * Extract severity level from comment body
   */
  private extractSeverityLevel(body: string): string {
    if (body.includes("![critical]")) return "critical";
    if (body.includes("![medium]")) return "medium";
    if (body.includes("![low]")) return "low";
    return "medium"; // default
  }

  /**
   * Determine suggestion type based on content analysis
   */
  private determineSuggestionType(body: string): ParsedSuggestion["type"] {
    // Keywords that indicate different types of suggestions
    const typePatterns = {
      bug_fix: [
        /エラー/,
        /error/i,
        /bug/i,
        /fix/i,
        /修正/,
        /問題/,
        /issue/i,
        /exception/i,
        /fail/i,
        /失敗/,
        /不具合/,
        /がインポートされていません/,
        /missing import/i,
        /runtime.*error/i,
        /NameError/i,
        /実行時に.*が発生/,
      ],
      refactor: [
        /リファクタ/,
        /refactor/i,
        /restructure/i,
        /reorganize/i,
        /重複/,
        /duplicate/i,
        /dry/i,
        /clean/i,
        /整理/,
      ],
      style_improvement: [
        /スタイル/,
        /style/i,
        /format/i,
        /indent/i,
        /naming/i,
        /convention/i,
        /規約/,
        /フォーマット/,
        /命名/,
        /型ヒント/,
        /type hint/i,
        /推奨します/,
        /recommend/i,
      ],
      code_change: [
        /変更/,
        /change/i,
        /modify/i,
        /update/i,
        /replace/i,
        /追加/,
        /add/i,
        /remove/i,
        /削除/,
      ],
    };

    // Check each type pattern in order of priority
    for (const [type, patterns] of Object.entries(typePatterns)) {
      if (patterns.some((pattern) => pattern.test(body))) {
        return type as ParsedSuggestion["type"];
      }
    }

    return "code_change"; // default
  }

  /**
   * Extract description from comment body
   */
  private extractDescription(body: string): string {
    // Remove markdown formatting and extract main description
    const lines = body.split("\n");
    const descriptionLines: string[] = [];
    let foundStart = false;

    // Skip severity indicator line and collect all consecutive description lines
    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and markdown elements at the beginning
      if (
        !foundStart &&
        (!trimmed ||
          trimmed.startsWith("![") ||
          trimmed.startsWith("####") ||
          trimmed.startsWith("[^"))
      ) {
        continue;
      }

      // Stop when we hit a new markdown section
      if (
        foundStart &&
        (trimmed.startsWith("```") ||
          trimmed.startsWith("####") ||
          trimmed.startsWith("[^"))
      ) {
        break;
      }

      // Collect description lines
      if (trimmed) {
        foundStart = true;
        descriptionLines.push(trimmed);
      } else if (foundStart) {
        // Empty line within description - continue collecting but don't add the empty line
        continue;
      }
    }

    return descriptionLines.join(" ").trim() || "Code improvement suggestion";
  }

  /**
   * Extract instruction from comment body
   */
  private extractInstruction(body: string): string {
    // Look for code suggestion blocks
    const suggestionMatch = body.match(/```suggestion\n([\s\S]*?)\n```/);
    if (suggestionMatch) {
      return suggestionMatch[1].trim();
    }

    // Look for specific instruction patterns
    const instructionPatterns = [
      /以下のように.*?してください[：:]\s*(.*?)(?:\n|$)/,
      /次のように.*?変更[：:]\s*(.*?)(?:\n|$)/,
      /Consider.*?:\s*(.*?)(?:\n|$)/i,
      /Recommend.*?:\s*(.*?)(?:\n|$)/i,
      /Suggest.*?:\s*(.*?)(?:\n|$)/i,
    ];

    for (const pattern of instructionPatterns) {
      const match = body.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: extract the main content after severity indicator
    const lines = body.split("\n");
    const contentLines = lines.filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed &&
        !trimmed.startsWith("![") &&
        !trimmed.startsWith("####") &&
        !trimmed.startsWith("[^") &&
        !trimmed.startsWith("```")
      );
    });

    return contentLines.join(" ").trim();
  }

  /**
   * Check if an instruction is actionable (can be automatically applied)
   */
  private isActionableInstruction(instruction: string): boolean {
    // Instructions that are typically not actionable (require human judgment)
    const nonActionablePatterns = [
      /consider refactoring/i,
      /think about/i,
      /you might want to consider/i,
      /検討してください$/,
      /考慮してください$/,
      /判断してください$/,
    ];

    // Check if it's explicitly non-actionable
    if (nonActionablePatterns.some((pattern) => pattern.test(instruction))) {
      return false;
    }

    // Instructions that are typically actionable
    const actionablePatterns = [
      // Code replacement/modification
      /import.*from/i,
      /export.*from/i,
      /function\s+\w+/i,
      /class\s+\w+/i,
      /const\s+\w+/i,
      /let\s+\w+/i,
      /var\s+\w+/i,

      // Specific code changes
      /```suggestion/,
      /replace.*with/i,
      /change.*to/i,
      /add.*to/i,
      /remove.*from/i,

      // Japanese patterns
      /を追加/,
      /に変更/,
      /を削除/,
      /を修正/,
      /してください/,
      /追加してください/,
      /変更してください/,
      /修正してください/,

      // Missing imports or similar specific issues
      /がインポートされていません/,
      /missing import/i,
      /add.*import/i,
      /型ヒント/,
      /type hint/i,
    ];

    // Check if it's actionable
    if (actionablePatterns.some((pattern) => pattern.test(instruction))) {
      return true;
    }

    // If instruction is not empty and doesn't match non-actionable patterns, consider it actionable
    return instruction.trim().length > 10;
  }

  /**
   * Calculate confidence score for a suggestion
   */
  private calculateConfidence(
    comment: Comment,
    severity: string,
    suggestionType: ParsedSuggestion["type"]
  ): number {
    let confidence = CommentMonitor.CONFIDENCE_BASE;

    // Severity-based confidence
    switch (severity) {
      case "critical":
        confidence += CommentMonitor.CONFIDENCE_CRITICAL;
        break;
      case "medium":
        confidence += CommentMonitor.CONFIDENCE_MEDIUM;
        break;
      case "low":
        confidence += CommentMonitor.CONFIDENCE_LOW;
        break;
    }

    // Type-based confidence
    switch (suggestionType) {
      case "bug_fix":
        confidence += CommentMonitor.CONFIDENCE_BUG_FIX;
        break;
      case "style_improvement":
        confidence += CommentMonitor.CONFIDENCE_STYLE_IMPROVEMENT;
        break;
      case "refactor":
        confidence += CommentMonitor.CONFIDENCE_REFACTOR;
        break;
      case "code_change":
        confidence += CommentMonitor.CONFIDENCE_CODE_CHANGE;
        break;
    }

    // File context confidence
    if (comment.path && comment.line) {
      confidence += CommentMonitor.CONFIDENCE_FILE_CONTEXT;
    }

    // Code suggestion block increases confidence
    if (comment.body.includes("```suggestion")) {
      confidence += CommentMonitor.CONFIDENCE_SUGGESTION_BLOCK;
    }

    return Math.min(confidence, CommentMonitor.CONFIDENCE_MAX);
  }
}
