import * as vscode from 'vscode';
import { spawn } from 'child_process';

export class CliService {
    /**
     * Executes a command-line tool.
     * 
     * @param command The command to execute (e.g., 'python').
     * @param args An array of string arguments.
     * @param outputChannel The VS Code output channel to stream stdout and stderr to.
     * @returns A promise that resolves if the command exits with code 0, and rejects otherwise.
     */
    public execute(command: string, args: string[], outputChannel: vscode.OutputChannel): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            outputChannel.appendLine(`> Running command: ${command} ${args.join(' ')}`);

            const child = spawn(command, args);

            // Stream stdout
            if (child.stdout) {
                child.stdout.on('data', (data: Buffer) => {
                    outputChannel.append(data.toString());
                });
            }

            // Stream stderr
            if (child.stderr) {
                child.stderr.on('data', (data: Buffer) => {
                    outputChannel.append(data.toString());
                });
            }

            // Handle spawn errors (e.g., command not found)
            child.on('error', (error) => {
                outputChannel.appendLine(`Error spawning process: ${error.message}`);
                reject(error);
            });

            // Handle process exit
            child.on('close', (code) => {
                if (code === 0) {
                    outputChannel.appendLine(`> Command finished with exit code ${code}.`);
                    resolve();
                } else {
                    const errorMessage = `Command failed with exit code ${code}.`;
                    outputChannel.appendLine(`> ${errorMessage}`);
                    reject(new Error(errorMessage));
                }
            });
        });
    }
}