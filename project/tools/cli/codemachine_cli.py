#!/usr/bin/env python3
"""
Code Machine Type A CLI

Implements the prompt → requirements → architecture → plan → todo → build loop
described in the Type A specification. The CLI keeps the VS Code extension
interface (generate/run task) but also exposes a `project` command that performs
the full pipeline end-to-end.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import textwrap
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, unquote

try:
    from litellm import completion  # type: ignore
except ImportError:  # pragma: no cover - handled via mock mode
    completion = None  # type: ignore

ARTIFACTS_DIR = ".artifacts"
BUILD_DIR = "build"
LOGS_DIR = "logs"
LLM_LOG_SUBDIR = "llm"
LINT_LOG_SUBDIR = "lints"

REQUIREMENTS_FILE = "requirements.md"
ARCHITECTURE_FILE = "architecture.md"
PLAN_FILE = "plan.md"
TODO_FILE = "todo.json"
BLUEPRINT_FILE = ".blueprint"
CLI_LOG_FILE = "cli.log"

CLI_DIR = Path(__file__).resolve().parent
CLI_PROMPTS_DIR = CLI_DIR / "prompts"
PROJECT_ROOT = CLI_DIR.parent.parent
PROMPTS_DIR = PROJECT_ROOT / "prompts"


def log(message: str) -> None:
    print(f"[CodeMachine CLI] {message}")


def parse_workspace_uri(value: str | None, project_name: str) -> Path:
    if value:
        if value.startswith("file://"):
            parsed = urlparse(value)
            if parsed.scheme != "file":
                raise ValueError("Only file:// URIs are supported for the workspace.")
            path = unquote(parsed.path)
            return Path(path)
        return Path(value).expanduser()

    default_root = Path.cwd() / "projects" / project_name
    default_root.mkdir(parents=True, exist_ok=True)
    return default_root


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_template(relative_path: str, fallback: str) -> str:
    rel_name = Path(relative_path).name
    candidates = [
        CLI_PROMPTS_DIR / relative_path,
        CLI_PROMPTS_DIR / rel_name,
        PROMPTS_DIR / relative_path,
        PROMPTS_DIR / rel_name,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate.read_text(encoding="utf-8").strip()
    return fallback.strip()


def timestamp() -> str:
    return datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")


@dataclass
class WorkspaceContext:
    root: Path
    project_name: str
    prompt: str

    def __post_init__(self) -> None:
        self.artifacts = ensure_dir(self.root / ARTIFACTS_DIR)
        self.logs_dir = ensure_dir(self.artifacts / LOGS_DIR)
        self.llm_logs_dir = ensure_dir(self.logs_dir / LLM_LOG_SUBDIR)
        self.lint_logs_dir = ensure_dir(self.artifacts / LINT_LOG_SUBDIR)
        self.cli_log_path = self.logs_dir / CLI_LOG_FILE
        self.cli_log_path.touch(exist_ok=True)
        self.blueprint_path = self.artifacts / BLUEPRINT_FILE
        if self.blueprint_path.exists():
            try:
                data = json.loads(self.blueprint_path.read_text(encoding="utf-8"))
                if (not self.project_name) or self.project_name == "workspace":
                    self.project_name = data.get("project", {}).get("name", self.project_name)
                if not self.prompt:
                    self.prompt = data.get("input_prompt", self.prompt)
            except json.JSONDecodeError:
                pass
        self._ensure_artifacts_gitignore()

    def log(self, message: str) -> None:
        log(message)
        with self.cli_log_path.open("a", encoding="utf-8") as handle:
            handle.write(f"{timestamp()} {message}\n")

    def record_llm(self, stage: str, messages: List[Dict[str, str]], response: str) -> None:
        payload = {
            "stage": stage,
            "messages": messages,
            "response": response,
            "timestamp": timestamp(),
        }
        target = self.llm_logs_dir / f"{payload['timestamp']}_{stage}.json"
        target.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def write_artifact(self, relative: str, content: str) -> Path:
        target = self.artifacts / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        self.log(f"Wrote {relative}")
        return target

    def read_artifact(self, relative: str) -> Optional[str]:
        target = self.artifacts / relative
        if target.exists():
            return target.read_text(encoding="utf-8")
        return None

    def write_blueprint(self, force: bool) -> None:
        if self.blueprint_path.exists() and not force:
            return
        blueprint = {
            "project": {
                "name": self.project_name,
                "description": self.prompt[:200],
            },
            "project_config": {
                "project_dir": str(self.root),
                "src_dir": "project",
            },
            "input_prompt": self.prompt,
        }
        self.blueprint_path.write_text(json.dumps(blueprint, indent=2), encoding="utf-8")
        self.log(f"Blueprint updated at {self.blueprint_path}")

    def _ensure_artifacts_gitignore(self) -> None:
        gitignore_path = self.artifacts / '.gitignore'
        if gitignore_path.exists():
            return
        content = "\n".join([
            "# Auto-generated by Code Machine CLI",
            "logs/",
            "lints/",
            "debug/",
            "",
        ])
        gitignore_path.write_text(content, encoding='utf-8')


class LLMClient:
    def __init__(self) -> None:
        self.mode = self._determine_mode()
        self.model = os.environ.get("CODEMACHINE_LLM_MODEL", "gpt-4o-mini")
        self.api_key = os.environ.get("CODEMACHINE_LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
        self.api_base = os.environ.get("CODEMACHINE_LLM_API_BASE")
        log(f"LLM mode: {self.mode}")

    def _determine_mode(self) -> str:
        override = os.environ.get("CODEMACHINE_CLI_MODE", "auto").lower()
        if override in {"mock", "real"}:
            if override == "real" and completion is None:
                raise ImportError("LiteLLM is not installed but CODEMACHINE_CLI_MODE=real.")
            return override
        if completion is None or not (os.environ.get("CODEMACHINE_LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")):
            return "mock"
        return "real"

    def draft_requirements(self, ctx: WorkspaceContext) -> str:
        if self.mode == "mock":
            return self._mock_requirements(ctx.project_name, ctx.prompt)
        template = load_template(
            "generate_initial_frd.txt",
            "Act as a senior analyst. Create a requirements doc based on the provided prompt: {input}",
        )
        document = ctx.prompt or "No prompt provided."
        user_content = template.replace("{input}", document)
        messages = [
            {
                "role": "system",
                "content": "You are Code Machine. Produce a structured Functional Requirements Document.",
            },
            {"role": "user", "content": user_content},
        ]
        response = self._invoke_llm("requirements", messages)
        ctx.record_llm("requirements", messages, response)
        return response.strip() + "\n"

    def draft_architecture(self, ctx: WorkspaceContext, requirements: str) -> str:
        if self.mode == "mock":
            return textwrap.dedent(
                f"""
                # {ctx.project_name} Architecture

                ## Components
                - Prompt Intake
                - Planner
                - Builder

                ## Technology Stack
                - TypeScript frontend, Python backend, SQLite DB.

                ## Critical Flow
                ```mermaid
                sequenceDiagram
                    participant User
                    participant Planner
                    participant Builder
                    User->>Planner: describe goal
                    Planner->>Builder: build plan
                    Builder->>User: deliver code
                ```
                """
            ).strip() + "\n"

        template = load_template(
            "plan_arch.txt",
            "You are a software architect. Given requirements, produce Markdown architecture with "
            "components, tech stack, and diagrams.",
        )
        prompt_body = template.replace("{manifest}", requirements).replace("{constraints}", "None provided.")
        messages = [
            {"role": "system", "content": "You are Code Machine. Produce a comprehensive architecture blueprint."},
            {"role": "user", "content": prompt_body},
        ]
        response = self._invoke_llm("architecture", messages)
        ctx.record_llm("architecture", messages, response)
        return response.strip() + "\n"

    def draft_plan(self, ctx: WorkspaceContext, requirements: str, architecture: str) -> str:
        if self.mode == "mock":
            return textwrap.dedent(
                """
                # Iteration Plan

                ## Iteration I1
                - Task I1.T1: Implement requirements.md
                - Task I1.T2: Implement architecture.md

                ## Iteration I2
                - Task I2.T1: Create plan.md and todo.json
                """
            ).strip() + "\n"

        template = load_template(
            "plan_iter.txt",
            "You are a planning agent. Using the requirements and architecture, produce a multi-iteration plan in Markdown.",
        )
        plan_prompt = textwrap.dedent(
            f"""
            ## Requirements
            {requirements}

            ## Architecture
            {architecture}
            """
        )
        messages = [
            {"role": "system", "content": template},
            {"role": "user", "content": plan_prompt},
        ]
        response = self._invoke_llm("plan_markdown", messages)
        ctx.record_llm("plan_markdown", messages, response)
        return response.strip() + "\n"

    def extract_tasks(self, ctx: WorkspaceContext, plan_markdown: str) -> List[Dict[str, Any]]:
        if self.mode == "mock":
            return [
                {
                    "iteration_id": "I1",
                    "description": "Foundation work",
                    "status": "pending",
                    "tasks": [
                        {
                            "id": "I1.T1",
                            "description": "Write requirements.md",
                            "status": "pending",
                            "file_paths": [f"{ARTIFACTS_DIR}/{REQUIREMENTS_FILE}"],
                        },
                        {
                            "id": "I1.T2",
                            "description": "Write architecture.md",
                            "status": "pending",
                            "file_paths": [f"{ARTIFACTS_DIR}/{ARCHITECTURE_FILE}"],
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
                                    "description": "Produce plan.md and todo.json",
                                    "status": "pending",
                                    "file_paths": [
                                        f"{ARTIFACTS_DIR}/{PLAN_FILE}",
                                        f"{ARTIFACTS_DIR}/{TODO_FILE}",
                                    ],
                                }
                            ],
                        }
                    ],
                },
            ]

        template = load_template(
            "plan_iter_extraction.txt",
            "Extract tasks into JSON.",
        )
        user_content = template.replace("{plan_text}", plan_markdown)
        messages = [
            {"role": "system", "content": "You are Code Machine. Extract tasks according to the provided instructions."},
            {"role": "user", "content": user_content},
        ]
        response = self._invoke_llm("plan_json", messages)
        ctx.record_llm("plan_json", messages, response)
        tasks = self._parse_task_array(response)
        return self._tasks_to_iterations(tasks)

    def build_task_summary(self, ctx: WorkspaceContext, task_id: str, feedback: Optional[str]) -> str:
        if self.mode == "mock":
            feedback_text = feedback or "No reviewer feedback provided."
            return textwrap.dedent(
                f"""
                # Task {task_id}

                ## Summary
                - Generated deterministic output for {task_id}.

                ## Feedback
                {feedback_text}

                ## Next Steps
                - Review and commit changes.
                """
            ).strip() + "\n"

        system_prompt = (
            "You are the Builder Agent. Produce a Markdown summary of the work performed, "
            "validation steps, and follow-up items for the given task."
        )
        user_lines = [f"Task ID: {task_id}"]
        if feedback:
            user_lines.append(f"Reviewer feedback: {feedback}")
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "\n".join(user_lines)},
        ]
        response = self._invoke_llm("build_task", messages)
        ctx.record_llm("build_task", messages, response)
        return response.strip() + "\n"

    def _invoke_llm(self, stage: str, messages: List[Dict[str, str]]) -> str:
        if self.mode == "mock":
            raise RuntimeError("Mock mode should not call _invoke_llm directly.")
        if completion is None:
            raise RuntimeError("LiteLLM is not installed. Run `pip install litellm`.")
        kwargs: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
        }
        if self.api_key:
            kwargs["api_key"] = self.api_key
        if self.api_base:
            kwargs["api_base"] = self.api_base
        log(f"Calling LiteLLM for stage '{stage}' using model {self.model}")
        result = completion(**kwargs)
        try:
            return result["choices"][0]["message"]["content"]
        except Exception as exc:  # pragma: no cover - defensive
            raise RuntimeError(f"Unexpected response from LiteLLM: {result}") from exc

    @staticmethod
    def _strip_code_fence(content: str) -> str:
        text = content.strip()
        if not text.startswith("```") and not text.startswith("~~~"):
            return text
        fence = text[:3]
        stripped = text[3:]
        if stripped.lstrip().lower().startswith("json"):
            stripped = stripped.lstrip()[4:]
        closing_index = stripped.rfind(fence)
        if closing_index != -1:
            stripped = stripped[:closing_index]
        return stripped.strip()

    def _parse_task_array(self, response: str) -> List[Dict[str, Any]]:
        cleaned = self._strip_code_fence(response)
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Failed to parse plan JSON: {exc.msg}") from exc
        if not isinstance(data, list):
            raise ValueError("Expected JSON array of tasks from plan extraction.")
        return data

    def _tasks_to_iterations(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        nodes: Dict[str, Dict[str, Any]] = {}
        roots: List[Dict[str, Any]] = []

        def ensure_node(identifier: str, description: str) -> Dict[str, Any]:
            if identifier in nodes:
                node = nodes[identifier]
                if description and not node["description"]:
                    node["description"] = description
                return node
            node = {
                "iteration_id": identifier,
                "description": description or "",
                "status": "pending",
                "tasks": [],
                "iterations": [],
            }
            nodes[identifier] = node
            parent_id = ".".join(identifier.split(".")[:-1])
            if parent_id:
                parent = ensure_node(parent_id, "")
                if node not in parent["iterations"]:
                    parent["iterations"].append(node)
            else:
                roots.append(node)
            return node

        for task in tasks:
            iteration_id = task.get("iteration_id") or "I1"
            iteration_goal = task.get("iteration_goal", "")
            node = ensure_node(iteration_id, iteration_goal)
            file_paths = task.get("target_files") or task.get("file_paths") or []
            if isinstance(file_paths, str):
                file_paths = [file_paths]
            node.setdefault("tasks", []).append({
                "id": task.get("task_id") or task.get("id") or "task",
                "description": task.get("description", ""),
                "status": "pending",
                "file_paths": file_paths,
            })

        def prune(node: Dict[str, Any]) -> Dict[str, Any]:
            node["iterations"] = [prune(child) for child in node.get("iterations", [])]
            if not node["iterations"]:
                node.pop("iterations", None)
            if not node.get("tasks"):
                node.pop("tasks", None)
            return node

        return [prune(root) for root in roots]

    def _mock_requirements(self, project_name: str, prompt: str) -> str:
        return textwrap.dedent(
            f"""
            # {project_name} Requirements

            ## Overview
            {prompt}

            ## Functional Requirements
            - Convert prompts into requirements, architecture, and plans.

            ## Data
            - Store artifacts under `{ARTIFACTS_DIR}` for traceability.

            ## Non-Functional
            - Deterministic when CODEMACHINE_CLI_MODE=mock.

            ## Acceptance Tests
            - CLI run produces all artifacts without error.
            """
        ).strip() + "\n"


class TypeAPipeline:
    def __init__(self, ctx: WorkspaceContext, llm: LLMClient) -> None:
        self.ctx = ctx
        self.llm = llm

    def generate_documents(self, force: bool) -> List[Dict[str, Any]]:
        return self.generate_until("todo", force)

    def generate_until(self, stage: str, force: bool) -> Optional[List[Dict[str, Any]]]:
        self.ctx.write_blueprint(force)
        requirements = self._ensure_requirements(force)
        if stage == "requirements":
            return None
        architecture = self._ensure_architecture(requirements, force)
        if stage == "architecture":
            return None
        plan = self._ensure_plan(requirements, architecture, force)
        if stage == "plan":
            return None
        return self.extract_plan_to_json_from_content(plan, force)

    def _ensure_requirements(self, force: bool) -> str:
        existing = self.ctx.read_artifact(REQUIREMENTS_FILE)
        if existing and not force:
            self.ctx.log("requirements.md exists; reusing.")
            return existing
        doc = self.llm.draft_requirements(self.ctx)
        self.ctx.write_artifact(REQUIREMENTS_FILE, doc)
        return doc

    def _ensure_architecture(self, requirements: str, force: bool) -> str:
        existing = self.ctx.read_artifact(ARCHITECTURE_FILE)
        if existing and not force:
            self.ctx.log("architecture.md exists; reusing.")
            return existing
        doc = self.llm.draft_architecture(self.ctx, requirements)
        self.ctx.write_artifact(ARCHITECTURE_FILE, doc)
        return doc

    def _ensure_plan(self, requirements: str, architecture: str, force: bool) -> str:
        existing = self.ctx.read_artifact(PLAN_FILE)
        if existing and not force:
            self.ctx.log("plan.md exists; reusing.")
            return existing
        doc = self.llm.draft_plan(self.ctx, requirements, architecture)
        self.ctx.write_artifact(PLAN_FILE, doc)
        return doc

    def extract_plan_to_json(self, force: bool) -> List[Dict[str, Any]]:
        plan = self.ctx.read_artifact(PLAN_FILE)
        if not plan:
            raise FileNotFoundError('plan.md not found; generate the plan before extracting tasks.')
        return self.extract_plan_to_json_from_content(plan, force)

    def extract_plan_to_json_from_content(self, plan_markdown: str, force: bool) -> List[Dict[str, Any]]:
        todo_path = self.ctx.artifacts / TODO_FILE
        if todo_path.exists() and not force:
            self.ctx.log("todo.json exists; reusing.")
            return json.loads(todo_path.read_text(encoding="utf-8"))
        todo = self.llm.extract_tasks(self.ctx, plan_markdown)
        todo_path.write_text(json.dumps(todo, indent=2), encoding="utf-8")
        self.ctx.log("todo.json updated from plan.")
        return todo

    def execute_iterations(self, todo: List[Dict[str, Any]], qa_enabled: bool) -> None:
        build_dir = ensure_dir(self.ctx.artifacts / BUILD_DIR)
        for iteration in todo:
            iteration_id = iteration.get("iteration_id", "Iter")
            self.ctx.log(f"Starting iteration {iteration_id}")
            tasks = iteration.get("tasks", [])
            for task in tasks:
                task_id = task.get("task_id") or task.get("id") or "task"
                summary = self.llm.build_task_summary(self.ctx, task_id, None)
                target = build_dir / iteration_id
                ensure_dir(target)
                (target / f"{task_id}.md").write_text(summary, encoding="utf-8")
                self.ctx.log(f"Completed task {task_id}")
                for file_path in task.get("file_paths", []):
                    absolute = self.ctx.root / file_path
                    absolute.parent.mkdir(parents=True, exist_ok=True)
                    if not absolute.exists():
                        absolute.write_text(f"# Auto-generated placeholder for {task_id}\n", encoding="utf-8")
                if qa_enabled:
                    run_quality_checks(self.ctx, task_id)

    def run_single_task(self, task_id: str, feedback: Optional[str], qa_enabled: bool) -> None:
        build_dir = ensure_dir(self.ctx.artifacts / BUILD_DIR)
        summary = self.llm.build_task_summary(self.ctx, task_id, feedback)
        target = build_dir / f"{task_id}.md"
        target.write_text(summary, encoding="utf-8")
        self.ctx.log(f"Generated build artifact for task {task_id}")
        if qa_enabled:
            run_quality_checks(self.ctx, task_id)


def run_quality_checks(ctx: WorkspaceContext, label: str) -> None:
    scripts = [
        ("tools/lint.sh", "lint"),
        ("tools/test.sh", "test"),
    ]
    for script, kind in scripts:
        script_path = ctx.root / script
        if not script_path.exists():
            continue
        ctx.log(f"Running {script} for {label}")
        result = subprocess.run(
            ["/bin/bash", str(script_path)],
            cwd=ctx.root,
            capture_output=True,
            text=True,
        )
        log_path = ctx.lint_logs_dir / f"{timestamp()}_{kind}_{label}.log"
        log_path.write_text(result.stdout + "\n" + result.stderr, encoding="utf-8")
        if result.returncode != 0:
            ctx.log(f"{script} failed for {label} (see {log_path})")
        else:
            ctx.log(f"{script} passed for {label}")


def command_generate(args: argparse.Namespace, llm: LLMClient) -> None:
    workspace = parse_workspace_uri(args.workspace_uri, args.project_name)
    ctx = WorkspaceContext(workspace, args.project_name, args.prompt or "")
    pipeline = TypeAPipeline(ctx, llm)
    if args.fail:
        log("Failure requested via --fail.")
        print("Requested failure for test scenario.", file=sys.stderr)
        sys.exit(1)
    pipeline.generate_until(args.until, force=args.force)


def command_run(args: argparse.Namespace, llm: LLMClient) -> None:
    workspace = parse_workspace_uri(args.workspace_uri, args.project_name or "workspace")
    prompt_text = args.prompt or ""
    project_name = args.project_name or workspace.name
    ctx = WorkspaceContext(workspace, project_name, prompt_text)
    pipeline = TypeAPipeline(ctx, llm)
    if args.fail:
        log("Failure requested via --fail.")
        print("Requested failure for test scenario.", file=sys.stderr)
        sys.exit(1)
    pipeline.run_single_task(args.task_id, args.feedback, qa_enabled=args.qa)


def command_project(args: argparse.Namespace, llm: LLMClient) -> None:
    workspace = parse_workspace_uri(args.workspace_uri, args.project_name)
    ctx = WorkspaceContext(workspace, args.project_name, args.prompt or "")
    if not ctx.prompt:
        raise ValueError("A prompt is required to run the project pipeline.")

    pipeline = TypeAPipeline(ctx, llm)
    todo = pipeline.generate_until("todo", force=args.force) or []
    if not args.auto_approve and sys.stdin.isatty():
        ctx.log(f"Requirements stored at {ctx.artifacts / REQUIREMENTS_FILE}")
        response = input("Continue to architecture/plan generation? [Y/n]: ").strip().lower()
        if response not in {"", "y", "yes"}:
            ctx.log("Stopping after requirements per user request.")
            return
    pipeline.execute_iterations(todo, qa_enabled=not args.no_qa)


def command_extract_plan(args: argparse.Namespace, llm: LLMClient) -> None:
    workspace = parse_workspace_uri(args.workspace_uri, args.project_name or "workspace")
    ctx = WorkspaceContext(workspace, args.project_name or workspace.name, args.prompt or "")
    pipeline = TypeAPipeline(ctx, llm)
    pipeline.extract_plan_to_json(force=args.force)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Code Machine Type A CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--workspace-uri", help="Workspace path or file:// URI.")
    common.add_argument("--force", action="store_true", help="Regenerate artifacts even if they exist.")
    common.add_argument("--fail", action="store_true", help="Simulate failure for tests.")

    gen = subparsers.add_parser("generate", parents=[common], help="Generate requirements/architecture/plan/todo.")
    gen.add_argument("--project-name", required=True)
    gen.add_argument("--prompt")
    gen.add_argument(
        "--until",
        choices=["requirements", "architecture", "plan", "todo"],
        default="todo",
        help="Stage to generate up to (defaults to todo).",
    )

    run = subparsers.add_parser("run", parents=[common], help="Run a single task.")
    run.add_argument("--project-name", help="Optional project name override.")
    run.add_argument("--prompt", help="Optional prompt override (for blueprint creation).")
    run.add_argument("--task-id", required=True)
    run.add_argument("--feedback")
    run.add_argument("--qa", action="store_true", help="Run QA scripts after finishing the task.")

    project = subparsers.add_parser("project", parents=[common], help="Execute the Type A pipeline end-to-end.")
    project.add_argument("-n", "--project-name", required=True)
    project.add_argument("-t", "--type", default="a", choices=["a"], help="Project type (currently only 'a').")
    project.add_argument("--prompt", required=False, help="Free-form user prompt describing the project.")
    project.add_argument("--auto-approve", action="store_true", help="Skip interactive confirmation.")
    project.add_argument("--no-qa", action="store_true", help="Disable QA runs after each task.")

    extract = subparsers.add_parser("extract-plan", parents=[common], help="Convert plan.md to todo.json via LLM.")
    extract.add_argument("--project-name", help="Optional project name override.")
    extract.add_argument("--prompt", help="Optional prompt override for blueprint hydration.")

    return parser


def main(argv: Optional[List[str]] = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    llm = LLMClient()
    if args.command == "generate":
        command_generate(args, llm)
    elif args.command == "run":
        command_run(args, llm)
    elif args.command == "project":
        command_project(args, llm)
    elif args.command == "extract-plan":
        command_extract_plan(args, llm)
    else:  # pragma: no cover
        parser.error(f"Unknown command {args.command}")


if __name__ == "__main__":
    main()
