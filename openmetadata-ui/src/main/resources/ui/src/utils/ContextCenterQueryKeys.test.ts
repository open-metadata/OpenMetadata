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

import { QueryClient } from '@tanstack/react-query';
import { reconcileCountAfterAsyncDelete } from './ContextCenterQueryKeys';

const KEY = ['test-count'];

// jest.config enables fake timers globally; this helper's whole job is to wait
// between polls, so it needs a clock that advances. `intervalMs: 0` keeps the
// real waits at a tick.
beforeAll(() => jest.useRealTimers());

afterAll(() => jest.useFakeTimers());

/** A client whose query for KEY resolves to whatever the server now reports. */
const buildClient = (serverTotal: () => number) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  queryClient.setQueryDefaults(KEY, { queryFn: async () => serverTotal() });

  return queryClient;
};

describe('reconcileCountAfterAsyncDelete', () => {
  it('waits for the row to disappear before trusting the count', async () => {
    // The server still reports the pre-delete total until the 3rd poll, when
    // the background delete lands and the row is gone.
    let polls = 0;
    const queryClient = buildClient(() => (polls < 3 ? 5 : 4));
    queryClient.setQueryData(KEY, 5);

    await reconcileCountAfterAsyncDelete(
      queryClient,
      KEY,
      async () => ++polls >= 3,
      { attempts: 5, intervalMs: 0 }
    );

    expect(polls).toBe(3);
    expect(queryClient.getQueryData(KEY)).toBe(4);
  });

  it('stops polling as soon as the row is gone', async () => {
    let polls = 0;
    const queryClient = buildClient(() => 4);
    queryClient.setQueryData(KEY, 5);

    await reconcileCountAfterAsyncDelete(
      queryClient,
      KEY,
      async () => {
        polls++;

        return true;
      },
      { attempts: 5, intervalMs: 0 }
    );

    expect(polls).toBe(1);
  });

  it('refetches once even when the delete never lands', async () => {
    // The budget runs out with the row still present. The badge must end up on
    // the server's own figure rather than a number computed in advance.
    let polls = 0;
    const queryClient = buildClient(() => 5);
    queryClient.setQueryData(KEY, 5);

    await reconcileCountAfterAsyncDelete(
      queryClient,
      KEY,
      async () => {
        polls++;

        return false;
      },
      { attempts: 3, intervalMs: 0 }
    );

    expect(polls).toBe(3);
    expect(queryClient.getQueryData(KEY)).toBe(5);
  });

  it('settles on the server total when a restore lands in the same window', async () => {
    // Badge cached at 10. A hard delete is pending and the user restores
    // another file mid-poll, so the server moves 10 → 9 → 8. A target frozen
    // at 9 would stop early and pin the badge one too high; polling the row's
    // absence lets the final refetch read the truth.
    let serverTotal = 10;
    const queryClient = buildClient(() => serverTotal);
    queryClient.setQueryData(KEY, 10);

    let polls = 0;
    await reconcileCountAfterAsyncDelete(
      queryClient,
      KEY,
      async () => {
        polls++;
        // Restore lands first, then the background hard delete.
        serverTotal = polls === 1 ? 9 : 8;

        return polls >= 2;
      },
      { attempts: 5, intervalMs: 0 }
    );

    expect(queryClient.getQueryData(KEY)).toBe(8);
  });

  it('does not cap the badge when a soft delete raises the count mid-poll', async () => {
    // The reverse case: another document is archived while the hard delete is
    // pending, so the server total rises. Nothing may clamp it back down.
    let serverTotal = 5;
    const queryClient = buildClient(() => serverTotal);
    queryClient.setQueryData(KEY, 5);

    await reconcileCountAfterAsyncDelete(
      queryClient,
      KEY,
      async () => {
        // One archived (+1), the hard delete landed (-1), plus another archive.
        serverTotal = 6;

        return true;
      },
      { attempts: 5, intervalMs: 0 }
    );

    expect(queryClient.getQueryData(KEY)).toBe(6);
  });
});
