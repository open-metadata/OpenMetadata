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

import { createContext, PropsWithChildren, useContext } from 'react';

/**
 * Imperative store backing app-mode route revalidation.
 *
 * The app-mode shell keeps every visited cacheable route mounted (see
 * {@link KeepAliveRoutes}), so a page's on-mount fetch never runs again.
 * This store hands pages a side-channel signal — a per-path "activation
 * epoch" plus a global "focus epoch" plus per-path "dirty" flags — so they
 * can re-validate stale data when they become visible again, the browser
 * tab refocuses, or an external invalidation marks them dirty.
 *
 * The store is a stable mutable object (held in a ref by the provider) exposed through
 * context. Consumers read it via {@link useRouteActivationStore} and subscribe imperatively
 * in an effect, so updating the store never re-renders the (always-mounted) pages —
 * sidestepping a re-render storm across the whole kept-alive tree.
 */
export interface RouteActivationStore {
  /** Current active cacheable path, or undefined while on a non-cacheable route. */
  getActivePath: () => string | undefined;
  /** Per-path activation epoch — bumped each time the path transitions hidden→visible. */
  getActivationEpoch: (path: string) => number;
  /** Global focus epoch — bumped on window focus / tab becoming visible. */
  getFocusEpoch: () => number;
  /**
   * Per-path "dirty" version — bumped each time the path is marked stale. A counter
   * (not a consumable flag) so every subscriber on the same path reacts independently;
   * a page may mount many widgets that all listen on the same route.
   */
  getDirtyVersion: (path: string) => number;
  /** Mark a path's data stale (external invalidation); notifies its subscribers. */
  markRouteDirty: (path: string) => void;
  /**
   * Mark EVERY known (visited/subscribed) route stale at once — used on reconnect,
   * where events emitted during the drop were missed, so all kept-alive pages must re-validate
   * (the active one immediately, hidden ones on next activation).
   */
  markAllRoutesDirty: () => void;
  /** Subscribe to changes affecting {@code path}; returns an unsubscribe fn. */
  subscribe: (path: string, listener: () => void) => () => void;
  /** @internal — driven by KeepAliveRoutes. */
  setActivePath: (path: string | undefined) => void;
  /** @internal — driven by KeepAliveRoutes on re-activation. */
  bumpEpoch: (path: string) => void;
  /** @internal — driven by KeepAliveRoutes on window focus / visibility. */
  bumpFocus: () => void;
}

export const createRouteActivationStore = (): RouteActivationStore => {
  let activePath: string | undefined;
  let focusEpoch = 0;
  const epochs = new Map<string, number>();
  const dirtyVersions = new Map<string, number>();
  const listeners = new Map<string, Set<() => void>>();
  const knownPaths = new Set<string>();

  const notify = (path: string) => {
    listeners.get(path)?.forEach((listener) => listener());
  };

  const notifyAll = () => {
    listeners.forEach((set) => set.forEach((listener) => listener()));
  };

  const bumpDirty = (path: string) => {
    dirtyVersions.set(path, (dirtyVersions.get(path) ?? 0) + 1);
    notify(path);
  };

  return {
    getActivePath: () => activePath,
    getActivationEpoch: (path) => epochs.get(path) ?? 0,
    getFocusEpoch: () => focusEpoch,
    getDirtyVersion: (path) => dirtyVersions.get(path) ?? 0,
    markRouteDirty: (path) => {
      knownPaths.add(path);
      bumpDirty(path);
    },
    markAllRoutesDirty: () => {
      knownPaths.forEach(bumpDirty);
    },
    subscribe: (path, listener) => {
      knownPaths.add(path);
      let set = listeners.get(path);
      if (!set) {
        set = new Set();
        listeners.set(path, set);
      }
      set.add(listener);

      return () => {
        set?.delete(listener);
        if (set && set.size === 0) {
          listeners.delete(path);
        }
      };
    },
    setActivePath: (path) => {
      activePath = path;
      if (path) {
        knownPaths.add(path);
      }
    },
    bumpEpoch: (path) => {
      epochs.set(path, (epochs.get(path) ?? 0) + 1);
      notify(path);
    },
    bumpFocus: () => {
      focusEpoch += 1;
      notifyAll();
    },
  };
};

const RouteActivationContext = createContext<RouteActivationStore | null>(null);

export const useRouteActivationStore = (): RouteActivationStore | null =>
  useContext(RouteActivationContext);

export const RouteActivationProvider = ({
  store,
  children,
}: PropsWithChildren<{ store: RouteActivationStore }>) => (
  <RouteActivationContext.Provider value={store}>
    {children}
  </RouteActivationContext.Provider>
);
