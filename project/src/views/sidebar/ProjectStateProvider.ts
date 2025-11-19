import * as vscode from 'vscode';
import { WorkflowController, Phase } from '../../controllers/WorkflowController';

type ProjectStateNode = ProjectStateItem | NextPhaseItem;

export class ProjectStateProvider implements vscode.TreeDataProvider<ProjectStateNode>, vscode.Disposable {
  private _onDidChangeTreeData: vscode.EventEmitter<ProjectStateNode | undefined | null | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<ProjectStateNode | undefined | null | void> = this._onDidChangeTreeData.event;
  private readonly phaseListener: vscode.Disposable;

  constructor(private readonly workflowController: WorkflowController) {
    this.phaseListener = this.workflowController.onDidPhaseChange(() => this.refresh());
  }

  dispose(): void {
    this.phaseListener.dispose();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProjectStateNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProjectStateNode): Promise<ProjectStateNode[]> {
    if (element) {
      return [];
    }
    const phases = Object.values(Phase).filter((value): value is Phase => typeof value === 'number');
    const currentPhase = this.workflowController.currentPhase;
    const items: ProjectStateNode[] = [];

    const nextAction = getNextPhaseAction(currentPhase);
    if (nextAction) {
      items.push(new NextPhaseItem(nextAction.label, nextAction.command));
    }

    return items.concat(phases.map(phase => new ProjectStateItem(phase, phase === currentPhase)));
  }
}

class ProjectStateItem extends vscode.TreeItem {
  constructor(public readonly phase: Phase, isCurrent: boolean) {
    super(Phase[phase], vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'project-state';
    this.description = isCurrent ? 'Current phase' : '';
    this.iconPath = new vscode.ThemeIcon(isCurrent ? 'debug-start' : 'circle-outline');
  }
}

class NextPhaseItem extends vscode.TreeItem {
  constructor(label: string, commandId: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'project-next-phase';
    this.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.orange'));
    this.description = 'Advance workflow';
    this.command = {
      command: commandId,
      title: label,
    };
  }
}

function getNextPhaseAction(phase: Phase): { label: string; command: string } | undefined {
  switch (phase) {
    case Phase.Specs:
      return { label: 'Approve Requirements', command: 'codemachine.approveRequirements' };
    case Phase.Arch:
      return { label: 'Approve Architecture', command: 'codemachine.approveArchitecture' };
    case Phase.Plan:
      return { label: 'Approve Plan & Start Build', command: 'codemachine.approvePlan' };
    default:
      return undefined;
  }
}
