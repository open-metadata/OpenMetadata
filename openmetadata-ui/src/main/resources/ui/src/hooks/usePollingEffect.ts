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

export const DEFAULT_POLL_INTERVAL_MS = 5000;

export interface UsePollingEffectOptions {
  enabled: boolean;
  intervalMs?: number;
}

/**
 * Runs `callback` on a fixed interval while `enabled` is true. Skips a tick if
 * the previous invocation is still in flight (no overlapping calls) and clears
 * the timer when disabled or unmounted. The latest `callback` is always used,
 * so callers don't need to memoize it.
 */
export const usePollingEffect = (
  callback: () => void | Promise<void>,
  { enabled, intervalMs = DEFAULT_POLL_INTERVAL_MS }: UsePollingEffectOptions
): void => {
  const savedCallback = useRef(callback);
  const isInFlight = useRef(false);

  useEffect(() => {
    savedCallback.current = callback;
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const id = setInterval(() => {
      if (isInFlight.current) {
        return;
      }

      const result = savedCallback.current();
      // Only guard against overlap for async callbacks; a sync callback has
      // already completed by the time it returns.
      if (result instanceof Promise) {
        isInFlight.current = true;
        result.finally(() => {
          isInFlight.current = false;
        });
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [enabled, intervalMs]);
};
