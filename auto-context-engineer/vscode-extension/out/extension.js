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
exports.getExtensionContext = exports.deactivate = exports.activate = void 0;
// VS Code Extension Entry Point for Auto Context Engineer
const vscode = __importStar(require("vscode"));
const contextCapture_1 = require("./services/contextCapture");
const summarization_1 = require("./services/summarization");
const storage_1 = require("./services/storage");
const search_1 = require("./services/search");
const sync_1 = require("./services/sync");
const contextTreeProvider_1 = require("./providers/contextTreeProvider");
const dashboardWebviewProvider_1 = require("./providers/dashboardWebviewProvider");
const settingsWebviewProvider_1 = require("./providers/settingsWebviewProvider");
let extensionContext;
async function activate(context) {
    console.log('Auto Context Engineer extension is now active!');
    // Initialize services
    const storageService = new storage_1.StorageService(context);
    const summarizationService = new summarization_1.SummarizationService();
    const searchService = new search_1.SearchService(storageService);
    const syncService = new sync_1.SyncService(storageService);
    const contextCaptureService = new contextCapture_1.ContextCaptureService(storageService, summarizationService);
    // Initialize extension context
    extensionContext = {
        vscodeContext: context,
        services: {
            storage: storageService,
            summarization: summarizationService,
            search: searchService,
            sync: syncService,
            contextCapture: contextCaptureService
        },
        state: {
            isEnabled: true,
            autoCapture: true,
            localOnly: true,
            syncWithBrowser: false
        }
    };
    // Initialize services
    await initializeServices();
    // Register providers
    registerProviders(context);
    // Register commands
    registerCommands(context);
    // Register event listeners
    registerEventListeners(context);
    // Set context for when clauses
    vscode.commands.executeCommand('setContext', 'autoContextEngineer.enabled', true);
    console.log('Auto Context Engineer extension initialized successfully');
}
exports.activate = activate;
function deactivate() {
    console.log('Auto Context Engineer extension is being deactivated');
    // Cleanup services
    if (extensionContext?.services) {
        extensionContext.services.contextCapture.dispose();
        extensionContext.services.sync.dispose();
    }
}
exports.deactivate = deactivate;
async function initializeServices() {
    try {
        // Initialize storage
        await extensionContext.services.storage.initialize();
        // Load configuration
        await loadConfiguration();
        // Initialize context capture if auto-capture is enabled
        if (extensionContext.state.autoCapture) {
            await extensionContext.services.contextCapture.startAutoCapture();
        }
        // Initialize sync service if enabled
        if (extensionContext.state.syncWithBrowser) {
            await extensionContext.services.sync.initialize();
        }
        console.log('All services initialized successfully');
    }
    catch (error) {
        console.error('Failed to initialize services:', error);
        vscode.window.showErrorMessage('Failed to initialize Auto Context Engineer: ' + error);
    }
}
function registerProviders(context) {
    // Context tree provider
    const contextTreeProvider = new contextTreeProvider_1.ContextTreeProvider(extensionContext);
    vscode.window.registerTreeDataProvider('autoContextEngineer.contextView', contextTreeProvider);
    // Dashboard webview provider
    const dashboardProvider = new dashboardWebviewProvider_1.DashboardWebviewProvider(extensionContext);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('autoContextEngineer.dashboard', dashboardProvider));
    // Settings webview provider
    const settingsProvider = new settingsWebviewProvider_1.SettingsWebviewProvider(extensionContext);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('autoContextEngineer.settings', settingsProvider));
}
function registerCommands(context) {
    // Capture context command
    const captureContextCommand = vscode.commands.registerCommand('autoContextEngineer.captureContext', async () => {
        try {
            const result = await extensionContext.services.contextCapture.captureCurrentContext();
            if (result) {
                vscode.window.showInformationMessage('Context captured successfully');
            }
        }
        catch (error) {
            console.error('Failed to capture context:', error);
            vscode.window.showErrorMessage('Failed to capture context: ' + error);
        }
    });
    // Summarize context command
    const summarizeContextCommand = vscode.commands.registerCommand('autoContextEngineer.summarizeContext', async () => {
        try {
            const contexts = await extensionContext.services.storage.getRecentContexts(10);
            if (contexts.length === 0) {
                vscode.window.showInformationMessage('No contexts available to summarize');
                return;
            }
            const result = await extensionContext.services.summarization.summarizeContexts(contexts);
            if (result) {
                vscode.window.showInformationMessage('Context summarized successfully');
            }
        }
        catch (error) {
            console.error('Failed to summarize context:', error);
            vscode.window.showErrorMessage('Failed to summarize context: ' + error);
        }
    });
    // Search context command
    const searchContextCommand = vscode.commands.registerCommand('autoContextEngineer.searchContext', async () => {
        try {
            const query = await vscode.window.showInputBox({
                prompt: 'Enter search query',
                placeHolder: 'Search contexts and summaries...'
            });
            if (query) {
                const results = await extensionContext.services.search.search(query);
                // Show results in a quick pick or webview
                showSearchResults(results);
            }
        }
        catch (error) {
            console.error('Failed to search context:', error);
            vscode.window.showErrorMessage('Failed to search context: ' + error);
        }
    });
    // Open dashboard command
    const openDashboardCommand = vscode.commands.registerCommand('autoContextEngineer.openDashboard', () => {
        vscode.commands.executeCommand('workbench.view.extension.autoContextEngineer');
    });
    // Open settings command
    const openSettingsCommand = vscode.commands.registerCommand('autoContextEngineer.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'autoContextEngineer');
    });
    // Register all commands
    context.subscriptions.push(captureContextCommand, summarizeContextCommand, searchContextCommand, openDashboardCommand, openSettingsCommand);
}
function registerEventListeners(context) {
    // Listen for configuration changes
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration('autoContextEngineer')) {
            await loadConfiguration();
            await updateServiceConfiguration();
        }
    });
    // Listen for text document changes
    const textChangeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (extensionContext.state.autoCapture && extensionContext.state.isEnabled) {
            await extensionContext.services.contextCapture.handleTextChange(event);
        }
    });
    // Listen for active editor changes
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (extensionContext.state.autoCapture && extensionContext.state.isEnabled && editor) {
            await extensionContext.services.contextCapture.handleEditorChange(editor);
        }
    });
    // Listen for workspace folder changes
    const workspaceChangeListener = vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
        if (extensionContext.state.autoCapture && extensionContext.state.isEnabled) {
            await extensionContext.services.contextCapture.handleWorkspaceChange(event);
        }
    });
    context.subscriptions.push(configChangeListener, textChangeListener, editorChangeListener, workspaceChangeListener);
}
async function loadConfiguration() {
    const config = vscode.workspace.getConfiguration('autoContextEngineer');
    extensionContext.state = {
        isEnabled: config.get('enabled', true),
        autoCapture: config.get('autoCapture', true),
        localOnly: config.get('localOnly', true),
        syncWithBrowser: config.get('syncWithBrowser', false)
    };
}
async function updateServiceConfiguration() {
    // Update context capture service
    if (extensionContext.state.autoCapture) {
        await extensionContext.services.contextCapture.startAutoCapture();
    }
    else {
        extensionContext.services.contextCapture.stopAutoCapture();
    }
    // Update sync service
    if (extensionContext.state.syncWithBrowser) {
        await extensionContext.services.sync.initialize();
    }
    else {
        extensionContext.services.sync.dispose();
    }
}
async function showSearchResults(results) {
    if (results.length === 0) {
        vscode.window.showInformationMessage('No results found');
        return;
    }
    const items = results.map(result => ({
        label: result.title || 'Untitled Context',
        description: result.snippet || '',
        detail: `Score: ${result.score.toFixed(2)} | ${new Date(result.timestamp).toLocaleString()}`,
        result
    }));
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a context to view',
        matchOnDescription: true,
        matchOnDetail: true
    });
    if (selected) {
        // Open the context in a new editor or webview
        await showContextDetails(selected.result);
    }
}
async function showContextDetails(context) {
    // Create a new untitled document with the context content
    const document = await vscode.workspace.openTextDocument({
        content: context.content || context.summary || 'No content available',
        language: context.language || 'plaintext'
    });
    await vscode.window.showTextDocument(document);
}
// Export extension context for use in other modules
function getExtensionContext() {
    return extensionContext;
}
exports.getExtensionContext = getExtensionContext;
//# sourceMappingURL=extension.js.map