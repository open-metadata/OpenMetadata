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
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PROFILE_NAV_IDS } from '../constants/Profile.constants';
// eslint-disable-next-line openmetadata-imports/no-hook-ui-imports -- type-only import for hash ↔ nav-id mapping
import type { ProfileNavId } from '../components/discovery/personal-space/Profile/profileNavConfig';

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

/**
 * Hook that syncs settings modal navigation with `location.hash`.
 *
 * The modal overlays the current page — the pathname stays untouched.
 * Hash presence means the modal should be open; clearing the hash closes it.
 */
export const useSettingsHash = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const state = useMemo(
    () => parseHash(location.hash),
    [location.hash]
  );

  const setHash = useCallback(
    (
      tab: string,
      subPath?: string,
      params?: Record<string, string | undefined>
    ) => {
      const next = buildHash(tab, subPath, params);

      if (window.location.hash !== next) {
        navigate({ hash: next.slice(1) }, { replace: true });
      }
    },
    [navigate]
  );

  const clearHash = useCallback(() => {
    if (window.location.hash) {
      navigate(
        { pathname: location.pathname, search: location.search, hash: '' },
        { replace: true }
      );
    }
  }, [navigate, location.pathname, location.search]);

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
