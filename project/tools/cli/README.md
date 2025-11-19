# Code Machine CLI

This Python CLI powers generation and task execution for the VS Code extension.
It uses [LiteLLM](https://github.com/BerriAI/litellm) to call LLMs and writes
artifacts into the workspace under `.artifacts/`.

## Installation

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r tools/cli/requirements.txt
```

## Environment

Set the model + credentials LiteLLM should use (OpenAI-compatible variables
work as well):

```
export CODEMACHINE_LLM_MODEL=gpt-4o-mini
export CODEMACHINE_LLM_API_KEY=$OPENAI_API_KEY
# Optional:
# export CODEMACHINE_LLM_API_BASE=https://api.openai.com/v1
```

By default the CLI falls back to a deterministic mock mode (no network calls).
Force mock/real behavior via:

```
export CODEMACHINE_CLI_MODE=mock   # or real
```

## Commands

- `python tools/cli/codemachine_cli.py project -n NAME --prompt "..." [--workspace-uri ...]`
  Executes the full Type A pipeline. Flags:
  - `--force` regenerates existing artifacts.
  - `--auto-approve` skips the confirmation pause after requirements.
  - `--no-qa` disables post-task `tools/lint.sh` and `tools/test.sh`.
- `python ... generate --project-name NAME --prompt PROMPT --workspace-uri <path-or-uri>`
  Used by the VS Code extension to draft requirements/architecture/plan/todo deterministically.
- `python ... run --task-id I1.T1 --workspace-uri <...> [--feedback "..."]`
  Creates `.artifacts/build/<task-id>.md` summarizing the step (and optionally runs QA with `--qa`).

All commands accept `--fail` to simulate an error for automated tests. Set
`CODEMACHINE_CLI_MODE=mock` during CI to avoid real API calls.
