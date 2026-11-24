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
import { useExploreCache } from './useExploreCache';

const STALE_TIME_MS = 30_000;
const MAX_ENTRIES = 60;

const cache = () => useExploreCache.getState();

describe('useExploreCache', () => {
  beforeEach(() => {
    jest.setSystemTime(0);
    cache().clearCache();
  });

  it('returns a freshly written entry', () => {
    cache().setCached('key', { value: 1 });

    expect(cache().getCached<{ value: number }>('key')?.data).toEqual({
      value: 1,
    });
  });

  it('returns undefined for a missing key', () => {
    expect(cache().getCached('missing')).toBeUndefined();
  });

  it('returns an entry that is still within the freshness window', () => {
    cache().setCached('key', 'data');
    jest.advanceTimersByTime(STALE_TIME_MS - 1);

    expect(cache().getCached('key')?.data).toBe('data');
  });

  it('treats an entry past the freshness window as a miss', () => {
    cache().setCached('key', 'data');
    jest.advanceTimersByTime(STALE_TIME_MS + 1);

    expect(cache().getCached('key')).toBeUndefined();
  });

  it('evicts the oldest entry once capacity is exceeded', () => {
    for (let i = 0; i <= MAX_ENTRIES; i++) {
      cache().setCached(`key-${i}`, i);
    }

    expect(cache().entries.size).toBe(MAX_ENTRIES);
    expect(cache().getCached('key-0')).toBeUndefined();
    expect(cache().getCached<number>(`key-${MAX_ENTRIES}`)?.data).toBe(
      MAX_ENTRIES
    );
  });

  it('re-writing a key makes it the youngest, so it survives the next eviction', () => {
    for (let i = 0; i < MAX_ENTRIES; i++) {
      cache().setCached(`key-${i}`, i);
    }

    cache().setCached('key-0', 'refreshed');
    cache().setCached('overflow', 'new');

    expect(cache().getCached<string>('key-0')?.data).toBe('refreshed');
    expect(cache().getCached('key-1')).toBeUndefined();
  });

  it('clearCache drops every entry', () => {
    cache().setCached('a', 1);
    cache().setCached('b', 2);

    cache().clearCache();

    expect(cache().entries.size).toBe(0);
    expect(cache().getCached('a')).toBeUndefined();
  });

  it('shares an in-flight count request and expires it after two seconds', async () => {
    const load = jest.fn().mockResolvedValue({ table: 12 });
    const first = cache().getOrLoad('counts', load);
    const second = cache().getOrLoad('counts', load);

    await expect(first).resolves.toEqual({ table: 12 });
    await expect(second).resolves.toEqual({ table: 12 });
    expect(load).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(2001);
    await cache().getOrLoad('counts', load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not retain failed requests', async () => {
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValue(12);

    await expect(cache().getOrLoad('counts', load)).rejects.toThrow(
      'unavailable'
    );
    await expect(cache().getOrLoad('counts', load)).resolves.toBe(12);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not restore a previous user request after clearing the cache', async () => {
    let complete: (value: number) => void = (_value) => undefined;
    const first = cache().getOrLoad(
      'counts',
      () =>
        new Promise<number>((resolve) => {
          complete = resolve;
        })
    );
    await Promise.resolve();
    cache().clearCache();
    complete(87);
    await first;

    expect(cache().getCached('counts')).toBeUndefined();
    await expect(cache().getOrLoad('counts', async () => 12)).resolves.toBe(12);
  });
});
