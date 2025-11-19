# Code Machine Orchestrator

Code Machine Orchestrator is a VS Code extension and CLI toolkit that automates a full Type A requirements-to-code workflow. It can generate requirements, architecture, implementation plans, and build tasks from natural language prompts while integrating with adapter-driven backends (Python Type A CLI, Codex, or CodeMachine).

## Features

- **Prompt to Requirements:** Collect high-level prompts and turn them into structured FRDs stored under `.artifacts/requirements.md`.
- **Architecture and Planning:** Automatically generate architecture blueprints (`architecture.md`), plan documents (`plan.md`), and structured tasks (`todo.json`).
- **Task Execution:** Run individual tasks or the entire build process from the VS Code sidebar. Each task is committed with a meaningful message, and diff snapshots open automatically.
- **Adapters:** Switch between different automation engines without touching the extension:
  - `python` (default) runs the Type A CLI (`tools/cli/codemachine_cli.py`).
  - `codex` uses the Codex CLI with templated prompts for each stage.
  - `codemachine` proxies to the CodeMachine CLI via planner/builder agents.
- **Codex Integration:** Codex prompts include the official templates and previously generated artifacts for accurate, context-aware outputs.
- **Artifacts View:** Sidebar tree renders both nested iteration plans and flattened task lists, with visual signaling for active/completed tasks and a manual refresh button.

## Repository Structure

```
.
├── README.md                     # This file
├── package.json / tsconfig.json  # VS Code extension metadata and build config
├── src/                          # Extension TypeScript source (commands, controllers, views)
├── tools/
│   ├── bridge/                   # Adapter-aware CLI bridge (Python, Codex, CodeMachine)
│   └── cli/                      # Type A Python CLI (requirements → architecture → plan → todo)
├── .artifacts/                   # Generated artifacts (ignored from git)
└── ...
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+ (if using the python adapter) with `pip install -r tools/cli/requirements.txt`
- Optional: Codex CLI (`codex`) or CodeMachine CLI (`codemachine`) for alternate adapters

### Install Dependencies

```bash
npm install
```

### Build the Extension

```bash
npm run compile
```

### Run the Extension

Use VS Code’s “Run Extension” launch configuration or install the extension locally:

```bash
npm run compile
# Then launch VS Code with the extension host
```

### Select Adapter

Set `CODEMACHINE_CLI_ADAPTER` to choose backend:

```bash
# Python (default)
export CODEMACHINE_CLI_ADAPTER=python

# Codex
export CODEMACHINE_CLI_ADAPTER=codex
export CODEMACHINE_CODEX_FLAGS="--sandbox workspace-write"

# CodeMachine CLI
export CODEMACHINE_CLI_ADAPTER=codemachine
export CODEMACHINE_PLAN_AGENT=planner
export CODEMACHINE_BUILD_AGENT=builder
```

The VS Code extension and CLI bridge automatically route generation/run requests to the selected adapter.

## Key Commands (VS Code)

- **Code Machine: New Project** – generates requirements with the current adapter.
- **Approve Requirements/Architecture/Plan** – runs adapter stages sequentially with progress notifications and opens each artifact for review.
- **Run Build Process** – prompts per iteration and executes all tasks, highlighting active tasks in the sidebar.
- **Run Task** – manually run a single task by ID.
- **Refresh Artifacts** – manually refreshes the artifact tree view.

## Testing

```bash
npm run compile
npm test
```

> Note: Integration tests that launch VS Code may require network access to download the test runner. If the download fails in your environment, rerun locally with network access.

## Contributing

- Fork the repo and create a branch for your feature or bugfix.
- Run `npm run compile` before submitting a PR to ensure TypeScript builds cleanly.
- For CLI changes, document new adapters or stages in `tools/cli/README.md`.

## License

This repository is part of the Code Machine project. Please refer to your organization’s licensing terms before distributing or modifying.
