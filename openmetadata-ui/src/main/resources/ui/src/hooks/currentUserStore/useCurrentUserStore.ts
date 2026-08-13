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
import { RecentlySearchedData, RecentlyViewedData } from 'Models';
import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import { deleteUserPreference, putUserPreference } from '../../rest/userAPI';
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
// `user_preferences` side table, via `putUserPreference` /
// `deleteUserPreference`) in addition to being persisted locally. Everything
// else in UserPreferences stays purely on-device. Keep this to a single entry
// for now — see the task brief for the rollout plan of additional keys.
export const BACKEND_SYNCED_KEYS = new Set<keyof UserPreferences>(['appMode']);
const DEBOUNCE_MS = 300;

/**
 * A single backend-synced-key entry off the wire, shaped `{ type, config }`
 * per `api/teams/preferences/*.json`. `config` is intentionally loose here —
 * each branch in {@link deriveKeyedPreferences} / {@link buildPreferenceConfig}
 * knows its own concrete shape.
 */
interface WirePreferenceEntry {
  type?: string;
  config?: { value?: string | null };
}

/**
 * Wire discriminator (`type`) for a backend-synced local key. Each key gets
 * its own branch — mirrors {@link deriveKeyedPreferences} and
 * {@link buildPreferenceConfig} below. Returns `null` for keys that aren't
 * backend-synced (callers should have already filtered via
 * `BACKEND_SYNCED_KEYS`, this is just a safety net).
 */
function preferenceTypeFor(key: keyof UserPreferences): string | null {
  if (key === 'appMode') {
    return 'appMode';
  }

  return null;
}

/** Builds the `config` object for a PUT of the given backend-synced key. */
function buildPreferenceConfig(
  key: keyof UserPreferences,
  value: unknown
): unknown {
  if (key === 'appMode') {
    return { value };
  }

  return undefined;
}

/**
 * Translates the wire-format `preferences` list (list of typed discriminated
 * unions keyed by `type`) into the local keyed shape consumed by
 * `useCurrentUserPreferences`. Future preference types get their own branch
 * here, mirroring `preferenceTypeFor` / `buildPreferenceConfig` above.
 */
function deriveKeyedPreferences(
  entries?: WirePreferenceEntry[]
): Partial<UserPreferences> {
  const keyed: Partial<UserPreferences> = {};
  for (const item of entries ?? []) {
    if (item?.type === 'appMode') {
      keyed.appMode = item.config?.value ?? null;
    }
    // future preference types get their own branch here.
  }

  return keyed;
}

// Exposed so `AuthProvider`'s boot-time resolver can read `appMode` (and any
// future backend-synced key) straight off the list-shaped `GET .../preferences`
// response without duplicating the `{type, config}` unwrapping logic.
export const derivePreferencesFromList = deriveKeyedPreferences;

// Module-level state for the debounced backend sync. `pendingPatch` holds
// the last-write-wins value per key for the in-flight debounce window
// (`null` means "delete this key's preference entry"). `previousValues`
// snapshots what each key's value was immediately before the *first* write
// in the current batch, so a failed write can roll the local store back to
// exactly what the user saw beforehand (not to whatever the server last
// confirmed, which may be stale or absent for keys that were never migrated
// up).
const pendingPatch = new Map<string, unknown>();
const previousValues = new Map<string, unknown>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let serverKnown: Partial<UserPreferences> = {};

/**
 * PUTs (or, for a `null` write, DELETEs) the given key's backend-synced
 * preference entry, updates `serverKnown` from the authoritative response,
 * and rolls back + toasts on failure. Scoped to a single key so one key's
 * failure can't clobber a sibling key's successful write in the same flush.
 */
async function flushOneKey(
  userName: string,
  userId: string,
  key: keyof UserPreferences,
  value: unknown,
  previousValue: unknown
): Promise<void> {
  const type = preferenceTypeFor(key);
  if (!type) {
    return;
  }

  const isRemoval = value === null;
  // A DELETE on a key the server never had would be a wasted round trip for
  // what is semantically already a no-op (and, under the prior JSON-Patch
  // design, `remove` on an absent member throws per RFC 6902).
  if (isRemoval && !(key in serverKnown)) {
    return;
  }

  try {
    const updated = isRemoval
      ? await deleteUserPreference(userId, type)
      : await putUserPreference(
          userId,
          type,
          buildPreferenceConfig(key, value)
        );

    const keyed = deriveKeyedPreferences(
      updated?.preferences as WirePreferenceEntry[] | undefined
    );
    if (key in keyed) {
      (serverKnown as Record<string, unknown>)[key] = (
        keyed as Record<string, unknown>
      )[key];
    } else {
      delete (serverKnown as Record<string, unknown>)[key];
    }
  } catch (error) {
    // A newer write may have landed locally while this request was in
    // flight (e.g. the user changed the same key again before the rejected
    // request settled). Only roll back if the local value still equals what
    // we attempted to persist — if it has diverged, a subsequent write
    // already superseded this attempt and clobbering it with the
    // pre-attempt value would silently discard that newer write.
    const currentSlice = (usePersistentStorage.getState().preferences[
      userName
    ] ?? {}) as unknown as Record<string, unknown>;
    if (currentSlice[key] === value) {
      usePersistentStorage.getState().setUserPreference(userName, {
        [key]: previousValue ?? null,
      } as Partial<UserPreferences>);
    }
    showErrorToast(error as AxiosError);
  }
}

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

  await Promise.all(
    Array.from(attempted.entries()).map(([key, value]) =>
      flushOneKey(
        userName,
        userId,
        key as keyof UserPreferences,
        value,
        attemptedPrevious.get(key)
      )
    )
  );
}

/**
 * Enqueues a debounced backend PUT/DELETE for any backend-synced keys
 * present in `patch`. Non-whitelisted keys are ignored here entirely — they
 * still get written to the local persisted store by the caller, they just
 * never reach the server.
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
 *  - server has no value but local does -> one-shot migration, PUT it up.
 *  - neither has a value -> no-op.
 */
export function hydrateBackendSyncedPreferences(
  user: { id: string; name: string },
  userPreferences?: { preferences?: WirePreferenceEntry[] }
): void {
  if (!user?.name || !user.id) {
    return;
  }
  const server = deriveKeyedPreferences(userPreferences?.preferences);
  serverKnown = { ...server };

  const localSlice =
    usePersistentStorage.getState().preferences[user.name] ??
    ({} as UserPreferences);

  for (const key of BACKEND_SYNCED_KEYS) {
    const serverValue = (server as Record<string, unknown>)[key];
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
      // Backend sync needs the user's id (for the PUT/DELETE URL);
      // local-only users (e.g. not yet resolved) still get the local write
      // above.
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

// Best-effort flush of any still-debounced write when the tab is closing —
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
