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
export type StudioUrlMode = 'view' | 'edit' | 'query' | 'ai';
export type StudioUrlView =
  | 'graph'
  | 'tree'
  | 'ontology'
  | 'console'
  | 'builder';
export type StudioUrlVersion = 'draft' | 'published';

export interface StudioUrlState {
  readonly mode?: StudioUrlMode;
  readonly view?: StudioUrlView;
  readonly version?: StudioUrlVersion;
}

const MODES: readonly StudioUrlMode[] = ['view', 'edit', 'query', 'ai'];
const VERSIONS: readonly StudioUrlVersion[] = ['draft', 'published'];
const VIEWS_BY_MODE: Record<StudioUrlMode, readonly StudioUrlView[]> = {
  view: ['graph', 'tree', 'ontology'],
  edit: ['graph', 'tree', 'ontology'],
  query: ['console', 'builder'],
  ai: [],
};
const ALL_VIEWS: readonly StudioUrlView[] = [
  'graph',
  'tree',
  'ontology',
  'console',
  'builder',
];

export const STUDIO_MODE_PARAM = 'mode';
export const STUDIO_VIEW_PARAM = 'view';
export const STUDIO_VERSION_PARAM = 'version';

const pick = <T extends string>(
  allowed: readonly T[],
  value: string | null
): T | undefined => allowed.find((item) => item === value);

/** Reads mode, view and version; a value the Studio does not know is dropped, not guessed. */
export const parseStudioUrlState = (
  params: URLSearchParams
): StudioUrlState => {
  const mode = pick(MODES, params.get(STUDIO_MODE_PARAM));
  const view = pick(ALL_VIEWS, params.get(STUDIO_VIEW_PARAM));
  const version = pick(VERSIONS, params.get(STUDIO_VERSION_PARAM));

  return {
    ...(mode ? { mode } : {}),
    ...(view && (!mode || VIEWS_BY_MODE[mode].includes(view)) ? { view } : {}),
    ...(version ? { version } : {}),
  };
};

/** The view a mode opens on when the URL names none. */
export const defaultViewFor = (
  mode: StudioUrlMode
): StudioUrlView | undefined => VIEWS_BY_MODE[mode][0];

/**
 * Writes mode, view and version over `params`, leaving every other parameter alone.
 * A value that equals its default is removed, so the plain URL keeps meaning "View, Graph".
 * `keepViewMode` writes `mode=view` even though it is the default, for a URL that also
 * carries a draft link, which would otherwise open Review.
 */
export const buildStudioUrlParams = (
  params: URLSearchParams,
  state: StudioUrlState,
  keepViewMode = false
): URLSearchParams => {
  const next = new URLSearchParams(params);
  const mode = state.mode ?? 'view';
  const view =
    state.view && VIEWS_BY_MODE[mode].includes(state.view)
      ? state.view
      : undefined;
  const setOrDelete = (key: string, value: string | undefined) =>
    value ? next.set(key, value) : next.delete(key);

  setOrDelete(
    STUDIO_MODE_PARAM,
    mode !== 'view' || keepViewMode ? mode : undefined
  );
  setOrDelete(
    STUDIO_VIEW_PARAM,
    view && view !== defaultViewFor(mode) ? view : undefined
  );
  setOrDelete(
    STUDIO_VERSION_PARAM,
    state.version === 'published' ? 'published' : undefined
  );

  return next;
};

/**
 * Changes the named fields of the current mode, view and version and keeps the rest. A field
 * present in `patch` with the value `undefined` is cleared. A URL that carries a draft link
 * keeps an explicit `mode=view` once the patch names a mode, so it does not fall back to Review.
 */
export const patchStudioUrlParams = (
  params: URLSearchParams,
  patch: StudioUrlState
): URLSearchParams =>
  buildStudioUrlParams(
    params,
    { ...parseStudioUrlState(params), ...patch },
    params.has('draft') && 'mode' in patch
  );
