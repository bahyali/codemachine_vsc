import * as vscode from 'vscode';
import { WorkflowController, Phase } from './controllers/WorkflowController';
import { ArtifactWatcher } from './services/ArtifactWatcher';
import { registerNewProjectCommand } from './commands/newProject';
import { registerShowArchitecturePreviewCommand } from './commands/showArchitecturePreview';
import { TaskTreeProvider } from './views/sidebar/TaskTreeProvider';

export function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('Code Machine');
	outputChannel.appendLine('Congratulations, your extension "code-machine-orchestrator" is now active!');
	outputChannel.appendLine('Code Machine Orchestrator activated.');
	outputChannel.show(true);

	const workflowController = new WorkflowController(outputChannel);
	outputChannel.appendLine(`Workflow initialized in phase: ${Phase[workflowController.currentPhase]}`);

	// Register Tree View
	const taskTreeProvider = new TaskTreeProvider();
	const taskBoardView = vscode.window.registerTreeDataProvider('codeMachine.taskBoard', taskTreeProvider);

	const artifactWatcher = new ArtifactWatcher(workflowController, taskTreeProvider, outputChannel);

	// Register commands
	registerNewProjectCommand(context);
	registerShowArchitecturePreviewCommand(context);

	context.subscriptions.push(outputChannel, artifactWatcher, taskBoardView);
}

export function deactivate() {}