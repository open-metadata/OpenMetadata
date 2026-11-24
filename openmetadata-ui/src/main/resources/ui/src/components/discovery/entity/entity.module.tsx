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

import React from 'react';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { AppModule } from '../../platform/ai-shell/AppModule.types';
import { RoutePosition } from '../../Settings/Applications/plugins/AppPlugin';
import { ENTITY_MODULE_PREFIX, ENTITY_ROUTES } from './entity.constants';

const EntityDetailPage = withSuspenseFallback(
  React.lazy(() => import('./EntityDetailPage'))
);

const EntityVersionPage = withSuspenseFallback(
  React.lazy(
    () => import('../../../pages/EntityVersionPage/EntityVersionPage.component')
  )
);

/**
 * Icon-less app-module owning the entity-detail and entity-version routes.
 *
 * It contributes no sidebar item (no `icon`) — the sidebar derivation skips
 * icon-less modules — but its routes still flatten into the app-mode route
 * tree, so entity detail/version pages resolve inside the shell when reached
 * by navigation from another surface (Explore, search, lineage, …).
 */
export const entityModule: AppModule = {
  id: 'entity',
  navOrder: 15,
  labelKey: 'label.entity',
  prefix: ENTITY_MODULE_PREFIX,
  defaultPath: ENTITY_MODULE_PREFIX,
  routes: [
    {
      path: ENTITY_ROUTES.ENTITY,
      element: <EntityDetailPage />,
      position: RoutePosition.APP,
    },
    {
      path: ENTITY_ROUTES.ENTITY_WITH_TAB,
      element: <EntityDetailPage />,
      position: RoutePosition.APP,
    },
    {
      path: ENTITY_ROUTES.ENTITY_WITH_SUB_TAB,
      element: <EntityDetailPage />,
      position: RoutePosition.APP,
    },
    {
      path: ENTITY_ROUTES.ENTITY_VERSION,
      element: <EntityVersionPage />,
      position: RoutePosition.APP,
    },
    {
      path: ENTITY_ROUTES.ENTITY_VERSION_WITH_TAB,
      element: <EntityVersionPage />,
      position: RoutePosition.APP,
    },
  ],
};
