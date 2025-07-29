# Technology Stack

## Runtime Environment

- **Node.js**: Version 20 (managed via mise)
- **Package Manager**: pnpm (latest version)
- **Platform**: macOS with AppleScript integration

## Core Technologies

- **TypeScript**: Primary development language for type safety and better IDE support
  - Strict type checking enabled for robust code
  - Interface-driven development for clear contracts
  - Async/await patterns for API and IDE operations
- **GitHub API**: REST API integration for PR monitoring and comment management
- **AppleScript**: Native macOS automation for Kiro IDE control
- **Git**: Local repository management and automated commits

## Development Tools

- **mise**: Tool version management (configured in `mise.toml`)
- **Kiro IDE**: Target IDE for automated code modifications
- **VSCode**: Development environment with Kiro agent integration disabled

## Architecture Patterns

- **Polling-based Monitoring**: Regular GitHub API polling for PR changes
- **Component-based Design**: Modular architecture with clear separation of concerns
- **Event-driven Processing**: Comment-triggered automated fix cycles
- **Local Daemon Process**: Runs continuously to monitor and process PRs

## Common Commands

Since this is a planning/specification phase project, implementation commands will include:

```bash
# Project initialization (when implemented)
pnpm init
pnpm install

# TypeScript development
pnpm run dev          # Development with watch mode
pnpm run build        # TypeScript compilation
pnpm run type-check   # Type checking without compilation
pnpm run test         # Run tests with type checking

# Tool management
mise install
mise use
```

## Key Dependencies (Planned)

- GitHub API client library
- AppleScript execution utilities
- TypeScript compiler and tooling
- Testing framework (Jest/Vitest)
- Configuration management utilities
