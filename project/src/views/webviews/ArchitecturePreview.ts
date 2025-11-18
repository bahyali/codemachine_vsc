import * as vscode from 'vscode';
import * as MarkdownIt from 'markdown-it';

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Manages the webview panel for previewing architecture markdown with rendered Mermaid diagrams.
 */
export class ArchitecturePreview {
    public static currentPanel: ArchitecturePreview | undefined;

    public static readonly viewType = 'architecturePreview';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _markdownContent: string;

    public static createOrShow(extensionUri: vscode.Uri, markdownContent: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it and update its content.
        if (ArchitecturePreview.currentPanel) {
            ArchitecturePreview.currentPanel._markdownContent = markdownContent;
            ArchitecturePreview.currentPanel._update();
            ArchitecturePreview.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            ArchitecturePreview.viewType,
            'Architecture Preview',
            column || vscode.ViewColumn.One,
            {
                // Enable javascript in the webview
                enableScripts: true,
            }
        );

        ArchitecturePreview.currentPanel = new ArchitecturePreview(panel, extensionUri, markdownContent);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, markdownContent: string) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._markdownContent = markdownContent;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public dispose() {
        ArchitecturePreview.currentPanel = undefined;

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
        this._panel.title = 'Architecture Preview';
        this._panel.webview.html = this._getHtmlForWebview(webview, this._markdownContent);
    }

    private _getHtmlForWebview(webview: vscode.Webview, markdownContent: string): string {
        const nonce = getNonce();
        const md = new MarkdownIt();

        // Simple replacement strategy:
        // Find all mermaid blocks and wrap them in the required div.
        // Let markdown-it render the rest.
        const processedContent = markdownContent.replace(/```mermaid([\s\S]*?)```/g, (match, mermaidCode) => {
            return `<div class="mermaid">${mermaidCode.trim()}</div>`;
        });

        const htmlContent = md.render(processedContent);

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Architecture Preview</title>
                <style>
                    body {
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                        font-family: var(--vscode-font-family);
                    }
                    .mermaid {
                        /* For dark themes, mermaid svgs can have white backgrounds. This forces it to match */
                        background-color: var(--vscode-editor-background);
                        padding: 1em;
                        border-radius: 5px;
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
                <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
                <script nonce="${nonce}">
                    mermaid.initialize({ startOnLoad: true });
                </script>
            </body>
            </html>`;
    }
}