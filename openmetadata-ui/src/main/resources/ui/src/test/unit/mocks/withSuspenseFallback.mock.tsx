/*
 *  Copyright 2022 Collate.
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

import { ComponentType, forwardRef, Suspense } from 'react';

/**
 * Test mock for withSuspenseFallback.
 * Mirrors production: uses forwardRef so ref-dependent components behave
 * correctly in tests. Uses null fallback so no loader appears during resolution.
 */
export function withSuspenseFallback<T extends object>(
  Component: ComponentType<T>
) {
  return forwardRef<unknown, T>(function DefaultFallback(props, ref) {
    return (
      <Suspense fallback={null}>
        <Component {...(props as T)} ref={ref} />
      </Suspense>
    );
  });
}

// Route-level chunks use a visible fallback in production, but unit tests keep
// the mock silent to avoid unrelated loader assertions across router tests.
export const withPageSuspenseFallback = withSuspenseFallback;

export default withSuspenseFallback;
