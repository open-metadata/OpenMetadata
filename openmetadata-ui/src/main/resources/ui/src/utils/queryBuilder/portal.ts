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

export const DEFAULT_QUERY_BUILDER_PORTAL_ID = 'query-builder-portal';

/**
 * Returns (creating if needed) a dedicated top-layer portal node so popups
 * emitted from inside the query builder render above a react-aria overlay.
 *
 * `openmetadata-ui-core-components` overlays manage their own stacking, but a
 * popup whose container points at an external node does not get that automatic
 * treatment — the container's z-index becomes the popup's stacking floor.
 * 10001 clears the react-aria overlay ceiling of ~10000, and
 * `data-react-aria-top-layer` opts the node into the same stacking model so
 * focus and dismiss interactions keep working.
 *
 * Callers pass their own `containerId` when they need an independently
 * positioned node; the default is shared and sufficient for a single builder.
 */
export const getQueryBuilderPortalContainer = (
  containerId: string = DEFAULT_QUERY_BUILDER_PORTAL_ID
): HTMLElement => {
  const existing = document.getElementById(containerId);

  if (existing) {
    return existing;
  }

  const container = document.createElement('div');
  container.id = containerId;
  container.setAttribute('data-react-aria-top-layer', 'true');
  container.style.position = 'absolute';
  container.style.zIndex = '10001';
  document.body.appendChild(container);

  return container;
};
