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
import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,

  {
    ignores: ['node_modules/**', 'dist/**'],
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    settings: {
      react: {
        version: 'detect',
      },
    },

    plugins: {
      react,
      'react-hooks': reactHooks,
    },

    rules: {
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
          ignoreStrings: true,
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

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-use-before-define': 'warn',
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          caughtErrors: 'none',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Ban Tailwind `ring-*` for drawing edges. Rings compile to box-shadow, and WebKit
      // does not pixel-snap box-shadows, so a ring used as a border thins out and can
      // vanish entirely in Safari at non-100% zoom. Use `border-*`, or `outline-*` where
      // the edge must be layout-neutral. See docs/colors.md §2.3.1.
      //
      // Requires start-of-string, whitespace, `:` or `!` before `ring-`, so it catches
      // every form — `tw:ring-1`, `tw:focus-visible:ring-2`, `tw:[&_button]:ring-0`,
      // `tw:!ring-0` — while ignoring CSS custom properties (`--tw-ring-color-*`).
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/(^|[\\s:!])ring-/]',
          message:
            'Do not use Tailwind `ring-*` to draw an edge — it compiles to box-shadow, which WebKit does not pixel-snap, so it thins/vanishes in Safari when zoomed. Use `border-*`, or `outline-1 -outline-offset-1 outline-<token>`. Where the outline is already the focus ring, use `borderAfter` + `after:outline-<token>`. See docs/colors.md §2.3.1.',
        },
        {
          selector: 'TemplateElement[value.raw=/(^|[\\s:!])ring-/]',
          message:
            'Do not use Tailwind `ring-*` to draw an edge — it compiles to box-shadow, which WebKit does not pixel-snap, so it thins/vanishes in Safari when zoomed. Use `border-*`, or `outline-1 -outline-offset-1 outline-<token>`. Where the outline is already the focus ring, use `borderAfter` + `after:outline-<token>`. See docs/colors.md §2.3.1.',
        },
      ],
    },
  },

  // Override for Storybook files
  {
    files: ['src/**/*.stories.{ts,tsx,js,jsx}'],
    rules: {
      'no-console': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },
];
