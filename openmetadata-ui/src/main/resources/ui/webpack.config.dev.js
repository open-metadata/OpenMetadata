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
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const process = require('process');

const outputPath = path.join(__dirname, 'build');
const devServerTarget =
  process.env.DEV_SERVER_TARGET ?? 'http://localhost:8585/';

module.exports = {
  // Development mode
  mode: 'development',

  // Input configuration
  entry: ['@babel/polyfill', path.join(__dirname, 'src/index.tsx')],

  // Output configuration
  output: {
    path: outputPath,
    filename: '[name].js',
    chunkFilename: '[name].js',
    // Clean the output directory before emit.
    clean: true,
    // Ensures bundle is served from absolute path as opposed to relative
    publicPath: `/`,
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
        loader: 'ts-loader',
        options: {
          configFile: 'tsconfig.json',
          transpileOnly: true, // Speed up compilation in development mode
        },
        include: path.resolve(__dirname, 'src'), // Just the source code
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
        include: path.resolve(__dirname, 'src'), // Just the source code
      },
      // images files to be handled by file-loader
      {
        test: /\.png$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'images/',
            },
          },
        ],
      },
    ],
  },

  // Module resolution
  resolve: {
    // File types to be handled
    extensions: ['.ts', '.tsx', '.js', '.css', '.less', '.svg'],
    fallback: {
      https: require.resolve('https-browserify'),
      fs: false,
      'process/browser': require.resolve('process/browser'),
    },
    alias: {
      process: 'process/browser',
      Quill: path.resolve(__dirname, 'node_modules/quill'), // Alias for the 'quill' library in node_modules
    },
  },

  plugins: [
    // In development mode, fork TypeScript checking to run in another thread and not block main
    // transpilation
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        configFile: 'tsconfig.json',
      },
    }),
    // Generate index.html from template
    new HtmlWebpackPlugin({
      favicon: path.join(__dirname, 'public/favicon.png'),
      template: path.join(__dirname, 'public/index.html'),
      scriptLoading: 'defer',
      hash: true,
    }),
    // Copy favicon, logo and manifest for index.html
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
          from: path.join(__dirname, 'public/token-storage-worker.js'),
          to: outputPath,
        }
      ],
    }),
  ],

  // webpack-dev-server
  devServer: {
    // Disable webpack browser window overlay
    client: {
      overlay: false,
    },
    static: {
      directory: outputPath,
    },
    compress: true,
    hot: true,
    port: 3000,
    open: true,
    // Route all requests to index.html so that app gets to handle all copy pasted deep links
    historyApiFallback: {
      disableDotRule: true,
    },
    // Proxy configuration
    proxy: [
      {
        context: '/api/',
        target: devServerTarget,
        changeOrigin: true,
      },
    ],
  },

  // Source map
  devtool: 'eval-cheap-module-source-map',
};
