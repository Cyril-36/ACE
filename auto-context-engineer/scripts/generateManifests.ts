#!/usr/bin/env node
// Script to generate browser-specific manifests
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { manifestGenerator, ManifestConfig } from '../src/services/compatibility/manifestGenerator';
import { BrowserType } from '../src/utils/browserDetection';

// Base configuration for the extension
const baseConfig: ManifestConfig = {
  name: 'Auto Context Engineer',
  version: '1.0.0',
  description: 'Privacy-first browser extension that automatically captures, summarizes, and manages LLM context to overcome token limitations',
  permissions: [
    'storage',
    'activeTab',
    'scripting',
    'tabs',
    'unlimitedStorage',
  ],
  hostPermissions: [
    'https://chat.openai.com/*',
    'https://claude.ai/*',
    'https://gemini.google.com/*',
    'https://bard.google.com/*',
    'https://github.com/*',
    'https://gitlab.com/*',
    'https://bitbucket.org/*',
    'https://vscode.dev/*',
    'https://github.dev/*',
    'https://replit.com/*',
    'https://codesandbox.io/*',
    'https://stackblitz.com/*',
  ],
  background: {
    serviceWorker: 'src/background.js',
  },
  contentScripts: [
    {
      matches: [
        'https://chat.openai.com/*',
        'https://claude.ai/*',
        'https://gemini.google.com/*',
        'https://bard.google.com/*',
      ],
      js: ['src/content/contentScript.js'],
      runAt: 'document_idle',
    },
    {
      matches: [
        'https://vscode.dev/*',
        'https://github.dev/*',
        'https://replit.com/*',
        'https://codesandbox.io/*',
        'https://stackblitz.com/*',
      ],
      js: ['src/content/ideContextCapture.js'],
      runAt: 'document_idle',
    },
  ],
  action: {
    defaultPopup: 'src/popup/index.html',
    defaultTitle: 'Auto Context Engineer',
    defaultIcon: {
      '16': 'src/assets/icons/icon-16.png',
      '32': 'src/assets/icons/icon-32.png',
      '48': 'src/assets/icons/icon-48.png',
      '128': 'src/assets/icons/icon-128.png',
    },
  },
  options: {
    page: 'src/options/index.html',
    openInTab: true,
  },
  icons: {
    '16': 'src/assets/icons/icon-16.png',
    '32': 'src/assets/icons/icon-32.png',
    '48': 'src/assets/icons/icon-48.png',
    '128': 'src/assets/icons/icon-128.png',
  },
  webAccessibleResources: [
    {
      resources: ['src/assets/*'],
      matches: ['<all_urls>'],
    },
  ],
};

// Browser-specific configurations
const browserConfigs = {
  chrome: {
    ...baseConfig,
    name: 'Auto Context Engineer',
  },
  firefox: {
    ...baseConfig,
    name: 'Auto Context Engineer',
    // Firefox-specific adjustments
    permissions: baseConfig.permissions?.filter(p => p !== 'unlimitedStorage'),
  },
  edge: {
    ...baseConfig,
    name: 'Auto Context Engineer',
  },
  safari: {
    ...baseConfig,
    name: 'Auto Context Engineer',
    // Safari has more restrictive permissions
    permissions: ['storage', 'activeTab', 'tabs'],
    hostPermissions: [
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://github.com/*',
    ],
  },
};

function generateManifests() {
  const generator = manifestGenerator;
  const outputDir = join(process.cwd(), 'dist', 'manifests');

  // Create output directory
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  // Generate manifests for each browser
  Object.entries(browserConfigs).forEach(([browser, config]) => {
    console.log(`Generating manifest for ${browser}...`);

    // Mock browser detection for each browser type
    const browserType = browser as keyof typeof BrowserType;
    const mockBrowserInfo = {
      type: BrowserType[browserType.toUpperCase() as keyof typeof BrowserType] || BrowserType.UNKNOWN,
      version: '100.0.0',
      isChromium: ['chrome', 'edge'].includes(browser),
      supportsManifestV3: browser !== 'safari',
      supportsServiceWorker: browser !== 'safari',
      supportsIndexedDB: true,
      supportsWebCrypto: true,
      supportsStorageAPI: true,
    };

    // Generate manifest
    const manifest = generator.generateManifest(config);

    // Validate manifest
    const validation = generator.validateManifest(manifest);
    if (!validation.valid) {
      console.error(`Invalid manifest for ${browser}:`, validation.errors);
      return;
    }

    // Write manifest file
    const manifestPath = join(outputDir, `manifest-${browser}.json`);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✓ Generated ${manifestPath}`);
  });

  // Generate default manifest (Chrome V3)
  const defaultManifest = generator.generateManifest(baseConfig);
  const defaultPath = join(process.cwd(), 'manifest.json');
  writeFileSync(defaultPath, JSON.stringify(defaultManifest, null, 2));
  console.log(`✓ Generated default manifest: ${defaultPath}`);

  console.log('\nManifest generation complete!');
  console.log('Browser-specific manifests are available in dist/manifests/');
}

// Run the script
if (require.main === module) {
  generateManifests();
}

export { generateManifests };