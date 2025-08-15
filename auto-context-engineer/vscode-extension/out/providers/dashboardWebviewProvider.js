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
exports.DashboardWebviewProvider = void 0;
// Dashboard Webview Provider for VS Code Extension
const vscode = __importStar(require("vscode"));
class DashboardWebviewProvider {
    constructor(extensionContext) {
        this.extensionContext = extensionContext;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this.extensionContext.vscodeContext.extensionUri
            ]
        };
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage((message) => this.handleMessage(message), undefined, this.extensionContext.vscodeContext.subscriptions);
        // Load initial data
        this.loadDashboardData();
        // Refresh data periodically
        setInterval(() => {
            this.loadDashboardData();
        }, 30000); // 30 seconds
    }
    async handleMessage(message) {
        switch (message.command) {
            case 'refresh':
                await this.loadDashboardData();
                break;
            case 'captureContext':
                try {
                    await this.extensionContext.services.contextCapture.captureCurrentContext();
                    vscode.window.showInformationMessage('Context captured successfully');
                    await this.loadDashboardData();
                }
                catch (error) {
                    vscode.window.showErrorMessage('Failed to capture context: ' + error);
                }
                break;
            case 'summarizeContext':
                try {
                    const contexts = await this.extensionContext.services.storage.getRecentContexts(10);
                    if (contexts.length > 0) {
                        await this.extensionContext.services.summarization.summarizeContexts(contexts);
                        vscode.window.showInformationMessage('Context summarized successfully');
                        await this.loadDashboardData();
                    }
                    else {
                        vscode.window.showInformationMessage('No contexts available to summarize');
                    }
                }
                catch (error) {
                    vscode.window.showErrorMessage('Failed to summarize context: ' + error);
                }
                break;
            case 'openContext':
                if (message.data && message.data.contextId) {
                    await this.openContext(message.data.contextId);
                }
                break;
            case 'openSummary':
                if (message.data && message.data.summaryId) {
                    await this.openSummary(message.data.summaryId);
                }
                break;
            case 'clearData':
                const result = await vscode.window.showWarningMessage('Are you sure you want to clear all data? This action cannot be undone.', 'Yes', 'No');
                if (result === 'Yes') {
                    try {
                        await this.extensionContext.services.storage.clearAllData();
                        vscode.window.showInformationMessage('All data cleared successfully');
                        await this.loadDashboardData();
                    }
                    catch (error) {
                        vscode.window.showErrorMessage('Failed to clear data: ' + error);
                    }
                }
                break;
        }
    }
    async loadDashboardData() {
        try {
            const stats = await this.extensionContext.services.storage.getStorageStats();
            const recentContexts = await this.extensionContext.services.storage.getRecentContexts(10);
            const recentSummaries = await this.extensionContext.services.storage.getRecentSummaries(5);
            const dashboardData = {
                stats,
                recentContexts,
                recentSummaries,
                searchIndex: {} // Placeholder for search index data
            };
            this._view?.webview.postMessage({
                command: 'updateData',
                data: dashboardData
            });
        }
        catch (error) {
            console.error('Failed to load dashboard data:', error);
        }
    }
    async openContext(contextId) {
        try {
            const context = await this.extensionContext.services.storage.getContext(contextId);
            if (context) {
                const document = await vscode.workspace.openTextDocument({
                    content: context.content,
                    language: context.metadata.language || 'plaintext'
                });
                await vscode.window.showTextDocument(document);
            }
        }
        catch (error) {
            console.error('Failed to open context:', error);
            vscode.window.showErrorMessage('Failed to open context: ' + error);
        }
    }
    async openSummary(summaryId) {
        try {
            const summary = await this.extensionContext.services.storage.getSummary(summaryId);
            if (summary) {
                const document = await vscode.workspace.openTextDocument({
                    content: summary.content,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(document);
            }
        }
        catch (error) {
            console.error('Failed to open summary:', error);
            vscode.window.showErrorMessage('Failed to open summary: ' + error);
        }
    }
    getHtmlForWebview(_webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auto Context Engineer Dashboard</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 16px;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .title {
            font-size: 18px;
            font-weight: bold;
        }
        
        .refresh-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .refresh-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 20px;
        }
        
        .stat-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 12px;
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }
        
        .stat-value {
            font-size: 20px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        
        .stat-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        
        .section {
            margin-bottom: 24px;
        }
        
        .section-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 12px;
            color: var(--vscode-textLink-foreground);
        }
        
        .item-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .item {
            padding: 8px 12px;
            margin-bottom: 4px;
            background: var(--vscode-list-inactiveSelectionBackground);
            border-radius: 3px;
            cursor: pointer;
            border: 1px solid transparent;
        }
        
        .item:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
        }
        
        .item-title {
            font-weight: 500;
            margin-bottom: 2px;
        }
        
        .item-meta {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        
        .actions {
            display: flex;
            gap: 8px;
            margin-top: 20px;
        }
        
        .action-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            flex: 1;
        }
        
        .action-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .action-btn.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .action-btn.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .loading {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 20px;
        }
        
        .empty-state {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 20px;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">Dashboard</div>
        <button class="refresh-btn" onclick="refresh()">Refresh</button>
    </div>
    
    <div id="content">
        <div class="loading">Loading dashboard data...</div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        let dashboardData = null;
        
        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
        
        function captureContext() {
            vscode.postMessage({ command: 'captureContext' });
        }
        
        function summarizeContext() {
            vscode.postMessage({ command: 'summarizeContext' });
        }
        
        function openContext(contextId) {
            vscode.postMessage({ 
                command: 'openContext', 
                data: { contextId } 
            });
        }
        
        function openSummary(summaryId) {
            vscode.postMessage({ 
                command: 'openSummary', 
                data: { summaryId } 
            });
        }
        
        function clearData() {
            vscode.postMessage({ command: 'clearData' });
        }
        
        function formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }
        
        function formatTimeAgo(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);
            
            if (diffMins < 1) return 'just now';
            if (diffMins < 60) return diffMins + 'm ago';
            if (diffHours < 24) return diffHours + 'h ago';
            if (diffDays < 7) return diffDays + 'd ago';
            return date.toLocaleDateString();
        }
        
        function updateDashboard(data) {
            dashboardData = data;
            const content = document.getElementById('content');
            
            content.innerHTML = \`
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">\${data.stats.totalContexts}</div>
                        <div class="stat-label">Contexts</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${data.stats.totalSummaries}</div>
                        <div class="stat-label">Summaries</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${formatBytes(data.stats.totalSize)}</div>
                        <div class="stat-label">Storage Used</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${Math.round((data.stats.usedStorage / data.stats.storageQuota) * 100)}%</div>
                        <div class="stat-label">Quota Used</div>
                    </div>
                </div>
                
                <div class="section">
                    <div class="section-title">Recent Contexts</div>
                    \${data.recentContexts.length > 0 ? 
                        '<ul class="item-list">' + 
                        data.recentContexts.map(context => \`
                            <li class="item" onclick="openContext('\${context.id}')">
                                <div class="item-title">\${context.metadata.fileName || 'Untitled'}</div>
                                <div class="item-meta">\${context.type} • \${formatTimeAgo(context.timestamp)} • \${context.tokens} tokens</div>
                            </li>
                        \`).join('') + 
                        '</ul>' 
                        : '<div class="empty-state">No contexts captured yet</div>'
                    }
                </div>
                
                <div class="section">
                    <div class="section-title">Recent Summaries</div>
                    \${data.recentSummaries.length > 0 ? 
                        '<ul class="item-list">' + 
                        data.recentSummaries.map(summary => \`
                            <li class="item" onclick="openSummary('\${summary.id}')">
                                <div class="item-title">Summary (\${summary.contextIds.length} contexts)</div>
                                <div class="item-meta">\${Math.round(summary.quality.overall * 100)}% quality • \${formatTimeAgo(summary.timestamp)}</div>
                            </li>
                        \`).join('') + 
                        '</ul>' 
                        : '<div class="empty-state">No summaries created yet</div>'
                    }
                </div>
                
                <div class="actions">
                    <button class="action-btn" onclick="captureContext()">Capture Context</button>
                    <button class="action-btn" onclick="summarizeContext()">Summarize</button>
                    <button class="action-btn secondary" onclick="clearData()">Clear Data</button>
                </div>
            \`;
        }
        
        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateData':
                    updateDashboard(message.data);
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
exports.DashboardWebviewProvider = DashboardWebviewProvider;
DashboardWebviewProvider.viewType = 'autoContextEngineer.dashboard';
//# sourceMappingURL=dashboardWebviewProvider.js.map