import { describe, it, expect } from 'vitest';
import { AppleScriptExecutor } from './applescript-executor';

describe('AppleScriptExecutor', () => {
  describe('constructor', () => {
    it('should create instance with default options', () => {
      const executor = new AppleScriptExecutor();
      expect(executor).toBeInstanceOf(AppleScriptExecutor);
    });

    it('should create instance with custom options', () => {
      const executor = new AppleScriptExecutor({
        timeout: 5000,
        logLevel: 'debug'
      });
      expect(executor).toBeInstanceOf(AppleScriptExecutor);
    });
  });

  describe('basic functionality', () => {
    it('should handle simple AppleScript execution', async () => {
      const executor = new AppleScriptExecutor();
      const result = await executor.executeScript('return "test"');
      
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        expect(result.output).toBe('test');
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle error cases gracefully', async () => {
      const executor = new AppleScriptExecutor();
      const result = await executor.executeScript('invalid syntax');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('should handle Kiro status check', async () => {
      const executor = new AppleScriptExecutor();
      const isRunning = await executor.isKiroRunning();
      
      expect(typeof isRunning).toBe('boolean');
    });

    it('should handle detailed Kiro status', async () => {
      const executor = new AppleScriptExecutor();
      const status = await executor.getKiroStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('isResponding');
      expect(status).toHaveProperty('windowCount');
      expect(typeof status.isRunning).toBe('boolean');
      expect(typeof status.isResponding).toBe('boolean');
      expect(typeof status.windowCount).toBe('number');
    });

    it('should handle file execution', async () => {
      const executor = new AppleScriptExecutor();
      const result = await executor.executeScriptFile('/nonexistent/file.scpt');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});