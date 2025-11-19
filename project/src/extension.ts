import * as vscode from 'vscode';
import { WorkflowController, Phase } from './controllers/WorkflowController';
import { ArtifactWatcher } from './services/ArtifactWatcher';
import { registerNewProjectCommand } from './commands/newProject';
import { registerShowArchitecturePreviewCommand } from './commands/showArchitecturePreview';
import { registerApprovalCommands } from './commands/approvePlan';
import { registerReviewCommands, ReviewDependencies } from './commands/reviewCommands';
import { registerRunBuildProcessCommand } from './commands/runBuildProcess';
import { TaskTreeProvider } from './views/sidebar/TaskTreeProvider';
import { ProjectStateProvider } from './views/sidebar/ProjectStateProvider';
import { ArtifactsTreeProvider } from './views/sidebar/ArtifactsTreeProvider';
import { BuildController } from './controllers/BuildController';
import { CliService } from './services/CliService';
import { GitService } from './services/GitService';
import { ReviewController } from './controllers/ReviewController';

export function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('Code Machine');
	outputChannel.appendLine('Congratulations, your extension "code-machine-orchestrator" is now active!');
	outputChannel.appendLine('Code Machine Orchestrator activated.');
	outputChannel.show(true);

	const workflowController = new WorkflowController(outputChannel, context.workspaceState);
	outputChannel.appendLine(`Workflow initialized in phase: ${Phase[workflowController.currentPhase]}`);
	vscode.commands.executeCommand('setContext', 'codeMachine.phase', Phase[workflowController.currentPhase]);

	// Register Tree View
	const taskTreeProvider = new TaskTreeProvider(workflowController);
	const projectStateProvider = new ProjectStateProvider(workflowController);
	const artifactsTreeProvider = new ArtifactsTreeProvider();
	const taskBoardView = vscode.window.registerTreeDataProvider('codeMachine.taskBoard', taskTreeProvider);
	const projectStateView = vscode.window.registerTreeDataProvider('codeMachine.projectState', projectStateProvider);
	const artifactsView = vscode.window.registerTreeDataProvider('codeMachine.artifacts', artifactsTreeProvider);

	const artifactWatcher = new ArtifactWatcher(workflowController, taskTreeProvider, artifactsTreeProvider, outputChannel);
	const phaseListener = workflowController.onDidPhaseChange(() => taskTreeProvider.refresh());

	// Register commands
	registerNewProjectCommand(context, outputChannel);
	registerShowArchitecturePreviewCommand(context);
    registerApprovalCommands(context, workflowController);

	const cliService = new CliService();
	let workspaceServices: ReviewDependencies | undefined;

	const ensureWorkspaceServices = (): ReviewDependencies | undefined => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return undefined;
		}

		const workspaceRoot = workspaceFolders[0].uri.fsPath;
		if (workspaceServices && workspaceServices.workspaceRoot === workspaceRoot) {
			return workspaceServices;
		}

		const gitService = new GitService(workspaceRoot);
		const reviewController = new ReviewController(gitService, workspaceRoot);
		const buildController = new BuildController(
			cliService,
			gitService,
			outputChannel,
			workspaceRoot,
			reviewController,
			context.extensionUri.fsPath,
		);

		workspaceServices = { workspaceRoot, gitService, buildController };
		outputChannel.appendLine(`Code Machine workspace set to: ${workspaceRoot}`);
		return workspaceServices;
	};

	if (!ensureWorkspaceServices()) {
		outputChannel.appendLine('Code Machine is waiting for an open folder before enabling workspace features.');
		vscode.window.showWarningMessage('Open a workspace folder to enable Code Machine commands.');
	}

	const workspaceFolderWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders || folders.length === 0) {
			workspaceServices = undefined;
			outputChannel.appendLine('All workspace folders have been closed. Code Machine commands are paused.');
			taskTreeProvider.refresh();
			artifactsTreeProvider.refresh();
			return;
		}

		ensureWorkspaceServices();
		taskTreeProvider.refresh();
		artifactsTreeProvider.refresh();
	});

	registerReviewCommands(context, () => ensureWorkspaceServices());
	const getBuildProcessDependencies = () => {
		const services = ensureWorkspaceServices();
		if (!services) {
			return undefined;
		}
		return { ...services, workflowController };
	};
	registerRunBuildProcessCommand(context, getBuildProcessDependencies);

	const runTaskCommand = vscode.commands.registerCommand('codemachine.runTask', async () => {
		const services = ensureWorkspaceServices();
		if (!services) {
			vscode.window.showErrorMessage('Open a workspace folder to run Code Machine tasks.');
			return;
		}

		// This is a placeholder to get the taskId for testing.
		// Later, this will be passed from the TreeView context menu.
		const taskId = await vscode.window.showInputBox({ prompt: 'Enter the Task ID to run' });
		if (taskId) {
			await services.buildController.runTask(taskId);
		}
	});

	context.subscriptions.push(
		outputChannel,
		artifactWatcher,
		phaseListener,
		projectStateProvider,
		taskBoardView,
		projectStateView,
		artifactsTreeProvider,
		artifactsView,
		runTaskCommand,
		workspaceFolderWatcher,
	);
}

export function deactivate() {}
