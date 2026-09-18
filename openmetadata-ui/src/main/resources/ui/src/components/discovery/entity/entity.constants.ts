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

/**
 * Route namespace owned by the entity app-module. These paths mount the
 * entity-detail and entity-version surfaces inside the app-mode shell. The
 * module is icon-less (no sidebar item), so these paths are reached by
 * navigation from other surfaces rather than a nav click.
 */
export const ENTITY_ROUTES = {
  ENTITY: '/entity/:entityType/:fqn',
  ENTITY_WITH_TAB: '/entity/:entityType/:fqn/:tab',
  ENTITY_WITH_SUB_TAB: '/entity/:entityType/:fqn/:tab/:subTab',
  ENTITY_VERSION: '/entity/:entityType/:fqn/versions/:version',
  ENTITY_VERSION_WITH_TAB: '/entity/:entityType/:fqn/versions/:version/:tab',
} as const;

/** Primary URL namespace owned by the entity module. */
export const ENTITY_MODULE_PREFIX = '/entity';
