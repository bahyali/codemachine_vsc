import * as vscode from 'vscode';
import * as path from 'path';
import { WorkflowController } from '../controllers/WorkflowController';
import { TaskTreeProvider } from '../views/sidebar/TaskTreeProvider';
import { ArtifactsTreeProvider } from '../views/sidebar/ArtifactsTreeProvider';
import { ARTIFACTS_DIR, TODO_FILENAME } from '../constants';

export class ArtifactWatcher implements vscode.Disposable {
    private _watcher: vscode.FileSystemWatcher;
    private _workflowController: WorkflowController;
    private _taskTreeProvider: TaskTreeProvider;
    private _artifactsTreeProvider?: ArtifactsTreeProvider;
    private _outputChannel: vscode.OutputChannel;

    constructor(
        workflowController: WorkflowController,
        taskTreeProvider: TaskTreeProvider,
        artifactsTreeProvider: ArtifactsTreeProvider,
        outputChannel: vscode.OutputChannel,
    ) {
        this._workflowController = workflowController;
        this._taskTreeProvider = taskTreeProvider;
        this._artifactsTreeProvider = artifactsTreeProvider;
        this._outputChannel = outputChannel;

        // A robust pattern to watch for artifacts in any subfolder of the workspace
        const globPattern = `**/${ARTIFACTS_DIR}/*.{md,json}`;
        this._watcher = vscode.workspace.createFileSystemWatcher(globPattern);

        this._watcher.onDidCreate(uri => this.onArtifactCreated(uri));
        this._watcher.onDidChange(uri => this.onArtifactChanged(uri));
        this._watcher.onDidDelete(uri => this.onArtifactDeleted(uri));
    }

    private onArtifactCreated(uri: vscode.Uri): void {
        this._outputChannel.appendLine(`Artifact created: ${uri.fsPath}`);
        this._workflowController.updatePhaseFromArtifact(uri);
        this._artifactsTreeProvider?.refresh();
        if (path.basename(uri.fsPath) === TODO_FILENAME) {
            this._taskTreeProvider.refresh();
        }
    }

    private onArtifactChanged(uri: vscode.Uri): void {
        this._outputChannel.appendLine(`Artifact changed: ${uri.fsPath}`);
        this._workflowController.updatePhaseFromArtifact(uri);
        this._artifactsTreeProvider?.refresh();
        if (path.basename(uri.fsPath) === TODO_FILENAME) {
            this._taskTreeProvider.refresh();
        }
    }

    private onArtifactDeleted(uri: vscode.Uri): void {
        this._outputChannel.appendLine(`Artifact deleted: ${uri.fsPath}`);
        this._artifactsTreeProvider?.refresh();
        if (path.basename(uri.fsPath) === TODO_FILENAME) {
            this._taskTreeProvider.refresh();
        }
    }

    public dispose() {
        this._watcher.dispose();
    }
}
