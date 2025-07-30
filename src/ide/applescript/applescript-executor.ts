import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface AppleScriptResult {
  success: boolean;
  output?: string;
  error?: string;
  errorCode?: number;
}

export interface AppleScriptExecutorOptions {
  timeout?: number;
  logLevel?: "debug" | "info" | "warn" | "error";
}

/**
 * AppleScript execution foundation for IDE automation
 * Provides core functionality to execute AppleScript commands from Node.js
 */
export class AppleScriptExecutor {
  private static readonly LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
  private static readonly LAUNCH_CHECK_DELAY_MS = 2000;

  private options: Required<AppleScriptExecutorOptions>;

  constructor(options: AppleScriptExecutorOptions = {}) {
    this.options = {
      timeout: options.timeout || 30000, // 30 seconds default
      logLevel: options.logLevel || "info",
    };
  }

  /**
   * Execute AppleScript code directly
   */
  async executeScript(script: string): Promise<AppleScriptResult> {
    try {
      this.log(
        "debug",
        `Executing AppleScript: ${script.substring(0, 100)}...`
      );

      const { stdout, stderr } = await execFileAsync(
        "osascript",
        ["-e", script],
        {
          timeout: this.options.timeout,
        }
      );

      if (stderr) {
        this.log("warn", `AppleScript stderr: ${stderr}`);
      }

      const result: AppleScriptResult = {
        success: true,
        output: stdout.trim(),
      };

      this.log("debug", `AppleScript result: ${result.output}`);
      return result;
    } catch (error: unknown) {
      return this.handleError(error, script);
    }
  }

  /**
   * Execute AppleScript from file
   */
  async executeScriptFile(filePath: string): Promise<AppleScriptResult> {
    try {
      this.log("debug", `Executing AppleScript file: ${filePath}`);

      const { stdout, stderr } = await execFileAsync("osascript", [filePath], {
        timeout: this.options.timeout,
      });

      if (stderr) {
        this.log("warn", `AppleScript stderr: ${stderr}`);
      }

      const result: AppleScriptResult = {
        success: true,
        output: stdout.trim(),
      };

      this.log("debug", `AppleScript file result: ${result.output}`);
      return result;
    } catch (error: unknown) {
      return this.handleError(error, `file: ${filePath}`);
    }
  }

  /**
   * Check if Kiro IDE is running
   */
  async isKiroRunning(): Promise<boolean> {
    const script =
      'tell application "System Events" to return (name of processes) contains "Kiro"';

    const result = await this.executeScript(script);
    return result.success && result.output === "true";
  }

  /**
   * Launch Kiro IDE if not running
   */
  async launchKiro(): Promise<AppleScriptResult> {
    const isRunning = await this.isKiroRunning();

    if (isRunning) {
      this.log("info", "Kiro IDE is already running");
      return { success: true, output: "already_running" };
    }

    const script = 'tell application "Kiro" to activate';

    const result = await this.executeScript(script);

    if (result.success) {
      this.log("info", "Kiro IDE launch command sent successfully");
      
      // Poll for Kiro to start with timeout
      const launchTimeout = 5000; // 5 seconds
      const pollInterval = 500; // 500 ms
      const startTime = Date.now();
      let nowRunning = false;

      while (Date.now() - startTime < launchTimeout) {
        nowRunning = await this.isKiroRunning();
        if (nowRunning) break;
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      return {
        success: true,
        output: nowRunning ? "launched" : "launch_attempted",
      };
    } else {
      this.log("error", "Failed to launch Kiro IDE");
      return result;
    }
  }

  /**
   * Get Kiro IDE status information
   */
  async getKiroStatus(): Promise<{
    isRunning: boolean;
    isResponding: boolean;
    windowCount: number;
  }> {
    const isRunning = await this.isKiroRunning();

    if (!isRunning) {
      return {
        isRunning: false,
        isResponding: false,
        windowCount: 0,
      };
    }

    // Check if Kiro is responding and count windows
    const script =
      'tell application "Kiro" to try to return "responding:" & (count of windows) on error return "not_responding:0"';

    const result = await this.executeScript(script);

    if (result.success && result.output) {
      const [status, countStr] = result.output.split(":");
      return {
        isRunning: true,
        isResponding: status === "responding",
        windowCount: parseInt(countStr, 10) || 0,
      };
    }

    return {
      isRunning: true,
      isResponding: false,
      windowCount: 0,
    };
  }

  /**
   * Handle AppleScript execution errors
   */
  private handleError(error: unknown, context: string): AppleScriptResult {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const code = (error as any)?.code;
    const errorCode = typeof code === "number" ? code : -1;

    this.log(
      "error",
      `AppleScript execution failed for ${context.substring(
        0,
        200
      )}...: ${errorMessage}`
    );

    // Parse common AppleScript error types
    let errorType = "unknown";
    if (errorMessage.includes("timeout")) {
      errorType = "timeout";
    } else if (
      errorMessage.includes("not found") ||
      errorMessage.includes("doesn't exist")
    ) {
      errorType = "application_not_found";
    } else if (errorMessage.includes("permission")) {
      errorType = "permission_denied";
    } else if (errorMessage.includes("syntax error")) {
      errorType = "syntax_error";
    }

    return {
      success: false,
      error: `${errorType}: ${errorMessage}`,
      errorCode,
    };
  }

  /**
   * Internal logging method
   */
  private log(
    level: "debug" | "info" | "warn" | "error",
    message: string
  ): void {
    const currentLevel = AppleScriptExecutor.LOG_LEVELS[this.options.logLevel];
    const messageLevel = AppleScriptExecutor.LOG_LEVELS[level];

    if (messageLevel >= currentLevel) {
      const timestamp = new Date().toISOString();
      console.log(
        `[${timestamp}] [AppleScript] [${level.toUpperCase()}] ${message}`
      );
    }
  }
}
