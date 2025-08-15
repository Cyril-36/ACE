import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react({
      // Enable React Fast Refresh for better development experience
      fastRefresh: true,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/services': resolve(__dirname, 'src/services'),
      '@/utils': resolve(__dirname, 'src/utils'),
      '@/i18n': resolve(__dirname, 'src/i18n'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/hooks': resolve(__dirname, 'src/hooks'),
    },
  },
  build: {
    // Optimize build performance
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV === 'development',
    
    // Optimize chunk splitting
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        contentScript: resolve(__dirname, 'src/content/contentScript.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId;
          if (facadeModuleId?.includes('background')) {
            return 'src/background.js';
          }
          if (facadeModuleId?.includes('contentScript')) {
            return 'src/content/contentScript.js';
          }
          return 'src/[name].js';
        },
        chunkFileNames: 'src/chunks/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.html')) {
            return 'src/[name][extname]';
          }
          return 'src/assets/[name].[hash][extname]';
        },
        // Optimize chunk splitting for better caching
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'utils': ['src/utils/index.ts'],
          'services': ['src/services/index.ts'],
        },
      },
      // External dependencies for extension environment
      external: ['chrome'],
    },
    outDir: 'dist',
    emptyOutDir: true,
    
    // Performance optimizations
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 4096,
  },
  
  // Development server optimizations
  server: {
    hmr: {
      overlay: false, // Disable error overlay for better performance
    },
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['@types/chrome'],
  },
  
  // Enable esbuild for faster builds
  esbuild: {
    target: 'es2020',
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});