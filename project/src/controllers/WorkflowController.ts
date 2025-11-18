import * as vscode from 'vscode';
import * as path from 'path';

export enum Phase {
    Concept,
    Specs,
    Arch,
    Plan,
    Build
}

export class WorkflowController {
    private _currentPhase: Phase;
    private _outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this._currentPhase = Phase.Concept;
        this._outputChannel = outputChannel;
    }

    public get currentPhase(): Phase {
        return this._currentPhase;
    }

    public updatePhaseFromArtifact(uri: vscode.Uri): void {
        const filename = path.basename(uri.fsPath);

        switch (filename) {
            case 'requirements.md':
                this._currentPhase = Phase.Specs;
                this._outputChannel.appendLine(`Phase changed to Specs based on creation of ${filename}`);
                break;
            case 'architecture.md':
                this._currentPhase = Phase.Arch;
                this._outputChannel.appendLine(`Phase changed to Arch based on creation of ${filename}`);
                break;
            case 'todo.json':
                this._currentPhase = Phase.Plan;
                this._outputChannel.appendLine(`Phase changed to Plan based on creation of ${filename}`);
                break;
            // Add other cases as needed for plan.md, todo.json etc.
        }
    }
}