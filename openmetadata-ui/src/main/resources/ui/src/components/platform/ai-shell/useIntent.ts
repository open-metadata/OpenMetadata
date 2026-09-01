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

/**
 * Module-scoped pub/sub for cross-component CTA wiring. One component
 * emits a named intent; another (mounted anywhere) listens via
 * `useIntent` and runs a callback.
 *
 * One listener per intent — subscribing twice clobbers the first. If
 * multi-listener support is ever needed, change the value type to
 * `Set<Listener>`; public API stays the same.
 *
 * @example
 *   emitIntent('add-test-case');
 *   useIntent('add-test-case', () => setIsOpen(true));
 */

type Listener = () => void;

const listeners = new Map<string, Listener>();

export function emitIntent(name: string): void {
  listeners.get(name)?.();
}

export function useIntent(
  name: string,
  handler: () => void,
  // Optional re-register signal. Because only one listener exists per name,
  // a host that is kept mounted-but-hidden (app-mode keep-alive) can have its
  // listener clobbered by another instance that mounts on top, and then
  // orphaned entirely when that instance unmounts and deletes the shared slot.
  // A kept-alive host passes a value that changes each time it becomes the
  // active route (e.g. a `useRouteActivation` epoch) so it re-claims the slot
  // on reactivation instead of staying silently unsubscribed.
  reregisterKey?: unknown
): void {
  // Ref keeps the listener stable across renders while still calling the
  // freshest handler closure — avoids resubscribing on every render.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrapped: Listener = () => handlerRef.current();
    listeners.set(name, wrapped);

    return () => {
      // Only delete if we're still the active listener — guards against
      // an unmount-after-clobber sequence wiping out a newer subscriber.
      if (listeners.get(name) === wrapped) {
        listeners.delete(name);
      }
    };
  }, [name, reregisterKey]);
}
