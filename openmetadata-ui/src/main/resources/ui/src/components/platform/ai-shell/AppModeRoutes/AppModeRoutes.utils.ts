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

import { ExtensionPointRegistry } from '../../../../utils/ExtensionPointRegistry';
import { AppModule } from '../AppModule.types';
import { KeepAliveRoute } from '../KeepAliveRoutes/KeepAliveRoutes';

/**
 * Flattens every module's routes into the app-mode route table. A module
 * that owns a `resolveRoutes` resolver (e.g. `connectionsModule`, which
 * splices `EXTENSION_POINTS.CONNECTIONS_ROUTES` contributions ahead of its
 * generic `:tab` route) is resolved through it so plugin-contributed routes
 * (Collate's AgentJob detail page, for example) make it into the table;
 * modules without one fall back to their static `routes` array unchanged.
 *
 * Falling back only when `registry` itself is missing (rather than
 * whenever `resolveRoutes` returns an empty array) matters: a module with
 * zero current contributions must still render as "no extra routes", not
 * silently revert to `routes`.
 */
export const resolveAppModuleRoutes = (
  modules: AppModule[],
  registry?: ExtensionPointRegistry
): KeepAliveRoute[] =>
  modules.flatMap((module) => {
    const routes = registry
      ? module.resolveRoutes?.(registry) ?? module.routes
      : module.routes;

    return routes.map((route) => ({
      element: route.element,
      path: route.path,
      children: route.children,
    }));
  });
