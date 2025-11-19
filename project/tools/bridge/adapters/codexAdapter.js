const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PROMPTS_DIR = path.resolve(__dirname, '../../prompts');
const ARTIFACTS_DIR = '.artifacts';

function runCodexAdapter(cliArgs) {
  const workspacePath = extractWorkspacePath(cliArgs);
  const { subcommand, options } = parseCliCommand(cliArgs);
  let prompt;
  try {
    prompt = buildCodexPrompt(subcommand, options, workspacePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Codex adapter error: ${message}`);
    process.exit(2);
  }
  if (!prompt) {
    console.error('Codex adapter currently supports the `generate`, `extract-plan`, and `run` subcommands.');
    process.exit(2);
  }

  const codexArgs = [
    '--full-auto',
    '--ask-for-approval',
    'on-failure',
    '--sandbox',
    'workspace-write',
    'exec',
  ];
  if (workspacePath) {
    codexArgs.push('--cd', workspacePath);
  }
  const additional = process.env.CODEMACHINE_CODEX_FLAGS;
  if (additional) {
    codexArgs.push(...additional.split(/\s+/).filter(Boolean));
  }
  codexArgs.push(prompt);

  const child = spawn('codex', codexArgs, {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('error', (error) => {
    console.error(`Failed to start Codex CLI: ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}

function parseCliCommand(cliArgs) {
  if (!cliArgs.length) {
    return { subcommand: undefined, options: {} };
  }
  const subcommand = cliArgs[0];
  const options = {};
  for (let i = 1; i < cliArgs.length; i++) {
    const arg = cliArgs[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const eqIndex = arg.indexOf('=');
    if (eqIndex !== -1) {
      const key = arg.slice(2, eqIndex);
      options[key] = arg.slice(eqIndex + 1);
      continue;
    }
    const key = arg.slice(2);
    if (i + 1 < cliArgs.length && !cliArgs[i + 1].startsWith('--')) {
      options[key] = cliArgs[i + 1];
      i++;
    } else {
      options[key] = true;
    }
  }
  return { subcommand, options };
}

function extractWorkspacePath(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--workspace-uri' && i + 1 < args.length) {
      return uriToPath(args[i + 1]);
    }
    if (arg.startsWith('--workspace-uri=')) {
      return uriToPath(arg.split('=')[1]);
    }
  }
  return undefined;
}

function uriToPath(value) {
  if (!value) {
    return undefined;
  }
  if (value.startsWith('file://')) {
    try {
      const url = new URL(value);
      return decodeURIComponent(url.pathname);
    } catch {
      return value;
    }
  }
  return value;
}

function buildCodexPrompt(subcommand, options, workspacePath) {
  if (!subcommand) {
    return undefined;
  }
  if (subcommand === 'generate') {
    return buildGeneratePrompt(options, workspacePath);
  }
  if (subcommand === 'extract-plan') {
    const merged = { ...options, until: 'todo' };
    return buildGeneratePrompt(merged, workspacePath);
  }
  if (subcommand === 'run') {
    return buildRunPrompt(options, workspacePath);
  }
  return undefined;
}

function buildGeneratePrompt(options, workspacePath) {
  const projectName = options['project-name'] || 'Unnamed Project';
  const userPrompt = options.prompt || 'No additional prompt provided.';
  const stage = (options.until || 'todo').toLowerCase();
  const allowedStages = ['requirements', 'architecture', 'plan', 'todo'];
  if (!allowedStages.includes(stage)) {
    throw new Error(`Unsupported stage "${stage}" passed to generate.`);
  }
  const root = workspacePath || 'the current working directory';
  const templateExamples = {
    requirements: loadPromptText('generate_initial_frd.txt'),
    architecture: loadPromptText('plan_arch.txt'),
    plan: loadPromptText('plan_iter.txt'),
    todo: loadPromptText('plan_iter_extraction.txt'),
  };
  const requirementsContent = loadArtifactContent(workspacePath, path.join(ARTIFACTS_DIR, 'requirements.md'));
  const architectureContent = loadArtifactContent(workspacePath, path.join(ARTIFACTS_DIR, 'architecture.md'));
  const planContent = loadArtifactContent(workspacePath, path.join(ARTIFACTS_DIR, 'plan.md'));

  const stageInstructions = {
    requirements: [
      `1. Create or update ${ARTIFACTS_DIR}/requirements.md with a detailed Functional Requirements Document (FRD).`,
      '2. Follow the structure: Introduction, User Roles & Personas, User Stories, Functional Requirements with unique IDs, Non-Functional Requirements (Performance, Security, Usability, Reliability), Workflows with Mermaid/PlantUML diagrams, Ambiguities/Questions, Assumptions, Out-of-Scope.',
      '3. Base all content on the user prompt and inferred needs. Keep the tone professional and actionable.',
    ],
    architecture: [
      `1. Read ${ARTIFACTS_DIR}/requirements.md and produce ${ARTIFACTS_DIR}/architecture.md.`,
      '2. Include component breakdown, technology stack recommendations, deployment considerations, and at least one diagram (PlantUML or Mermaid) showing critical flows.',
      '3. Reference all major services, databases, external APIs, and how they interact.',
    ],
    plan: [
      `1. Using requirements + architecture, create ${ARTIFACTS_DIR}/plan.md as a multi-iteration plan following the Type A format (iterations, tasks with IDs, agent hints, inputs/outputs, acceptance criteria, parallelizable flag).`,
      '2. Ensure the plan mentions architectural artifacts, diagrams, specs, and implementation tasks in logical order.',
    ],
    todo: [
      `1. Convert ${ARTIFACTS_DIR}/plan.md into JSON at ${ARTIFACTS_DIR}/todo.json.`,
      '2. The JSON must be an array of iterations. Each iteration has iteration_id, description, status, nested iterations (if any), and tasks.',
      '3. Each task contains id, description, status, file_paths (relative paths), and nested iterations when applicable. Match the schema previously used by the Type A CLI.',
    ],
  };

  const rules = [
    `You are Codex acting as the Code Machine Type A CLI.`,
    `Workspace root: ${root}`,
    `Project name: ${projectName}`,
    `User prompt/context: ${userPrompt}`,
    '',
    'General Rules:',
    '- Work exclusively inside the workspace root.',
    `- Write artifacts into the ${ARTIFACTS_DIR}/ directory.`,
    '- Do not include explanatory prose outside the generated files.',
    '- Overwrite existing artifacts only when instructed by the current stage.',
    '',
    `Current Stage: ${stage.toUpperCase()}`,
    ...stageInstructions[stage],
    '',
    'Template Guidance:',
    templateExamples[stage] || 'No template file available for this stage.',
  ];

  if (stage === 'architecture' && requirementsContent) {
    rules.push('', `Existing Requirements (${ARTIFACTS_DIR}/requirements.md):`, requirementsContent);
  }
  if (stage === 'plan') {
    if (requirementsContent) {
      rules.push('', `Existing Requirements (${ARTIFACTS_DIR}/requirements.md):`, requirementsContent);
    }
    if (architectureContent) {
      rules.push('', `Existing Architecture (${ARTIFACTS_DIR}/architecture.md):`, architectureContent);
    }
  }
  if (stage === 'todo') {
    if (requirementsContent) {
      rules.push('', `Requirements Context (${ARTIFACTS_DIR}/requirements.md):`, requirementsContent);
    }
    if (architectureContent) {
      rules.push('', `Architecture Context (${ARTIFACTS_DIR}/architecture.md):`, architectureContent);
    }
    if (planContent) {
      rules.push('', `Plan Context (${ARTIFACTS_DIR}/plan.md):`, planContent);
    }
  }

  rules.push('', 'Ensure the output files are well-formatted and ready for the next stage.');
  return rules.join('\n');
}

function buildRunPrompt(options, workspacePath) {
  const taskId = options['task-id'];
  if (!taskId) {
    throw new Error('Task ID is required for the run subcommand.');
  }
  const feedback = options.feedback || 'No reviewer feedback provided.';
  const root = workspacePath || 'the current working directory';
  const artifactPath = `${ARTIFACTS_DIR}/build/${taskId}.md`;
  const buildTemplate = loadPromptText('build_step.txt');
  const requirementsContent = loadArtifactContent(workspacePath, path.join(ARTIFACTS_DIR, 'requirements.md'));
  const architectureContent = loadArtifactContent(workspacePath, path.join(ARTIFACTS_DIR, 'architecture.md'));
  const planContent = loadArtifactContent(workspacePath, path.join(ARTIFACTS_DIR, 'plan.md'));
  const todoContent = loadArtifactContent(workspacePath, path.join(ARTIFACTS_DIR, 'todo.json'));

  const rules = [
    'You are Codex acting as the Code Machine Type A CLI during the build loop.',
    `Workspace root: ${root}`,
    `Task ID: ${taskId}`,
    `Reviewer feedback: ${feedback}`,
    '',
    'Instructions:',
    '- Inspect the repository, especially files referenced in .artifacts/todo.json for this task.',
    '- Implement the necessary code changes, tests, or documentation required to complete the task.',
    `- Summarize the work in ${artifactPath} with sections for Summary, Implementation Details, Validation, and Next Steps.`,
    '- If source files must be updated, edit them directly within the workspace.',
    '- Keep the summary concise but detailed enough for reviewers.',
    '',
    'Template Guidance:',
    buildTemplate || 'No template file available.',
  ];

  if (requirementsContent) {
    rules.push('', `Requirements Context (${ARTIFACTS_DIR}/requirements.md):`, requirementsContent);
  }
  if (architectureContent) {
    rules.push('', `Architecture Context (${ARTIFACTS_DIR}/architecture.md):`, architectureContent);
  }
  if (planContent) {
    rules.push('', `Plan Context (${ARTIFACTS_DIR}/plan.md):`, planContent);
  }
  if (todoContent) {
    rules.push('', `Todo Context (${ARTIFACTS_DIR}/todo.json):`, todoContent);
  }

  return rules.join('\n');
}

function loadPromptText(filename, fallback = '') {
  const candidates = [
    path.join(PROMPTS_DIR, filename),
    path.join(PROMPTS_DIR, path.basename(filename)),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf8');
    }
  }
  return fallback;
}

function loadArtifactContent(workspacePath, relativePath) {
  if (!workspacePath) {
    return undefined;
  }
  try {
    const full = path.join(workspacePath, relativePath);
    if (!fs.existsSync(full)) {
      return undefined;
    }
    return fs.readFileSync(full, 'utf8');
  } catch {
    return undefined;
  }
}

module.exports = { runCodexAdapter };
