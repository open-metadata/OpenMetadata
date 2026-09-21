/*
 *  Copyright 2026 Collate.
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
 * Isolated wrapper for the compile-time `import.meta.env.PW_E2E_BUILD`
 * flag. Two consumers care about it:
 *
 *   1. Vite build — inlines the boolean and lets the guarded branch tree-
 *      shake out of production bundles.
 *   2. Jest — cannot parse `import.meta` under the default CJS transformer,
 *      so callers that reach the flag through this module can be jest-mocked
 *      (`jest.mock('./isPlaywrightBuild', () => ({ isPlaywrightBuild: () =>
 *      true }))`) without dragging the syntax into the test file itself.
 *
 * Keep the flag read in exactly this one module — importing `import.meta`
 * from any test-imported file re-triggers the Jest parse error.
 */

export const isPlaywrightBuild = (): boolean => {
  return Boolean(import.meta.env.PW_E2E_BUILD);
};
