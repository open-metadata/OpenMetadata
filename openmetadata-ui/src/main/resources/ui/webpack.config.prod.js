/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const outputPath = path.join(__dirname, 'dist/assets');

module.exports = {
  cache: {
    type: 'filesystem', // Use filesystem for cache
    buildDependencies: {
      config: [__filename], // Cache invalidation on config file changes
    },
    cacheDirectory: path.resolve(__dirname, 'node_modules/.cache/webpack'),
    compression: 'gzip', // Compress cache files
    store: 'pack', // More efficient storage
  },

  // Production mode
  mode: 'production',

  // Input configuration
  entry: path.join(__dirname, 'src/index.tsx'),

  // Output configuration
  output: {
    path: outputPath,
    filename: '[name].[fullhash].js',
    chunkFilename: '[name].[fullhash].js',
    // Clean the output directory before emit.
    clean: true,
    // Use exactly the same ${basePath} pattern as in index.html
    // The HTML uses: href="${basePath}favicon.png" (no slash after basePath)
    // So webpack should use the same pattern
    publicPath: '${basePath}',
  },

  // Loaders
  module: {
    rules: [
      // .mjs files to be handled
      {
        test: /\.m?js/,
        include: path.resolve(__dirname, 'node_modules/kleur'),
        resolve: {
          fullySpecified: false,
        },
      },

      // .ts and .tsx files to be handled by ts-loader
      {
        test: /\.(ts|tsx)$/,
        exclude: [/node_modules/, /dist/],
        include: path.resolve(__dirname, 'src'),
        use: [
          {
            loader: 'thread-loader',
            options: {
              workers: Math.max(require('os').cpus().length - 2, 2), // More conservative CPU usage
              poolTimeout: 2000, // Faster pool termination
            },
          },
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.json',
              happyPackMode: true, // Enable faster builds with HappyPack compatibility
              transpileOnly: true, // Speed up compilation in development mode
            },
          },
        ],
      },

      // .css files to be handled by style-loader & css-loader
      {
        test: /\.(css)$/,
        use: ['style-loader', 'css-loader'],
      },

      // .less files to be handled by less-loader
      {
        test: /\.less$/,
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader',
          {
            loader: 'less-loader',
            options: {
              lessOptions: {
                javascriptEnabled: true,
              },
            },
          },
        ],
      },

      // .svg files to be handled by @svgr/webpack
      {
        test: /\.svg$/,
        use: ['@svgr/webpack', 'url-loader'],
        include: path.resolve(__dirname, 'src'),
      },

      // Images to be handled by file-loader + image-webpack-loader
      {
        test: /\.(png|jpe?g)$/i,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: 'images/[name].[contenthash].[ext]', // Output file naming
              outputPath: 'images/', // Directory in the output folder
            },
          },
        ],
      },
    ],
  },

  // Module resolution
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.css', '.less', '.svg'],
    fallback: {
      https: require.resolve('https-browserify'),
      fs: false,
      'process/browser': require.resolve('process/browser'),
    },
    alias: {
      process: 'process/browser',
      Quill: path.resolve(__dirname, 'node_modules/quill'),
    },
  },

  // Optimizations
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          compress: {
            drop_console: true, // Remove console logs for production
          },
        },
      }),
    ],
    splitChunks: {
      chunks: 'all', // Split all types of chunks
      maxSize: 240000, // Maximum size for chunks
      cacheGroups: {
        default: {
          reuseExistingChunk: true, // Reuse existing chunks
          priority: -10,
        },
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: -20,
        },
      },
    },
    runtimeChunk: 'single', // Separate runtime code into its own chunk
    chunkIds: 'deterministic', // Use stable and unique chunk IDs
  },

  // Plugins
  plugins: [
    // Clean webpack output directory
    new CleanWebpackPlugin(),

    // Generate index.html from template
    new HtmlWebpackPlugin({
      favicon: path.join(__dirname, 'public/favicon.png'),
      hash: true,
      cache: false,
      template: path.join(__dirname, 'public/index.html'),
      scriptLoading: 'defer',
    }),

    // Copy favicon, logo, manifest, and other assets
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(__dirname, 'public/favicon.png'),
          to: outputPath,
        },
        {
          from: path.join(__dirname, 'public/favicons/favicon-16x16.png'),
          to: outputPath,
        },
        {
          from: path.join(__dirname, 'public/favicons/favicon-32x32.png'),
          to: outputPath,
        },
        {
          from: path.join(__dirname, 'public/logo192.png'),
          to: outputPath,
        },
        {
          from: path.join(__dirname, 'public/manifest.json'),
          to: outputPath,
        },
        {
          from: path.join(__dirname, 'public/swagger.html'),
          to: outputPath,
        },
        {
          from: path.join(__dirname, 'public/locales'),
          to: outputPath,
        },
        {
          from: path.join(__dirname, 'public/BronzeCertification.svg'),
          to: outputPath,
        },
        {
          from: path.join(__dirname, 'public/SilverCertification.svg'),
          to: outputPath,
        },
        {
          from: path.join(__dirname, 'public/GoldCertification.svg'),
          to: outputPath,
        },
      ],
    }),

    // Compress output files
    new CompressionPlugin({
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
    }),

    // Bundle analyzer (only when explicitly requested)
    ...(process.env.ANALYZE_BUNDLE === 'true' ? [new BundleAnalyzerPlugin({
      analyzerMode: 'static', // Outputs an HTML report
      openAnalyzer: false, // Set to true to open report automatically
    })] : []),
  ],

  // Performance budgets
  performance: {
    maxAssetSize: 300000, // 300KB
    maxEntrypointSize: 300000, // 300KB
    hints: 'warning', // Show warnings for budget violations
  },

  // Disable source maps for production
  devtool: false,
};
