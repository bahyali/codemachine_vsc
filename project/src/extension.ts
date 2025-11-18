import * as vscode from 'vscode';
import { WorkflowController, Phase } from './controllers/WorkflowController';
import { ArtifactWatcher } from './services/ArtifactWatcher';
import { registerNewProjectCommand } from './commands/newProject';
import { registerShowArchitecturePreviewCommand } from './commands/showArchitecturePreview';

export function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('Code Machine');
	outputChannel.appendLine('Congratulations, your extension "code-machine-orchestrator" is now active!');
	outputChannel.appendLine('Code Machine Orchestrator activated.');
	outputChannel.show(true);

	const workflowController = new WorkflowController(outputChannel);
	outputChannel.appendLine(`Workflow initialized in phase: ${Phase[workflowController.currentPhase]}`);

	const artifactWatcher = new ArtifactWatcher(workflowController, outputChannel);

	// Register commands
	registerNewProjectCommand(context);
	registerShowArchitecturePreviewCommand(context);

	context.subscriptions.push(outputChannel, artifactWatcher);
}

export function deactivate() {}