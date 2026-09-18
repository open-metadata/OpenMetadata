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

// jsdom ships no `DataTransfer`, and every component that hands a `FileList`
// back to a callback builds one through it (see `filesToFileList` in
// `file-upload.tsx`). Without this shim, drop-zone code paths throw
// `DataTransfer is not defined` before any assertion runs. Only the
// `items.add` → `files` shape used by that helper is modelled.
if (typeof globalThis.DataTransfer === 'undefined') {
  class DataTransferPolyfill {
    private readonly collected: File[] = [];

    readonly items = {
      add: (file: File) => {
        this.collected.push(file);
      },
    };

    get files(): FileList {
      const list = [...this.collected];

      return Object.assign(list, {
        item: (index: number) => list[index] ?? null,
      }) as unknown as FileList;
    }
  }

  globalThis.DataTransfer =
    DataTransferPolyfill as unknown as typeof DataTransfer;
}
