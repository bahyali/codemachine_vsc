import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from '../services/GitService';

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
}