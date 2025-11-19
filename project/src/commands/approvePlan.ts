import * as vscode from 'vscode';
import { WorkflowController, Phase } from '../controllers/WorkflowController';
import { ARTIFACTS_DIR, ARCHITECTURE_FILENAME, REQUIREMENTS_FILENAME, TODO_FILENAME } from '../constants';

async function artifactExists(filename: string): Promise<boolean> {
    const files = await vscode.workspace.findFiles(`**/${ARTIFACTS_DIR}/${filename}`, '**/node_modules/**', 1);
    return files.length > 0;
}

export function registerApprovalCommands(context: vscode.ExtensionContext, workflowController: WorkflowController) {
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

        if (!(await artifactExists(TODO_FILENAME))) {
            vscode.window.showErrorMessage('No todo.json file found in .artifacts. Generate the plan before approving.');
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
