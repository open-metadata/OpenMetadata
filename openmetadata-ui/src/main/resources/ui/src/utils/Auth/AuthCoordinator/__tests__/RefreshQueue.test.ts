/*
 *  Copyright 2022 Collate.
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

import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  isRefreshFailedError,
  RefreshFailedError,
  RefreshQueue,
} from '../RefreshQueue';

const mockAxios = (responder: (cfg: AxiosRequestConfig) => Promise<unknown>) =>
  ({ request: jest.fn(responder) } as unknown as AxiosInstance);

describe('RefreshQueue', () => {
  it('enqueues and replays with the fresh token on drain success', async () => {
    const queue = new RefreshQueue();
    const axios = mockAxios(async (cfg) => ({
      ok: true,
      headers: cfg.headers,
    }));

    const p1 = queue.enqueue({
      url: '/a',
      headers: { Authorization: 'Bearer OLD' },
    });
    const p2 = queue.enqueue({ url: '/b', headers: {} });

    expect(queue.size()).toBe(2);

    await queue.drain('NEW', axios);

    await expect(p1).resolves.toEqual({
      ok: true,
      headers: { Authorization: 'Bearer NEW' },
    });
    await expect(p2).resolves.toEqual({
      ok: true,
      headers: { Authorization: 'Bearer NEW' },
    });
    expect(queue.size()).toBe(0);
  });

  it('rejects all pending when drained with null token', async () => {
    const queue = new RefreshQueue();
    const axios = mockAxios(async () => ({}));

    const p = queue.enqueue({ url: '/a' });
    await queue.drain(null, axios);

    await expect(p).rejects.toThrow(/refresh failed/i);
    // Typed, so callers can leave the outcome to the refresh-failed handler.
    await expect(p).rejects.toBeInstanceOf(RefreshFailedError);
    expect(queue.size()).toBe(0);
  });

  it('recognises only its own refresh failure', () => {
    expect(isRefreshFailedError(new RefreshFailedError())).toBe(true);
    expect(isRefreshFailedError(new Error('Token refresh failed'))).toBe(false);
    expect(isRefreshFailedError({ response: { status: 401 } })).toBe(false);
  });

  it('reports hasPending accurately', () => {
    const queue = new RefreshQueue();

    expect(queue.hasPending()).toBe(false);

    queue.enqueue({ url: '/x' });

    expect(queue.hasPending()).toBe(true);
  });
});
