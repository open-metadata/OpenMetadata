# Unit tests enforce runner correctness separately from production UI structure

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** UI maintainers
- **Guard:** `eslint-rules/eslint-config.test.mjs` in the application UI
- **Related:** Collate issue #8580

## Context

Unit tests render deliberately simplified mocks and fixtures. Accessibility,
rendering performance, production import layering, and complexity checks on those
fixtures produce warnings and repeated inline suppressions without checking the
shipped component. The production files remain linted separately.

## Decision

Scope Jest rules to `src/**/*.test.{js,jsx,ts,tsx}`, matching the Jest runner.
Do not apply Jest rules to Playwright, setup files, or the Vitest component library.
Keep type checking, hook correctness, unused-variable checks, and general
correctness rules active in tests. Allow CommonJS imports where Jest factories
need to load mocked modules after their mocks are installed.

Exclude production accessibility, rendering-cost, complexity, import-layer and
design-token rules from unit tests.
Keep those checks unchanged on production files. Remove unused inline directives;
keep active exceptions rather than silently weakening their underlying rules.

Enable measured, zero-backlog Jest correctness rules as errors.

Do not enable every recommended rule blindly. `no-conditional-expect` flags
legitimate table-driven branches, `no-standalone-expect` flags assertion helpers,
and `valid-expect` flags OSS assertions attached before fake timers or deferred
requests are advanced and awaited afterward. Assertion-free tests must be
repaired before enabling the assertion-presence check.

## Consequences

Test lint reports actionable correctness findings instead of mock-UI styling
noise. A clean test scan does not prove accessibility or production performance;
production checks and runtime tests remain required. Suppressed type findings are
still debt and must be fixed with real fixture and mock types before promotion.
