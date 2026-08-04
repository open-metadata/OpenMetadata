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
import i18next from 'eslint-plugin-i18next';
import jest from 'eslint-plugin-jest';
import jestFormatting from 'eslint-plugin-jest-formatting';
import jsoncPlugin from 'eslint-plugin-jsonc';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import playwright from 'eslint-plugin-playwright';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';
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
      'playwright/doc-generator/**',
      'playwright/output/**',
      'playwright/test-data/**',
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
      sonarjs,
      'jsx-a11y': jsxA11y,
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
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],
      // No need to disable base rule as it's already disabled in typescript-eslint/recommended
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

      // Re-enabled: the ESLint 9 flat-config incompatibility this was disabled
      // for no longer reproduces — verified running against this config, where
      // it reports ~367 findings in a 400-file sample. `warn` because of that
      // backlog; the repo convention is no user-facing string literals, so this
      // should reach `error` once the backlog is worked down.
      'i18next/no-literal-string': 'warn',

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

      // SonarJS — same engine and rule ids (Sxxxx) as the SonarCloud analysis
      // that already runs on every UI PR, so a finding here is the finding
      // Sonar reports, only faster and in the editor.
      //
      // ONLY rules with zero existing violations across src/ are listed. ESLint
      // reports per file, not per added line, so a rule with a legacy backlog
      // would fail PRs for code they merely touched. The high-backlog rules —
      // no-duplicate-string (640), cognitive-complexity (85), no-collapsible-if
      // (21), no-redundant-jump (14), no-duplicated-branches (9),
      // no-identical-functions (6) — are deliberately NOT here: SonarCloud's
      // Clean-as-You-Code gate scopes them to new lines, which ESLint cannot do.
      // Also held back for a small backlog, mostly in tests: no-extra-arguments
      // (20), prefer-object-literal (1), no-redundant-boolean (1).
      // Promote a rule here once its backlog is cleared.
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-gratuitous-expressions': 'error',
      'sonarjs/no-inverted-boolean-check': 'error',
      'sonarjs/no-useless-catch': 'error',
      'sonarjs/no-element-overwrite': 'error',
      'sonarjs/no-empty-collection': 'error',
      'sonarjs/no-same-line-conditional': 'error',
      'sonarjs/no-use-of-empty-return-value': 'error',
      'sonarjs/non-existent-operator': 'error',
      'sonarjs/no-ignored-return': 'error',
      'sonarjs/no-nested-switch': 'error',
      'sonarjs/no-globals-shadowing': 'error',
      'sonarjs/prefer-while': 'error',
      'sonarjs/no-unthrown-error': 'error',
      'sonarjs/no-misleading-array-reverse': 'error',

      // Accessibility. eslint-plugin-jsx-a11y was already a devDependency but
      // had never been registered, so none of it ran.
      //
      // Severity is chosen by MEASURED backlog, not by taste. ESLint reports per
      // file, not per added line, so a rule with existing violations set to
      // `error` would fail PRs for code they merely touched. Zero-backlog rules
      // are therefore `error` (blocking), and everything else is `warn` — kept
      // on so it shows in the editor and in CI output, and so the backlog is
      // visible rather than invisible.
      //
      // Promotion path: clear a rule's backlog, re-measure, move it to `error`.
      //
      // Safety note: `ui-checkstyle` runs `eslint --fix` and fails on the
      // resulting git diff, so a `warn` rule that AUTO-FIXES would silently
      // rewrite files and hard-fail the gate. Every rule listed at `warn` below
      // was checked: all report `fixable: none` or suggestions-only, and
      // react-hooks/exhaustive-deps — which declares `fixable: 'code'` — was
      // verified empirically not to rewrite a dependency array under `--fix`.
      // Re-check that before adding any new `warn` rule here.
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
      'jsx-a11y/no-noninteractive-tabindex': 'error',
      'jsx-a11y/tabindex-no-positive': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/autocomplete-valid': 'error',
      'jsx-a11y/heading-has-content': 'error',
      'jsx-a11y/html-has-lang': 'error',
      'jsx-a11y/iframe-has-title': 'error',
      'jsx-a11y/img-redundant-alt': 'error',
      'jsx-a11y/no-access-key': 'error',
      'jsx-a11y/no-distracting-elements': 'error',
      'jsx-a11y/scope': 'error',

      // --- warn tier: on, visible, not yet blocking. Counts are the measured
      // backlog at the time of writing; they only go down.
      'react-hooks/exhaustive-deps': 'warn', // 1694 across 595 files
      'jsx-a11y/control-has-associated-label': 'warn', // 146
      'jsx-a11y/click-events-have-key-events': 'warn', // 89
      'jsx-a11y/no-static-element-interactions': 'warn', // 87
      'jsx-a11y/label-has-for': 'warn', // 61
      'jsx-a11y/no-autofocus': 'warn', // 45
      'jsx-a11y/anchor-has-content': 'warn', // 12
      'jsx-a11y/no-noninteractive-element-interactions': 'warn', // 8
      'jsx-a11y/interactive-supports-focus': 'warn', // 7
      'jsx-a11y/anchor-is-valid': 'warn', // 5
      'jsx-a11y/alt-text': 'warn', // 3
      'jsx-a11y/no-redundant-roles': 'warn', // 2
      'jsx-a11y/mouse-events-have-key-events': 'warn', // 2
      'jsx-a11y/media-has-caption': 'warn', // 2
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'warn', // 2
      'jsx-a11y/anchor-ambiguous-text': 'warn', // 1
      'sonarjs/no-duplicate-string': 'warn', // 640
      'sonarjs/cognitive-complexity': ['warn', 15], // 85
      'sonarjs/no-collapsible-if': 'warn', // 21
      'sonarjs/no-extra-arguments': 'warn', // 20
      'sonarjs/no-redundant-jump': 'warn', // 14
      'sonarjs/no-duplicated-branches': 'warn', // 9
      'sonarjs/no-identical-functions': 'warn', // 6
      'sonarjs/prefer-object-literal': 'warn', // 1
      'sonarjs/no-redundant-boolean': 'warn', // 1

      // Complexity and structure. SonarCloud gates these on new code; these
      // surface the same findings locally and in the editor.
      'sonarjs/cyclomatic-complexity': 'warn', // 54 in a 400-file sample
      'sonarjs/expression-complexity': 'warn', // 15
      'sonarjs/no-nested-conditional': 'warn', // 16
      'sonarjs/no-nested-functions': 'warn', // 18

      // Security. Near-zero today — promote to error once confirmed at zero
      // across the whole tree, not just a sample.
      'sonarjs/no-clear-text-protocols': 'warn', // 18
      'sonarjs/no-hardcoded-passwords': 'warn', // 0 in sample
      'sonarjs/no-hardcoded-ip': 'warn', // 0 in sample
      'sonarjs/no-invariant-returns': 'warn', // 0 in sample

      // React correctness and re-render cost — the enforceable slice of
      // frontend-performance.md.
      'react/no-array-index-key': 'warn', // 23
      'react/jsx-no-constructed-context-values': 'warn', // 1
      'react/no-unstable-nested-components': 'warn', // 1
      'react/no-danger': 'warn', // 0 in sample
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // NOT enabled: react/jsx-no-useless-fragment. It auto-fixes, so at any
      // severity `eslint --fix` would rewrite files and hard-fail the
      // git-diff check in ui-checkstyle. Land a one-time repo-wide autofix
      // commit first, then add it here at error.
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
    plugins: {
      playwright,
    },
    rules: {
      // TypeScript/base rule overrides for Playwright files
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-duplicate-enum-values': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'prefer-const': 'off',

      // Playwright rules — blocking (error): zero existing violations, prevent regressions
      'playwright/no-networkidle': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/no-focused-test': 'error',

      // Playwright rules — aspirational (warn): existing violations to fix over time
      'playwright/missing-playwright-await': 'warn',
      'playwright/valid-expect': 'warn',
      'playwright/no-wait-for-timeout': 'warn',
      'playwright/no-force-option': 'warn',
      'playwright/no-element-handle': 'warn',
      'playwright/no-eval': 'warn',
      'playwright/no-skipped-test': 'warn',
      'playwright/prefer-web-first-assertions': 'warn',
      'playwright/no-useless-await': 'warn',
      'playwright/no-wait-for-selector': 'warn',
    },
  },

  // E2E spec files: warn on bare browser.newPage() (no storageState arg).
  //
  // There are two valid reasons to keep a warning here rather than an error:
  //   • ANTI-PATTERN (warn is appropriate): a test that only needs an admin
  //     page calls browser.newPage() + adminUser.login(page) per test instead
  //     of using test.use({ storageState: 'playwright/.auth/admin.json' }).
  //     That leaks the page on assertion failure and re-runs a full auth flow.
  //   • LEGITIMATE (warning, not error, avoids false positives): multi-user
  //     tests that need a second page as a *different* user (reviewer, data
  //     consumer, team member) genuinely need browser.newPage() because the
  //     `page` fixture only provides one pre-authenticated admin page.
  //
  // When you see this warning, ask: "do all assertions in this test need only
  // one (admin) perspective?" If yes, switch to the fixture. If no (you need
  // a second user), the warning is expected — leave it as-is.
  {
    files: ['playwright/e2e/**/*.spec.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "CallExpression[callee.object.name='browser'][callee.property.name='newPage'][arguments.length=0]",
          message:
            'Prefer the `page` fixture (test.use({ storageState })) over browser.newPage() + manual login for single-user admin tests. For multi-user tests that need a second non-admin page, this warning is expected — no action needed.',
        },
      ],
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
