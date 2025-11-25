const { spawn } = require('child_process');
const { parseCliCommand, extractWorkspacePath } = require('../utils/cliArgs');
const { buildGeneratePromptContent, buildRunPromptContent } = require('../utils/typeAPromptBuilder');

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
    '--yolo',
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

function buildCodexPrompt(subcommand, options, workspacePath) {
  if (!subcommand) {
    return undefined;
  }
  if (subcommand === 'generate') {
    return buildGeneratePromptContent(options, workspacePath);
  }
  if (subcommand === 'extract-plan') {
    const merged = { ...options, until: 'todo' };
    return buildGeneratePromptContent(merged, workspacePath);
  }
  if (subcommand === 'run') {
    return buildRunPromptContent(options, workspacePath);
  }
  return undefined;
}

module.exports = { runCodexAdapter };
