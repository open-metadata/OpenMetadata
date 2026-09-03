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

import { authCoordinator } from './Auth/AuthCoordinator';

/**
 * Shared plumbing for the fetch-based SSE clients (service progress, ingestion
 * log tail). Native EventSource cannot send the Authorization header the JWT
 * filter requires, so every stream in the app goes through
 * `@microsoft/fetch-event-source` and owns its own reconnect policy. That policy
 * lives here so the streams cannot drift apart.
 */

export type StreamHealth = 'connecting' | 'live' | 'unavailable' | 'down';

export const MAX_ATTEMPTS_BEFORE_DOWN = 5;
export const MAX_BACKOFF_MS = 30000;
export const BASE_BACKOFF_MS = 1000;

/** Stops the reconnect loop: retrying cannot change the outcome. */
export class FatalStreamError extends Error {
  constructor(public readonly health: StreamHealth) {
    super(`Stream terminated: ${health}`);
  }
}

/** The connection dropped for a reason a later attempt may not hit. */
export class RetriableStreamError extends Error {}

export const getBackoffDelay = (attempt: number): number =>
  Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);

export const abortableSleep = (
  ms: number,
  signal: AbortSignal
): Promise<void> =>
  new Promise((resolve) => {
    const timeoutId = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeoutId);
        resolve();
      },
      { once: true }
    );
  });

export interface StreamRetryState {
  attempt: number;
  consecutiveUnauthorized: number;
}

export const createStreamRetryState = (): StreamRetryState => ({
  attempt: 0,
  consecutiveUnauthorized: 0,
});

/**
 * The `onopen` policy every stream shares: a 503 means the feature is not
 * configured on this deployment and retrying is pointless; a first 401 buys one
 * token refresh; a second consecutive 401 means the session is genuinely gone.
 * Anything else is retriable.
 */
export const createStreamOpenHandler =
  (state: StreamRetryState, onLive: () => void) =>
  async (response: Response): Promise<void> => {
    if (response.ok) {
      state.attempt = 0;
      state.consecutiveUnauthorized = 0;
      onLive();

      return;
    }

    if (response.status === 503) {
      throw new FatalStreamError('unavailable');
    }

    if (response.status === 401) {
      state.consecutiveUnauthorized += 1;

      if (state.consecutiveUnauthorized > 1) {
        throw new FatalStreamError('down');
      }

      await authCoordinator.ensureFreshToken();
    }

    throw new RetriableStreamError();
  };

/**
 * Advances the retry counter after a failed attempt and reports the health the
 * user should see: still `connecting` while attempts remain, `down` once the
 * stream has failed enough times that it is not coming back on its own.
 */
export const nextRetryHealth = (state: StreamRetryState): StreamHealth => {
  state.attempt += 1;

  return state.attempt >= MAX_ATTEMPTS_BEFORE_DOWN ? 'down' : 'connecting';
};
