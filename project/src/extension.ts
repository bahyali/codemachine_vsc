import * as vscode from 'vscode';
import { WorkflowController, Phase } from './controllers/WorkflowController';

export function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('Code Machine');
	outputChannel.appendLine('Congratulations, your extension "code-machine-orchestrator" is now active!');
	outputChannel.appendLine('Code Machine Orchestrator activated.');
	outputChannel.show(true);

	const workflowController = new WorkflowController();
	outputChannel.appendLine(`Workflow initialized in phase: ${Phase[workflowController.currentPhase]}`);

	context.subscriptions.push(outputChannel);
}

export function deactivate() {}