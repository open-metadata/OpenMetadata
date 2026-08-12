/*
 *  Copyright 2025 Collate.
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
import { SIDEBAR_ENTITY_PATH_ALIASES } from '../constants/LeftSidebar.constants';

/**
 * Derive the active left-sidebar key(s) for the current route.
 *
 * A sidebar item is highlighted when its `key` matches the key derived here.
 * Resolution order:
 *  1. A registered 3-segment "deep path" (e.g. `/context-center/dashboard`) wins
 *     as-is so nested list pages stay active.
 *  2. Otherwise the first two path segments are used (e.g. `/glossary`).
 *  3. Entity detail/version pages are served through routes that use the
 *     singular entity path (`/tag/:fqn`, `/metric/:fqn`, `/glossary-term/...`)
 *     while their sidebar entry points at the list route (`/tags`, `/metrics`,
 *     `/glossary`). The alias map bridges that so the parent stays highlighted
 *     whenever the user is inside one of its children.
 */
export const getSidebarActiveKeys = (
  pathname: string,
  nestedKeys: Record<string, string>,
  aliases: Record<string, string> = SIDEBAR_ENTITY_PATH_ALIASES
): string[] => {
  const pathArray = pathname.split('/');
  const deepPath = [...pathArray].splice(0, 3).join('/');

  if (nestedKeys[deepPath]) {
    return [deepPath];
  }

  const shallowPath = pathArray.splice(0, 2).join('/');

  return [aliases[shallowPath] ?? shallowPath];
};
