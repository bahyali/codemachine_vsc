import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { CliService } from '../../../services/CliService';
import { EOL } from 'os';
import { ARTIFACTS_DIR, ARCHITECTURE_FILENAME, PLAN_FILENAME, REQUIREMENTS_FILENAME, TODO_FILENAME } from '../../../constants';

suite('CliService Test Suite', () => {
    let cliService: CliService;
    let mockOutputChannel: vscode.OutputChannel;
    let output: string;
    let workspaceDir: string;
    let workspaceUri: string;

    // Resolve path from out/test/suite/services -> project root -> test/mocks
    const mockCliPath = path.resolve(__dirname, '../../../../test/mocks/mock_cli.py');

    setup(async () => {
        output = '';
        cliService = new CliService();
        workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-service-test-'));
        workspaceUri = vscode.Uri.file(workspaceDir).toString();
        mockOutputChannel = {
            name: 'mock',
            append: (value: string) => { output += value; },
            appendLine: (value: string) => { output += value + EOL; },
            replace: (value: string) => { output = value; },
            clear: () => { /* no-op */ },
            show: () => { /* no-op */ },
            hide: () => { /* no-op */ },
            dispose: () => { /* no-op */ }
        };
    });

    teardown(async () => {
        await fs.rm(workspaceDir, { recursive: true, force: true });
    });

    test('should generate artifacts inside .artifacts folder', async () => {
        await cliService.execute(
            'python3',
            [
                mockCliPath,
                'generate',
                '--project-name',
                'Demo Project',
                '--prompt',
                'Sample prompt',
                '--workspace-uri',
                workspaceUri,
            ],
            mockOutputChannel
        );

        const artifactsDir = path.join(workspaceDir, ARTIFACTS_DIR);
        const requirementsPath = path.join(artifactsDir, REQUIREMENTS_FILENAME);
        const architecturePath = path.join(artifactsDir, ARCHITECTURE_FILENAME);
        const planPath = path.join(artifactsDir, PLAN_FILENAME);
        const todoPath = path.join(artifactsDir, TODO_FILENAME);

        const requirementsContent = await fs.readFile(requirementsPath, 'utf-8');
        assert.ok(requirementsContent.includes('Demo Project Requirements'), 'Requirements file should mention project name');

        const todoContent = await fs.readFile(todoPath, 'utf-8');
        const todoJson = JSON.parse(todoContent);
        assert.ok(Array.isArray(todoJson), 'todo.json should be an array of iterations');

        await Promise.all([
            fs.access(architecturePath),
            fs.access(planPath),
        ]);

        assert.ok(output.includes('> Running command: python3'), 'Should log the command being run');
        assert.ok(output.includes('Mock CLI: wrote'), 'Should stream CLI output');
        assert.ok(output.includes('> Command finished with exit code 0.'), 'Should log successful exit code');
    });

    test('should reject promise when mock_cli.py exits with non-zero code', async () => {
        await assert.rejects(
            async () => {
                await cliService.execute(
                    'python3',
                    [
                        mockCliPath,
                        'generate',
                        '--project-name',
                        'Failing Project',
                        '--prompt',
                        'Sample prompt',
                        '--workspace-uri',
                        workspaceUri,
                        '--fail',
                    ],
                    mockOutputChannel
                );
            },
            (err: Error) => {
                assert.strictEqual(err.message, 'Command failed with exit code 1.');
                return true;
            },
            'Promise should have been rejected'
        );

        assert.ok(output.includes('Mock CLI: Simulating failure.'), 'Should capture failure message');
        assert.ok(output.includes('> Command failed with exit code 1.'), 'Should log failure exit code');
    });

    test('should reject promise when command does not exist', async () => {
        const nonExistentCommand = 'this_command_does_not_exist_12345';
        
        await assert.rejects(
            async () => {
                await cliService.execute(nonExistentCommand, [], mockOutputChannel);
            },
            (err: Error) => {
                assert.ok(err.message.includes('ENOENT') || err.message.includes('spawn'), 'Error message should indicate a spawn error');
                return true;
            },
            'Promise should have been rejected for non-existent command'
        );

        assert.ok(output.includes(`Error spawning process:`), 'Should log spawn error');
    });

    test('should try fallback command when primary executable is missing', async () => {
        const nonExistentCommand = 'this_command_does_not_exist_67890';
        const args = [
            mockCliPath,
            'generate',
            '--project-name',
            'Fallback Project',
            '--prompt',
            'Sample prompt',
            '--workspace-uri',
            workspaceUri,
        ];

        await cliService.execute(nonExistentCommand, args, mockOutputChannel, undefined, { fallbackCommands: ['python3'] });

        assert.ok(output.includes('Trying next fallback'), 'Should log fallback attempt');
        assert.ok(output.includes('> Running command: python3'), 'Should eventually run the fallback command');
        assert.ok(output.includes('> Command finished with exit code 0.'), 'Should complete successfully via fallback');
    });
});
