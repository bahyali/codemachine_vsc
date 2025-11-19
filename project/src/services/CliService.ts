import * as vscode from 'vscode';
import { spawn } from 'child_process';

interface ExecuteOptions {
    fallbackCommands?: string[];
}

export class CliService {
    /**
     * Executes a command-line tool.
     * 
     * @param command The command to execute (e.g., 'python').
     * @param args An array of string arguments.
     * @param outputChannel The VS Code output channel to stream stdout and stderr to.
     * @param cwd The working directory to run the command in.
     * @param options Additional execution options such as fallback commands.
     * @returns A promise that resolves if the command exits with code 0, and rejects otherwise.
     */
    public async execute(
        command: string,
        args: string[],
        outputChannel: vscode.OutputChannel,
        cwd?: string,
        options?: ExecuteOptions,
    ): Promise<void> {
        const commandsToTry = [command, ...(options?.fallbackCommands ?? [])];
        let lastError: Error | undefined;

        for (let i = 0; i < commandsToTry.length; i++) {
            const cmd = commandsToTry[i];
            try {
                await this.runCommand(cmd, args, outputChannel, cwd);
                return;
            } catch (error) {
                const err = error as NodeJS.ErrnoException;
                lastError = err instanceof Error ? err : new Error(String(err));
                const hasMoreCommands = i < commandsToTry.length - 1;

                if (err.code === 'ENOENT' && hasMoreCommands) {
                    outputChannel.appendLine(`Command "${cmd}" not found. Trying next fallback...`);
                    continue;
                }

                throw lastError;
            }
        }

        if (lastError) {
            throw lastError;
        }
    }

    private runCommand(command: string, args: string[], outputChannel: vscode.OutputChannel, cwd?: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (cwd) {
                outputChannel.appendLine(`> Working directory: ${cwd}`);
            }
            outputChannel.appendLine(`> Running command: ${command} ${args.join(' ')}`);

            const child = spawn(command, args, { cwd });

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
