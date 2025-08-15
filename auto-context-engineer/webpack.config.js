const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    mode: isProduction ? 'production' : 'development',
    
    entry: {
      background: './src/background.ts',
      popup: './src/popup/popup.tsx',
      options: './src/options/options.tsx',
      'content-chat': './src/content/chatMonitor.ts',
      'content-ide': './src/content/ideContextCapture.ts',
    },
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].[contenthash].js',
      chunkFilename: '[name].[contenthash].chunk.js',
      clean: true,
    },
    
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@services': path.resolve(__dirname, 'src/services'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@types': path.resolve(__dirname, 'src/types'),
      },
    },
    
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                experimentalWatchApi: true,
              },
            },
          ],
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset/resource',
        },
      ],
    },
    
    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProduction,
              drop_debugger: true,
              pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
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
      
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          // Vendor libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            enforce: true,
          },
          
          // React and related libraries
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            chunks: 'all',
            priority: 20,
            enforce: true,
          },
          
          // Common utilities
          utils: {
            test: /[\\/]src[\\/]utils[\\/]/,
            name: 'utils',
            chunks: 'all',
            priority: 15,
            minChunks: 2,
          },
          
          // Services (lazy loaded)
          services: {
            test: /[\\/]src[\\/]services[\\/]/,
            name: 'services',
            chunks: 'async',
            priority: 12,
            minChunks: 2,
          },
          
          // Analytics and performance (separate chunk)
          analytics: {
            test: /[\\/]src[\\/]services[\\/](analytics|performance)[\\/]/,
            name: 'analytics',
            chunks: 'all',
            priority: 18,
            minChunks: 1,
          },
          
          // Cloud services (lazy loaded)
          cloud: {
            test: /[\\/]src[\\/]services[\\/]cloud[\\/]/,
            name: 'cloud',
            chunks: 'async',
            priority: 15,
            minChunks: 1,
          },
        },
      },
      
      runtimeChunk: {
        name: 'runtime',
      },
      
      concatenateModules: true,
      removeEmptyChunks: true,
      mergeDuplicateChunks: true,
    },
    
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        '__DEV__': !isProduction,
      }),
      
      ...(isProduction ? [
        new CompressionPlugin({
          algorithm: 'gzip',
          test: /\.(js|css|html|svg)$/,
          threshold: 8192,
          minRatio: 0.8,
        }),
      ] : []),
      
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/locale$/,
        contextRegExp: /moment$/,
      }),
      
      new webpack.optimize.ModuleConcatenationPlugin(),
    ],
    
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 512000, // 500kb
      maxAssetSize: 512000, // 500kb
    },
    
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    },
    
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    
    stats: {
      chunks: false,
      modules: false,
      assets: true,
      colors: true,
      timings: true,
    },
  };
};