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

import { useEffect, useRef } from 'react';
import { useRouteActivationStore } from './RouteActivationContext';

export type RouteActivationReason = 'activation' | 'focus' | 'dirty' | 'maxAge';

export interface UseRouteActivationOptions {
  /** Also fire when the browser tab refocuses while this route is active. Default true. */
  revalidateOnFocus?: boolean;
  /** Force a {@code 'maxAge'} reason once the page has been mounted longer than this. */
  maxAgeMs?: number;
  /**
   * The host cacheable route path. Defaults to the path that was active when the hook
   * first ran — which, inside the keep-alive container, is always the page's own path
   * (a page is only mounted once it has become active). Pass explicitly in tests.
   */
  path?: string;
}

/**
 * Re-validate a kept-alive app-mode page when it becomes visible again.
 *
 * Fires {@code onActivate} when the host route transitions hidden→visible
 * ({@code 'activation'}), when the tab refocuses while it is active ({@code 'focus'}),
 * when a websocket invalidation marked it dirty ({@code 'dirty'}), or when it has been
 * mounted past {@code maxAgeMs} ({@code 'maxAge'}). It deliberately does NOT fire on
 * first mount — the page's own on-mount fetch already ran, so firing again would
 * double-fetch.
 *
 * Pair with the data cache: for {@code 'activation'}/{@code 'focus'} just re-run the
 * fetch (the query's stale time decides no-op-vs-refetch); for
 * {@code 'dirty'}/{@code 'maxAge'} invalidate first so the refetch is forced.
 */
export const useRouteActivation = (
  onActivate: (reason: RouteActivationReason) => void,
  options?: UseRouteActivationOptions
): void => {
  const store = useRouteActivationStore();
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  const revalidateOnFocus = options?.revalidateOnFocus ?? true;
  const maxAgeMs = options?.maxAgeMs;

  // Capture the host path once. At first render the page is the active route, so the
  // store's active path is this page's path (unless explicitly provided).
  const pathRef = useRef<string | undefined>(undefined);
  if (pathRef.current === undefined) {
    pathRef.current = options?.path ?? store?.getActivePath();
  }
  const path = options?.path ?? pathRef.current;

  const mountedAtRef = useRef<number | undefined>(undefined);
  if (mountedAtRef.current === undefined) {
    mountedAtRef.current = Date.now();
  }

  useEffect(() => {
    if (!store || !path) {
      return;
    }

    // Per-listener baselines — each subscriber reacts to changes independently, so the
    // Home page's many widgets all revalidate on the same route's dirty/activation.
    let lastEpoch = store.getActivationEpoch(path);
    let lastFocus = store.getFocusEpoch();
    let lastDirty = store.getDirtyVersion(path);

    const isAged = () =>
      maxAgeMs != null &&
      mountedAtRef.current != null &&
      Date.now() - mountedAtRef.current > maxAgeMs;

    const handle = () => {
      const epoch = store.getActivationEpoch(path);
      const focus = store.getFocusEpoch();
      const dirty = store.getDirtyVersion(path);
      const isActive = store.getActivePath() === path;
      const becameDirty = dirty !== lastDirty;

      // Re-activation (hidden→visible) — always revalidate. A pending dirty signal or
      // an over-aged page upgrades the reason so the caller force-refetches.
      if (epoch !== lastEpoch) {
        lastEpoch = epoch;
        lastFocus = focus; // a focus that coincides with activation shouldn't double-fire
        lastDirty = dirty;
        let reason: RouteActivationReason = 'activation';
        if (becameDirty) {
          reason = 'dirty';
        } else if (isAged()) {
          reason = 'maxAge';
        }
        onActivateRef.current(reason);

        return;
      }

      // Websocket marked us dirty while we're the visible page — revalidate now.
      if (isActive && becameDirty) {
        lastDirty = dirty;
        onActivateRef.current('dirty');

        return;
      }

      // Tab refocused while we're the visible page.
      if (focus !== lastFocus) {
        lastFocus = focus;
        if (revalidateOnFocus && isActive) {
          onActivateRef.current('focus');
        }
      }
    };

    return store.subscribe(path, handle);
  }, [store, path, revalidateOnFocus, maxAgeMs]);
};
