const { spawn } = require('child_process');
const { parseCliCommand, extractWorkspacePath } = require('../utils/cliArgs');
const { buildGeneratePromptContent, buildRunPromptContent } = require('../utils/typeAPromptBuilder');

const PLAN_AGENT = process.env.CODEMACHINE_PLAN_AGENT || 'planner';
const BUILD_AGENT = process.env.CODEMACHINE_BUILD_AGENT || 'builder';

function runCodeMachineAdapter(cliArgs) {
  const workspacePath = extractWorkspacePath(cliArgs);
  const { subcommand, options } = parseCliCommand(cliArgs);
  let commandArgs;
  try {
    commandArgs = buildCommandArgs(subcommand, options, workspacePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`CodeMachine adapter error: ${message}`);
    process.exit(2);
  }
  if (!commandArgs) {
    console.error('CodeMachine adapter currently supports the `generate`, `extract-plan`, and `run` subcommands.');
    process.exit(2);
  }

  const args = [];
  if (workspacePath) {
    args.push('-d', workspacePath);
  }
  args.push(...commandArgs);

  const child = spawn('codemachine', args, {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('error', (error) => {
    console.error(`Failed to start CodeMachine CLI: ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}

function buildCommandArgs(subcommand, options, workspacePath) {
  if (!subcommand) {
    return undefined;
  }
  if (subcommand === 'generate') {
    const prompt = buildGeneratePromptContent(options, workspacePath);
    return ['run', formatScriptArg(process.env.CODEMACHINE_PLAN_AGENT || PLAN_AGENT, prompt)];
  }
  if (subcommand === 'extract-plan') {
    const prompt = buildGeneratePromptContent({ ...options, until: 'todo' }, workspacePath);
    return ['run', formatScriptArg(process.env.CODEMACHINE_PLAN_AGENT || PLAN_AGENT, prompt)];
  }
  if (subcommand === 'run') {
    const prompt = buildRunPromptContent(options, workspacePath);
    return ['run', formatScriptArg(process.env.CODEMACHINE_BUILD_AGENT || BUILD_AGENT, prompt)];
  }
  return undefined;
}

function formatScriptArg(agent, prompt) {
  const escaped = prompt.replace(/"/g, '\\"');
  return `${agent} "${escaped}"`;
}

module.exports = { runCodeMachineAdapter };
