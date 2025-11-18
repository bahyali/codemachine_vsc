import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('The "Code Machine Orchestrator" extension is now active.');

	const outputChannel = vscode.window.createOutputChannel('Code Machine');
	outputChannel.appendLine('Code Machine Orchestrator activated.');
	outputChannel.show(true); // Passing true preserves focus on the editor
}

export function deactivate() {}