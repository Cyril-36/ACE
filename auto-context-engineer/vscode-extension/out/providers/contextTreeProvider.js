"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextTreeProvider = void 0;
// Context Tree Provider for VS Code Extension Sidebar
const vscode = __importStar(require("vscode"));
class ContextTreeProvider {
    constructor(extensionContext) {
        this.extensionContext = extensionContext;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // Refresh tree when data changes
        this.setupDataChangeListeners();
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
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
    async getRootItems() {
        const items = [];
        // Recent Contexts section
        const recentContexts = await this.extensionContext.services.storage.getRecentContexts(5);
        if (recentContexts.length > 0) {
            items.push({
                label: `Recent Contexts (${recentContexts.length})`,
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                contextType: 'context',
                iconPath: new vscode.ThemeIcon('history'),
                children: recentContexts.map((context) => this.createContextItem(context))
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
                children: recentSummaries.map((summary) => this.createSummaryItem(summary))
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
    async getContextChildren(element) {
        if (element.children) {
            return element.children;
        }
        return [];
    }
    async getSummaryChildren(element) {
        if (element.children) {
            return element.children;
        }
        return [];
    }
    async getWorkspaceChildren(element) {
        if (element.children) {
            return element.children;
        }
        return [];
    }
    async getFileChildren(element) {
        if (element.children) {
            return element.children;
        }
        return [];
    }
    createContextItem(context) {
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
    createSummaryItem(summary) {
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
    async getWorkspaceGroups() {
        const contexts = await this.extensionContext.services.storage.getContexts();
        const workspaceGroups = new Map();
        // Group contexts by workspace
        contexts.forEach((context) => {
            const workspace = context.metadata.workspaceName || 'Unknown';
            if (!workspaceGroups.has(workspace)) {
                workspaceGroups.set(workspace, []);
            }
            workspaceGroups.get(workspace).push(context);
        });
        // Create workspace items
        const workspaceItems = [];
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
    getContextIcon(context) {
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
    createContextTooltip(context) {
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
    createSummaryTooltip(summary) {
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
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        if (diffMins < 1) {
            return 'just now';
        }
        else if (diffMins < 60) {
            return `${diffMins}m ago`;
        }
        else if (diffHours < 24) {
            return `${diffHours}h ago`;
        }
        else if (diffDays < 7) {
            return `${diffDays}d ago`;
        }
        else {
            return date.toLocaleDateString();
        }
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    setupDataChangeListeners() {
        // Listen for storage changes and refresh the tree
        // This is a simplified implementation - in practice, you'd want more granular updates
        // Refresh every 30 seconds to show updated data
        setInterval(() => {
            this.refresh();
        }, 30000);
    }
    // Command handlers (to be registered in extension.ts)
    async openContext(context) {
        try {
            // Create a new document with the context content
            const document = await vscode.workspace.openTextDocument({
                content: context.content,
                language: context.metadata.language || 'plaintext'
            });
            await vscode.window.showTextDocument(document);
        }
        catch (error) {
            console.error('Failed to open context:', error);
            vscode.window.showErrorMessage('Failed to open context: ' + error);
        }
    }
    async openSummary(summary) {
        try {
            // Create a new document with the summary content
            const document = await vscode.workspace.openTextDocument({
                content: summary.content,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(document);
        }
        catch (error) {
            console.error('Failed to open summary:', error);
            vscode.window.showErrorMessage('Failed to open summary: ' + error);
        }
    }
}
exports.ContextTreeProvider = ContextTreeProvider;
//# sourceMappingURL=contextTreeProvider.js.map