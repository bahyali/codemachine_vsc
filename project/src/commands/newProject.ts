import * as vscode from 'vscode';
import { PromptPanel } from '../views/webviews/PromptPanel';

export function registerNewProjectCommand(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
    const command = vscode.commands.registerCommand('codemachine.newProject', () => {
        // This code is executed when the command is called
        PromptPanel.createOrShow(context.extensionUri, outputChannel);
    });

    context.subscriptions.push(command);
}
