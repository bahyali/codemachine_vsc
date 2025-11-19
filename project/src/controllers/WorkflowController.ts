import * as vscode from 'vscode';
import * as path from 'path';
import { PHASE_STATE_KEY, REQUIREMENTS_FILENAME } from '../constants';

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
    private readonly storage: vscode.Memento;

    public readonly onDidPhaseChange: vscode.Event<Phase> = this._onDidPhaseChange.event;

    constructor(outputChannel: vscode.OutputChannel, storage: vscode.Memento) {
        this.storage = storage;
        this._currentPhase = this.storage.get<Phase>(PHASE_STATE_KEY, Phase.Concept);
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
        this.storage.update(PHASE_STATE_KEY, phase);
    }

    public updatePhaseFromArtifact(uri: vscode.Uri): void {
        const filename = path.basename(uri.fsPath);

        if (filename === REQUIREMENTS_FILENAME && this._currentPhase < Phase.Specs) {
            this.setPhase(Phase.Specs);
        }
    }
}
