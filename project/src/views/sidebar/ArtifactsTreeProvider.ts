import * as vscode from 'vscode';
import * as path from 'path';
import { ARTIFACTS_DIR } from '../../constants';

type ArtifactTreeItem = ArtifactEntry | InfoEntry;

export class ArtifactsTreeProvider implements vscode.TreeDataProvider<ArtifactTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData: vscode.EventEmitter<ArtifactTreeItem | undefined | null | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<ArtifactTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    // No resources to dispose currently, but method required for interface compliance.
  }

  getTreeItem(element: ArtifactTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ArtifactTreeItem): Promise<ArtifactTreeItem[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [new InfoEntry('Open a workspace folder to view artifacts.')];
    }

    const workspaceUri = workspaceFolders[0].uri;
    const artifactsRoot = vscode.Uri.joinPath(workspaceUri, ARTIFACTS_DIR);

    try {
      await vscode.workspace.fs.stat(artifactsRoot);
    } catch {
      return [new InfoEntry('No artifacts generated yet.')];
    }

    if (element && element instanceof InfoEntry) {
      return [];
    }

    const targetUri = element instanceof ArtifactEntry ? element.resourceUri : artifactsRoot;
    const entries = await vscode.workspace.fs.readDirectory(targetUri);
    const sorted = entries.sort((a, b) => {
      if (a[1] === b[1]) {
        return a[0].localeCompare(b[0]);
      }
      return a[1] === vscode.FileType.Directory ? -1 : 1;
    });

    return sorted.map(([name, fileType]) => {
      const childUri = vscode.Uri.joinPath(targetUri, name);
      return new ArtifactEntry(childUri, fileType);
    });
  }
}

class ArtifactEntry extends vscode.TreeItem {
  constructor(public readonly resourceUri: vscode.Uri, fileType: vscode.FileType) {
    super(path.basename(resourceUri.fsPath), fileType === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    this.resourceUri = resourceUri;
    this.contextValue = fileType === vscode.FileType.Directory ? 'artifact-folder' : 'artifact-file';
    this.iconPath = fileType === vscode.FileType.Directory ? new vscode.ThemeIcon('folder') : new vscode.ThemeIcon('file');

    if (fileType === vscode.FileType.File) {
      this.command = {
        command: 'vscode.open',
        title: 'Open Artifact',
        arguments: [resourceUri],
      };
    }
  }
}

class InfoEntry extends vscode.TreeItem {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'artifact-info';
  }
}
