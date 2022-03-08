/*
 *  Copyright 2021 Collate
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
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackBar = require('webpackbar');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const outputPath = path.join(__dirname, 'build');

module.exports = {
  // Development mode
  mode: 'development',

  // Input configuration
  entry: ['@babel/polyfill', path.join(__dirname, 'src/index.js')],

  // Output configuration
  output: {
    path: outputPath,
    filename: '[name].js',
    chunkFilename: '[name].js',
    publicPath: '/', // Ensures bundle is served from absolute path as opposed to relative
  },

  // Loaders
  module: {
    rules: [
      // .js and .jsx files to be handled by babel-loader
      {
        test: /\.(js|jsx)$/,
        include: path.resolve(__dirname, 'src'),
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      // .ts and .tsx files to be handled by ts-loader
      {
        test: /\.(ts|tsx)$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true, // Speed up compilation in development mode
        },
        include: path.resolve(__dirname, 'src'), // Just the source code
      },
      // .css and .scss files to be handled by sass-loader
      // include scss rule and sass-loader if injecting scss/sass file
      {
        test: /\.(css|s[ac]ss)$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              // Prefer `dart-sass`
              implementation: require.resolve('sass'),
            },
          },
          'postcss-loader',
        ],
        include: [
          path.resolve(__dirname, 'src'),
          path.resolve(__dirname, 'node_modules/tailwindcss'),
          path.resolve(__dirname, 'node_modules/react-tippy'),
          path.resolve(__dirname, 'node_modules/react-draft-wysiwyg'),
          path.resolve(__dirname, 'node_modules/codemirror'),
          path.resolve(__dirname, 'node_modules/rc-tree'),
        ],
        // May need to handle files outside the source code
        // (from node_modules)
      },
      // .svg files to be handled by @svgr/webpack
      {
        test: /\.svg$/,
        use: ['@svgr/webpack'],
        include: path.resolve(__dirname, 'src'), // Just the source code
      },
      // different urls to be handled by url-loader
      {
        test: /\.(png|jpg|jpeg|gif|svg|ico|eot|woff|woff2)$/i,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192,
              name: `[name].[ext]`,
            },
          },
        ],
        include: [
          path.resolve(__dirname, 'src'),
          path.resolve(__dirname, 'node_modules/slick-carousel'),
        ], // Just the source code
      },
      // Font files to be handled by file-loader
      {
        test: /\.ttf$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'fonts/',
            },
          },
        ],
        include: [
          path.resolve(__dirname, 'src'),
          path.resolve(__dirname, 'node_modules/slick-carousel'),
        ], // Just the source code
      },
    ],
  },

  // Module resolution
  resolve: {
    // File types to be handled
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.svg', '.ttf'],
    fallback: {
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      path: require.resolve('path-browserify'),
    },
  },

  plugins: [
    // Clean webpack output directory
    new CleanWebpackPlugin({
      verbose: true,
    }),
    // In development mode, fork TypeScript checking to run in another thread and not block main
    // transpilation
    new ForkTsCheckerWebpackPlugin({
      eslint: {
        files: './src/**/*.{ts,tsx,js,jsx}',
        // required - same as command `eslint ./src/**/*.{ts,tsx,js,jsx} --ext .ts,.tsx,.js,.jsx`
      },
    }),
    // Generate index.html from template
    new HtmlWebpackPlugin({
      favicon: path.join(__dirname, 'public/favicon.png'),
      template: path.join(__dirname, 'public/index.html'),
      scriptLoading: 'defer',
    }),
    // Copy favicon, logo and manifest for index.html
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(__dirname, 'public/favicon.png'),
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
          from: path.join(__dirname, 'public/robots.txt'),
          to: outputPath,
        },
      ],
    }),
    // Build progress bar
    new WebpackBar({
      name: '@openmetadata [dev]',
      color: '#54BAC9',
    }),
    new MiniCssExtractPlugin({
      filename: '[name].bundle.css',
      chunkFilename: '[id].css',
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ],

  // webpack-dev-server
  devServer: {
    contentBase: outputPath,
    compress: true,
    port: 3000,
    // Route all requests to index.html so that app gets to handle all copy pasted deep links
    historyApiFallback: {
      disableDotRule: true,
    },
    // Proxy configuration
    proxy: [
      {
        context: '/api',
        target: 'http://localhost:8585/',
        changeOrigin: true,
      },
    ],
  },

  // Source map
  devtool: 'eval-cheap-source-map',
};
