/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.search.lineage;

import static org.junit.jupiter.api.Assertions.*;

import com.google.common.cache.CacheStats;
import java.util.HashMap;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;

public class GuavaLineageGraphCacheTest {

  private GuavaLineageGraphCache cache;
  private LineageGraphConfiguration config;

  @BeforeEach
  public void setUp() {
    config = LineageGraphConfiguration.getDefault();
    cache = new GuavaLineageGraphCache(config);
  }

  @Test
  public void testCacheMiss() {
    SearchLineageRequest request =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3);

    LineageCacheKey key = LineageCacheKey.fromRequest(request);
    Optional<SearchLineageResult> result = cache.get(key);

    assertFalse(result.isPresent());
  }

  @Test
  public void testCacheHit() {
    SearchLineageRequest request =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3);

    LineageCacheKey key = LineageCacheKey.fromRequest(request);
    SearchLineageResult result = createMockResult(100);

    cache.put(key, result);
    Optional<SearchLineageResult> cached = cache.get(key);

    assertTrue(cached.isPresent());
    assertEquals(100, cached.get().getNodes().size());
  }

  @Test
  public void testCacheInvalidation() {
    SearchLineageRequest request =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3);

    LineageCacheKey key = LineageCacheKey.fromRequest(request);
    SearchLineageResult result = createMockResult(100);

    cache.put(key, result);
    cache.invalidate(key);

    Optional<SearchLineageResult> cached = cache.get(key);
    assertFalse(cached.isPresent());
  }

  @Test
  public void testCacheInvalidateAll() {
    SearchLineageRequest request1 =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3);

    SearchLineageRequest request2 =
        new SearchLineageRequest().withFqn("table2").withUpstreamDepth(3);

    LineageCacheKey key1 = LineageCacheKey.fromRequest(request1);
    LineageCacheKey key2 = LineageCacheKey.fromRequest(request2);

    cache.put(key1, createMockResult(100));
    cache.put(key2, createMockResult(200));

    assertEquals(2, cache.size());

    cache.invalidateAll();

    assertEquals(0, cache.size());
    assertFalse(cache.get(key1).isPresent());
    assertFalse(cache.get(key2).isPresent());
  }

  @Test
  public void testCacheStats() {
    SearchLineageRequest request =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3);

    LineageCacheKey key = LineageCacheKey.fromRequest(request);
    SearchLineageResult result = createMockResult(100);

    // Miss
    cache.get(key);

    // Put
    cache.put(key, result);

    // Hit
    cache.get(key);
    cache.get(key);

    CacheStats stats = cache.getStats();

    assertEquals(2, stats.hitCount());
    assertEquals(1, stats.missCount());
    assertEquals(3, stats.requestCount());
  }

  @Test
  public void testCacheSize() {
    assertEquals(0, cache.size());

    SearchLineageRequest request1 =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3);

    SearchLineageRequest request2 =
        new SearchLineageRequest().withFqn("table2").withUpstreamDepth(3);

    cache.put(LineageCacheKey.fromRequest(request1), createMockResult(100));
    assertEquals(1, cache.size());

    cache.put(LineageCacheKey.fromRequest(request2), createMockResult(200));
    assertEquals(2, cache.size());
  }

  @Test
  public void testNullKeyHandling() {
    Optional<SearchLineageResult> result = cache.get(null);
    assertFalse(result.isPresent());
  }

  @Test
  public void testNullResultHandling() {
    SearchLineageRequest request =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3);

    LineageCacheKey key = LineageCacheKey.fromRequest(request);

    cache.put(key, null);

    // Should not be cached
    assertEquals(0, cache.size());
  }

  @Test
  public void testLargeGraphRejection() {
    SearchLineageRequest request =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3);

    LineageCacheKey key = LineageCacheKey.fromRequest(request);

    // Try to cache a graph larger than medium threshold (50K)
    SearchLineageResult largeResult = createMockResult(60000);
    cache.put(key, largeResult);

    // Should not be cached (warning logged)
    assertEquals(0, cache.size());
  }

  @Test
  public void testHitRatio() {
    SearchLineageRequest request =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3);

    LineageCacheKey key = LineageCacheKey.fromRequest(request);

    // Initial hit ratio should be 0.0 (no requests yet)
    assertEquals(0.0, cache.getHitRatio(), 0.001);

    // Miss
    cache.get(key);
    assertEquals(0.0, cache.getHitRatio(), 0.001);

    // Put and hit
    cache.put(key, createMockResult(100));
    cache.get(key);

    // Hit ratio should be 0.5 (1 hit, 2 total requests)
    assertEquals(0.5, cache.getHitRatio(), 0.001);

    // More hits
    cache.get(key);
    cache.get(key);

    // Hit ratio should be 0.75 (3 hits, 4 total requests)
    assertEquals(0.75, cache.getHitRatio(), 0.001);
  }

  private SearchLineageResult createMockResult(int nodeCount) {
    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(new HashMap<>());
    result.setUpstreamEdges(new HashMap<>());
    result.setDownstreamEdges(new HashMap<>());

    // Add dummy nodes
    for (int i = 0; i < nodeCount; i++) {
      result.getNodes().put("node" + i, null);
    }

    return result;
  }
}
