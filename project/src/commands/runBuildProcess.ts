import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BuildController } from '../controllers/BuildController';
import { WorkflowController, Phase } from '../controllers/WorkflowController';
import { Iteration } from '../models/task';
import { ARTIFACTS_DIR, TODO_FILENAME } from '../constants';

export interface BuildProcessDependencies {
    buildController: BuildController;
    workspaceRoot: string;
    workflowController: WorkflowController;
}

type BuildDependenciesProvider = () => BuildProcessDependencies | undefined;

export function registerRunBuildProcessCommand(context: vscode.ExtensionContext, getDependencies: BuildDependenciesProvider) {
    const disposable = vscode.commands.registerCommand('codemachine.runBuildProcess', async () => {
        const deps = getDependencies();
        if (!deps) {
            vscode.window.showErrorMessage('Open a workspace folder to run the build process.');
            return;
        }
        if (deps.workflowController.currentPhase !== Phase.Build) {
            vscode.window.showWarningMessage('Enter the Build phase before running the build process.');
            return;
        }

        const planPath = path.join(deps.workspaceRoot, ARTIFACTS_DIR, TODO_FILENAME);
        let iterations: Iteration[];
        try {
            const content = await fs.readFile(planPath, 'utf-8');
            iterations = JSON.parse(content);
        } catch (error) {
            vscode.window.showErrorMessage(`Unable to load plan from ${planPath}. Generate the plan before running the build.`);
            return;
        }

        const completed = await processIterations(iterations, deps.buildController);
        if (completed) {
            vscode.window.showInformationMessage('Build process completed for all approved iterations.');
        } else {
            vscode.window.showWarningMessage('Build process stopped.');
        }
    });

    context.subscriptions.push(disposable);
}

async function processIterations(iterations: Iteration[], buildController: BuildController): Promise<boolean> {
    for (const iteration of iterations) {
        const approval = await requestIterationApproval(iteration);
        if (approval === 'cancel') {
            return false;
        }
        if (approval === 'skip') {
            continue;
        }

        const success = await runTasksInIteration(iteration, buildController);
        if (!success) {
            return false;
        }

        if (iteration.iterations) {
            const childResult = await processIterations(iteration.iterations, buildController);
            if (!childResult) {
                return false;
            }
        }
    }
    return true;
}

async function requestIterationApproval(iteration: Iteration): Promise<'run' | 'skip' | 'cancel'> {
    const message = iteration.description
        ? `Iteration ${iteration.iteration_id}: ${iteration.description}`
        : `Iteration ${iteration.iteration_id}`;
    const selection = await vscode.window.showInformationMessage(
        `${message}\nApprove to run its tasks?`,
        { modal: true },
        'Run iteration',
        'Skip iteration',
        'Cancel build'
    );

    switch (selection) {
        case 'Run iteration':
            return 'run';
        case 'Skip iteration':
            return 'skip';
        default:
            return 'cancel';
    }
}

async function runTasksInIteration(iteration: Iteration, buildController: BuildController): Promise<boolean> {
    const tasks = iteration.tasks ?? [];
    for (const task of tasks) {
        try {
            await buildController.runTask(task.id);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed while executing task ${task.id}: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    return true;
}
