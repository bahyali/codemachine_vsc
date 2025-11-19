const path = require('path');
const { spawn } = require('child_process');

const PYTHON_SCRIPT = path.resolve(__dirname, '../../cli/codemachine_cli.py');

function runPythonAdapter(cliArgs) {
  const customPython = process.env.CODEMACHINE_PYTHON;
  const candidates = customPython ? [customPython] : ['python', 'python3', 'py'];
  trySpawnSequential(candidates, PYTHON_SCRIPT, cliArgs);
}

function trySpawnSequential(commands, scriptPath, cliArgs) {
  if (commands.length === 0) {
    console.error('Failed to find a Python interpreter for the Code Machine CLI.');
    process.exit(1);
  }
  const command = commands[0];
  const child = spawn(command, [scriptPath, ...cliArgs], {
    stdio: 'inherit',
    env: process.env,
  });
  let spawned = false;

  child.on('error', (error) => {
    if (error.code === 'ENOENT' && commands.length > 1) {
      commands.shift();
      trySpawnSequential(commands, scriptPath, cliArgs);
    } else {
      console.error(`Failed to start adapter using "${command}": ${error.message}`);
      process.exit(1);
    }
  });

  child.on('spawn', () => {
    spawned = true;
  });

  child.on('exit', (code) => {
    if (!spawned && code !== 0 && commands.length > 1) {
      commands.shift();
      trySpawnSequential(commands, scriptPath, cliArgs);
      return;
    }
    process.exit(code ?? 1);
  });
}

module.exports = { runPythonAdapter };
