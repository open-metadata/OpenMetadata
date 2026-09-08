import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';

// Extend explicitly rather than via the `@testing-library/jest-dom/vitest`
// side-effect import: with `globals: false`, that import's internal
// `expect.extend` does not reliably reach the `expect` the test files import,
// leaving every jest-dom matcher (`toHaveClass`, …) undefined. Extending the
// imported `expect` here applies the matchers to the same singleton the tests
// use.
expect.extend(matchers);

// `globals: false` in vitest.config.ts means Testing Library's automatic
// cleanup (which detects a global `afterEach`) never registers, so each
// render leaks into the next test's jsdom document. Clean up explicitly.
afterEach(() => {
  cleanup();
});
