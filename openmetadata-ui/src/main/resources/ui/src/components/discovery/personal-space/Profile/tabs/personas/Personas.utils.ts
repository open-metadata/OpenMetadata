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

import { PageType } from '../../../../../../generated/system/ui/page';
import type { PersonaView } from './Personas.types';

const PATH_ADD = 'add';
const PATH_CUSTOMIZE = 'customize';

/**
 * Map the hash sub-path (everything after `#personas/`) to a view.
 *
 *   ''                          → landing
 *   'add'                       → add
 *   '<fqn>'                     → detail
 *   '<fqn>/customize/<category>'→ customize
 *
 * ponytail: persona FQNs are simple names (no `/`), so the `/customize/`
 * marker is an unambiguous split point — revisit only if persona FQNs ever
 * gain separators.
 */
export function hashSubPathToView(subPath: string): PersonaView {
  if (!subPath) {
    return { type: 'landing' };
  }

  if (subPath === PATH_ADD) {
    return { type: 'add' };
  }

  const marker = `/${PATH_CUSTOMIZE}/`;
  const markerIndex = subPath.indexOf(marker);

  if (markerIndex > -1) {
    const fqn = subPath.slice(0, markerIndex);
    const category = subPath.slice(markerIndex + marker.length);

    return { type: 'customize', fqn, name: fqn, category };
  }

  return { type: 'detail', fqn: subPath, name: subPath };
}

/** Inverse of {@link hashSubPathToView}; `undefined` for the landing view. */
export function viewToSubPath(view: PersonaView): string | undefined {
  switch (view.type) {
    case 'landing':
      return undefined;
    case 'add':
      return PATH_ADD;
    case 'detail':
      return view.fqn;
    case 'customize':
      return `${view.fqn}/${PATH_CUSTOMIZE}/${view.category}`;
    default:
      return undefined;
  }
}

/** Categories that open a grid of entity tiles instead of an editor. */
export const SUB_GRID_CATEGORIES = new Set(['governance', 'data-assets']);

const FULLSCREEN_CATEGORIES = new Set<string>([
  'homepage',
  PageType.LandingPage,
]);

/**
 * Home page and entity-level categories (`governance/Domain`) are edited on a
 * full page outside the personal-space modal; everything else stays inside it.
 */
export function isFullscreenPersonaCategory(category: string): boolean {
  return FULLSCREEN_CATEGORIES.has(category) || category.includes('/');
}

export function isFullscreenPersonaHash(
  tab: string | null,
  subPath: string
): boolean {
  if (tab !== 'personas') {
    return false;
  }
  const view = hashSubPathToView(subPath);

  return (
    view.type === 'customize' && isFullscreenPersonaCategory(view.category)
  );
}
