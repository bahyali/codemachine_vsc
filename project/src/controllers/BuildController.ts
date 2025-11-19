import * as vscode from 'vscode';
import { CliService } from '../services/CliService';
import { GitService } from '../services/GitService';
import { ReviewController } from './ReviewController';
import { CliInvoker } from '../models/CliInvoker';

export class BuildController {
    private currentTaskId: string | undefined;

    constructor(
        private readonly cliService: CliService,
        private readonly gitService: GitService,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly workspaceRoot: string,
        private readonly reviewController: ReviewController,
        private readonly cliInvoker: CliInvoker,
    ) {}

    public getCurrentTaskId(): string | undefined {
        return this.currentTaskId;
    }

    public clearCurrentTaskId(): void {
        this.currentTaskId = undefined;
    }

    private async executeTask(taskId: string, feedback?: string): Promise<void> {
        this.outputChannel.appendLine(`\n--- Running Task: ${taskId} ---`);
        if (feedback) {
            this.outputChannel.appendLine(`> With feedback: ${feedback}`);
        }
        try {
            const workspaceUri = vscode.Uri.file(this.workspaceRoot).toString();
            const args = ['run', '--task-id', taskId, '--workspace-uri', workspaceUri];
            if (feedback) {
                // Assuming feedback is passed as an argument. The exact format might need adjustment
                // based on the CLI's implementation.
                args.push('--feedback', feedback);
            }

            await this.cliService.execute(
                this.cliInvoker.command,
                [this.cliInvoker.scriptPath, ...args],
                this.outputChannel,
                this.workspaceRoot,
                { fallbackCommands: this.cliInvoker.fallback },
            );
            
            this.outputChannel.appendLine(`Task ${taskId} completed successfully.`);
            
            await this.gitService.stageAllChanges();
            this.outputChannel.appendLine(`Changes for task ${taskId} staged.`);

            await this.gitService.commit(`feat(${taskId}): apply automated changes`);
            this.outputChannel.appendLine(`Committed results for task ${taskId}.`);
            await this.reviewController.logDiffForLastCommit(this.outputChannel);

            vscode.window.showInformationMessage(`Task ${taskId} finished. Diff logged to Code Machine output.`);

        } catch (error) {
            const errorMessage = `Failed to run task ${taskId}: ${error instanceof Error ? error.message : String(error)}`;
            this.outputChannel.appendLine(errorMessage);
            vscode.window.showErrorMessage(errorMessage);
            // If the task fails, there's no active task to review.
            this.currentTaskId = undefined;
        }
    }

    public async runTask(taskId: string): Promise<void> {
        this.currentTaskId = taskId;
        await this.executeTask(taskId);
    }

    public async retryTask(taskId: string, feedback: string): Promise<void> {
        this.currentTaskId = taskId;
        await this.executeTask(taskId, feedback);
    }
}
