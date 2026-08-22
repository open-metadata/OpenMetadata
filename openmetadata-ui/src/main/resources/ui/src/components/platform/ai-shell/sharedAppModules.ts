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
import { CLASSIC_V1_APP_MODE } from '../../../constants/appMode.constants';
import { contextCenterModule } from '../../discovery/context-center/contextCenter.module';
import { entityModule } from '../../discovery/entity/entity.module';
import { personalSpaceModule } from '../../discovery/personal-space/personalSpace.module';
import { marketplaceModule } from '../../governance/marketplace/marketplace.module';
import { observabilityModule } from '../../observability/ObservabilityModule/observability.module';
import { useApplicationsProvider } from '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { AppModule } from './AppModule.types';

/**
 * OSS shared modules for the app-mode shell — surfaces owned by
 * OpenMetadata core that appear in the shell for every consumer.
 *
 * Ordered by `navOrder` for readability; `useAllAppModules` sorts the union
 * with plugin contributions regardless.
 */
export const sharedAppModules: AppModule[] = [
  entityModule,
  observabilityModule,
  contextCenterModule,
  marketplaceModule,
  personalSpaceModule,
];

/**
 * The full, ordered module list backing the app-mode shell.
 *
 * Merges the OSS `sharedAppModules` with every module an installed
 * `AppPlugin` contributes via `getModeModules(CLASSIC_V1_APP_MODE)` — the
 * plugin-native mechanism mirroring `getRoutes()` for Classic mode — and
 * sorts the union by `navOrder` (ascending). Ties keep insertion order:
 * shared modules before plugin-contributed ones at the same `navOrder`.
 */
export const useAllAppModules = (): AppModule[] => {
  const { plugins = [] } = useApplicationsProvider() ?? {};

  return useMemo(() => {
    const contributed = plugins.flatMap(
      (plugin) => plugin.getModeModules?.(CLASSIC_V1_APP_MODE) ?? []
    );
    const merged = [...sharedAppModules, ...contributed];

    return merged
      .map((module, index) => ({ module, index }))
      .sort((a, b) =>
        a.module.navOrder === b.module.navOrder
          ? a.index - b.index
          : a.module.navOrder - b.module.navOrder
      )
      .map(({ module }) => module);
  }, [plugins]);
};
