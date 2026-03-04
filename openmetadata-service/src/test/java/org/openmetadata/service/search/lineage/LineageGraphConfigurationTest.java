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

import org.junit.jupiter.api.Test;

public class LineageGraphConfigurationTest {

  @Test
  public void testDefaultConfiguration() {
    LineageGraphConfiguration config = LineageGraphConfiguration.getDefault();

    // Verify thresholds
    assertEquals(5000, config.getSmallGraphThreshold());
    assertEquals(50000, config.getMediumGraphThreshold());
    assertEquals(100000, config.getMaxInMemoryNodes());

    // Verify batch sizes
    assertEquals(10000, config.getSmallGraphBatchSize());
    assertEquals(5000, config.getMediumGraphBatchSize());
    assertEquals(1000, config.getLargeGraphBatchSize());
    assertEquals(500, config.getStreamingBatchSize());

    // Verify cache settings
    assertTrue(config.isEnableCaching());
    assertEquals(300, config.getCacheTTLSeconds());
    assertEquals(100, config.getMaxCachedGraphs());

    // Verify progress tracking
    assertFalse(config.isEnableProgressTracking());
    assertEquals(10000, config.getProgressReportInterval());

    // Verify scroll settings
    assertFalse(config.isUseScrollForLargeGraphs());
    assertEquals(5, config.getScrollTimeoutMinutes());
  }

  @Test
  public void testCacheEligibility() {
    LineageGraphConfiguration config = LineageGraphConfiguration.getDefault();

    // Small graphs should be cached
    assertTrue(config.shouldCacheGraph(1000));
    assertTrue(config.shouldCacheGraph(4999));

    // Medium graphs should be cached
    assertTrue(config.shouldCacheGraph(5000));
    assertTrue(config.shouldCacheGraph(25000));
    assertTrue(config.shouldCacheGraph(49999));

    // Large graphs should NOT be cached
    assertFalse(config.shouldCacheGraph(50000));
    assertFalse(config.shouldCacheGraph(75000));
    assertFalse(config.shouldCacheGraph(100000));

    // Streaming graphs should NOT be cached
    assertFalse(config.shouldCacheGraph(150000));
  }

  @Test
  public void testGraphSizeClassification() {
    LineageGraphConfiguration config = LineageGraphConfiguration.getDefault();

    // Small graphs (< 5K)
    assertTrue(1000 < config.getSmallGraphThreshold());
    assertTrue(4999 < config.getSmallGraphThreshold());

    // Medium graphs (5K-50K)
    assertTrue(5000 >= config.getSmallGraphThreshold());
    assertTrue(5000 < config.getMediumGraphThreshold());
    assertTrue(49999 < config.getMediumGraphThreshold());

    // Large graphs (50K-100K)
    assertTrue(50000 >= config.getMediumGraphThreshold());
    assertTrue(50000 < config.getMaxInMemoryNodes());
    assertTrue(99999 < config.getMaxInMemoryNodes());

    // Streaming graphs (>100K)
    assertTrue(100000 >= config.getMaxInMemoryNodes());
    assertTrue(150000 >= config.getMaxInMemoryNodes());
  }

  @Test
  public void testEdgeCases() {
    LineageGraphConfiguration config = LineageGraphConfiguration.getDefault();

    // Boundary values
    assertFalse(config.shouldCacheGraph(0));
    assertTrue(config.shouldCacheGraph(1));
    assertTrue(config.shouldCacheGraph(config.getMediumGraphThreshold() - 1));
    assertFalse(config.shouldCacheGraph(config.getMediumGraphThreshold()));
    assertFalse(config.shouldCacheGraph(config.getMediumGraphThreshold() + 1));
  }

  @Test
  public void testBatchSizeProgression() {
    LineageGraphConfiguration config = LineageGraphConfiguration.getDefault();

    // Batch sizes should decrease as graph size increases
    assertTrue(config.getSmallGraphBatchSize() > config.getMediumGraphBatchSize());
    assertTrue(config.getMediumGraphBatchSize() > config.getLargeGraphBatchSize());
    assertTrue(config.getLargeGraphBatchSize() > config.getStreamingBatchSize());
  }
}
