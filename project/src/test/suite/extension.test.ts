import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('CodeMachine.code-machine-orchestrator'));
	});

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('CodeMachine.code-machine-orchestrator');
        if (!extension) {
            assert.fail('Extension not found');
        }
        // The extension is activated by onStartupFinished, so it should be active already.
        // If not, we can activate it manually for the test.
        if (!extension.isActive) {
            await extension.activate();
        }
        assert.ok(extension.isActive);
    });
});