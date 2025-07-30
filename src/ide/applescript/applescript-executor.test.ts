import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
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
    it('should return success and output for a valid script', async () => {
      const executor = new AppleScriptExecutor();
      const result = await executor.executeScript('return "test"');
      
      expect(result.success).toBe(true);
      expect(result.output).toBe('test');
      expect(result.error).toBeUndefined();
    });

    it('should handle error cases gracefully', async () => {
      const executor = new AppleScriptExecutor();
      const result = await executor.executeScript('invalid syntax');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/syntax_error/);
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

    it('should execute a script from a file successfully', async () => {
      const tempDir = await fs.mkdtemp(join(tmpdir(), 'applescript-test-'));
      const scriptPath = join(tempDir, 'test.scpt');
      await fs.writeFile(scriptPath, 'return "hello from file"');

      const executor = new AppleScriptExecutor();
      const result = await executor.executeScriptFile(scriptPath);

      expect(result.success).toBe(true);
      expect(result.output).toBe('hello from file');

      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should handle file execution errors', async () => {
      const executor = new AppleScriptExecutor();
      const result = await executor.executeScriptFile('/nonexistent/file.scpt');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});