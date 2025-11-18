import * as vscode from 'vscode';
import { CliService } from '../services/CliService';
import { GitService } from '../services/GitService';
import { ReviewController } from './ReviewController';

export class BuildController {
    constructor(
        private readonly cliService: CliService,
        private readonly gitService: GitService,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly workspaceRoot: string,
        private readonly reviewController: ReviewController,
    ) {}

    public async runTask(taskId: string): Promise<void> {
        this.outputChannel.appendLine(`\n--- Running Task: ${taskId} ---`);
        try {
            // In a real scenario, the path to the CLI would be configurable.
            // For now, we assume a mock script is available for testing.
            const cliPath = 'test/mocks/mock_cli.py'; // Relative to workspace root
            const args = ['run', '--task-id', taskId];

            await this.cliService.execute('python', [cliPath, ...args], this.outputChannel, this.workspaceRoot);
            
            this.outputChannel.appendLine(`Task ${taskId} completed successfully.`);
            
            // Stage the changes
            await this.gitService.stageAllChanges();
            this.outputChannel.appendLine(`Changes for task ${taskId} staged.`);

            vscode.window.showInformationMessage(`Task ${taskId} finished. Changes are staged and ready for review.`);

            await this.reviewController.showDiffForStagedChanges();

        } catch (error) {
            const errorMessage = `Failed to run task ${taskId}: ${error instanceof Error ? error.message : String(error)}`;
            this.outputChannel.appendLine(errorMessage);
            vscode.window.showErrorMessage(errorMessage);
        }
    }
}