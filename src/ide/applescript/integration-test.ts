#!/usr/bin/env node

/**
 * Integration test for AppleScript executor
 * This script tests the actual AppleScript execution functionality
 */

import { AppleScriptExecutor } from './applescript-executor';

async function runIntegrationTests() {
  console.log('🧪 Starting AppleScript Executor Integration Tests...\n');

  const executor = new AppleScriptExecutor({ logLevel: 'info' });

  // Test 1: Basic AppleScript execution
  console.log('Test 1: Basic AppleScript execution');
  try {
    const result = await executor.executeScript('return "Hello from AppleScript"');
    console.log('✅ Basic execution:', result.success ? 'PASSED' : 'FAILED');
    if (result.success) {
      console.log('   Output:', result.output);
    } else {
      console.log('   Error:', result.error);
    }
  } catch (error) {
    console.log('❌ Basic execution: ERROR -', error);
  }

  console.log();

  // Test 2: Error handling
  console.log('Test 2: Error handling with invalid script');
  try {
    const result = await executor.executeScript('invalid syntax here');
    console.log('✅ Error handling:', !result.success ? 'PASSED' : 'FAILED');
    if (!result.success) {
      console.log('   Error type:', result.error?.split(':')[0]);
    }
  } catch (error) {
    console.log('❌ Error handling: ERROR -', error);
  }

  console.log();

  // Test 3: Kiro status check
  console.log('Test 3: Kiro IDE status check');
  try {
    const isRunning = await executor.isKiroRunning();
    console.log('✅ Kiro status check: PASSED');
    console.log('   Kiro running:', isRunning);
  } catch (error) {
    console.log('❌ Kiro status check: ERROR -', error);
  }

  console.log();

  // Test 4: Detailed Kiro status
  console.log('Test 4: Detailed Kiro status');
  try {
    const status = await executor.getKiroStatus();
    console.log('✅ Detailed status: PASSED');
    console.log('   Status:', JSON.stringify(status, null, 2));
  } catch (error) {
    console.log('❌ Detailed status: ERROR -', error);
  }

  console.log();

  // Test 5: System Events access
  console.log('Test 5: System Events access');
  try {
    const result = await executor.executeScript('tell application "System Events" to return name of first process');
    console.log('✅ System Events:', result.success ? 'PASSED' : 'FAILED');
    if (result.success) {
      console.log('   First process:', result.output);
    } else {
      console.log('   Error:', result.error);
    }
  } catch (error) {
    console.log('❌ System Events: ERROR -', error);
  }

  console.log('\n🏁 Integration tests completed!');
}

// Run the tests if this file is executed directly
if (require.main === module) {
  runIntegrationTests().catch(console.error);
}

export { runIntegrationTests };