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
import * as jsoncParser from 'jsonc-eslint-parser';
import tseslint from 'typescript-eslint';
import openMetadataI18n from './eslint-rules/openmetadata-i18n.mjs';
import openMetadataImports from './eslint-rules/openmetadata-imports.mjs';
import openMetadataPerformance from './eslint-rules/openmetadata-performance.mjs';
import openMetadataPlaywright from './eslint-rules/openmetadata-playwright.mjs';
import openMetadataUiPatterns from './eslint-rules/openmetadata-ui-patterns.mjs';
import omPlaywright from './playwright/eslint-rules/index.mjs';

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
      'src/jsons/**',
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
      'openmetadata-i18n': openMetadataI18n,
      'openmetadata-imports': openMetadataImports,
      'openmetadata-performance': openMetadataPerformance,
      'openmetadata-ui-patterns': openMetadataUiPatterns,
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
      'jest/no-disabled-tests': 'error',
      'jest-formatting/padding-around-all': 'error',

      // TypeScript rules
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Cleared to zero and locked by the ESLint-cleanup stack — safe reorders
      // where possible, documented disables for mutual-recursion / derived-below
      // cases. Promoted to error so CI blocks any regression.
      '@typescript-eslint/no-use-before-define': 'error',
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
      // Cleared to zero and locked by the ESLint-cleanup stack — every site is
      // a real type (generated/ entities, precise props, unknown+guards,
      // as-unknown-as fixture casts, derived component types). No suppressions.
      // Promoted to error so CI blocks any regression.
      '@typescript-eslint/no-explicit-any': 'error',

      // No user-facing string literals — all copy goes through `t()`. Cleared to
      // zero (mock/fixture files exempted below; decorative glyphs carry a
      // documented disable) and enforced at error so CI blocks new hardcoded copy.
      'i18next/no-literal-string': 'error',

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

      // --- blocking (error): brought to zero by the ESLint-cleanup stack and
      // locked so they cannot regress. jsx-a11y + safe-mechanical sonarjs were
      // cleared in the a11y/safe-mechanical PR; promoting to error keeps CI red
      // on any new violation instead of letting the backlog silently grow back.
      'jsx-a11y/control-has-associated-label': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/label-has-for': 'error',
      'jsx-a11y/no-autofocus': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/interactive-supports-focus': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/mouse-events-have-key-events': 'error',
      'jsx-a11y/media-has-caption': 'error',
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',
      'jsx-a11y/anchor-ambiguous-text': 'error',
      'openmetadata-ui-patterns/no-raw-title-attribute': 'error',
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/no-extra-arguments': 'error',
      'sonarjs/no-redundant-jump': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/prefer-object-literal': 'error',
      'sonarjs/no-redundant-boolean': 'error',

      // --- warn tier: on, visible, not yet blocking. Counts are the measured
      // backlog at the time of writing; they only go down. Each is promoted to
      // error by its own cleanup PR once its violations reach zero.
      'react-hooks/exhaustive-deps': 'warn', // 1693 across 596 files
      // Stock sonarjs flags i18n translation keys (t('label.…')), which must
      // stay inline. Replaced by the i18n-aware variant below, which ignores
      // t() keys and label./message./server. strings and is enforced at error.
      'sonarjs/no-duplicate-string': 'off',
      'openmetadata-i18n/no-duplicate-string': 'error',
      'sonarjs/cognitive-complexity': ['warn', 15], // 85

      // Complexity and structure. SonarCloud gates these on new code; these
      // surface the same findings locally and in the editor.
      'sonarjs/cyclomatic-complexity': 'warn', // 54 in a 400-file sample
      // Promoted to error: all 141 over-complex expressions refactored by
      // extracting sub-expressions into named consts (short-circuit preserved);
      // backlog is zero and this ratchets it.
      'sonarjs/expression-complexity': 'error',
      // Promoted to error: all nested-ternary violations refactored to
      // intermediate variables / if-else; backlog is zero and this ratchets it.
      'sonarjs/no-nested-conditional': 'error',
      // Promoted to error: all 75 deeply-nested functions refactored by
      // hoisting the innermost callback to a shallower named scope; backlog is
      // zero and this ratchets it.
      'sonarjs/no-nested-functions': 'error',

      // Security. Enforced in production code. Test fixtures, mock data, and
      // the sample-entity constants files legitimately embed http:// self-links,
      // localhost IPs, and dummy credentials — those paths are exempted in a
      // dedicated override below (matching how SonarQube excludes test sources
      // from security scanning), so production stays clean at error.
      'sonarjs/no-clear-text-protocols': 'error',
      'sonarjs/no-hardcoded-passwords': 'error',
      'sonarjs/no-hardcoded-ip': 'error',
      'sonarjs/no-invariant-returns': 'warn', // 0 in sample

      // React correctness and re-render cost — the enforceable slice of
      // frontend-performance.md. Cleared to zero by the ESLint-cleanup stack —
      // stable keys, hoisted components, memoized context values; documented
      // disables only where no real fix exists (static never-reordered lists,
      // dangerouslySetInnerHTML on sanitized content). Promoted to error.
      'react/no-array-index-key': 'error',
      'react/jsx-no-constructed-context-values': 'error',
      'react/no-unstable-nested-components': 'error',
      'react/no-danger': 'error',
      // Cleared to zero and locked by the ESLint-cleanup stack — redundant `!`
      // removed / narrowed where safe, documented disables where the value is
      // non-null by invariant. `!` is compile-time only, so no `!`→`?.` rewrites
      // (that would change throw-on-null to silent undefined). Promoted to error.
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Import architecture and request fan-out. These are warnings while the
      // measured legacy backlog is worked down; they are reporting-only and do
      // not rewrite source under --fix.
      'openmetadata-imports/no-api-calls-in-iteration': 'warn',
      'openmetadata-imports/no-circular-imports': 'warn',
      'openmetadata-imports/no-cross-page-imports': 'warn',
      'openmetadata-imports/no-hook-ui-imports': 'warn',
      'openmetadata-imports/no-impure-pure-utils': 'warn',
      'openmetadata-imports/no-internal-barrel-imports': 'warn',
      'openmetadata-imports/no-lodash-default-import': 'warn',
      'openmetadata-imports/no-lower-layer-page-imports': 'warn',
      'openmetadata-imports/no-rest-ui-imports': 'warn',
      'openmetadata-imports/review-sequential-api-calls': 'warn',

      // Repository-specific performance invariants. These rules have no
      // existing backlog and are reporting-only, so they can block without
      // rewriting files under --fix.
      'openmetadata-performance/require-suspense-fallback': 'error',
      'openmetadata-performance/no-unbounded-module-cache': 'error',

      // NOT enabled: react/jsx-no-useless-fragment. It auto-fixes, so at any
      // severity `eslint --fix` would rewrite files and hard-fail the
      // git-diff check in ui-checkstyle. Land a one-time repo-wide autofix
      // commit first, then add it here at error.
    },
  },

  // Route modules must preserve page-level code splitting. Type-only imports
  // remain allowed because they do not create a runtime bundle edge.
  {
    files: ['src/components/AppRouter/**/*.{ts,tsx}'],
    rules: {
      'openmetadata-performance/no-eager-page-imports': 'error',
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
    // The local plugin lives under playwright/ but is a linter, not a test:
    // applying rules like no-positional-locator to its own source is
    // meaningless, and its RuleTester fixtures deliberately contain the exact
    // anti-patterns those rules look for.
    ignores: ['**/playwright/eslint-rules/**'],
    plugins: {
      'openmetadata-playwright': openMetadataPlaywright,
      playwright,
      'om-playwright': omPlaywright,
    },
    rules: {
      // TypeScript/base rule overrides for Playwright files
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-duplicate-enum-values': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'prefer-const': 'off',

      // Playwright must not import application code from `src/`.
      //
      // Playwright runs in plain Node with no bundler, no CSS pipeline and no
      // i18n bootstrap. A single import of an app util drags the whole app
      // dependency graph into the test process, e.g.:
      //
      //   IncidentManager.spec.ts
      //     -> playwright/utils/incidentManager        (playwright util)
      //       -> src/utils/StringUtils                 (app util)
      //         -> src/utils/i18next/LocalUtil         (app i18n bootstrap)
      //           -> @openmetadata/ui-core-components  (the whole component library)
      //
      // Two exceptions, both dependency-free by construction:
      //   • src/generated/**  — code-generated schema types/enums; they are the
      //     API contract the tests build request payloads from, and generated
      //     files only ever reference other generated files.
      //   • src/enums/**      — leaf enum modules with no imports of their own.
      //
      // Anything else (utils, context, components, rest, hooks, pages) must be
      // duplicated under playwright/ instead — see playwright/utils/dateTime.ts
      // and playwright/support/entity/Entity.interface.ts for the pattern.
      // Type-only imports are restricted too: an `import type` that later loses
      // its `type` keyword silently reintroduces the runtime dependency.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // A `group` of ['**/src/**', '!**/src/generated/**'] does NOT
              // work here: `group` uses gitignore semantics, which cannot
              // re-include a path whose parent directory is already excluded.
              // The negative lookahead is what actually carves out the two
              // allowed subtrees.
              regex: '(^|/)src/(?!generated/|enums/)',
              message:
                'Playwright tests must not import app code from src/ — it pulls the app dependency graph (i18n, @openmetadata/ui-core-components) into the test process. Only src/generated/** and src/enums/** are allowed; duplicate anything else under playwright/.',
            },
          ],
          paths: [
            {
              name: '@openmetadata/ui-core-components',
              message:
                'The component library must never be imported by Playwright tests — it is browser-only React code with no place in a Node test process.',
            },
          ],
        },
      ],

      // Playwright rules — blocking (error): zero existing violations, prevent regressions
      'playwright/no-networkidle': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/missing-playwright-await': 'error',
      'playwright/valid-expect': 'error',
      'playwright/no-element-handle': 'error',
      'playwright/no-eval': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/no-useless-await': 'error',

      // A facet aggregation wait must name the value it is waiting for, not just
      // the endpoint or field: a dropdown fires one aggregation when it opens and
      // one per typed search, so a wait that names neither can resolve off the
      // wrong one and run the test ahead of the request it queued (#31859). Warn
      // rather than error while the remaining 27 call sites are migrated to
      // playwright/utils/searchAggregation.ts.
      'openmetadata-playwright/require-aggregation-wait-helper': 'warn',

      // Playwright rules — promoted to error behind the suppressions ratchet
      // (see eslint-suppressions.json): existing violations are snapshotted,
      // new ones fail lint.
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-skipped-test': 'error',
      'playwright/no-wait-for-selector': 'error',

      // Local OpenMetadata Playwright rules.
      'om-playwright/no-awaited-wait-for-response': 'error',
      'om-playwright/no-blanket-test-slow': 'error',
      'om-playwright/no-positional-locator': 'error',
      'om-playwright/justified-rule-disable': 'error',
    },
  },

  // Custom rules that only make sense on e2e spec files
  {
    files: ['playwright/e2e/**/*.spec.{js,jsx,ts,tsx}'],
    plugins: {
      'om-playwright': omPlaywright,
    },
    rules: {
      'om-playwright/require-assertion-per-test': 'error',
    },
  },

  // Local ESLint plugin (playwright/eslint-rules/**): plain ESM, matching the
  // repo's other rule plugins in eslint-rules/. Excluded from the Playwright
  // test rules above, and needs the Node globals its RuleTester and node:test
  // usage rely on.
  //
  // scripts/*.mjs is build-time tooling that runs under Node directly. It had
  // no config block, so `process`/`console` were undefined there — an error
  // only reachable when a scripts/ file lands in a changed-file lint, which the
  // merge queue guarantees and a PR event does not. The .js tooling alongside
  // it is CommonJS and needs a different fix; left alone deliberately.
  {
    files: ['playwright/eslint-rules/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
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

  // Test fixtures and mock data use literal and repeated strings as selectors and
  // sample values, so production-facing string rules create noise without protecting
  // user-visible copy.
  {
    files: [
      'src/**/*.test.{ts,tsx}',
      'src/**/*.mock.{ts,tsx,js}',
      'src/**/mocks/**/*.{ts,tsx,js}',
      'src/test/**/*.{ts,tsx,js}',
    ],
    rules: {
      'i18next/no-literal-string': 'off',
      'openmetadata-i18n/no-duplicate-string': 'off',
    },
  },

  // Mock and fixture data legitimately repeats sample strings; no-duplicate-string
  // targets production maintainability, so scope it off for these files (production
  // constants/utils are NOT exempt — their duplicates are extracted to constants).
  {
    files: [
      'src/**/*.mock.{ts,tsx}',
      'src/**/mocks/**/*.{ts,tsx}',
      'src/**/__mocks__/**/*.{ts,tsx}',
      'src/constants/mockTourData.constants.ts',
    ],
    rules: {
      'openmetadata-i18n/no-duplicate-string': 'off',
    },
  },

  // Test setup files
  {
    files: [
      'src/setupTests.js',
      'src/**/*.test.{js,jsx,ts,tsx}',
      'src/**/*.spec.{js,jsx,ts,tsx}',
      'src/test/unit/mocks/**/*.{js,jsx,ts,tsx}',
      'playwright/**/*.spec.{js,jsx,ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Security rules (clear-text protocols, hardcoded IPs/passwords) target
  // production code paths. Test fixtures and mock data legitimately embed
  // sample http:// self-links (mirroring backend responses), localhost IPs, and
  // dummy credentials — exempt them, matching how SonarQube excludes test
  // sources from security scanning. mockTourData is a 100%-mock guided-tour
  // fixture whose sample links point at the local dev server (http://localhost),
  // so it is exempt too; production constants files are NOT — their sample URLs
  // were fixed to https and the rules stay enforced there.
  {
    files: [
      'src/**/*.test.{js,jsx,ts,tsx}',
      'src/**/*.mock.{ts,tsx}',
      'src/**/mocks/**/*.{ts,tsx}',
      'src/**/__mocks__/**/*.{ts,tsx}',
      'src/constants/mockTourData.constants.ts',
    ],
    rules: {
      'sonarjs/no-clear-text-protocols': 'off',
      'sonarjs/no-hardcoded-ip': 'off',
      'sonarjs/no-hardcoded-passwords': 'off',
    },
  },
];
