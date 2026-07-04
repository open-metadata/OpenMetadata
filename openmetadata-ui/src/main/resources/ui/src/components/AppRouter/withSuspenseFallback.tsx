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

import { ComponentType, forwardRef, ReactNode, Suspense } from 'react';
import { PageLoader } from '../common/Loader/Loader';

export function withSuspenseFallback<T extends object>(
  Component: ComponentType<T>,
  // Keep embedded/background lazy chunks silent unless a caller opts into visible progress.
  fallback: ReactNode = null
) {
  return forwardRef<unknown, T>(function DefaultFallback(props, ref) {
    return (
      <Suspense fallback={fallback}>
        <Component {...(props as T)} ref={ref} />
      </Suspense>
    );
  });
}

export function withPageSuspenseFallback<T extends object>(
  Component: ComponentType<T>
) {
  return withSuspenseFallback(Component, <PageLoader />);
}

export default withSuspenseFallback;
