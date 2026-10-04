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

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfileNavId, PROFILE_NAV_IDS } from '../constants/Profile.constants';

/**
 * Parsed hash state for the settings modal.
 *
 * Hash format: `#<tab>[/<subPath>][?param=val&...]`
 *
 * Examples:
 *   #bots                              → { tab: 'bots', subPath: '', params: {} }
 *   #bots/autoclassification-bot       → { tab: 'bots', subPath: 'autoclassification-bot', params: {} }
 *   #bots?page=2&cursorType=after      → { tab: 'bots', subPath: '', params: { page: '2', cursorType: 'after' } }
 */
export interface SettingsHashState {
  tab: ProfileNavId | null;
  subPath: string;
  params: Record<string, string>;
}

const EMPTY_PARAMS: Record<string, string> = {};
const EMPTY_STATE: SettingsHashState = {
  tab: null,
  subPath: '',
  params: EMPTY_PARAMS,
};

function parseHash(hash: string): SettingsHashState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;

  if (!raw) {
    return EMPTY_STATE;
  }

  const [pathPart, queryPart] = raw.split('?', 2);
  const segments = pathPart.split('/');
  const candidate = segments[0] || '';
  const tab = PROFILE_NAV_IDS.has(candidate)
    ? (candidate as ProfileNavId)
    : null;

  if (!tab) {
    return EMPTY_STATE;
  }

  const subPath = segments.slice(1).join('/');

  let params = EMPTY_PARAMS;

  if (queryPart) {
    params = {};

    for (const pair of queryPart.split('&')) {
      const [key, val] = pair.split('=', 2);

      if (key) {
        params[decodeURIComponent(key)] = decodeURIComponent(val ?? '');
      }
    }
  }

  return { tab, subPath, params };
}

function buildHash(
  tab: string,
  subPath?: string,
  params?: Record<string, string | undefined>
): string {
  let hash = `#${tab}`;

  if (subPath) {
    hash += `/${subPath}`;
  }

  if (params) {
    const entries = Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== ''
    );

    if (entries.length > 0) {
      hash +=
        '?' +
        entries
          .map(
            ([k, v]) =>
              `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`
          )
          .join('&');
    }
  }

  return hash;
}

// The modal's BrowserRouter runs with `useTransitions`, so react-router wraps every
// location update in `React.startTransition` — a low-priority commit. The Teams panel
// pushes a stream of header-state updates (urgent re-renders) that starve that
// transition, so a `useLocation()`-derived view never commits and the modal appears
// frozen on the old sub-view until a refresh. This urgent store is updated
// synchronously by `setHash`/`clearHash` so the view switches immediately; react-router
// still owns the URL and history. Browser-driven changes (deep link, refresh,
// Back/Forward) are mirrored back in via the `location.hash` effect below.
let storeHash = typeof window !== 'undefined' ? window.location.hash : '';
const storeListeners = new Set<() => void>();

const setStoreHash = (next: string): void => {
  if (storeHash !== next) {
    storeHash = next;
    storeListeners.forEach((listener) => listener());
  }
};

const subscribeStoreHash = (onStoreChange: () => void): (() => void) => {
  storeListeners.add(onStoreChange);

  return () => {
    storeListeners.delete(onStoreChange);
  };
};

const getStoreHash = (): string => storeHash;

/**
 * Hook that syncs settings modal navigation with `location.hash`.
 *
 * The modal overlays the current page — the pathname stays untouched.
 * Hash presence means the modal should be open; clearing the hash closes it.
 */
export const useSettingsHash = () => {
  const navigate = useNavigate();

  // Keep navigate reachable from the stable callbacks below without listing it
  // (or location) as a dependency — an unstable `setHash` identity propagates
  // into panels' `onNavigate` callbacks and the header-injection effects that
  // depend on them, re-firing those effects every render (infinite loop).
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const hash = useSyncExternalStore(
    subscribeStoreHash,
    getStoreHash,
    getStoreHash
  );

  const state = useMemo(() => parseHash(hash), [hash]);

  // The urgent `storeHash` is the single source of truth; `setHash`/`clearHash`
  // keep it correct for in-app navigation. Only GENUINE browser-driven changes
  // (Back/Forward, deep link, refresh) need mirroring in. We listen to
  // `popstate` rather than react-router's `location.hash` because our own
  // `navigate(..., { replace: true })` wraps the update in a transition — reading
  // the lagged `location.hash` would echo a stale value back into the store and
  // flip it to the previous tab/sub-path (infinite oscillation). `replace`
  // navigations do not emit `popstate`, so they never echo back.
  useEffect(() => {
    const onPopState = () => setStoreHash(globalThis.location.hash);
    globalThis.addEventListener('popstate', onPopState);

    // Initial sync (not a real popstate event). A deep link opened in a new tab
    // is captured in the module-level `storeHash` at load time; the app's
    // initial auth/landing redirect can strip the hash from the URL before this
    // effect runs. Only adopt the live hash when it is non-empty, so that
    // redirect can't wipe the deep link — the modal still opens on the deep
    // view. Genuine browser navigation (Back/Forward to an empty hash) still
    // clears via the `popstate` listener above.
    const liveHash = globalThis.location.hash;
    if (liveHash || !storeHash) {
      setStoreHash(liveHash);
    }

    return () => globalThis.removeEventListener('popstate', onPopState);
  }, []);

  // pathname/search are read from `globalThis.location` at call time (mirroring
  // useTableFilters) so these callbacks stay referentially stable.
  const setHash = useCallback(
    (
      tab: string,
      subPath?: string,
      params?: Record<string, string | undefined>
    ) => {
      const next = buildHash(tab, subPath, params);

      if (storeHash !== next) {
        setStoreHash(next);
        navigateRef.current(
          {
            pathname: globalThis.location.pathname,
            search: globalThis.location.search,
            hash: next.slice(1),
          },
          { replace: true }
        );
      }
    },
    []
  );

  const clearHash = useCallback(() => {
    if (storeHash) {
      setStoreHash('');
      navigateRef.current(
        {
          pathname: globalThis.location.pathname,
          search: globalThis.location.search,
          hash: '',
        },
        { replace: true }
      );
    }
  }, []);

  const updateParams = useCallback(
    (params: Record<string, string | undefined>) => {
      if (state.tab) {
        setHash(state.tab, state.subPath || undefined, {
          ...state.params,
          ...params,
        });
      }
    },
    [state.tab, state.subPath, state.params, setHash]
  );

  return { state, setHash, clearHash, updateParams };
};

/**
 * Hook to read/write pagination params from the hash.
 * Drop-in replacement for usePaging when inside the settings modal.
 */
export const useHashPagingParams = () => {
  const { state, updateParams } = useSettingsHash();

  const page = Number(state.params.page) || 1;
  const cursorType = state.params.cursorType || undefined;
  const cursor = state.params.cursor || undefined;
  const pageSize = Number(state.params.pageSize) || undefined;

  const setPage = useCallback(
    (
      nextPage: number,
      nextCursorType?: string,
      nextCursor?: string,
      nextPageSize?: number
    ) => {
      updateParams({
        page: String(nextPage),
        cursorType: nextCursorType,
        cursor: nextCursor,
        pageSize: nextPageSize ? String(nextPageSize) : undefined,
      });
    },
    [updateParams]
  );

  return { page, cursorType, cursor, pageSize, setPage };
};

/**
 * Effect that opens the personal-space modal when a settings hash is present
 * on mount (deep link support). Call from PersonalSpaceModal.
 */
export const useSettingsHashSync = (
  openModal: (panel: 'profile') => void,
  isOpen: boolean
) => {
  const { state, clearHash } = useSettingsHash();
  const wasOpenRef = useRef(isOpen);
  const prevTabRef = useRef<string | null>(null);

  // Only auto-open when the hash itself changes (deep link or refresh),
  // not when isOpen flips (which would fight the close path).
  useEffect(() => {
    if (state.tab && state.tab !== prevTabRef.current && !isOpen) {
      openModal('profile');
    }
    prevTabRef.current = state.tab;
  }, [state.tab, isOpen, openModal]);

  // Clear hash only when modal transitions from open → closed (not on mount)
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      clearHash();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, clearHash]);
};
