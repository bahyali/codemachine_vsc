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
}