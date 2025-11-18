import * as vscode from 'vscode';
import * as path from 'path';
import { CliService } from '../../services/CliService';

/**
 * Manages the webview panel for creating a new project.
 * This panel displays a form to capture project name and initial prompt.
 */
export class PromptPanel {
    public static currentPanel: PromptPanel | undefined;

    public static readonly viewType = 'newProject';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (PromptPanel.currentPanel) {
            PromptPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            PromptPanel.viewType,
            'Code Machine: New Project',
            column || vscode.ViewColumn.One,
            {
                // Enable javascript in the webview
                enableScripts: true,
            }
        );

        PromptPanel.currentPanel = new PromptPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'submit':
                        await this.handleSubmit(message.payload.projectName, message.payload.prompt);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private async handleSubmit(projectName: string, prompt: string) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Please open a workspace folder to create a new project.');
            return;
        }
        const workspaceFolder = workspaceFolders[0];
        const workspaceRoot = workspaceFolder.uri.fsPath;
        const outputChannel = vscode.window.createOutputChannel('Code Machine');
        const cliService = new CliService();

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating project requirements...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "Starting CLI..." });
            try {
                // This path assumes the mock CLI from I1.T3 is located in `test/mocks/`.
                const cliPath = path.join(this._extensionUri.fsPath, 'test', 'mocks', 'mock_cli.py');
                
                // The mock CLI needs to create `requirements.md` in the `cwd`.
                await cliService.execute('python', [cliPath, '--prompt', prompt, '--project-name', projectName], outputChannel, workspaceRoot);
                
                progress.report({ increment: 100, message: "Requirements generated." });
                
                // Close the webview panel
                this.dispose();

                // Open the requirements.md file
                const requirementsPath = vscode.Uri.joinPath(workspaceFolder.uri, 'requirements.md');
                const document = await vscode.workspace.openTextDocument(requirementsPath);
                await vscode.window.showTextDocument(document);

            } catch (error) {
                let errorMessage = 'An unknown error occurred.';
                if (error instanceof Error) {
                    errorMessage = error.message;
                }
                vscode.window.showErrorMessage(`Failed to generate project: ${errorMessage}`);
            }
        });
    }

    public dispose() {
        PromptPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'Code Machine: New Project';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(_webview: vscode.Webview) {
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>New Code Machine Project</title>
                <style>
                    body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); }
                    .container { padding: 20px; }
                    label { display: block; margin-bottom: 5px; }
                    input, textarea {
                        width: 100%;
                        padding: 8px;
                        margin-bottom: 15px;
                        border: 1px solid var(--vscode-input-border);
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        box-sizing: border-box; /* Important */
                    }
                    textarea {
                        resize: vertical;
                        min-height: 100px;
                    }
                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 10px 15px;
                        cursor: pointer;
                        text-align: center;
                    }
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                </style>
			</head>
			<body>
                <div class="container">
                    <h1>New Code Machine Project</h1>
                    <form id="new-project-form">
                        <label for="projectName">Project Name</label>
                        <input type="text" id="projectName" name="projectName" required />

                        <label for="prompt">Prompt</label>
                        <textarea id="prompt" name="prompt" rows="10" required></textarea>

                        <button type="submit">Generate Requirements</button>
                    </form>
                </div>

				<script nonce="${nonce}">
					(function() {
						const vscode = acquireVsCodeApi();
						const form = document.getElementById('new-project-form');

						form.addEventListener('submit', (event) => {
							event.preventDefault();
							
							const projectNameInput = document.getElementById('projectName');
							const promptInput = document.getElementById('prompt');

							if (projectNameInput && promptInput) {
                                const projectName = projectNameInput.value;
                                const prompt = promptInput.value;
								vscode.postMessage({
									command: 'submit',
									payload: {
                                        projectName,
                                        prompt
                                    }
								});
							}
						});
					}());
				</script>
			</body>
			</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}