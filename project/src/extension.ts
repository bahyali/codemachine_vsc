import * as vscode from 'vscode';
import { WorkflowController, Phase } from './controllers/WorkflowController';
import { ArtifactWatcher } from './services/ArtifactWatcher';
import { registerNewProjectCommand } from './commands/newProject';
import { registerShowArchitecturePreviewCommand } from './commands/showArchitecturePreview';
import { registerApprovePlanCommand } from './commands/approvePlan';
import { registerReviewCommands } from './commands/reviewCommands';
import { TaskTreeProvider } from './views/sidebar/TaskTreeProvider';
import { BuildController } from './controllers/BuildController';
import { CliService } from './services/CliService';
import { GitService } from './services/GitService';
import { ReviewController } from './controllers/ReviewController';

export function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('Code Machine');
	outputChannel.appendLine('Congratulations, your extension "code-machine-orchestrator" is now active!');
	outputChannel.appendLine('Code Machine Orchestrator activated.');
	outputChannel.show(true);

	const workflowController = new WorkflowController(outputChannel);
	outputChannel.appendLine(`Workflow initialized in phase: ${Phase[workflowController.currentPhase]}`);
	vscode.commands.executeCommand('setContext', 'codeMachine.phase', Phase[workflowController.currentPhase]);

	// Register Tree View
	const taskTreeProvider = new TaskTreeProvider();
	const taskBoardView = vscode.window.registerTreeDataProvider('codeMachine.taskBoard', taskTreeProvider);

	const artifactWatcher = new ArtifactWatcher(workflowController, taskTreeProvider, outputChannel);

	// Register commands
	registerNewProjectCommand(context);
	registerShowArchitecturePreviewCommand(context);
	registerApprovePlanCommand(context, workflowController);

	const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('Code Machine requires an open folder to work.');
        return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    const cliService = new CliService();
    const gitService = new GitService(workspaceRoot);
    const reviewController = new ReviewController(gitService, workspaceRoot);
    const buildController = new BuildController(cliService, gitService, outputChannel, workspaceRoot, reviewController);

    registerReviewCommands(context, buildController, gitService, workspaceRoot);

    const runTaskCommand = vscode.commands.registerCommand('codemachine.runTask', async () => {
        // This is a placeholder to get the taskId for testing.
        // Later, this will be passed from the TreeView context menu.
        const taskId = await vscode.window.showInputBox({ prompt: 'Enter the Task ID to run' });
        if (taskId) {
            await buildController.runTask(taskId);
        }
    });

	context.subscriptions.push(outputChannel, artifactWatcher, taskBoardView, runTaskCommand);
}

export function deactivate() {}