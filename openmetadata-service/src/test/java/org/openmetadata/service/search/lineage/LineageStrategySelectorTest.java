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
import static org.mockito.Mockito.*;

import java.io.IOException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;

public class LineageStrategySelectorTest {

  private LineageGraphExecutor mockExecutor;
  private LineageStrategySelector selector;
  private LineageGraphConfiguration config;

  @BeforeEach
  public void setUp() {
    mockExecutor = mock(LineageGraphExecutor.class);
    selector = new LineageStrategySelector(mockExecutor);
    config = LineageGraphConfiguration.getDefault();
  }

  @Test
  public void testSelectSmallGraphStrategy() {
    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(1000) // < 5K
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    LineageGraphStrategy strategy = selector.selectStrategy(context);

    assertNotNull(strategy);
    assertEquals("SmallGraph", strategy.getStrategyName());
    assertTrue(strategy.canHandle(context));
  }

  @Test
  public void testSelectMediumGraphStrategy() {
    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(25000) // 5K-50K
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    LineageGraphStrategy strategy = selector.selectStrategy(context);

    assertNotNull(strategy);
    assertEquals("MediumGraph", strategy.getStrategyName());
    assertTrue(strategy.canHandle(context));
  }

  @Test
  public void testSelectLargeGraphStrategy() {
    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(75000) // 50K-100K
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    LineageGraphStrategy strategy = selector.selectStrategy(context);

    assertNotNull(strategy);
    assertEquals("LargeGraph", strategy.getStrategyName());
    assertTrue(strategy.canHandle(context));
  }

  @Test
  public void testSelectStreamingGraphStrategy() {
    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(150000) // > 100K
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    LineageGraphStrategy strategy = selector.selectStrategy(context);

    assertNotNull(strategy);
    assertEquals("StreamingGraph", strategy.getStrategyName());
    assertTrue(strategy.canHandle(context));
  }

  @Test
  public void testBoundaryValue_SmallToMedium() {
    // Test exactly at small threshold (5000)
    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(5000)
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    LineageGraphStrategy strategy = selector.selectStrategy(context);

    assertEquals("MediumGraph", strategy.getStrategyName());
  }

  @Test
  public void testBoundaryValue_MediumToLarge() {
    // Test exactly at medium threshold (50000)
    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(50000)
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    LineageGraphStrategy strategy = selector.selectStrategy(context);

    assertEquals("LargeGraph", strategy.getStrategyName());
  }

  @Test
  public void testBoundaryValue_LargeToStreaming() {
    // Test exactly at max in-memory threshold (100000)
    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(100000)
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    LineageGraphStrategy strategy = selector.selectStrategy(context);

    assertEquals("StreamingGraph", strategy.getStrategyName());
  }

  @Test
  public void testStrategyPriorityOrdering() {
    // Verify that if multiple strategies can handle a context,
    // the one with highest priority is selected

    LineageQueryContext smallContext =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(1000)
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    LineageGraphStrategy smallStrategy = selector.selectStrategy(smallContext);

    // Small graph strategy should have highest priority for small graphs
    assertEquals("SmallGraph", smallStrategy.getStrategyName());
    assertEquals(100, smallStrategy.getPriority());
  }

  @Test
  public void testZeroNodeEstimate() {
    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(0)
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    LineageGraphStrategy strategy = selector.selectStrategy(context);

    // Should select SmallGraphStrategy for zero estimate
    assertEquals("SmallGraph", strategy.getStrategyName());
  }

  @Test
  public void testNegativeNodeEstimate() {
    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(-1)
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    LineageGraphStrategy strategy = selector.selectStrategy(context);

    // Should still select a strategy (SmallGraph as fallback)
    assertNotNull(strategy);
  }

  @Test
  public void testStrategyExecution() throws IOException {
    // Setup mock executor to return a result
    SearchLineageResult mockResult = new SearchLineageResult();
    when(mockExecutor.executeInMemory(any(), anyInt())).thenReturn(mockResult);

    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(1000)
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    LineageGraphStrategy strategy = selector.selectStrategy(context);
    SearchLineageResult result = strategy.buildGraph(context);

    assertNotNull(result);
    verify(mockExecutor, times(1)).executeInMemory(any(), anyInt());
  }
}
