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
exports.SettingsWebviewProvider = void 0;
// Settings Webview Provider for VS Code Extension
const vscode = __importStar(require("vscode"));
class SettingsWebviewProvider {
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
        // Load initial settings
        this.loadSettings();
    }
    async handleMessage(message) {
        switch (message.command) {
            case 'updateSettings':
                await this.updateSettings(message.data);
                break;
            case 'resetSettings':
                await this.resetSettings();
                break;
            case 'exportData':
                await this.exportData();
                break;
            case 'importData':
                await this.importData();
                break;
            case 'testSync':
                await this.testSync();
                break;
        }
    }
    async loadSettings() {
        try {
            const config = vscode.workspace.getConfiguration('autoContextEngineer');
            const settingsData = {
                enabled: config.get('enabled', true),
                autoCapture: config.get('autoCapture', true),
                captureThreshold: config.get('captureThreshold', 1000),
                summarizationMethod: config.get('summarizationMethod', 'local'),
                localOnly: config.get('localOnly', true),
                syncWithBrowser: config.get('syncWithBrowser', false)
            };
            this._view?.webview.postMessage({
                command: 'updateSettings',
                data: settingsData
            });
        }
        catch (error) {
            console.error('Failed to load settings:', error);
        }
    }
    async updateSettings(settings) {
        try {
            const config = vscode.workspace.getConfiguration('autoContextEngineer');
            await config.update('enabled', settings.enabled, vscode.ConfigurationTarget.Global);
            await config.update('autoCapture', settings.autoCapture, vscode.ConfigurationTarget.Global);
            await config.update('captureThreshold', settings.captureThreshold, vscode.ConfigurationTarget.Global);
            await config.update('summarizationMethod', settings.summarizationMethod, vscode.ConfigurationTarget.Global);
            await config.update('localOnly', settings.localOnly, vscode.ConfigurationTarget.Global);
            await config.update('syncWithBrowser', settings.syncWithBrowser, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('Settings updated successfully');
        }
        catch (error) {
            console.error('Failed to update settings:', error);
            vscode.window.showErrorMessage('Failed to update settings: ' + error);
        }
    }
    async resetSettings() {
        try {
            const config = vscode.workspace.getConfiguration('autoContextEngineer');
            await config.update('enabled', undefined, vscode.ConfigurationTarget.Global);
            await config.update('autoCapture', undefined, vscode.ConfigurationTarget.Global);
            await config.update('captureThreshold', undefined, vscode.ConfigurationTarget.Global);
            await config.update('summarizationMethod', undefined, vscode.ConfigurationTarget.Global);
            await config.update('localOnly', undefined, vscode.ConfigurationTarget.Global);
            await config.update('syncWithBrowser', undefined, vscode.ConfigurationTarget.Global);
            await this.loadSettings();
            vscode.window.showInformationMessage('Settings reset to defaults');
        }
        catch (error) {
            console.error('Failed to reset settings:', error);
            vscode.window.showErrorMessage('Failed to reset settings: ' + error);
        }
    }
    async exportData() {
        try {
            const data = await this.extensionContext.services.storage.exportData();
            const jsonData = JSON.stringify(data, null, 2);
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('auto-context-engineer-export.json'),
                filters: {
                    'JSON Files': ['json']
                }
            });
            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonData, 'utf8'));
                vscode.window.showInformationMessage('Data exported successfully');
            }
        }
        catch (error) {
            console.error('Failed to export data:', error);
            vscode.window.showErrorMessage('Failed to export data: ' + error);
        }
    }
    async importData() {
        try {
            const uris = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'JSON Files': ['json']
                }
            });
            if (uris && uris.length > 0) {
                const fileContent = await vscode.workspace.fs.readFile(uris[0]);
                const jsonData = JSON.parse(fileContent.toString());
                await this.extensionContext.services.storage.importData(jsonData);
                vscode.window.showInformationMessage('Data imported successfully');
            }
        }
        catch (error) {
            console.error('Failed to import data:', error);
            vscode.window.showErrorMessage('Failed to import data: ' + error);
        }
    }
    async testSync() {
        try {
            const syncStatus = await this.extensionContext.services.sync.getSyncStatus();
            if (!syncStatus.isEnabled) {
                vscode.window.showWarningMessage('Browser sync is not enabled');
                return;
            }
            if (!syncStatus.browserConnected) {
                vscode.window.showWarningMessage('Browser extension not connected');
                return;
            }
            await this.extensionContext.services.sync.syncWithBrowser();
            vscode.window.showInformationMessage('Sync test completed successfully');
        }
        catch (error) {
            console.error('Sync test failed:', error);
            vscode.window.showErrorMessage('Sync test failed: ' + error);
        }
    }
    getHtmlForWebview(_webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auto Context Engineer Settings</title>
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
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .title {
            font-size: 18px;
            font-weight: bold;
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
        
        .setting-item {
            margin-bottom: 16px;
            padding: 12px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }
        
        .setting-label {
            font-weight: 500;
            margin-bottom: 4px;
        }
        
        .setting-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        
        .setting-control {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        input[type="checkbox"] {
            margin: 0;
        }
        
        input[type="number"], select {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 12px;
            width: 120px;
        }
        
        input[type="number"]:focus, select:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        
        .actions {
            display: flex;
            gap: 8px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        
        .action-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
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
        
        .warning {
            background: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            color: var(--vscode-inputValidation-warningForeground);
            padding: 8px 12px;
            border-radius: 3px;
            font-size: 12px;
            margin-top: 8px;
        }
        
        .info {
            background: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            color: var(--vscode-inputValidation-infoForeground);
            padding: 8px 12px;
            border-radius: 3px;
            font-size: 12px;
            margin-top: 8px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">Settings</div>
    </div>
    
    <div id="content">
        <div class="section">
            <div class="section-title">General</div>
            
            <div class="setting-item">
                <div class="setting-label">Enable Extension</div>
                <div class="setting-description">Enable or disable the Auto Context Engineer extension</div>
                <div class="setting-control">
                    <input type="checkbox" id="enabled" onchange="updateSetting('enabled', this.checked)">
                </div>
            </div>
            
            <div class="setting-item">
                <div class="setting-label">Auto Capture</div>
                <div class="setting-description">Automatically capture context when files change</div>
                <div class="setting-control">
                    <input type="checkbox" id="autoCapture" onchange="updateSetting('autoCapture', this.checked)">
                </div>
            </div>
            
            <div class="setting-item">
                <div class="setting-label">Capture Threshold</div>
                <div class="setting-description">Token threshold for automatic context capture</div>
                <div class="setting-control">
                    <input type="number" id="captureThreshold" min="100" max="10000" step="100" onchange="updateSetting('captureThreshold', parseInt(this.value))">
                    <span>tokens</span>
                </div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Summarization</div>
            
            <div class="setting-item">
                <div class="setting-label">Summarization Method</div>
                <div class="setting-description">Choose between local or cloud-based summarization</div>
                <div class="setting-control">
                    <select id="summarizationMethod" onchange="updateSetting('summarizationMethod', this.value)">
                        <option value="local">Local (TextRank)</option>
                        <option value="cloud">Cloud (API)</option>
                    </select>
                </div>
                <div class="warning" id="cloudWarning" style="display: none;">
                    Cloud summarization requires API keys and sends data to external services.
                </div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Privacy</div>
            
            <div class="setting-item">
                <div class="setting-label">Local Only Mode</div>
                <div class="setting-description">Keep all data local and never send to external services</div>
                <div class="setting-control">
                    <input type="checkbox" id="localOnly" onchange="updateSetting('localOnly', this.checked)">
                </div>
                <div class="info" id="localOnlyInfo" style="display: none;">
                    Local only mode ensures maximum privacy by keeping all data on your machine.
                </div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Browser Sync</div>
            
            <div class="setting-item">
                <div class="setting-label">Sync with Browser Extension</div>
                <div class="setting-description">Synchronize data with the browser extension</div>
                <div class="setting-control">
                    <input type="checkbox" id="syncWithBrowser" onchange="updateSetting('syncWithBrowser', this.checked)">
                </div>
                <div class="info" id="syncInfo" style="display: none;">
                    Browser sync allows sharing contexts and summaries between VS Code and your browser.
                </div>
            </div>
        </div>
        
        <div class="actions">
            <button class="action-btn" onclick="saveSettings()">Save Settings</button>
            <button class="action-btn secondary" onclick="resetSettings()">Reset to Defaults</button>
            <button class="action-btn secondary" onclick="exportData()">Export Data</button>
            <button class="action-btn secondary" onclick="importData()">Import Data</button>
            <button class="action-btn secondary" onclick="testSync()" id="testSyncBtn" style="display: none;">Test Sync</button>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        let currentSettings = {};
        
        function updateSetting(key, value) {
            currentSettings[key] = value;
            updateUI();
        }
        
        function updateUI() {
            // Show/hide warnings and info based on settings
            const cloudWarning = document.getElementById('cloudWarning');
            const localOnlyInfo = document.getElementById('localOnlyInfo');
            const syncInfo = document.getElementById('syncInfo');
            const testSyncBtn = document.getElementById('testSyncBtn');
            
            cloudWarning.style.display = currentSettings.summarizationMethod === 'cloud' ? 'block' : 'none';
            localOnlyInfo.style.display = currentSettings.localOnly ? 'block' : 'none';
            syncInfo.style.display = currentSettings.syncWithBrowser ? 'block' : 'none';
            testSyncBtn.style.display = currentSettings.syncWithBrowser ? 'inline-block' : 'none';
            
            // Disable cloud options when in local-only mode
            const summarizationMethod = document.getElementById('summarizationMethod');
            if (currentSettings.localOnly && currentSettings.summarizationMethod === 'cloud') {
                currentSettings.summarizationMethod = 'local';
                summarizationMethod.value = 'local';
            }
            summarizationMethod.disabled = currentSettings.localOnly;
        }
        
        function saveSettings() {
            vscode.postMessage({
                command: 'updateSettings',
                data: currentSettings
            });
        }
        
        function resetSettings() {
            vscode.postMessage({ command: 'resetSettings' });
        }
        
        function exportData() {
            vscode.postMessage({ command: 'exportData' });
        }
        
        function importData() {
            vscode.postMessage({ command: 'importData' });
        }
        
        function testSync() {
            vscode.postMessage({ command: 'testSync' });
        }
        
        function loadSettings(settings) {
            currentSettings = settings;
            
            document.getElementById('enabled').checked = settings.enabled;
            document.getElementById('autoCapture').checked = settings.autoCapture;
            document.getElementById('captureThreshold').value = settings.captureThreshold;
            document.getElementById('summarizationMethod').value = settings.summarizationMethod;
            document.getElementById('localOnly').checked = settings.localOnly;
            document.getElementById('syncWithBrowser').checked = settings.syncWithBrowser;
            
            updateUI();
        }
        
        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateSettings':
                    loadSettings(message.data);
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
exports.SettingsWebviewProvider = SettingsWebviewProvider;
SettingsWebviewProvider.viewType = 'autoContextEngineer.settings';
//# sourceMappingURL=settingsWebviewProvider.js.map