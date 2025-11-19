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

module.exports = { parseCliCommand, extractWorkspacePath };
