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
import java.util.HashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.GraphPerformanceConfig;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;

public class SmallGraphStrategyTest {

  private LineageGraphExecutor mockExecutor;
  private SmallGraphStrategy strategy;
  private LineageGraphConfiguration config;

  @BeforeEach
  public void setUp() {
    mockExecutor = mock(LineageGraphExecutor.class);
    strategy = new SmallGraphStrategy(mockExecutor);
    config = LineageGraphConfiguration.getDefault();
  }

  @Test
  public void testStrategyName() {
    assertEquals("SmallGraph", strategy.getStrategyName());
  }

  @Test
  public void testPriority() {
    // Small graph strategy should have highest priority
    assertEquals(100, strategy.getPriority());
  }

  @Test
  public void testCanHandle_SmallGraph() {
    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(1000) // < 5K
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    assertTrue(strategy.canHandle(context));
  }

  @Test
  public void testCanHandle_BoundaryValue() {
    // Exactly at threshold (4999)
    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(4999)
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    assertTrue(strategy.canHandle(context));
  }

  @Test
  public void testCannotHandle_MediumGraph() {
    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(5000) // >= 5K
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    assertFalse(strategy.canHandle(context));
  }

  @Test
  public void testCannotHandle_LargeGraph() {
    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(60000)
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    assertFalse(strategy.canHandle(context));
  }

  @Test
  public void testBuildGraph_Success() throws IOException {
    SearchLineageResult mockResult = new SearchLineageResult();
    mockResult.setNodes(new HashMap<>());
    mockResult.setUpstreamEdges(new HashMap<>());
    mockResult.setDownstreamEdges(new HashMap<>());

    // Add 1000 nodes to match estimate
    for (int i = 0; i < 1000; i++) {
      mockResult.getNodes().put("node" + i, null);
    }

    when(mockExecutor.executeInMemory(any(), eq(10000))).thenReturn(mockResult);

    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3))
            .estimatedNodeCount(1000)
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    SearchLineageResult result = strategy.buildGraph(context);

    assertNotNull(result);
    assertEquals(1000, result.getNodes().size());

    // Verify executor was called with correct batch size (10K for small graphs)
    verify(mockExecutor, times(1)).executeInMemory(any(), eq(10000));
  }

  @Test
  public void testBuildGraph_WithProgressTracking() throws IOException {
    // Enable progress tracking in config
    LineageGraphConfiguration configWithTracking =
        new LineageGraphConfiguration(
            new GraphPerformanceConfig()
                .withSmallGraphThreshold(5000)
                .withMediumGraphThreshold(50000)
                .withMaxInMemoryNodes(100000)
                .withSmallGraphBatchSize(10000)
                .withEnableProgressTracking(true)
                .withProgressReportInterval(1000));

    SearchLineageResult mockResult = new SearchLineageResult();
    mockResult.setNodes(new HashMap<>());

    when(mockExecutor.executeInMemory(any(), anyInt())).thenReturn(mockResult);

    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(1000)
            .config(configWithTracking)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    SearchLineageResult result = strategy.buildGraph(context);

    assertNotNull(result);
    // Progress tracker should be NoOpProgressTracker for small graphs
    assertNull(context.getProgressTracker());
  }

  @Test
  public void testBuildGraph_ErrorHandling() throws IOException {
    when(mockExecutor.executeInMemory(any(), anyInt())).thenThrow(new IOException("Test error"));

    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(1000)
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    assertThrows(IOException.class, () -> strategy.buildGraph(context));
  }

  @Test
  public void testBuildGraph_ZeroNodes() throws IOException {
    SearchLineageResult mockResult = new SearchLineageResult();
    mockResult.setNodes(new HashMap<>());

    when(mockExecutor.executeInMemory(any(), anyInt())).thenReturn(mockResult);

    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(0)
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    SearchLineageResult result = strategy.buildGraph(context);

    assertNotNull(result);
    assertEquals(0, result.getNodes().size());
  }

  @Test
  public void testBatchSizeCorrect() {
    LineageQueryContext context =
        LineageQueryContext.builder()
            .request(new SearchLineageRequest().withFqn("table1"))
            .estimatedNodeCount(1000)
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    // Small graph strategy should use smallGraphBatchSize (10K)
    assertEquals(10000, context.getBatchSize());
  }
}
