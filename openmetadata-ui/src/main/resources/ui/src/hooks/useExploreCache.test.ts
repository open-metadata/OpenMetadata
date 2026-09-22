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
});
