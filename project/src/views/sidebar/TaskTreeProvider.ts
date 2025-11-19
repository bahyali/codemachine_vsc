import * as vscode from 'vscode';

import { Iteration, Task } from '../../models/task';
import { WorkflowController, Phase } from '../../controllers/WorkflowController';
import { ARTIFACTS_DIR, TODO_FILENAME } from '../../constants';
import { getActiveTaskId, isTaskCompleted } from '../../state/TaskState';

type TaskPlannerItem = { type: 'task'; task: Task };
type IterationPlannerItem = { type: 'iteration'; label: string; description?: string; children: PlannerItem[] };
type PlannerItem = IterationPlannerItem | TaskPlannerItem;
type TaskTreeNode = PlanTreeItem | BuildProcessActionItem;

export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeNode | undefined | null | void> = new vscode.EventEmitter();
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
      if (element.contextValue === 'iteration') {
        return (element.children || []).map(child =>
          new PlanTreeItem(child, child.type === 'task' ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed),
        );
      }
      return [];
    }

    const todoFiles = await vscode.workspace.findFiles(`**/${ARTIFACTS_DIR}/${TODO_FILENAME}`, '**/node_modules/**', 1);
    if (todoFiles.length === 0) {
      return [new BuildProcessActionItem(false, this.workflowController.currentPhase === Phase.Build)];
    }

    try {
      const todoJsonUri = todoFiles[0];
      const fileContent = await vscode.workspace.fs.readFile(todoJsonUri);
      const parsed = JSON.parse(Buffer.from(fileContent).toString('utf8'));
      const plannerItems = this.normalizePlannerItems(parsed);
      const nodes = plannerItems.map(item =>
        new PlanTreeItem(item, item.type === 'task' ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed),
      );
      return [new BuildProcessActionItem(true, this.workflowController.currentPhase === Phase.Build), ...nodes];
    } catch (error) {
      console.error('Error parsing todo.json:', error);
      vscode.window.showErrorMessage('Failed to parse todo.json. Check the file for syntax errors.');
      return [new BuildProcessActionItem(false, this.workflowController.currentPhase === Phase.Build, true)];
    }
  }

  private normalizePlannerItems(data: any): PlannerItem[] {
    if (Array.isArray(data) && data.every(item => item.task_id || item.id)) {
      return this.convertTasksToPlannerItems(data);
    }
    return this.convertIterations(data as Iteration[]);
  }

  private convertTasksToPlannerItems(tasks: any[]): PlannerItem[] {
    const grouped = new Map<string, { goal?: string; tasks: Task[] }>();
    for (const raw of tasks) {
      const iterationId = raw.iteration_id || 'Iteration';
      const entry = grouped.get(iterationId) || { goal: raw.iteration_goal, tasks: [] as Task[] };
      entry.goal = entry.goal || raw.iteration_goal;
      const newTask: Task = {
        id: raw.task_id || raw.id || 'task',
        description: raw.description || '',
        status: (raw.status as Task['status']) || 'pending',
        dependencies: raw.dependencies || [],
        file_paths: raw.target_files || raw.file_paths || [],
      };
      entry.tasks.push(newTask);
      grouped.set(iterationId, entry);
    }

    return Array.from(grouped.entries()).map(([iterationId, entry]) => ({
      type: 'iteration' as const,
      label: iterationId,
      description: entry.goal,
      children: entry.tasks.map(task => ({ type: 'task' as const, task })),
    }));
  }

  private convertIterations(iterations: Iteration[] | undefined): PlannerItem[] {
    return (iterations || []).map(iter => ({
      type: 'iteration' as const,
      label: iter.iteration_id,
      description: iter.description,
      children: [
        ...(iter.iterations ? this.convertIterations(iter.iterations) : []),
        ...(iter.tasks || []).map(task => ({ type: 'task' as const, task })),
      ],
    }));
  }
}

class PlanTreeItem extends vscode.TreeItem {
  public readonly children?: PlannerItem[];

  constructor(public readonly data: PlannerItem, collapsibleState: vscode.TreeItemCollapsibleState) {
    const label = data.type === 'iteration' ? data.label : `${data.task.id}: ${data.task.description}`;
    super(label, collapsibleState);

    if (data.type === 'iteration') {
      this.contextValue = 'iteration';
      this.description = data.description;
      this.children = data.children;
    } else {
      this.contextValue = 'task';
      this.tooltip = `${data.task.description}\nStatus: ${data.task.status}`;
      const status = getVisualStatus(data.task);
      if (status === 'active') {
        this.iconPath = new vscode.ThemeIcon('sync~spin');
      } else if (status === 'done') {
        this.iconPath = new vscode.ThemeIcon('check');
      } else if (status === 'failed') {
        this.iconPath = new vscode.ThemeIcon('error');
      }
    }
  }
}

function getVisualStatus(task: Task): 'pending' | 'active' | 'done' | 'failed' {
  const activeTask = getActiveTaskId();
  if (activeTask === task.id) {
    return 'active';
  }
  if (isTaskCompleted(task.id) || task.status === 'done') {
    return 'done';
  }
  if (task.status === 'failed') {
    return 'failed';
  }
  return 'pending';
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
