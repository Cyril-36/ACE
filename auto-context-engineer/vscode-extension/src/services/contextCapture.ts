// Context Capture Service for VS Code Extension
import * as vscode from 'vscode';
import * as path from 'path';
import { VSCodeContext, VSCodeContextMetadata, CaptureError } from '../types';
import { StorageService } from './storage';
import { SummarizationService } from './summarization';

export class ContextCaptureService {
    private isAutoCapturing = false;
    private captureThreshold = 1000;
    private lastCaptureTime = 0;
    private debounceTimeout?: NodeJS.Timeout;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private storageService: StorageService,
        _summarizationService: SummarizationService
    ) { }

    async startAutoCapture(): Promise<void> {
        if (this.isAutoCapturing) {
            return;
        }

        this.isAutoCapturing = true;
        console.log('Auto context capture started');

        // Load configuration
        const config = vscode.workspace.getConfiguration('autoContextEngineer');
        this.captureThreshold = config.get('captureThreshold', 1000);
    }

    stopAutoCapture(): void {
        this.isAutoCapturing = false;

        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        console.log('Auto context capture stopped');
    }

    async captureCurrentContext(): Promise<VSCodeContext | null> {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                throw new CaptureError('No active editor found');
            }

            const context = await this.createContextFromEditor(activeEditor);
            await this.storageService.saveContext(context);

            console.log('Context captured:', context.id);
            return context;
        } catch (error) {
            console.error('Failed to capture context:', error);
            throw error;
        }
    }

    async captureWorkspaceContext(): Promise<VSCodeContext | null> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new CaptureError('No workspace folders found');
            }

            const context = await this.createWorkspaceContext();
            await this.storageService.saveContext(context);

            console.log('Workspace context captured:', context.id);
            return context;
        } catch (error) {
            console.error('Failed to capture workspace context:', error);
            throw error;
        }
    }

    async handleTextChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
        if (!this.isAutoCapturing || !event.document.uri.scheme.startsWith('file')) {
            return;
        }

        // Debounce text changes to avoid excessive captures
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.debounceTimeout = setTimeout(async () => {
            try {
                const tokenCount = this.estimateTokenCount(event.document.getText());
                if (tokenCount > this.captureThreshold) {
                    await this.captureCurrentContext();
                }
            } catch (error) {
                console.error('Error handling text change:', error);
            }
        }, 2000); // 2 second debounce
    }

    async handleEditorChange(_editor: vscode.TextEditor): Promise<void> {
        if (!this.isAutoCapturing) {
            return;
        }

        try {
            // Capture context when switching to a new file
            const now = Date.now();
            if (now - this.lastCaptureTime > 30000) { // 30 seconds minimum between captures
                await this.captureCurrentContext();
                this.lastCaptureTime = now;
            }
        } catch (error) {
            console.error('Error handling editor change:', error);
        }
    }

    async handleWorkspaceChange(event: vscode.WorkspaceFoldersChangeEvent): Promise<void> {
        if (!this.isAutoCapturing) {
            return;
        }

        try {
            // Capture workspace context when folders are added/removed
            if (event.added.length > 0 || event.removed.length > 0) {
                await this.captureWorkspaceContext();
            }
        } catch (error) {
            console.error('Error handling workspace change:', error);
        }
    }

    private async createContextFromEditor(editor: vscode.TextEditor): Promise<VSCodeContext> {
        const document = editor.document;
        const selection = editor.selection;

        // Get content (selection or full document)
        const content = selection.isEmpty
            ? document.getText()
            : document.getText(selection);

        // Get metadata
        const metadata = await this.createContextMetadata(editor);

        // Estimate token count
        const tokens = this.estimateTokenCount(content);

        return {
            id: this.generateContextId(),
            timestamp: new Date(),
            type: selection.isEmpty ? 'file' : 'selection',
            content,
            metadata,
            tokens
        };
    }

    private async createWorkspaceContext(): Promise<VSCodeContext> {
        // const workspaceFolders = vscode.workspace.workspaceFolders!;
        // const openTabs = this.getOpenTabs();

        // Create a summary of the workspace
        const content = await this.createWorkspaceSummary();
        const metadata = await this.createWorkspaceMetadata();
        const tokens = this.estimateTokenCount(content);

        return {
            id: this.generateContextId(),
            timestamp: new Date(),
            type: 'workspace',
            content,
            metadata,
            tokens
        };
    }

    private async createContextMetadata(editor: vscode.TextEditor): Promise<VSCodeContextMetadata> {
        const document = editor.document;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

        return {
            fileName: path.basename(document.fileName),
            filePath: document.fileName,
            language: document.languageId,
            workspaceName: workspaceFolder?.name,
            cursorPosition: editor.selection.active,
            selection: editor.selection.isEmpty ? undefined : editor.selection,
            activeEditor: document.fileName,
            openTabs: this.getOpenTabs(),
            gitBranch: await this.getGitBranch(),
            gitCommit: await this.getGitCommit(),
            tags: this.generateTags(document)
        };
    }

    private async createWorkspaceMetadata(): Promise<VSCodeContextMetadata> {
        const workspaceFolders = vscode.workspace.workspaceFolders!;
        const workspaceName = workspaceFolders[0]?.name;

        return {
            workspaceName,
            openTabs: this.getOpenTabs(),
            gitBranch: await this.getGitBranch(),
            gitCommit: await this.getGitCommit(),
            tags: ['workspace', 'summary']
        };
    }

    private async createWorkspaceSummary(): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders!;
        const openTabs = this.getOpenTabs();

        let summary = `Workspace: ${workspaceFolders[0]?.name}\n`;
        summary += `Folders: ${workspaceFolders.map((f: vscode.WorkspaceFolder) => f.name).join(', ')}\n`;
        summary += `Open Files: ${openTabs.length}\n`;

        if (openTabs.length > 0) {
            summary += `\nOpen Files:\n`;
            openTabs.forEach(tab => {
                summary += `- ${tab}\n`;
            });
        }

        // Add recent changes summary if available
        const recentContexts = await this.storageService.getRecentContexts(5);
        if (recentContexts.length > 0) {
            summary += `\nRecent Activity:\n`;
            recentContexts.forEach((context: VSCodeContext) => {
                summary += `- ${context.metadata.fileName || 'Unknown'} (${context.type})\n`;
            });
        }

        return summary;
    }

    private getOpenTabs(): string[] {
        return vscode.window.tabGroups.all
            .flatMap((group: any) => group.tabs)
            .map((tab: any) => {
                if (tab.input instanceof vscode.TabInputText) {
                    return path.basename(tab.input.uri.fsPath);
                }
                return tab.label;
            })
            .filter(Boolean);
    }

    private async getGitBranch(): Promise<string | undefined> {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
            if (!gitExtension) {
                return undefined;
            }

            const git = gitExtension.getAPI(1);
            const repositories = git.repositories;

            if (repositories.length > 0) {
                const repo = repositories[0];
                return repo.state.HEAD?.name;
            }
        } catch (error) {
            console.warn('Failed to get git branch:', error);
        }
        return undefined;
    }

    private async getGitCommit(): Promise<string | undefined> {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
            if (!gitExtension) {
                return undefined;
            }

            const git = gitExtension.getAPI(1);
            const repositories = git.repositories;

            if (repositories.length > 0) {
                const repo = repositories[0];
                return repo.state.HEAD?.commit;
            }
        } catch (error) {
            console.warn('Failed to get git commit:', error);
        }
        return undefined;
    }

    private generateTags(document: vscode.TextDocument): string[] {
        const tags: string[] = [];

        // Add language tag
        if (document.languageId) {
            tags.push(document.languageId);
        }

        // Add file type tags
        const extension = path.extname(document.fileName).toLowerCase();
        if (extension) {
            tags.push(extension.substring(1)); // Remove the dot
        }

        // Add workspace tag if available
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (workspaceFolder) {
            tags.push(workspaceFolder.name);
        }

        // Add content-based tags
        const content = document.getText().toLowerCase();
        if (content.includes('todo') || content.includes('fixme')) {
            tags.push('todo');
        }
        if (content.includes('test') || content.includes('spec')) {
            tags.push('test');
        }
        if (content.includes('config') || content.includes('setting')) {
            tags.push('config');
        }

        return tags;
    }

    private estimateTokenCount(text: string): number {
        // Simple token estimation (roughly 4 characters per token)
        return Math.ceil(text.length / 4);
    }

    private generateContextId(): string {
        return `vscode-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    dispose(): void {
        this.stopAutoCapture();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}