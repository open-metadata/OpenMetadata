/*
 *  Copyright 2025 Collate.
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
/*
 * Copyright 2022 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import i18next from 'eslint-plugin-i18next';
import jest from 'eslint-plugin-jest';
import jestFormatting from 'eslint-plugin-jest-formatting';
import jsoncPlugin from 'eslint-plugin-jsonc';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import jsoncParser from 'jsonc-eslint-parser';
import tseslint from 'typescript-eslint';

export default [
  // Base recommended configs
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,

  // Global ignores (from .eslintignore)
  {
    ignores: [
      'node/**',
      'node_modules/**',
      'build/**',
      'dist/**',
      'mock-api/**',
      'src/antlr/generated/**',
      'src/generated/antlr/**',
      'src/jsons/connectionSchemas/**',
      'src/generated/**',
      'coverage/**',
    ],
  },

  // Base config for JavaScript and TypeScript files
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2018,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.node,
        ...globals.jest,
        // Browser globals needed for tests and components
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        XMLHttpRequest: 'readonly',
        Range: 'readonly',
      },
    },

    settings: {
      'import/resolver': {
        'babel-module': {
          root: ['./src'],
          extensions: ['.js', '.jsx', '.png', '.svg'],
        },
      },
      react: {
        version: 'detect',
      },
      jest: {
        version: 'detect',
      },
    },

    plugins: {
      react,
      'react-hooks': reactHooks,
      jest,
      'jest-formatting': jestFormatting,
      i18next,
    },

    rules: {
      // ESLint rules
      eqeqeq: ['error', 'smart'],
      'no-console': 'error',
      'spaced-comment': ['error', 'always'],
      'max-len': [
        'error',
        {
          comments: 120,
          code: 200,
          ignoreTrailingComments: true,
          ignoreUrls: true,
        },
      ],
      curly: ['error', 'all'],
      'arrow-parens': ['error', 'always'],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'function' },
        { blankLine: 'always', prev: '*', next: 'class' },
        { blankLine: 'always', prev: '*', next: 'export' },
        { blankLine: 'any', prev: 'export', next: 'export' },
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: '*', next: 'break' },
        { blankLine: 'always', prev: '*', next: 'continue' },
        { blankLine: 'always', prev: '*', next: 'throw' },
      ],

      // React rules
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-sort-props': [
        'error',
        {
          callbacksLast: true,
          shorthandFirst: true,
        },
      ],
      'react/jsx-boolean-value': ['error', 'never'],
      'react/self-closing-comp': [
        'error',
        {
          component: true,
          html: true,
        },
      ],
      'react/jsx-pascal-case': 'error',
      'react/prop-types': 'off',
      'react/jsx-curly-brace-presence': ['error', 'never'],
      'react/display-name': 'off',

      // React hooks rules
      'react-hooks/rules-of-hooks': 'error',

      // Jest rules
      'jest/consistent-test-it': [
        'error',
        {
          fn: 'it',
          withinDescribe: 'it',
        },
      ],
      'jest/no-disabled-tests': 'warn',
      'jest-formatting/padding-around-all': 'error',

      // TypeScript rules
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-use-before-define': 'warn',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'warn',

      // i18next rules - temporarily disabled due to ESLint 9 compatibility issues
      // TODO: Re-enable when eslint-plugin-i18next fully supports ESLint 9 flat config
      'i18next/no-literal-string': 'off',
    },
  },

  // JSON files
  {
    files: ['src/**/*.json'],
    languageOptions: {
      parser: jsoncParser,
    },
    plugins: {
      jsonc: jsoncPlugin,
    },
    rules: {
      'eol-last': 'off',
      'max-len': 'off',
      'jsonc/sort-keys': 'off',
    },
  },

  // Locale JSON files with sorted keys
  {
    files: ['src/locale/**/*.json'],
    languageOptions: {
      parser: jsoncParser,
    },
    plugins: {
      jsonc: jsoncPlugin,
    },
    rules: {
      'jsonc/sort-keys': [
        'error',
        {
          pathPattern: '.*',
          order: { type: 'asc' },
        },
      ],
    },
  },

  // Generated files
  {
    files: ['src/generated/**/*.ts'],
    rules: {
      'max-len': 'off',
    },
  },

  // Playwright tests
  {
    files: ['**/playwright/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'jest/expect-expect': 'off',
      'jest/valid-expect-in-promise': 'off',
      'jest/valid-expect': 'off',
      'jest/valid-describe': 'off',
      'jest/consistent-test-it': 'off',
      'jest/no-done-callback': 'off',
      'jest/no-standalone-expect': 'off',
      'jest/no-conditional-expect': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-duplicate-enum-values': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
    },
  },

  // Test setup files
  {
    files: [
      'src/setupTests.js',
      'src/**/*.test.{js,jsx,ts,tsx}',
      'src/**/*.spec.{js,jsx,ts,tsx}',
      'playwright/**/*.spec.{js,jsx,ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
