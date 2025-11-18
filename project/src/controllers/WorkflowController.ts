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
    private readonly _onDidPhaseChange = new vscode.EventEmitter<Phase>();

    public readonly onDidPhaseChange: vscode.Event<Phase> = this._onDidPhaseChange.event;

    constructor(outputChannel: vscode.OutputChannel) {
        this._currentPhase = Phase.Concept;
        this._outputChannel = outputChannel;
    }

    public get currentPhase(): Phase {
        return this._currentPhase;
    }

    public setPhase(phase: Phase): void {
        if (this._currentPhase === phase) {
            return;
        }
        this._currentPhase = phase;
        const phaseName = Phase[phase];
        this._outputChannel.appendLine(`Phase changed to ${phaseName}`);
        this._onDidPhaseChange.fire(this._currentPhase);
        vscode.commands.executeCommand('setContext', 'codeMachine.phase', phaseName);
    }

    public updatePhaseFromArtifact(uri: vscode.Uri): void {
        const filename = path.basename(uri.fsPath);

        switch (filename) {
            case 'requirements.md':
                this.setPhase(Phase.Specs);
                break;
            case 'architecture.md':
                this.setPhase(Phase.Arch);
                break;
            case 'todo.json':
                this.setPhase(Phase.Plan);
                break;
        }
    }
}