import * as vscode from 'vscode';
import { WorkflowController, Phase } from '../controllers/WorkflowController';

export function registerApprovePlanCommand(context: vscode.ExtensionContext, workflowController: WorkflowController) {
    const command = 'codemachine.approvePlan';

    const commandHandler = () => {
        if (workflowController.currentPhase === Phase.Plan) {
            workflowController.setPhase(Phase.Build);
            vscode.window.showInformationMessage('Plan Approved. Build phase initiated.');
        } else {
            vscode.window.showWarningMessage(`Cannot approve plan. Current phase is '${Phase[workflowController.currentPhase]}', not 'Plan'.`);
        }
    };

    context.subscriptions.push(vscode.commands.registerCommand(command, commandHandler));
}