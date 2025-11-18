import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "code-machine-orchestrator" is now active!');

	const outputChannel = vscode.window.createOutputChannel('Code Machine');
	outputChannel.appendLine('Code Machine Orchestrator activated.');
	outputChannel.show(true);

	context.subscriptions.push(outputChannel);
}

export function deactivate() {}