/*
 *  Copyright 2024 Collate.
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
const eslint = require('@eslint/js');
const eslintPluginJsonc = require('eslint-plugin-jsonc');
const react = require('eslint-plugin-react');
const tseslint = require('typescript-eslint');

const ignores = [
  'node/',
  'node_modules/',
  'build/',
  'dist/',
  'mock-api/',
  '.DS_Store',
  '**/*.config.js',
  '**/*.config.dev.js',
  '**/*.config.prod.js',
  'src/antlr/generated/',
  'src/generated/antlr/',
  'src/jsons/connectionSchemas/',
  'src/generated/',
  'src/test/unit/mocks/',
  '**/*mock.js',
];

module.exports = tseslint.config(
  {
    files: ['src/*.ts', 'src/*.tsx'],
    ignores,
    extends: [
      react.configs.flat.recommended,
      //   eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked.map((conf) => ({
        ...conf,
        files: ['src/*.ts', 'src/*.tsx'],
      })),
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
      },
      ecmaVersion: 2020,
    },

    settings: {
      react: {
        version: 'detect',
      },
    },

    rules: {
      '@typescript-eslint/array-type': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'sort-keys': 'off',
      'id-length': 'off',
      'capitalized-comments': 'off',
      'no-inline-comments': 'off',
      'one-var': 'off',
    },
  },
  {
    ...eslintPluginJsonc.configs['recommended-with-json'],
    files: ['src/*json'],
    ignores,
  }
);
