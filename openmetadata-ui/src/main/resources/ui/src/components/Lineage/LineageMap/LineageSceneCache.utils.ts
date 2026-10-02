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
import LRUCache from 'lru-cache';
import type { LineageScene } from '../../../generated/api/lineage/lineageScene';

const SCENE_CACHE_LIMIT = 50;

interface SceneCacheEntry {
  promise: Promise<LineageScene>;
  value?: LineageScene;
}

export class LineageSceneCache {
  private readonly entries = new LRUCache<string, SceneCacheEntry>({
    max: SCENE_CACHE_LIMIT,
  });

  get(key: string): LineageScene | undefined {
    return this.entries.get(key)?.value;
  }

  load(
    key: string,
    fetchScene: () => Promise<LineageScene>,
    refresh = false
  ): Promise<LineageScene> {
    const existing = refresh ? undefined : this.entries.get(key);
    if (existing) {
      return existing.promise;
    }

    // Resolve into the entry, never back into the map: invalidation must also
    // discard responses from requests that were already running.
    const entry: SceneCacheEntry = {
      promise: Promise.resolve()
        .then(fetchScene)
        .then(
          (scene) => {
            entry.value = scene;

            return scene;
          },
          (error: unknown) => {
            if (this.entries.peek(key) === entry) {
              this.entries.del(key);
            }

            throw error;
          }
        ),
    };
    this.entries.set(key, entry);

    return entry.promise;
  }

  clear(): void {
    this.entries.reset();
  }
}
