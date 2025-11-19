#!/usr/bin/env node

const { runPythonAdapter } = require('./adapters/pythonAdapter');
const { runCodexAdapter } = require('./adapters/codexAdapter');
const { runCodeMachineAdapter } = require('./adapters/codeMachineAdapter');

const DEFAULT_ADAPTER = process.env.CODEMACHINE_CLI_ADAPTER || 'python';

function parseArgs(argv) {
  const passthrough = [];
  let adapter = DEFAULT_ADAPTER;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--adapter' && i + 1 < argv.length) {
      adapter = argv[i + 1];
      i++;
      continue;
    }
    if (arg.startsWith('--adapter=')) {
      adapter = arg.split('=')[1];
      continue;
    }
    passthrough.push(arg);
  }
  return { adapter, passthrough };
}

function run() {
  const argv = process.argv.slice(2);
  const { adapter, passthrough } = parseArgs(argv);
  const adapters = {
    python: runPythonAdapter,
    codex: runCodexAdapter,
    codemachine: runCodeMachineAdapter,
  };
  const impl = adapters[adapter];
  if (!impl) {
    console.error(`Unknown adapter "${adapter}". Set CODEMACHINE_CLI_ADAPTER or pass --adapter to select.`);
    process.exit(1);
  }
  impl(passthrough);
}

run();
