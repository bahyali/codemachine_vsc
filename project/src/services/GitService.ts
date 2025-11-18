import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';

export class GitService {
    // Making the git instance public for verification purposes in tests
    public git: SimpleGit;
    private cwd: string;

    constructor(workingDirectory: string) {
        this.cwd = workingDirectory;
        const options: Partial<SimpleGitOptions> = {
            baseDir: this.cwd,
            binary: 'git',
            maxConcurrentProcesses: 6,
        };
        this.git = simpleGit(options);
    }

    /**
     * Initializes a new Git repository in the working directory.
     * Also configures a dummy user for commits, essential for test/CI environments.
     */
    public async init(): Promise<void> {
        try {
            await this.git.init();
            // Git commits require a user name and email.
            await this.git.addConfig('user.name', 'CodeMachine');
            await this.git.addConfig('user.email', 'codemachine@example.com');
        } catch (error) {
            console.error('Failed to initialize git repository:', error);
            throw error;
        }
    }

    /**
     * Stages all changes and commits them with a given message.
     * @param message The commit message.
     */
    public async commit(message: string): Promise<void> {
        try {
            await this.git.add('./*');
            await this.git.commit(message);
        } catch (error) {
            console.error(`Failed to commit with message "${message}":`, error);
            throw error;
        }
    }

    /**
     * Resets the repository to a previous state. Defaults to undoing the last commit.
     * @param target The git ref to reset to, e.g., 'HEAD~1'.
     */
    public async resetHard(target: string = 'HEAD~1'): Promise<void> {
        try {
            await this.git.reset(['--hard', target]);
        } catch (error) {
            console.error(`Failed to reset hard to "${target}":`, error);
            throw error;
        }
    }

    /**
     * Gets the diff of the most recent commit.
     * @returns A promise that resolves with the diff content as a string.
     */
    public async getDiff(): Promise<string> {
        try {
            // 'show' with no arguments shows the last commit
            const diff = await this.git.show();
            return diff;
        } catch (error) {
            console.error('Failed to get diff:', error);
            throw error;
        }
    }
}