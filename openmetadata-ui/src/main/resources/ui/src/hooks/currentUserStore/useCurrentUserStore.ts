/*
 *  Copyright 2024 Collate.
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

import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { RecentlySearchedData, RecentlyViewedData } from 'Models';
import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import { patchUserPreferences } from '../../rest/userAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { useApplicationStore } from '../useApplicationStore';

export interface MarketplaceRecentSearchEntry {
  term: string;
  timestamp: number;
}

export interface UserPreferences {
  isSidebarCollapsed: boolean;
  selectedEntityTableColumns: Record<string, string[]>;
  globalPageSize: number;
  recentlyViewed: RecentlyViewedData[];
  recentlySearched: RecentlySearchedData[];
  recentlyViewedQuickLinks: RecentlyViewedData[];
  marketplaceRecentSearches: MarketplaceRecentSearchEntry[];
  connectionsViewMode?: 'grid' | 'list';
  /**
   * Boot-time app-mode preference — the "open in this mode when I log in"
   * checkbox in the app-mode switcher. `null` means "no explicit preference,
   * fall back to persona/app-default/constant at boot." Only the switcher's
   * checkbox writes this field; runtime mode-switching does NOT touch it.
   */
  appMode: string | null;
}

interface Store {
  preferences: Record<string, UserPreferences>;
  setUserPreference: (
    userName: string,
    preferences: Partial<UserPreferences>
  ) => void;
  getUserPreference: (userName: string) => UserPreferences;
  clearUserPreference: (userName: string) => void;
}

const defaultPreferences: UserPreferences = {
  isSidebarCollapsed: false,
  selectedEntityTableColumns: {},
  globalPageSize: PAGE_SIZE_BASE,
  recentlyViewed: [],
  recentlySearched: [],
  recentlyViewedQuickLinks: [],
  marketplaceRecentSearches: [],
  appMode: null,
};

export const usePersistentStorage = create<Store>()(
  persist(
    (set, get) => ({
      preferences: {},

      setUserPreference: (
        userName: string,
        newPreferences: Partial<UserPreferences>
      ) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            [userName]: {
              ...defaultPreferences,
              ...state.preferences[userName],
              ...newPreferences,
            },
          },
        }));
      },

      getUserPreference: (userName: string) => {
        const state = get();

        return state.preferences[userName] || defaultPreferences;
      },

      clearUserPreference: (userName: string) => {
        set((state) => {
          const { [userName]: _, ...rest } = state.preferences;

          return { preferences: rest };
        });
      },
    }),
    {
      name: 'user-preferences-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Preference keys that are synced to the backend (the standalone
// `user_preferences` side table, via `patchUserPreferences`) in addition to
// being persisted locally. Everything else in UserPreferences stays purely
// on-device. Keep this to a single entry for now — see the task brief for
// the rollout plan of additional keys.
export const BACKEND_SYNCED_KEYS = new Set<keyof UserPreferences>(['appMode']);
const DEBOUNCE_MS = 300;

// Module-level state for the debounced backend sync. `pendingPatch` holds
// the last-write-wins value per key for the in-flight debounce window
// (`null` means "emit a JSON-Patch remove"). `previousValues` snapshots what
// each key's value was immediately before the *first* write in the current
// batch, so a failed PATCH can roll the local store back to exactly what the
// user saw beforehand (not to whatever the server last confirmed, which may
// be stale or absent for keys that were never migrated up).
const pendingPatch = new Map<string, unknown>();
const previousValues = new Map<string, unknown>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let serverKnown: Partial<UserPreferences> = {};

async function flushPendingPatch(
  userName: string,
  userId: string
): Promise<void> {
  flushTimer = null;
  if (pendingPatch.size === 0) {
    return;
  }

  const attempted = new Map(pendingPatch);
  pendingPatch.clear();
  const attemptedPrevious = new Map(previousValues);
  previousValues.clear();

  // JSON-Patch ops apply directly against the `preferences` map on the
  // backend (`UserPreferencesRepository.patch`) — paths are NOT prefixed
  // with `/preferences/`.
  const ops: Operation[] = Array.from(attempted.entries()).map(
    ([key, value]) => {
      if (value === null) {
        return { op: 'remove', path: `/${key}` } as Operation;
      }

      const op = key in serverKnown ? 'replace' : 'add';

      return { op, path: `/${key}`, value } as Operation;
    }
  );

  try {
    const updated = await patchUserPreferences(userId, ops);
    const updatedPreferences = (updated?.preferences ?? {}) as Record<
      string,
      unknown
    >;
    serverKnown = { ...serverKnown, ...updatedPreferences };
    for (const [key, value] of attempted) {
      if (value === null) {
        delete (serverKnown as Record<string, unknown>)[key];
      }
    }
  } catch (error) {
    // A newer write may have landed locally while this PATCH was in flight
    // (e.g. the user changed the same key again before the rejected request
    // settled). Only roll back keys whose local value still equals what we
    // attempted to persist — if it has diverged, a subsequent write already
    // superseded this attempt and clobbering it with the pre-attempt value
    // would silently discard that newer write.
    const currentSlice = (usePersistentStorage.getState().preferences[
      userName
    ] ?? {}) as unknown as Record<string, unknown>;
    const rollback: Partial<UserPreferences> = {};
    for (const [key, attemptedValue] of attempted) {
      if (currentSlice[key] !== attemptedValue) {
        continue;
      }
      (rollback as Record<string, unknown>)[key] =
        attemptedPrevious.get(key) ?? null;
    }
    if (Object.keys(rollback).length > 0) {
      usePersistentStorage.getState().setUserPreference(userName, rollback);
    }
    showErrorToast(error as AxiosError);
  }
}

/**
 * Enqueues a debounced backend PATCH for any backend-synced keys present in
 * `patch`. Non-whitelisted keys are ignored here entirely — they still get
 * written to the local persisted store by the caller, they just never reach
 * the server.
 *
 * `previous` (when supplied) is the pre-write snapshot of the affected keys,
 * used only to seed the rollback value for this batch. When omitted (e.g.
 * the one-shot migration call from `hydrateBackendSyncedPreferences`), the
 * last known server value is used instead.
 */
export function syncBackendKeys(
  userName: string,
  userId: string,
  patch: Partial<UserPreferences>,
  previous?: Partial<UserPreferences>
): void {
  let queued = false;
  for (const [key, value] of Object.entries(patch)) {
    if (!BACKEND_SYNCED_KEYS.has(key as keyof UserPreferences)) {
      continue;
    }
    if (!previousValues.has(key)) {
      const serverFallback =
        (serverKnown as Record<string, unknown>)[key] ?? null;
      const previousValue =
        previous && key in previous
          ? (previous as Record<string, unknown>)[key] ?? null
          : serverFallback;
      previousValues.set(key, previousValue);
    }
    pendingPatch.set(key, value ?? null);
    queued = true;
  }
  if (!queued) {
    return;
  }
  if (flushTimer !== null) {
    return;
  }
  flushTimer = setTimeout(() => {
    void flushPendingPatch(userName, userId);
  }, DEBOUNCE_MS);
}

/**
 * Bootstrap hook: call once, right after `getLoggedInUser()` resolves and
 * `currentUser` is set, passing the sibling `GET /users/{id}/preferences`
 * response as `userPreferences`. Reconciles the freshly-fetched server
 * preferences with whatever is already in the local persisted store:
 *  - server has a value  -> server wins, overwrite local.
 *  - server has no value but local does -> one-shot migration, PATCH it up.
 *  - neither has a value -> no-op.
 */
export function hydrateBackendSyncedPreferences(
  user: { id: string; name: string },
  userPreferences?: { preferences?: Record<string, unknown> }
): void {
  if (!user?.name || !user.id) {
    return;
  }
  const server = userPreferences?.preferences ?? {};
  serverKnown = { ...server };

  const localSlice =
    usePersistentStorage.getState().preferences[user.name] ??
    ({} as UserPreferences);

  for (const key of BACKEND_SYNCED_KEYS) {
    const serverValue = server[key];
    const localValue = (localSlice as unknown as Record<string, unknown>)[key];

    if (serverValue !== undefined) {
      // Server wins.
      usePersistentStorage.getState().setUserPreference(user.name, {
        [key]: serverValue,
      } as Partial<UserPreferences>);
    } else if (localValue !== undefined && localValue !== null) {
      // Migrate the local-only value up to the server.
      syncBackendKeys(user.name, user.id, {
        [key]: localValue,
      } as Partial<UserPreferences>);
    }
  }
}

/**
 * Resets all module-level backend-sync bookkeeping (pending patch, rollback
 * snapshots, debounce timer, last-known server state). Exists primarily so
 * tests can isolate each case; also safe to call on logout.
 */
export function resetBackendSyncState(): void {
  pendingPatch.clear();
  previousValues.clear();
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  serverKnown = {};
}

// Hook to easily access current user's preferences
export const useCurrentUserPreferences = () => {
  const currentUser = useApplicationStore((state) => state.currentUser);
  const { preferences, setUserPreference } = usePersistentStorage();
  const userName = currentUser?.name;
  const currentUserId = currentUser?.id;

  // Memoized (deps: userName, currentUserId, stable store action) so
  // consumers such as usePaging, which capture setPreference in the
  // dependency array of handlePageChange, don't get a fresh callback every
  // render — an unstable identity would recreate those callbacks and cancel
  // debounced work.
  const setPreference = useCallback(
    (newPreferences: Partial<UserPreferences>) => {
      if (!userName) {
        return;
      }
      // Snapshot pre-write values before the optimistic local update so a
      // failed backend sync can roll back to what the user actually saw.
      const previous = usePersistentStorage.getState().preferences[userName];
      setUserPreference(userName, newPreferences);
      // Backend sync needs the user's id (for the PATCH URL); local-only
      // users (e.g. not yet resolved) still get the local write above.
      if (currentUserId) {
        syncBackendKeys(userName, currentUserId, newPreferences, previous);
      }
    },
    [userName, currentUserId, setUserPreference]
  );

  const resolvedPreferences = useMemo(
    () =>
      userName && preferences[userName]
        ? { ...defaultPreferences, ...preferences[userName] }
        : defaultPreferences,
    [userName, preferences]
  );

  return {
    preferences: resolvedPreferences,
    setPreference,
  };
};

// Best-effort flush of any still-debounced PATCH when the tab is closing —
// otherwise a write made just before navigation/close would be silently
// dropped once the debounce timer never gets to fire.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
      const user = useApplicationStore.getState().currentUser;
      if (user?.id && user?.name) {
        void flushPendingPatch(user.name, user.id);
      }
    }
  });
}
