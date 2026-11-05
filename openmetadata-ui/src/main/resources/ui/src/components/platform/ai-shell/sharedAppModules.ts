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
import { useApplicationsProvider } from '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { AppModule } from './AppModule.types';

/**
 * The base modules backing the AI app-mode shell, owned by
 * `LeftSidebarClassBase` (a downstream build overrides `getAppModeModules()` to
 * append its own). Re-exported here for consumers/tests that want the raw,
 * unsorted list. These are always present; install-gated modules come from
 * plugins (see `useAllAppModules`).
 */
export const sharedAppModules: AppModule[] =
  leftSidebarClassBase.getAppModeModules();

/**
 * The full, ordered module list backing the app-mode shell: the base modules
 * from `leftSidebarClassBase.getAppModeModules()` merged with any install-gated
 * modules contributed by installed plugins (`AppPlugin.getModeModules()` — the
 * `ApplicationsProvider` only exposes installed plugins, so these appear only
 * when their app is installed). Sorted by `navOrder` (ascending); ties keep
 * insertion order (base modules before plugin ones at the same `navOrder`).
 */
export const useAllAppModules = (): AppModule[] => {
  const { plugins = [] } = useApplicationsProvider() ?? {};

  return useMemo(() => {
    const pluginModules = plugins.flatMap(
      (plugin) => plugin.getModeModules?.() ?? []
    );
    const modules = [
      ...leftSidebarClassBase.getAppModeModules(),
      ...pluginModules,
    ];

    return modules
      .map((module, index) => ({ module, index }))
      .sort((a, b) =>
        a.module.navOrder === b.module.navOrder
          ? a.index - b.index
          : a.module.navOrder - b.module.navOrder
      )
      .map(({ module }) => module);
  }, [plugins]);
};
