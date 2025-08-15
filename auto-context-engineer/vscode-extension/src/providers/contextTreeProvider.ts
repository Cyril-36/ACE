// Context Tree Provider for VS Code Extension Sidebar
import * as vscode from 'vscode';

import { ExtensionContext, ContextTreeItem, VSCodeContext, VSCodeSummary } from '../types';

export class ContextTreeProvider implements vscode.TreeDataProvider<ContextTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ContextTreeItem | undefined | null | void> = new vscode.EventEmitter<ContextTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ContextTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private extensionContext: ExtensionContext) {
        // Refresh tree when data changes
        this.setupDataChangeListeners();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ContextTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ContextTreeItem): Promise<ContextTreeItem[]> {
        if (!element) {
            // Root level - show main categories
            return this.getRootItems();
        }

        switch (element.contextType) {
            case 'context':
                return this.getContextChildren(element);
            case 'summary':
                return this.getSummaryChildren(element);
            case 'workspace':
                return this.getWorkspaceChildren(element);
            case 'file':
                return this.getFileChildren(element);
            default:
                return [];
        }
    }

    private async getRootItems(): Promise<ContextTreeItem[]> {
        const items: ContextTreeItem[] = [];

        // Recent Contexts section
        const recentContexts = await this.extensionContext.services.storage.getRecentContexts(5);
        if (recentContexts.length > 0) {
            items.push({
                label: `Recent Contexts (${recentContexts.length})`,
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                contextType: 'context',
                iconPath: new vscode.ThemeIcon('history'),
                children: recentContexts.map((context: VSCodeContext) => this.createContextItem(context))
            });
        }

        // Recent Summaries section
        const recentSummaries = await this.extensionContext.services.storage.getRecentSummaries(5);
        if (recentSummaries.length > 0) {
            items.push({
                label: `Recent Summaries (${recentSummaries.length})`,
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                contextType: 'summary',
                iconPath: new vscode.ThemeIcon('symbol-text'),
                children: recentSummaries.map((summary: VSCodeSummary) => this.createSummaryItem(summary))
            });
        }

        // Workspaces section
        const workspaces = await this.getWorkspaceGroups();
        if (workspaces.length > 0) {
            items.push({
                label: `Workspaces (${workspaces.length})`,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                contextType: 'workspace',
                iconPath: new vscode.ThemeIcon('folder'),
                children: workspaces
            });
        }

        // Storage Stats
        const stats = await this.extensionContext.services.storage.getStorageStats();
        items.push({
            label: `Storage: ${this.formatBytes(stats.totalSize)}`,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextType: 'context',
            iconPath: new vscode.ThemeIcon('database'),
            tooltip: `${stats.totalContexts} contexts, ${stats.totalSummaries} summaries`
        });

        return items;
    }

    private async getContextChildren(element: ContextTreeItem): Promise<ContextTreeItem[]> {
        if (element.children) {
            return element.children;
        }
        return [];
    }

    private async getSummaryChildren(element: ContextTreeItem): Promise<ContextTreeItem[]> {
        if (element.children) {
            return element.children;
        }
        return [];
    }

    private async getWorkspaceChildren(element: ContextTreeItem): Promise<ContextTreeItem[]> {
        if (element.children) {
            return element.children;
        }
        return [];
    }

    private async getFileChildren(element: ContextTreeItem): Promise<ContextTreeItem[]> {
        if (element.children) {
            return element.children;
        }
        return [];
    }

    private createContextItem(context: VSCodeContext): ContextTreeItem {
        const fileName = context.metadata.fileName || 'Untitled';
        const timeAgo = this.getTimeAgo(context.timestamp);
        
        return {
            label: fileName,
            description: `${context.type} • ${timeAgo}`,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextType: 'context',
            data: context,
            iconPath: this.getContextIcon(context),
            tooltip: this.createContextTooltip(context),
            command: {
                command: 'autoContextEngineer.openContext',
                title: 'Open Context',
                arguments: [context]
            }
        };
    }

    private createSummaryItem(summary: VSCodeSummary): ContextTreeItem {
        const timeAgo = this.getTimeAgo(summary.timestamp);
        const quality = Math.round(summary.quality.overall * 100);
        
        return {
            label: `Summary (${summary.contextIds.length} contexts)`,
            description: `${quality}% • ${timeAgo}`,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextType: 'summary',
            data: summary,
            iconPath: new vscode.ThemeIcon('symbol-text'),
            tooltip: this.createSummaryTooltip(summary),
            command: {
                command: 'autoContextEngineer.openSummary',
                title: 'Open Summary',
                arguments: [summary]
            }
        };
    }

    private async getWorkspaceGroups(): Promise<ContextTreeItem[]> {
        const contexts = await this.extensionContext.services.storage.getContexts();
        const workspaceGroups = new Map<string, VSCodeContext[]>();

        // Group contexts by workspace
        contexts.forEach((context: VSCodeContext) => {
            const workspace = context.metadata.workspaceName || 'Unknown';
            if (!workspaceGroups.has(workspace)) {
                workspaceGroups.set(workspace, []);
            }
            workspaceGroups.get(workspace)!.push(context);
        });

        // Create workspace items
        const workspaceItems: ContextTreeItem[] = [];
        workspaceGroups.forEach((workspaceContexts, workspaceName) => {
            const recentContexts = workspaceContexts
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, 10);

            workspaceItems.push({
                label: workspaceName,
                description: `${workspaceContexts.length} contexts`,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                contextType: 'workspace',
                iconPath: new vscode.ThemeIcon('folder'),
                children: recentContexts.map(context => this.createContextItem(context))
            });
        });

        return workspaceItems.sort((a, b) => {
            const aLabel = typeof a.label === 'string' ? a.label : a.label?.label || '';
            const bLabel = typeof b.label === 'string' ? b.label : b.label?.label || '';
            return aLabel.localeCompare(bLabel);
        });
    }

    private getContextIcon(context: VSCodeContext): vscode.ThemeIcon {
        switch (context.type) {
            case 'file':
                return new vscode.ThemeIcon('file');
            case 'selection':
                return new vscode.ThemeIcon('selection');
            case 'workspace':
                return new vscode.ThemeIcon('folder');
            case 'session':
                return new vscode.ThemeIcon('clock');
            default:
                return new vscode.ThemeIcon('file-text');
        }
    }

    private createContextTooltip(context: VSCodeContext): string {
        const lines = [
            `Type: ${context.type}`,
            `File: ${context.metadata.fileName || 'Unknown'}`,
            `Language: ${context.metadata.language || 'Unknown'}`,
            `Workspace: ${context.metadata.workspaceName || 'Unknown'}`,
            `Tokens: ${context.tokens}`,
            `Created: ${context.timestamp.toLocaleString()}`,
            `Tags: ${context.metadata.tags.join(', ') || 'None'}`
        ];

        if (context.metadata.gitBranch) {
            lines.push(`Git Branch: ${context.metadata.gitBranch}`);
        }

        return lines.join('\n');
    }

    private createSummaryTooltip(summary: VSCodeSummary): string {
        const lines = [
            `Algorithm: ${summary.algorithm}`,
            `Contexts: ${summary.contextIds.length}`,
            `Quality: ${Math.round(summary.quality.overall * 100)}%`,
            `Compression: ${Math.round(summary.compressionRatio * 100)}%`,
            `Processing Time: ${summary.metadata.processingTime}ms`,
            `Created: ${summary.timestamp.toLocaleString()}`
        ];

        if (summary.metadata.workspaceName) {
            lines.push(`Workspace: ${summary.metadata.workspaceName}`);
        }

        if (summary.metadata.language) {
            lines.push(`Language: ${summary.metadata.language}`);
        }

        return lines.join('\n');
    }

    private getTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) {
            return 'just now';
        } else if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    private setupDataChangeListeners(): void {
        // Listen for storage changes and refresh the tree
        // This is a simplified implementation - in practice, you'd want more granular updates
        
        // Refresh every 30 seconds to show updated data
        setInterval(() => {
            this.refresh();
        }, 30000);
    }

    // Command handlers (to be registered in extension.ts)
    async openContext(context: VSCodeContext): Promise<void> {
        try {
            // Create a new document with the context content
            const document = await vscode.workspace.openTextDocument({
                content: context.content,
                language: context.metadata.language || 'plaintext'
            });
            
            await vscode.window.showTextDocument(document);
        } catch (error) {
            console.error('Failed to open context:', error);
            vscode.window.showErrorMessage('Failed to open context: ' + error);
        }
    }

    async openSummary(summary: VSCodeSummary): Promise<void> {
        try {
            // Create a new document with the summary content
            const document = await vscode.workspace.openTextDocument({
                content: summary.content,
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(document);
        } catch (error) {
            console.error('Failed to open summary:', error);
            vscode.window.showErrorMessage('Failed to open summary: ' + error);
        }
    }
}