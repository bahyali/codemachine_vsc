import * as vscode from 'vscode';
import { ArchitecturePreview } from '../views/webviews/ArchitecturePreview';

export function registerShowArchitecturePreviewCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('codemachine.showArchitecturePreview', () => {
        const editor = vscode.window.activeTextEditor;

        if (editor && editor.document.languageId === 'markdown') {
            const content = editor.document.getText();
            ArchitecturePreview.createOrShow(context.extensionUri, content);
        } else {
            vscode.window.showInformationMessage('Open a Markdown file to show the Architecture Preview.');
        }
    });

    context.subscriptions.push(command);
}