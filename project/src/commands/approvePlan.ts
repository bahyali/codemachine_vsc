import * as vscode from 'vscode';
import * as path from 'path';
import { WorkflowController, Phase } from '../controllers/WorkflowController';
import { ARTIFACTS_DIR, ARCHITECTURE_FILENAME, PLAN_FILENAME, REQUIREMENTS_FILENAME, TODO_FILENAME } from '../constants';
import { CliService } from '../services/CliService';

async function artifactExists(filename: string): Promise<boolean> {
    const files = await vscode.workspace.findFiles(`**/${ARTIFACTS_DIR}/${filename}`, '**/node_modules/**', 1);
    return files.length > 0;
}

interface ApprovalDependencies {
    outputChannel: vscode.OutputChannel;
    extensionPath: string;
    pythonCommand: string;
    pythonFallback: string[];
}

function getWorkspaceInfo() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    const folder = workspaceFolders[0];
    return {
        root: folder.uri.fsPath,
        uri: folder.uri.toString(),
        name: folder.name,
    };
}

export function registerApprovalCommands(
    context: vscode.ExtensionContext,
    workflowController: WorkflowController,
    deps: ApprovalDependencies,
) {
    const cliService = new CliService();
    const cliPath = path.join(deps.extensionPath, 'tools', 'cli', 'codemachine_cli.py');

    const approveRequirements = vscode.commands.registerCommand('codemachine.approveRequirements', async () => {
        if (workflowController.currentPhase !== Phase.Specs) {
            vscode.window.showWarningMessage('You must be in the Specs phase to approve requirements.');
            return;
        }

        if (!(await artifactExists(REQUIREMENTS_FILENAME))) {
            vscode.window.showErrorMessage('No requirements file found in .artifacts. Generate requirements before approving.');
            return;
        }

        workflowController.setPhase(Phase.Arch);
        vscode.window.showInformationMessage('Requirements approved. Architecture phase unlocked.');
    });

    const approveArchitecture = vscode.commands.registerCommand('codemachine.approveArchitecture', async () => {
        if (workflowController.currentPhase !== Phase.Arch) {
            vscode.window.showWarningMessage('You must be in the Architecture phase to approve the architecture.');
            return;
        }

        if (!(await artifactExists(ARCHITECTURE_FILENAME))) {
            vscode.window.showErrorMessage('No architecture file found in .artifacts. Generate architecture before approving.');
            return;
        }

        workflowController.setPhase(Phase.Plan);
        vscode.window.showInformationMessage('Architecture approved. Planning phase unlocked.');
    });

    const approvePlan = vscode.commands.registerCommand('codemachine.approvePlan', async () => {
        if (workflowController.currentPhase !== Phase.Plan) {
            vscode.window.showWarningMessage('You must be in the Plan phase to approve the plan.');
            return;
        }

        if (!(await artifactExists(PLAN_FILENAME))) {
            vscode.window.showErrorMessage('No plan.md file found in .artifacts. Generate the plan before approving.');
            return;
        }

        const workspaceInfo = getWorkspaceInfo();
        if (!workspaceInfo) {
            vscode.window.showErrorMessage('Open a workspace folder to approve the plan.');
            return;
        }

        deps.outputChannel.show(true);
        try {
            await cliService.execute(
                deps.pythonCommand,
                [
                    cliPath,
                    'extract-plan',
                    '--project-name',
                    workspaceInfo.name,
                    '--workspace-uri',
                    workspaceInfo.uri,
                    '--force',
                ],
                deps.outputChannel,
                workspaceInfo.root,
                { fallbackCommands: deps.pythonFallback },
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to convert plan to todo.json: ${message}`);
            return;
        }

        if (!(await artifactExists(TODO_FILENAME))) {
            vscode.window.showErrorMessage('Plan extraction did not produce todo.json. Check CLI output for details.');
            return;
        }

        workflowController.setPhase(Phase.Build);
        vscode.window.showInformationMessage('Plan approved. Build phase initiated.');
    });

    const resetPhase = vscode.commands.registerCommand('codemachine.resetWorkflowPhase', async () => {
        const confirmation = await vscode.window.showWarningMessage(
            'Reset Code Machine workflow back to Concept?',
            { modal: true },
            'Reset'
        );
        if (confirmation === 'Reset') {
            workflowController.setPhase(Phase.Concept);
            vscode.window.showInformationMessage('Code Machine workflow reset to Concept.');
        }
    });

    context.subscriptions.push(approveRequirements, approveArchitecture, approvePlan, resetPhase);
}
