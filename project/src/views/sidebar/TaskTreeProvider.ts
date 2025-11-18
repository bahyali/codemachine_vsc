import * as vscode from 'vscode';

// Based on schemas/todo_schema.json
interface Task {
  id: string;
  description: string;
  status: 'pending' | 'done' | 'failed';
  dependencies?: string[];
  file_paths?: string[];
}

interface Iteration {
  iteration_id: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  tasks: Task[];
  iterations?: Iteration[];
}

type PlanItemData = Iteration | Task;

export class TaskTreeProvider implements vscode.TreeDataProvider<PlanTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<PlanTreeItem | undefined | null | void> = new vscode.EventEmitter<PlanTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<PlanTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor() {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PlanTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PlanTreeItem): Promise<PlanTreeItem[]> {
    if (element) {
      // Children of an iteration
      if (element.contextValue === 'iteration' && 'tasks' in element.data) {
        const iteration = element.data as Iteration;
        const childTasks = iteration.tasks.map(task => new PlanTreeItem(task, vscode.TreeItemCollapsibleState.None));
        const childIterations = (iteration.iterations || []).map(iter => new PlanTreeItem(iter, vscode.TreeItemCollapsibleState.Collapsed));
        return Promise.resolve([...childIterations, ...childTasks]);
      }
      // Tasks are leaf nodes
      return Promise.resolve([]);
    } else {
      // Root level
      const todoFiles = await vscode.workspace.findFiles('**/artifacts/todo.json', '**/node_modules/**', 1);
      if (todoFiles.length > 0) {
        const todoJsonUri = todoFiles[0];
        try {
          const fileContent = await vscode.workspace.fs.readFile(todoJsonUri);
          const iterations: Iteration[] = JSON.parse(Buffer.from(fileContent).toString('utf8'));
          return Promise.resolve(iterations.map(iter => new PlanTreeItem(iter, vscode.TreeItemCollapsibleState.Collapsed)));
        } catch (error) {
          console.error('Error parsing todo.json:', error);
          vscode.window.showErrorMessage('Failed to parse todo.json. Check the file for syntax errors.');
          return Promise.resolve([]);
        }
      } else {
        // No todo.json found, which is a valid state.
        return Promise.resolve([]);
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