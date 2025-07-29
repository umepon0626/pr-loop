import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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

      const { stdout, stderr } = await execAsync(
        `osascript -e "${this.escapeScript(script)}"`,
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
    } catch (error: any) {
      return this.handleError(error, script);
    }
  }

  /**
   * Execute AppleScript from file
   */
  async executeScriptFile(filePath: string): Promise<AppleScriptResult> {
    try {
      this.log("debug", `Executing AppleScript file: ${filePath}`);

      const { stdout, stderr } = await execAsync(`osascript "${filePath}"`, {
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
    } catch (error: any) {
      return this.handleError(error, `file: ${filePath}`);
    }
  }

  /**
   * Check if Kiro IDE is running
   */
  async isKiroRunning(): Promise<boolean> {
    const script =
      'tell application "System Events" to return (name of processes) contains "Kiro"';

    try {
      const result = await this.executeScript(script);
      return result.success && result.output === "true";
    } catch (error) {
      this.log("error", `Failed to check Kiro status: ${error}`);
      return false;
    }
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
      // Wait a moment and check if it's running
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const nowRunning = await this.isKiroRunning();
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

    try {
      const result = await this.executeScript(script);

      if (result.success && result.output) {
        const [status, countStr] = result.output.split(":");
        return {
          isRunning: true,
          isResponding: status === "responding",
          windowCount: parseInt(countStr) || 0,
        };
      }
    } catch (error) {
      this.log("error", `Failed to get Kiro status details: ${error}`);
    }

    return {
      isRunning: true,
      isResponding: false,
      windowCount: 0,
    };
  }

  /**
   * Escape AppleScript string for command line execution
   */
  private escapeScript(script: string): string {
    return script
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, " ")
      .replace(/\r/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Handle AppleScript execution errors
   */
  private handleError(error: any, context: string): AppleScriptResult {
    const errorMessage = error.message || "Unknown error";
    const errorCode = error.code || -1;

    this.log(
      "error",
      `AppleScript execution failed for ${context}: ${errorMessage}`
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
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.options.logLevel];
    const messageLevel = levels[level];

    if (messageLevel >= currentLevel) {
      const timestamp = new Date().toISOString();
      console.log(
        `[${timestamp}] [AppleScript] [${level.toUpperCase()}] ${message}`
      );
    }
  }
}
