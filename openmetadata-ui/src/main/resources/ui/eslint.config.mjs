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
import eslint from '@eslint/js';
import eslintPluginJsonc from 'eslint-plugin-jsonc';
import react from 'eslint-plugin-react';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['src/*.ts', 'src/*.tsx', 'src/*.json'],
    ignores: [
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
    ],
    extends: [
      react.configs.flat.recommended,
      eslint.configs.recommended,
      //   {
      //     ...tseslint.configs.base,
      //     files: ['src/*.ts', 'src/*.tsx'],
      //   },

      ...tseslint.configs.recommendedTypeChecked.map((conf) => ({
        ...conf,
        files: ['src/*.ts', 'src/*.tsx'],
      })),

      //   ...eslintPluginJsonc.configs['flat/base'].map((conf) => ({
      //     ...conf,
      //     files: ['src/*json'],
      //   })),
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
      },
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
    ignores: ['**/tsconfig*.json'],
  }
  //   {
  //     files: ['src/locale/*.json'],
  //     plugins: { i18next },
  //     rules: {
  //       'i18next/no-literal-string': ['error', { mode: 'all' }],
  //     },
  //   }
);
