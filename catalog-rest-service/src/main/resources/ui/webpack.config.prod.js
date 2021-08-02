/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackBar = require('webpackbar');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const outputPath = path.join(__dirname, 'build');

module.exports = {
  // Production mode
  mode: 'production',

  // Input configuration
  entry: ['@babel/polyfill', path.join(__dirname, 'src/index.js')],

  // Output configuration
  output: {
    path: outputPath,
    filename: 'openmetadata.js',
    chunkFilename: '[name].js',
    publicPath: '/', // Ensures bundle is served from absolute path as opposed to relative
  },

  // Loaders
  module: {
    rules: [
      // .js and .jsx files to be handled by babel-loader
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
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
        exclude: /node_modules/, // Just the source code
      },
      // .css and .scss files to be handled by sass-loader
      // include scss rule and sass-loader if injecting scss/sass file
      {
        test: /\.(css)$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
        // No exclude, may need to handle files outside the source code
        // (from node_modules)
      },
      // .svg files to be handled by @svgr/webpack
      {
        test: /\.svg$/,
        use: ['@svgr/webpack'],
        exclude: /node_modules/, // Just the source code
      },
      //
      {
        test: /\.(png|jpg|gif|svg|ico)$/i,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192,
            },
          },
        ],
        exclude: /node_modules/, // Just the source code
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
        exclude: /node_modules/, // Just the source code
      },
    ],
  },

  // Module resolution
  resolve: {
    // File types to be handled
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.svg', '.ttf'],
    fallback: {
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
    },
  },

  plugins: [
    // Clean webpack output directory
    new CleanWebpackPlugin({
      verbose: true,
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
      name: '@collate/openmetadata [prod]',
      color: '#15C39B',
    }),
    new MiniCssExtractPlugin({
      filename: '[name].bundle.css',
      chunkFilename: '[id].css',
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    // Bundle analyzer
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: path.join(
        __dirname,
        'webpack/bundle-analyzer-report.html'
      ),
      openAnalyzer: false,
    }),
  ],

  // Source map
  devtool: 'source-map',
};
