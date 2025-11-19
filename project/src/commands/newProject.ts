import * as vscode from 'vscode';
import { PromptPanel } from '../views/webviews/PromptPanel';
import { CliInvoker } from '../models/CliInvoker';

export function registerNewProjectCommand(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel,
    invoker: CliInvoker,
) {
    const command = vscode.commands.registerCommand('codemachine.newProject', () => {
        PromptPanel.createOrShow(context.extensionUri, outputChannel, invoker);
    });

    context.subscriptions.push(command);
}
