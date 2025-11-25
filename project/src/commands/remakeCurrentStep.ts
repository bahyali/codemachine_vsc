import * as vscode from 'vscode';
import { WorkflowController, Phase } from '../controllers/WorkflowController';
import { CliInvoker } from '../models/CliInvoker';
import { CliService } from '../services/CliService';
import { ARCHITECTURE_FILENAME, PLAN_FILENAME, REQUIREMENTS_FILENAME, ARTIFACTS_DIR } from '../constants';

type RemakeStage = 'requirements' | 'architecture' | 'plan';

interface WorkspaceInfo {
    root: string;
    uri: string;
    name: string;
}

interface RemakeDependencies {
    outputChannel: vscode.OutputChannel;
    cliInvoker: CliInvoker;
}

const stageArtifacts: Record<RemakeStage, string> = {
    requirements: REQUIREMENTS_FILENAME,
    architecture: ARCHITECTURE_FILENAME,
    plan: PLAN_FILENAME,
};

function getWorkspaceInfo(): WorkspaceInfo | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    const folder = workspaceFolders[0];
    return {
        root: folder.uri.fsPath,
        uri: folder.uri.toString(),
        name: folder.name,
    };
}

function phaseToStage(phase: Phase): RemakeStage | undefined {
    switch (phase) {
        case Phase.Specs:
            return 'requirements';
        case Phase.Arch:
            return 'architecture';
        case Phase.Plan:
            return 'plan';
        default:
            return undefined;
    }
}

async function artifactExists(filename: string): Promise<boolean> {
    const files = await vscode.workspace.findFiles(`**/${ARTIFACTS_DIR}/${filename}`, '**/node_modules/**', 1);
    return files.length > 0;
}

async function openArtifact(workspaceUri: vscode.Uri, relative: string): Promise<void> {
    const target = vscode.Uri.joinPath(workspaceUri, ARTIFACTS_DIR, relative);
    try {
        const doc = await vscode.workspace.openTextDocument(target);
        await vscode.window.showTextDocument(doc, { preview: false });
    } catch {
        // Swallow errors if the artifact cannot be opened (e.g., not created yet).
    }
}

export function registerRemakeCurrentStepCommand(
    context: vscode.ExtensionContext,
    workflowController: WorkflowController,
    deps: RemakeDependencies,
) {
    const cliService = new CliService();

    const command = vscode.commands.registerCommand('codemachine.remakeCurrentStep', async () => {
        const workspace = getWorkspaceInfo();
        if (!workspace) {
            vscode.window.showErrorMessage('Open a workspace folder to remake the current step.');
            return;
        }

        const stage = phaseToStage(workflowController.currentPhase);
        if (!stage) {
            vscode.window.showWarningMessage('Remaking is available in the Specs, Architecture, or Plan phases.');
            return;
        }

        if (stage === 'architecture' && !(await artifactExists(REQUIREMENTS_FILENAME))) {
            vscode.window.showErrorMessage(`Cannot remake architecture without ${ARTIFACTS_DIR}/${REQUIREMENTS_FILENAME}.`);
            return;
        }
        if (stage === 'plan' && !(await artifactExists(ARCHITECTURE_FILENAME))) {
            vscode.window.showErrorMessage(`Cannot remake plan without ${ARTIFACTS_DIR}/${ARCHITECTURE_FILENAME}.`);
            return;
        }

        const notes = await vscode.window.showInputBox({
            prompt: `Add notes for remaking the ${stage} (optional)`,
            placeHolder: 'e.g., Tighten auth flows and prefer Next.js over CRA',
        });
        if (notes === undefined) {
            return;
        }

        deps.outputChannel.show(true);
        const args = [
            deps.cliInvoker.scriptPath,
            'generate',
            '--project-name',
            workspace.name,
            '--workspace-uri',
            workspace.uri,
            '--until',
            stage,
        ];
        const trimmedNotes = notes.trim();
        if (trimmedNotes.length > 0) {
            args.push('--prompt', trimmedNotes);
        }

        const label = stage.charAt(0).toUpperCase() + stage.slice(1);
        const succeeded = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Remaking ${label}...`,
            cancellable: false,
        }, async () => {
            try {
                await cliService.execute(
                    deps.cliInvoker.command,
                    args,
                    deps.outputChannel,
                    workspace.root,
                    { fallbackCommands: deps.cliInvoker.fallback },
                );
                return true;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to remake ${stage}: ${message}`);
                return false;
            }
        });

        if (!succeeded) {
            return;
        }

        await openArtifact(vscode.Uri.file(workspace.root), stageArtifacts[stage]);
        const suffix = trimmedNotes.length > 0 ? ' with your notes.' : '.';
        vscode.window.showInformationMessage(`${label} remade${suffix}`);
    });

    context.subscriptions.push(command);
}
