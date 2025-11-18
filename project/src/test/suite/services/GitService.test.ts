import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs/promises';
import { tmpdir } from 'os';
import { GitService } from '../../../services/GitService';
import { SimpleGit, simpleGit } from 'simple-git';

suite('GitService Test Suite', () => {
    let testRepoPath: string;
    let gitService: GitService;
    let rawGit: SimpleGit; // For verification purposes

    // Create a temporary directory for a new git repo before each test
    beforeEach(async () => {
        testRepoPath = await fs.mkdtemp(path.join(tmpdir(), 'codemachine-gitservice-test-'));
        gitService = new GitService(testRepoPath);
        rawGit = simpleGit(testRepoPath);
    });

    // Clean up the temporary directory after each test
    afterEach(async () => {
        if (testRepoPath) {
            await fs.rm(testRepoPath, { recursive: true, force: true });
        }
    });

    test('should initialize a repository, commit a file, and verify the commit', async () => {
        await gitService.init();

        // Check if .git directory exists
        const gitDirExists = await fs.stat(path.join(testRepoPath, '.git')).then(s => s.isDirectory()).catch(() => false);
        assert.ok(gitDirExists, '.git directory should be created');

        // Create a file and commit it
        const testFilePath = path.join(testRepoPath, 'test.txt');
        const commitMessage = 'Initial commit';
        await fs.writeFile(testFilePath, 'hello world');
        
        await gitService.commit(commitMessage);

        // Verify the commit
        const log = await rawGit.log();
        assert.strictEqual(log.total, 1, 'Should have one commit');
        assert.strictEqual(log.latest?.message, commitMessage, 'Commit message should match');
    });

    test('should commit a change and then reset it successfully', async () => {
        // Initial setup and first commit
        await gitService.init();
        const testFilePath = path.join(testRepoPath, 'test.txt');
        const initialContent = 'This is the first version.';
        await fs.writeFile(testFilePath, initialContent);
        await gitService.commit('First commit');

        // Modify the file and make a second commit
        const secondContent = 'This is the second version.';
        await fs.writeFile(testFilePath, secondContent);
        await gitService.commit('Second commit');

        // Verify the second commit and content change
        let log = await rawGit.log();
        assert.strictEqual(log.total, 2, 'Should have two commits');
        assert.strictEqual(log.latest?.message, 'Second commit', 'Latest commit message should be "Second commit"');
        let currentContent = await fs.readFile(testFilePath, 'utf-8');
        assert.strictEqual(currentContent, secondContent, 'File content should be the second version');

        // Reset the last commit
        await gitService.resetHard();

        // Verify the reset
        log = await rawGit.log();
        assert.strictEqual(log.total, 1, 'Should have only one commit after reset');
        assert.strictEqual(log.latest?.message, 'First commit', 'Latest commit message should be "First commit"');
        
        currentContent = await fs.readFile(testFilePath, 'utf-8');
        assert.strictEqual(currentContent, initialContent, 'File content should be reverted to the first version');
    });

    test('getDiff should return the diff of the last commit', async () => {
        await gitService.init();
        const testFilePath = path.join(testRepoPath, 'test.txt');
        await fs.writeFile(testFilePath, 'line 1\n');
        await gitService.commit('First commit');

        await fs.appendFile(testFilePath, 'line 2\n');
        await gitService.commit('Second commit');

        const diff = await gitService.getDiff();

        assert.ok(diff.includes('diff --git a/test.txt b/test.txt'), 'Diff header should be present');
        assert.ok(diff.includes('+line 2'), 'Diff should show the added line');
    });
});