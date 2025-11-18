import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BuildController } from '../controllers/BuildController';
import { GitService } from '../services/GitService';

import { Iteration, TodoPlan } from '../models/task';

/**
 * Recursively searches for a task by its ID in a nested structure of iterations and updates its status.
 * @param iterations The array of iterations to search through.
 * @param taskId The ID of the task to find.
 * @param newStatus The new status to set for the task.
 * @returns `true` if the task was found and updated, `false` otherwise.
 */
function findAndupdateTaskStatus(iterations: Iteration[], taskId: string, newStatus: 'pending' | 'done' | 'failed'): boolean {
    for (const iteration of iterations) {
        if (iteration.tasks) {
            const task = iteration.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = newStatus;
                return true;
            }
        }
        if (iteration.iterations) {
            if (findAndupdateTaskStatus(iteration.iterations, taskId, newStatus)) {
                return true;
            }
        }
    }
    return false;
}

export function registerReviewCommands(
    context: vscode.ExtensionContext,
    buildController: BuildController,
    gitService: GitService,
    workspaceRoot: string
) {
    const acceptCommand = vscode.commands.registerCommand('codemachine.acceptChanges', async () => {
        const taskId = buildController.getCurrentTaskId();
        if (!taskId) {
            vscode.window.showErrorMessage('No task is currently under review.');
            return;
        }

        try {
            const todoJsonPath = path.join(workspaceRoot, 'artifacts', 'todo.json');
            const todoJsonContent = await fs.readFile(todoJsonPath, 'utf-8');
            const plan: TodoPlan = JSON.parse(todoJsonContent);

            const updated = findAndupdateTaskStatus(plan, taskId, 'done');

            if (updated) {
                await fs.writeFile(todoJsonPath, JSON.stringify(plan, null, 2));
                vscode.window.showInformationMessage(`Task ${taskId} accepted and marked as done.`);
                
                // Commit the staged changes
                await gitService.commit(`feat: Complete task ${taskId}`);
                vscode.window.showInformationMessage(`Changes for task ${taskId} have been committed.`);

                buildController.clearCurrentTaskId();
            } else {
                vscode.window.showErrorMessage(`Task ${taskId} not found in todo.json.`);
            }
        } catch (error) {
            const errorMessage = `Failed to accept changes for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMessage);
            vscode.window.showErrorMessage(errorMessage);
        }
    });

    const rejectCommand = vscode.commands.registerCommand('codemachine.rejectChanges', async () => {
        const taskId = buildController.getCurrentTaskId();
        if (!taskId) {
            vscode.window.showErrorMessage('No task is currently under review.');
            return;
        }

        try {
            // Revert file system changes. 'HEAD' discards staged and unstaged changes.
            await gitService.resetHard('HEAD');
            vscode.window.showInformationMessage(`Changes for task ${taskId} have been reverted.`);

            const feedback = await vscode.window.showInputBox({
                prompt: `Please provide feedback for retrying task ${taskId}:`,
                placeHolder: 'e.g., "Add error handling for the user input"',
            });

            if (feedback) { // User provided feedback
                await buildController.retryTask(taskId, feedback);
            } else if (feedback === '') { // User submitted empty feedback
                vscode.window.showInformationMessage(`Task ${taskId} rejected. No feedback provided, not retrying.`);
                buildController.clearCurrentTaskId();
            } else { // User cancelled the input box (pressed Esc)
                vscode.window.showInformationMessage(`Task ${taskId} rejected and changes reverted. Retry cancelled.`);
                buildController.clearCurrentTaskId();
            }
        } catch (error) {
            const errorMessage = `Failed to reject changes for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMessage);
            vscode.window.showErrorMessage(errorMessage);
        }
    });

    context.subscriptions.push(acceptCommand, rejectCommand);
}