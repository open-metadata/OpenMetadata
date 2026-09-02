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
  abortableSleep,
  createStreamOpenHandler,
  createStreamRetryState,
  FatalStreamError,
  getBackoffDelay,
  MAX_BACKOFF_MS,
  nextRetryHealth,
  RetriableStreamError,
} from './SseStreamUtils';

const mockEnsureFreshToken = jest.fn().mockResolvedValue(undefined);

// `ensureFreshToken` is wrapped in an arrow function rather than referenced
// directly so the read of `mockEnsureFreshToken` is deferred until the real
// call site invokes it — jest hoists this factory above the `const`
// declaration above, so an eager read would throw a TDZ ReferenceError.
jest.mock('./Auth/AuthCoordinator', () => ({
  authCoordinator: {
    ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
  },
}));

const response = (status: number): Response =>
  ({ ok: status >= 200 && status < 300, status } as Response);

describe('getBackoffDelay', () => {
  it('doubles per attempt from one second', () => {
    expect(getBackoffDelay(1)).toBe(1000);
    expect(getBackoffDelay(2)).toBe(2000);
    expect(getBackoffDelay(3)).toBe(4000);
  });

  it('never exceeds the cap', () => {
    expect(getBackoffDelay(20)).toBe(MAX_BACKOFF_MS);
  });
});

describe('abortableSleep', () => {
  it('resolves immediately when the signal aborts', async () => {
    jest.useFakeTimers();
    const controller = new AbortController();
    const sleeping = abortableSleep(30000, controller.signal);

    controller.abort();

    await expect(sleeping).resolves.toBeUndefined();

    jest.useRealTimers();
  });
});

describe('nextRetryHealth', () => {
  it('stays connecting until the attempts run out, then reports down', () => {
    const state = createStreamRetryState();

    expect(nextRetryHealth(state)).toBe('connecting');
    expect(nextRetryHealth(state)).toBe('connecting');
    expect(nextRetryHealth(state)).toBe('connecting');
    expect(nextRetryHealth(state)).toBe('connecting');
    expect(nextRetryHealth(state)).toBe('down');
  });
});

describe('createStreamOpenHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports live and clears the counters on a successful open', async () => {
    const state = createStreamRetryState();
    state.attempt = 3;
    state.consecutiveUnauthorized = 1;
    const onLive = jest.fn();

    await createStreamOpenHandler(state, onLive)(response(200));

    expect(onLive).toHaveBeenCalledTimes(1);
    expect(state.attempt).toBe(0);
    expect(state.consecutiveUnauthorized).toBe(0);
  });

  it('treats a 503 as fatal and unavailable', async () => {
    const state = createStreamRetryState();

    await expect(
      createStreamOpenHandler(state, jest.fn())(response(503))
    ).rejects.toEqual(new FatalStreamError('unavailable'));
  });

  it('refreshes the token on the first 401 and asks for a retry', async () => {
    const state = createStreamRetryState();

    await expect(
      createStreamOpenHandler(state, jest.fn())(response(401))
    ).rejects.toBeInstanceOf(RetriableStreamError);

    expect(mockEnsureFreshToken).toHaveBeenCalledTimes(1);
    expect(state.consecutiveUnauthorized).toBe(1);
  });

  it('gives up on a second consecutive 401 without refreshing again', async () => {
    const state = createStreamRetryState();
    const handler = createStreamOpenHandler(state, jest.fn());

    await expect(handler(response(401))).rejects.toBeInstanceOf(
      RetriableStreamError
    );
    await expect(handler(response(401))).rejects.toEqual(
      new FatalStreamError('down')
    );

    expect(mockEnsureFreshToken).toHaveBeenCalledTimes(1);
  });

  it('asks for a retry on any other failure', async () => {
    const state = createStreamRetryState();

    await expect(
      createStreamOpenHandler(state, jest.fn())(response(500))
    ).rejects.toBeInstanceOf(RetriableStreamError);
  });
});
