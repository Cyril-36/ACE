# Auto Context Engineer - VS Code Extension

Privacy-first context capture and management for developers working in VS Code.

## Features

### 🔒 Privacy-First Design
- **Local-only by default**: All data stays on your machine
- **Encrypted storage**: AES-256 encryption for all stored data
- **No telemetry**: Zero data collection or tracking
- **Explicit consent**: Clear opt-in for any cloud features

### 📝 Intelligent Context Capture
- **Automatic capture**: Monitor file changes and capture context when thresholds are reached
- **Manual capture**: Capture context on-demand with keyboard shortcuts
- **Multi-type support**: Capture files, selections, workspace summaries, and sessions
- **Smart metadata**: Include file info, git branch, workspace details, and more

### 🧠 Local Summarization
- **TextRank algorithm**: Advanced extractive summarization
- **Quality metrics**: Coherence, relevance, and completeness scoring
- **Compression tracking**: Monitor how much content is compressed
- **Fast processing**: Sub-second summarization for most content

### 🔍 Powerful Search
- **Full-text search**: Search through all contexts and summaries
- **Smart filtering**: Filter by workspace, language, tags, and date ranges
- **Relevance ranking**: TF-IDF based scoring for accurate results
- **Quick access**: Keyboard shortcuts and command palette integration

### 🔄 Browser Sync (Optional)
- **Seamless integration**: Sync data with the browser extension
- **Conflict resolution**: Smart merging of data from both sources
- **Encrypted transfer**: All sync data is encrypted in transit
- **Real-time updates**: Automatic synchronization every 30 seconds

### 📊 Analytics Dashboard
- **Usage statistics**: Track contexts, summaries, and storage usage
- **Visual insights**: Charts and graphs for usage patterns
- **Storage management**: Monitor quota usage and cleanup suggestions
- **Performance metrics**: Processing times and quality scores

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Auto Context Engineer"
4. Click Install

## Quick Start

1. **Enable the extension**: The extension is enabled by default after installation
2. **Capture context**: Use `Ctrl+Shift+C` (Cmd+Shift+C on Mac) to capture current context
3. **Search contexts**: Use `Ctrl+Shift+F` (Cmd+Shift+F on Mac) to search your contexts
4. **View dashboard**: Open the Auto Context Engineer panel in the sidebar

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Capture Current Context | `Ctrl+Shift+C` | Capture the current file or selection |
| Search Context | `Ctrl+Shift+F` | Search through all contexts and summaries |
| Summarize Context | - | Summarize recent contexts |
| Open Dashboard | - | Open the analytics dashboard |
| Open Settings | - | Open extension settings |

## Configuration

### Basic Settings

- **Enable Extension**: Turn the extension on/off
- **Auto Capture**: Automatically capture context on file changes
- **Capture Threshold**: Token count threshold for automatic capture (default: 1000)
- **Summarization Method**: Choose between local (TextRank) or cloud-based summarization
- **Local Only Mode**: Keep all data local (recommended for privacy)

### Advanced Settings

- **Sync with Browser**: Enable synchronization with the browser extension
- **Storage Management**: Configure cleanup and retention policies
- **Privacy Controls**: Fine-tune data handling and audit settings

## Privacy & Security

### Data Storage
- All data is stored locally in VS Code's global storage
- Data is encrypted using AES-256 encryption
- No data is sent to external servers by default
- You control all data retention and cleanup

### Cloud Features (Optional)
- Cloud summarization requires explicit opt-in
- You provide your own API keys (OpenAI, Claude, Gemini)
- All cloud requests are logged for transparency
- You can disable cloud features at any time

### Browser Sync (Optional)
- Sync is disabled by default
- All sync data is encrypted in transit
- You control when and what data is synchronized
- Sync can be disabled without losing local data

## Usage Examples

### Automatic Context Capture
```typescript
// When you're working on a large file and it reaches 1000 tokens,
// the extension automatically captures the context and can summarize it
function complexFunction() {
    // Your code here...
    // Context automatically captured when threshold is reached
}
```

### Manual Context Capture
```typescript
// Select code you want to capture
const importantCode = {
    // This selection can be captured with Ctrl+Shift+C
    key: 'value'
};
```

### Search Your Contexts
- Search for "authentication" to find all auth-related contexts
- Filter by workspace to see only current project contexts
- Search by file type or language
- Find contexts by date range

## Troubleshooting

### Extension Not Working
1. Check if the extension is enabled in settings
2. Verify VS Code version compatibility (requires 1.74.0+)
3. Check the Output panel for error messages
4. Try reloading the window (Ctrl+Shift+P → "Reload Window")

### Context Not Being Captured
1. Ensure auto-capture is enabled
2. Check if the file type is supported
3. Verify the capture threshold setting
4. Make sure you're working in a file (not untitled documents)

### Search Not Working
1. Wait for the search index to build (happens automatically)
2. Try rebuilding the index from the dashboard
3. Check if you have any contexts to search
4. Verify search terms are not too short (minimum 3 characters)

### Sync Issues
1. Ensure both VS Code and browser extensions are installed
2. Check that sync is enabled in both extensions
3. Verify network connectivity
4. Try manual sync from the settings panel

## Development

### Building from Source
```bash
cd vscode-extension
npm install
npm run compile
```

### Testing
```bash
npm run test
```

### Packaging
```bash
npm run package
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## Support

- **Documentation**: [Full documentation](../README.md)
- **Issues**: [GitHub Issues](https://github.com/auto-context-engineer/auto-context-engineer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/auto-context-engineer/auto-context-engineer/discussions)

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for a list of changes and updates.

---

**Privacy Notice**: This extension is designed with privacy as the top priority. By default, all data remains on your local machine. Any cloud features require explicit opt-in and use your own API keys. We do not collect, store, or transmit any of your data.