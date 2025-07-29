# Project Structure

## Current Organization

This project is currently in the specification and design phase, with the following structure:

```
.
├── .kiro/                    # Kiro IDE configuration and specifications
│   ├── specs/               # Project specifications
│   │   └── ai-pr-review-loop/
│   │       ├── requirements.md  # Detailed requirements (Japanese)
│   │       ├── design.md        # System architecture and design
│   │       └── tasks.md         # Implementation task breakdown
│   └── steering/            # AI assistant guidance documents
├── .vscode/                 # VSCode configuration
│   └── settings.json       # IDE settings (Kiro MCP disabled)
└── mise.toml               # Tool version management
```

## Planned Implementation Structure

Based on the design specifications, the implemented project will follow this structure:

```
src/
├── core/                   # Core business logic
│   ├── models/            # Data models and interfaces
│   ├── services/          # Business logic services
│   └── utils/             # Shared utilities
├── github/                # GitHub API integration
│   ├── client.ts          # GitHub API client
│   ├── poller.ts          # PR polling service
│   └── comment-manager.ts # Comment operations
├── parser/                # Comment parsing and analysis
│   ├── comment-parser.ts  # Natural language parsing
│   └── suggestion-validator.ts # Validation logic
├── ide/                   # IDE integration
│   ├── applescript/       # AppleScript controllers
│   └── kiro-controller.ts # Kiro IDE operations
├── loop/                  # Loop control system
│   ├── session-manager.ts # Loop session management
│   └── loop-controller.ts # Main loop logic
└── status/                # Status and progress tracking
    ├── status-controller.ts
    └── reporter.ts
```

## Configuration Files

- **mise.toml**: Tool version management (Node.js 20, pnpm latest)
- **package.json**: Node.js project configuration and dependencies
- **tsconfig.json**: TypeScript compiler configuration
- **config/**: Runtime configuration (GitHub tokens, polling intervals)

## Key Architectural Principles

- **Modular Design**: Clear separation between GitHub API, IDE control, and business logic
- **Component Isolation**: Each major component (poller, parser, controller) is independently testable
- **Configuration-driven**: External configuration for tokens, intervals, and limits
- **Error Boundaries**: Each component handles its own error scenarios
- **Async Processing**: Non-blocking operations for API calls and IDE automation