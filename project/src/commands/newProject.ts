import * as vscode from 'vscode';
import { PromptPanel } from '../views/webviews/PromptPanel';

export function registerNewProjectCommand(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel,
    pythonCommand: string,
    pythonFallback: string[],
) {
    const command = vscode.commands.registerCommand('codemachine.newProject', () => {
        PromptPanel.createOrShow(context.extensionUri, outputChannel, pythonCommand, pythonFallback);
    });

    context.subscriptions.push(command);
}
