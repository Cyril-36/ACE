# Auto Context Engineer

Privacy-first browser extension that automatically captures, summarizes, and manages LLM context to overcome token limitations.

## Features

- **Privacy-First**: Local-only processing with optional cloud features
- **Smart Context Capture**: Automatically monitors LLM platforms for context changes
- **Intelligent Summarization**: Local and cloud-based summarization algorithms
- **Token Management**: Proactive token limit monitoring and management
- **Cross-Platform**: Supports ChatGPT, Claude, Gemini, and more

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Testing

```bash
npm run test
npm run test:coverage
```

### Linting

```bash
npm run lint
npm run format
```

## Project Structure

```
src/
├── background.ts          # Background service worker
├── content/              # Content scripts
├── popup/               # Extension popup
├── options/             # Settings page
├── services/            # Core services
├── types/               # TypeScript definitions
├── utils/               # Utility functions
└── i18n/                # Internationalization
```

## Privacy & Security

This extension prioritizes user privacy:

- All data processing can be done locally
- Cloud features are opt-in only
- Data is encrypted at rest
- No telemetry or tracking
- Open source and auditable

## License

MIT License - see LICENSE file for details.