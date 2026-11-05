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
  LineageBand,
  LineageLens,
  LineageScene,
} from '../../../generated/api/lineage/lineageScene';
import { LineageSceneCache } from './LineageSceneCache.utils';

const scene: LineageScene = {
  band: LineageBand.Asset,
  lens: LineageLens.Service,
  breadcrumb: [],
  nodes: [],
  edges: [],
};

const deferredScene = () => {
  let resolve!: (value: LineageScene) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<LineageScene>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

describe('LineageSceneCache', () => {
  it('rejects synchronous loader failures and allows a subsequent retry', async () => {
    const cache = new LineageSceneCache();
    const failure = new Error('Scene unavailable');

    await expect(
      cache.load('asset', () => {
        throw failure;
      })
    ).rejects.toBe(failure);
    await expect(
      cache.load('asset', () => Promise.resolve(scene))
    ).resolves.toBe(scene);
    expect(cache.get('asset')).toBe(scene);
  });

  it('shares an in-flight prefetch with navigation to the same scene', async () => {
    const cache = new LineageSceneCache();
    const pending = deferredScene();
    const fetchScene = jest.fn(() => pending.promise);
    const prefetch = cache.load('asset', fetchScene);
    const navigation = cache.load('asset', fetchScene);

    pending.resolve(scene);

    await expect(navigation).resolves.toBe(scene);
    await expect(prefetch).resolves.toBe(scene);
    expect(fetchScene).toHaveBeenCalledTimes(1);
    expect(cache.get('asset')).toBe(scene);
  });

  it('does not restore a stale prefetch after a lineage mutation clears the cache', async () => {
    const cache = new LineageSceneCache();
    const pending = deferredScene();
    const prefetch = cache.load('asset', () => pending.promise);
    cache.clear();
    const updatedScene = { ...scene, hiddenNodeCount: 1 };
    await cache.load('asset', () => Promise.resolve(updatedScene));
    pending.resolve(scene);
    await prefetch;

    expect(cache.get('asset')).toBe(updatedScene);
  });

  it('keeps an invalidated key absent when its old request completes', async () => {
    const cache = new LineageSceneCache();
    const pending = deferredScene();
    const prefetch = cache.load('asset', () => pending.promise);
    cache.clear();
    pending.resolve(scene);
    await prefetch;

    expect(cache.get('asset')).toBeUndefined();
  });

  it('evicts the least recently used entry at 50 scenes, including pending requests', async () => {
    const cache = new LineageSceneCache();
    const pending = deferredScene();
    const oldest = cache.load('pending', () => pending.promise);
    for (let index = 0; index < 49; index++) {
      await cache.load(String(index), () => Promise.resolve(scene));
    }

    expect(cache.get('0')).toBe(scene);

    await cache.load('overflow', () => Promise.resolve(scene));
    pending.resolve(scene);
    await oldest;

    expect(cache.get('pending')).toBeUndefined();

    await cache.load('next', () => Promise.resolve(scene));

    expect(cache.get('1')).toBeUndefined();
    expect(cache.get('0')).toBe(scene);
  });

  it('retries failed requests without evicting a newer refresh', async () => {
    const cache = new LineageSceneCache();
    const failure = new Error('Scene unavailable');

    await expect(
      cache.load('asset', () => Promise.reject(failure))
    ).rejects.toBe(failure);

    const pending = deferredScene();
    const retry = cache.load('asset', () => pending.promise);
    const retryFailure = expect(retry).rejects.toBe(failure);
    const updatedScene = { ...scene, hiddenNodeCount: 2 };
    await cache.load('asset', () => Promise.resolve(updatedScene), true);
    pending.reject(failure);
    await retryFailure;

    expect(cache.get('asset')).toBe(updatedScene);
  });
});
