import * as vscode from 'vscode';
import { WorkflowController, Phase } from './controllers/WorkflowController';
import { ArtifactWatcher } from './services/ArtifactWatcher';

export function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('Code Machine');
	outputChannel.appendLine('Congratulations, your extension "code-machine-orchestrator" is now active!');
	outputChannel.appendLine('Code Machine Orchestrator activated.');
	outputChannel.show(true);

	const workflowController = new WorkflowController(outputChannel);
	outputChannel.appendLine(`Workflow initialized in phase: ${Phase[workflowController.currentPhase]}`);

	const artifactWatcher = new ArtifactWatcher(workflowController, outputChannel);

	context.subscriptions.push(outputChannel, artifactWatcher);
}

export function deactivate() {}