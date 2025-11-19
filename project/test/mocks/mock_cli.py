import argparse
import json
import sys
from pathlib import Path
from textwrap import dedent
from urllib.parse import unquote, urlparse

ARTIFACTS_DIR = ".artifacts"
REQUIREMENTS_FILENAME = "requirements.md"
ARCHITECTURE_FILENAME = "architecture.md"
PLAN_FILENAME = "plan.md"
TODO_FILENAME = "todo.json"


def parse_workspace_uri(raw_value: str) -> Path:
    if raw_value.startswith("file://"):
        parsed = urlparse(raw_value)
        if parsed.scheme != "file":
            raise ValueError("Only file:// URIs are supported for the workspace.")
        return Path(unquote(parsed.path))
    return Path(raw_value).expanduser()


def ensure_artifacts_dir(workspace: Path) -> Path:
    artifacts_dir = workspace / ARTIFACTS_DIR
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    return artifacts_dir


def write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"Mock CLI: wrote {path}")


def create_todo_plan(project_name: str) -> list:
    return [
        {
            "iteration_id": "I1",
            "description": "Foundation work",
            "status": "pending",
            "tasks": [
                {
                    "id": "I1.T1",
                    "description": f"Define requirements for {project_name}",
                    "status": "pending",
                    "file_paths": [f"{ARTIFACTS_DIR}/{REQUIREMENTS_FILENAME}"],
                },
                {
                    "id": "I1.T2",
                    "description": "Outline initial architecture decisions",
                    "status": "pending",
                    "file_paths": [f"{ARTIFACTS_DIR}/{ARCHITECTURE_FILENAME}"],
                },
            ],
        },
        {
            "iteration_id": "I2",
            "description": "Planning horizon",
            "status": "pending",
            "iterations": [
                {
                    "iteration_id": "I2.I1",
                    "description": "Task breakdown",
                    "status": "pending",
                    "tasks": [
                        {
                            "id": "I2.I1.T1",
                            "description": "Write the implementation plan and task board",
                            "status": "pending",
                            "file_paths": [
                                f"{ARTIFACTS_DIR}/{PLAN_FILENAME}",
                                f"{ARTIFACTS_DIR}/{TODO_FILENAME}",
                            ],
                        }
                    ],
                }
            ],
        },
    ]


def generate_artifacts(args: argparse.Namespace) -> None:
    workspace = parse_workspace_uri(args.workspace_uri)
    artifacts_dir = ensure_artifacts_dir(workspace)
    requirements_path = artifacts_dir / REQUIREMENTS_FILENAME
    architecture_path = artifacts_dir / ARCHITECTURE_FILENAME
    plan_path = artifacts_dir / PLAN_FILENAME
    todo_path = artifacts_dir / TODO_FILENAME

    requirements_content = dedent(
        f"""
        # {args.project_name} Requirements

        Generated from the following product prompt:

        > {args.prompt.strip()}

        ## Functional Requirements
        - Capture user intent and convert it into reproducible artifacts.
        - Store all generated documents under `{ARTIFACTS_DIR}`.

        ## Non-Functional Requirements
        - Deterministic output for testing.
        - Plain Markdown and JSON artifacts for easy inspection.
        """
    ).strip() + "\n"

    architecture_content = dedent(
        f"""
        # {args.project_name} Architecture

        ## Components
        1. **Interface Layer** — surfaces the generated requirements and plan.
        2. **Planning Engine** — reads `{PLAN_FILENAME}` and `{TODO_FILENAME}`.
        3. **Artifact Store** — persists Markdown/JSON in `{ARTIFACTS_DIR}`.

        ## Deployment
        A single container responsible for orchestrating CLI-driven workflows.
        """
    ).strip() + "\n"

    plan_markdown = dedent(
        f"""
        # {args.project_name} Build Plan

        | Task | Description |
        | ---- | ----------- |
        | I1.T1 | Finalize requirements |
        | I1.T2 | Establish architecture baseline |
        | I2.I1.T1 | Author plan + todo artifacts |
        """
    ).strip() + "\n"

    todo_plan = create_todo_plan(args.project_name)

    write_file(requirements_path, requirements_content)
    write_file(architecture_path, architecture_content)
    write_file(plan_path, plan_markdown)
    write_file(todo_path, json.dumps(todo_plan, indent=2))


def run_task(args: argparse.Namespace) -> None:
    workspace = parse_workspace_uri(args.workspace_uri)
    artifacts_dir = ensure_artifacts_dir(workspace)
    task_dir = artifacts_dir / "build"
    task_dir.mkdir(parents=True, exist_ok=True)
    task_file = task_dir / f"{args.task_id}.md"

    feedback_line = args.feedback or "No reviewer feedback provided."
    task_content = dedent(
        f"""
        # Task {args.task_id}

        This artifact demonstrates deterministic output from the mock CLI.

        ## Feedback
        {feedback_line}
        """
    ).strip() + "\n"

    write_file(task_file, task_content)


def main() -> None:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--workspace-uri",
        required=True,
        help="Workspace path or file:// URI where artifacts should be written.",
    )
    common.add_argument(
        "--fail",
        action="store_true",
        help="Simulate a non-zero exit for test scenarios.",
    )

    parser = argparse.ArgumentParser(description="Mock CLI that generates deterministic artifacts.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    generate_parser = subparsers.add_parser("generate", parents=[common], help="Create Markdown/JSON artifacts.")
    generate_parser.add_argument("--project-name", required=True, help="Name of the project being generated.")
    generate_parser.add_argument("--prompt", required=True, help="User prompt captured in requirements.")

    run_parser = subparsers.add_parser("run", parents=[common], help="Simulate running a build task.")
    run_parser.add_argument("--task-id", required=True, help="Identifier of the task to run.")
    run_parser.add_argument("--feedback", help="Optional reviewer feedback string.", default="")

    args = parser.parse_args()

    if args.command == "generate":
        generate_artifacts(args)
    elif args.command == "run":
        run_task(args)
    else:
        parser.error("Unknown command requested.")

    if args.fail:
        print("Mock CLI: Simulating failure.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
