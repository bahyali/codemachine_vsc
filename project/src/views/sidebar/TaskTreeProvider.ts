import * as vscode from 'vscode';

import { Iteration, Task } from '../../models/task';
import { WorkflowController, Phase } from '../../controllers/WorkflowController';
import { ARTIFACTS_DIR, TODO_FILENAME } from '../../constants';

type PlanItemData = Iteration | Task;
type TaskTreeNode = PlanTreeItem | BuildProcessActionItem;

export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeNode | undefined | null | void> = new vscode.EventEmitter<TaskTreeNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TaskTreeNode | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private readonly workflowController: WorkflowController) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TaskTreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TaskTreeNode): Promise<TaskTreeNode[]> {
    if (element) {
      if (!(element instanceof PlanTreeItem)) {
        return [];
      }
      // Children of an iteration
      if (element.contextValue === 'iteration') {
        const iteration = element.data as Iteration;
        const childTasks = (iteration.tasks || []).map(task => new PlanTreeItem(task, vscode.TreeItemCollapsibleState.None));
        const childIterations = (iteration.iterations || []).map(iter => new PlanTreeItem(iter, vscode.TreeItemCollapsibleState.Collapsed));
        return Promise.resolve([...childIterations, ...childTasks]);
      }
      // Tasks are leaf nodes
      return Promise.resolve([]);
    } else {
      // Root level
      const todoFiles = await vscode.workspace.findFiles(`**/${ARTIFACTS_DIR}/${TODO_FILENAME}`, '**/node_modules/**', 1);
      if (todoFiles.length > 0) {
        const todoJsonUri = todoFiles[0];
        try {
          const fileContent = await vscode.workspace.fs.readFile(todoJsonUri);
          const iterations: Iteration[] = JSON.parse(Buffer.from(fileContent).toString('utf8'));
          const planItems = iterations.map(iter => new PlanTreeItem(iter, vscode.TreeItemCollapsibleState.Collapsed));
          return Promise.resolve([new BuildProcessActionItem(true, this.workflowController.currentPhase === Phase.Build), ...planItems]);
        } catch (error) {
          console.error('Error parsing todo.json:', error);
          vscode.window.showErrorMessage('Failed to parse todo.json. Check the file for syntax errors.');
          return Promise.resolve([new BuildProcessActionItem(false, this.workflowController.currentPhase === Phase.Build, true)]);
        }
      } else {
        // No todo.json found, which is a valid state.
        return Promise.resolve([new BuildProcessActionItem(false, this.workflowController.currentPhase === Phase.Build)]);
      }
    }
  }
}

class PlanTreeItem extends vscode.TreeItem {
  constructor(
    public readonly data: PlanItemData,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    let label = '';
    if ('iteration_id' in data) { // It's an Iteration
      label = data.iteration_id;
    } else { // It's a Task
      label = `${data.id}: ${data.description}`;
    }
    super(label, collapsibleState);

    if ('iteration_id' in data) {
      this.contextValue = 'iteration';
      this.description = data.description;
    } else {
      this.contextValue = 'task';
      this.tooltip = `${data.description}\nStatus: ${data.status}`;
      
      switch (data.status) {
        case 'done':
          this.iconPath = new vscode.ThemeIcon('check');
          break;
        case 'failed':
          this.iconPath = new vscode.ThemeIcon('error');
          break;
      }
    }
  }
}

class BuildProcessActionItem extends vscode.TreeItem {
  constructor(
    private readonly hasPlan: boolean,
    private readonly isBuildPhase: boolean,
    private readonly parseFailed: boolean = false,
  ) {
    super('Run Build Process', vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'build-process-action';
    this.iconPath = new vscode.ThemeIcon('tools', new vscode.ThemeColor(this.isEnabled() ? 'charts.yellow' : 'disabledForeground'));

    if (this.isEnabled()) {
      this.command = {
        command: 'codemachine.runBuildProcess',
        title: 'Run Build Process',
      };
      this.description = 'Approves each iteration, runs tasks automatically';
    } else if (!this.hasPlan) {
      this.description = this.parseFailed ? 'Fix plan file to enable build process' : 'Generate plan to enable build process';
    } else {
      this.description = 'Approve plan to enter build phase.';
    }
  }

  private isEnabled(): boolean {
    return this.hasPlan && this.isBuildPhase && !this.parseFailed;
  }
}
