import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// `globals: false` in vitest.config.ts means Testing Library's automatic
// cleanup (which detects a global `afterEach`) never registers, so each
// render leaks into the next test's jsdom document. Clean up explicitly.
afterEach(() => {
  cleanup();
});
