import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { GitService } from '../services/GitService';
import { ARTIFACTS_DIR } from '../constants';

export class ReviewController {
    constructor(
        private readonly gitService: GitService,
        private readonly workspaceRoot: string,
    ) {}

    public async showDiffForStagedChanges(): Promise<void> {
        try {
            const stagedFiles = await this.gitService.getStagedChanges();
            if (stagedFiles.length === 0) {
                console.log('No staged changes to show.');
                return;
            }

            // Open the diff for the first file. VS Code's SCM view will show the rest.
            const firstFile = stagedFiles[0];
            const fileUri = vscode.Uri.file(path.join(this.workspaceRoot, firstFile));

            await vscode.commands.executeCommand('git.openChange', fileUri);
        } catch (error) {
            const errorMessage = `Failed to show diff for staged changes: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMessage);
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    public async logDiffForLastCommit(outputChannel: vscode.OutputChannel): Promise<void> {
        try {
            const diff = await this.gitService.getDiff();
            if (!diff) {
                outputChannel.appendLine('No diff available for the last commit.');
                return;
            }
            const diffPath = await this.persistDiff(diff);
            if (diffPath) {
                const doc = await vscode.workspace.openTextDocument(diffPath);
                await vscode.window.showTextDocument(doc, { preview: true });
            }
        } catch (error) {
            const message = `Failed to retrieve last commit diff: ${error instanceof Error ? error.message : String(error)}`;
            console.error(message);
            vscode.window.showErrorMessage(message);
        }
    }

    private async persistDiff(diff: string): Promise<string | undefined> {
        const debugDir = path.join(this.workspaceRoot, ARTIFACTS_DIR, 'debug', 'diffs');
        try {
            await fs.mkdir(debugDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filePath = path.join(debugDir, `diff-${timestamp}.patch`);
            await fs.writeFile(filePath, diff, 'utf8');
            return filePath;
        } catch (error) {
            const message = `Failed to write diff snapshot: ${error instanceof Error ? error.message : String(error)}`;
            console.error(message);
        }

        return undefined;
    }
}
