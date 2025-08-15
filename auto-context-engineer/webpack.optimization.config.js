/**
 * Webpack optimization configuration for Auto Context Engineer
 */

const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  mode: 'production',
  
  // Optimization settings
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true, // Remove console.log in production
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug'],
          },
          mangle: {
            safari10: true,
          },
          output: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
    
    // Split chunks for better caching
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Vendor libraries
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        
        // React and related libraries
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react',
          chunks: 'all',
          priority: 20,
        },
        
        // Analytics and performance utilities
        analytics: {
          test: /[\\/]src[\\/]services[\\/](analytics|performance)[\\/]/,
          name: 'analytics',
          chunks: 'all',
          priority: 15,
        },
        
        // Cloud services (lazy loaded)
        cloud: {
          test: /[\\/]src[\\/]services[\\/]cloud[\\/]/,
          name: 'cloud',
          chunks: 'async',
          priority: 15,
        },
        
        // Common utilities
        utils: {
          test: /[\\/]src[\\/]utils[\\/]/,
          name: 'utils',
          chunks: 'all',
          priority: 5,
        },
      },
    },
    
    // Runtime chunk for better caching
    runtimeChunk: {
      name: 'runtime',
    },
    
    // Module concatenation for better tree shaking
    concatenateModules: true,
    
    // Remove empty chunks
    removeEmptyChunks: true,
    
    // Merge duplicate chunks
    mergeDuplicateChunks: true,
  },
  
  // Resolve optimizations
  resolve: {
    // Reduce resolve time
    modules: [
      path.resolve(__dirname, 'src'),
      'node_modules',
    ],
    
    // Alias for shorter imports and better tree shaking
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@types': path.resolve(__dirname, 'src/types'),
    },
    
    // Optimize extensions resolution
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    
    // Fallback for Node.js modules in browser
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer"),
    },
  },
  
  // Module rules for optimization
  module: {
    rules: [
      // TypeScript optimization
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true, // Faster compilation
              experimentalWatchApi: true,
            },
          },
        ],
        exclude: /node_modules/,
      },
      
      // CSS optimization
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[hash:base64:5]', // Shorter class names
              },
            },
          },
        ],
      },
      
      // Asset optimization
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[hash][ext][query]',
        },
      },
    ],
  },
  
  // Plugins for optimization
  plugins: [
    // Define environment variables
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      '__DEV__': false,
    }),
    
    // Compression
    new CompressionPlugin({
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8,
    }),
    
    // Bundle analyzer (optional, enable when needed)
    // new BundleAnalyzerPlugin({
    //   analyzerMode: 'static',
    //   openAnalyzer: false,
    // }),
    
    // Ignore moment.js locales to reduce bundle size
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }),
    
    // Module concatenation
    new webpack.optimize.ModuleConcatenationPlugin(),
  ],
  
  // Performance hints
  performance: {
    hints: 'warning',
    maxEntrypointSize: 512000, // 500kb
    maxAssetSize: 512000, // 500kb
  },
  
  // Cache configuration for faster rebuilds
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
  
  // Stats configuration
  stats: {
    chunks: false,
    modules: false,
    assets: true,
    colors: true,
    timings: true,
  },
};

// Development-specific optimizations
if (process.env.NODE_ENV === 'development') {
  module.exports.optimization.minimize = false;
  module.exports.devtool = 'eval-source-map';
  module.exports.cache.type = 'memory';
  
  // Hot module replacement
  module.exports.plugins.push(
    new webpack.HotModuleReplacementPlugin()
  );
}

// Bundle analysis mode
if (process.env.ANALYZE_BUNDLE) {
  module.exports.plugins.push(
    new BundleAnalyzerPlugin({
      analyzerMode: 'server',
      openAnalyzer: true,
    })
  );
}