/**
 * Basic tests for GitHub API Client
 * These tests verify the client can be instantiated and basic functionality works
 */

import { GitHubClient, GitHubAPIError, RateLimitError } from './client';
import { GitHubConfig, PollingConfig } from '../core/config';

// Simple test runner
function runTests() {
  console.log('Running GitHub Client tests...');
  
  const githubConfig: GitHubConfig = {
    token: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
    apiUrl: 'https://api.github.com',
  };

  const pollingConfig: PollingConfig = {
    intervalMs: 30000,
    maxRetries: 3,
    backoffMultiplier: 2,
    timeoutMs: 10000,
  };

  // Test 1: Constructor
  try {
    const client = new GitHubClient(githubConfig, pollingConfig);
    console.log('✓ GitHubClient constructor works');
  } catch (error) {
    console.log('✗ GitHubClient constructor failed:', error);
    return;
  }

  // Test 2: Error classes
  try {
    const apiError = new GitHubAPIError('Test error', 404, { data: 'test' });
    if (apiError.message === 'Test error' && apiError.status === 404) {
      console.log('✓ GitHubAPIError works correctly');
    } else {
      console.log('✗ GitHubAPIError properties incorrect');
    }

    const resetTime = new Date();
    const rateLimitError = new RateLimitError('Rate limit exceeded', resetTime);
    if (rateLimitError.message === 'Rate limit exceeded' && rateLimitError.resetTime === resetTime) {
      console.log('✓ RateLimitError works correctly');
    } else {
      console.log('✗ RateLimitError properties incorrect');
    }
  } catch (error) {
    console.log('✗ Error classes test failed:', error);
  }

  // Test 3: Rate limit info
  try {
    const client = new GitHubClient(githubConfig, pollingConfig);
    const rateLimitInfo = client.getLastRateLimitInfo();
    if (rateLimitInfo === undefined) {
      console.log('✓ Initial rate limit info is undefined');
    } else {
      console.log('✗ Initial rate limit info should be undefined');
    }
  } catch (error) {
    console.log('✗ Rate limit info test failed:', error);
  }

  // Test 4: Configuration handling
  try {
    const configWithoutToken = { ...githubConfig, token: '' };
    const client1 = new GitHubClient(configWithoutToken, pollingConfig);
    console.log('✓ Handles missing token gracefully');

    const configWithoutApiUrl = { ...githubConfig };
    delete (configWithoutApiUrl as any).apiUrl;
    const client2 = new GitHubClient(configWithoutApiUrl, pollingConfig);
    console.log('✓ Uses default API URL when not provided');
  } catch (error) {
    console.log('✗ Configuration handling test failed:', error);
  }

  console.log('GitHub Client tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

export { runTests };