import * as vscode from 'vscode';
import { WorkflowController } from '../controllers/WorkflowController';

export class ArtifactWatcher implements vscode.Disposable {
    private _watcher: vscode.FileSystemWatcher;
    private _workflowController: WorkflowController;

    constructor(workflowController: WorkflowController) {
        this._workflowController = workflowController;

        // A robust pattern to watch for artifacts in any subfolder of the workspace
        const globPattern = '**/artifacts/*.{md,json}';
        this._watcher = vscode.workspace.createFileSystemWatcher(globPattern);

        this._watcher.onDidCreate(uri => this.onArtifactCreated(uri));
        this._watcher.onDidChange(uri => this.onArtifactChanged(uri));
        // Optional: handle deletion if needed in the future
        // this._watcher.onDidDelete(uri => this.onArtifactDeleted(uri));
    }

    private onArtifactCreated(uri: vscode.Uri): void {
        console.log(`Artifact created: ${uri.fsPath}`);
        this._workflowController.updatePhaseFromArtifact(uri);
    }

    private onArtifactChanged(uri: vscode.Uri): void {
        console.log(`Artifact changed: ${uri.fsPath}`);
        this._workflowController.updatePhaseFromArtifact(uri);
    }

    public dispose() {
        this._watcher.dispose();
    }
}