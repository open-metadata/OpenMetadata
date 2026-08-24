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

import { useMemo } from 'react';
import leftSidebarClassBase from '../../../utils/LeftSidebarClassBase';
import { AppModule } from './AppModule.types';

/**
 * The modules backing the ClassicV1 app-mode shell, owned by
 * `LeftSidebarClassBase` (a downstream build overrides `getAppModeModules()` to
 * append its own). Re-exported here for consumers/tests that want the raw,
 * unsorted list. ClassicV1 is an app layout — these are not contributed by an
 * installed plugin.
 */
export const sharedAppModules: AppModule[] =
  leftSidebarClassBase.getAppModeModules();

/**
 * The full, ordered module list backing the app-mode shell — the modules from
 * `leftSidebarClassBase.getAppModeModules()` sorted by `navOrder` (ascending).
 * Ties keep insertion order.
 */
export const useAllAppModules = (): AppModule[] => {
  return useMemo(() => {
    const modules = leftSidebarClassBase.getAppModeModules();

    return modules
      .map((module, index) => ({ module, index }))
      .sort((a, b) =>
        a.module.navOrder === b.module.navOrder
          ? a.index - b.index
          : a.module.navOrder - b.module.navOrder
      )
      .map(({ module }) => module);
  }, []);
};
