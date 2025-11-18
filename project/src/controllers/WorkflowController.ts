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

    constructor() {
        this._currentPhase = Phase.Concept;
    }

    public get currentPhase(): Phase {
        return this._currentPhase;
    }

    public updatePhaseFromArtifact(uri: vscode.Uri): void {
        const filename = path.basename(uri.fsPath);

        switch (filename) {
            case 'requirements.md':
                this._currentPhase = Phase.Specs;
                console.log(`Phase changed to Specs based on creation of ${filename}`);
                break;
            case 'architecture.md':
                this._currentPhase = Phase.Arch;
                console.log(`Phase changed to Arch based on creation of ${filename}`);
                break;
            // Add other cases as needed for plan.md, todo.json etc.
        }
    }
}