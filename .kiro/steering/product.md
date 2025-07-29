# Product Overview

## AI PR Review Loop System

This project is an automated GitHub PR review and fix system that creates a continuous improvement loop between AI code review and automated code fixes.

### Core Functionality

The system monitors GitHub PRs for Gemini Code Assist review comments, automatically applies suggested fixes using Kiro IDE's AI agent capabilities, and creates multiple review-fix cycles to improve code quality before human review.

### Key Features

- **Automated Fix Application**: Parses AI review comments and applies code changes automatically
- **Multi-iteration Loops**: Runs up to 3 review-fix cycles to iteratively improve code
- **Progress Tracking**: Provides real-time status updates and change summaries on PRs
- **IDE Integration**: Uses AppleScript to control Kiro IDE for seamless local development workflow
- **Smart Comment Resolution**: Automatically resolves review comments when fixes are applied

### Target Users

- Development teams using GitHub PRs with Gemini Code Assist
- Projects wanting to reduce manual code review overhead
- Teams seeking automated code quality improvement before human review