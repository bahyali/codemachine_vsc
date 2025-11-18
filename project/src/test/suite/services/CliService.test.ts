import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { CliService } from '../../../services/CliService';
import { EOL } from 'os';

suite('CliService Test Suite', () => {
    let cliService: CliService;
    let mockOutputChannel: vscode.OutputChannel;
    let output: string;

    // Resolve path from out/test/suite/services -> project root -> test/mocks
    const mockCliPath = path.resolve(__dirname, '../../../../test/mocks/mock_cli.py');

    setup(() => {
        output = '';
        cliService = new CliService();
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

    test('should execute mock_cli.py successfully and stream output', async () => {
        const args = ['arg1', 'arg2'];
        await cliService.execute('python3', [mockCliPath, ...args], mockOutputChannel);

        assert.ok(output.includes('> Running command: python3'), 'Should log the command being run');
        assert.ok(output.includes("MockCli: Process started."), 'Should capture start message');
        assert.ok(output.includes(`MockCli: Received arguments: ['arg1', 'arg2']`), 'Should capture arguments');
        assert.ok(output.includes("MockCli: Processing step 1 of 3..."), 'Should capture progress');
        assert.ok(output.includes("MockCli: Process completed successfully."), 'Should capture success message');
        assert.ok(output.includes('> Command finished with exit code 0.'), 'Should log successful exit code');
    });

    test('should reject promise when mock_cli.py exits with non-zero code', async () => {
        const args = ['--fail'];
        
        await assert.rejects(
            async () => {
                await cliService.execute('python3', [mockCliPath, ...args], mockOutputChannel);
            },
            (err: Error) => {
                assert.strictEqual(err.message, 'Command failed with exit code 1.');
                return true;
            },
            'Promise should have been rejected'
        );

        assert.ok(output.includes("MockCli: Simulating failure."), 'Should capture failure message');
        assert.ok(output.includes("This is an error message."), 'Should capture stderr message');
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
});