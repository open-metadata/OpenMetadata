/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.GraphPerformanceConfig;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.api.lineage.LineageScene;
import org.openmetadata.service.search.lineage.LineageGraphConfiguration;

class LineageSceneCacheTest {
  @Test
  void cacheIsBoundedAcrossDistinctFilters() {
    LineageSceneCache cache = new LineageSceneCache(LineageGraphConfiguration.getDefault());
    IntStream.range(0, 150).forEach(index -> cache.put(key(index), new LineageScene()));

    long retained =
        IntStream.range(0, 150).filter(index -> cache.get(key(index)).isPresent()).count();
    assertTrue(retained > 0 && retained <= 50);
    assertTrue(cache.get(key(149)).isPresent());
  }

  @Test
  void invalidationRemovesAllCachedScenes() {
    LineageSceneCache cache = new LineageSceneCache(LineageGraphConfiguration.getDefault());
    LineageScene scene = new LineageScene().withBand(LineageBand.ASSET);
    cache.put(key(0), scene);
    assertEquals(scene, cache.get(key(0)).orElseThrow());

    cache.invalidateAll();

    assertTrue(cache.get(key(0)).isEmpty());
  }

  @Test
  void disabledCacheDoesNotRetainScenes() {
    LineageSceneCache cache =
        new LineageSceneCache(
            new LineageGraphConfiguration(new GraphPerformanceConfig().withEnableCaching(false)));
    cache.put(key(0), new LineageScene());

    assertTrue(cache.get(key(0)).isEmpty());
  }

  @Test
  void zeroTtlExpiresScenesImmediately() {
    LineageSceneCache cache =
        new LineageSceneCache(
            new LineageGraphConfiguration(new GraphPerformanceConfig().withCacheTTLSeconds(0)));
    cache.put(key(0), new LineageScene());

    assertTrue(cache.get(key(0)).isEmpty());
  }

  @Test
  void nullInputsDoNotReplaceExistingScenes() {
    LineageSceneCache cache = new LineageSceneCache(LineageGraphConfiguration.getDefault());
    LineageScene scene = new LineageScene();
    cache.put(key(0), scene);
    cache.put(key(0), null);
    cache.put(null, scene);

    assertTrue(cache.get(null).isEmpty());
    assertEquals(scene, cache.get(key(0)).orElseThrow());
  }

  private LineageSceneCache.Key key(int index) {
    return new LineageSceneCache.Key(
        LineageLens.SERVICE, LineageBand.ASSET, 1, 1, 100, "filter-" + index, false);
  }
}
