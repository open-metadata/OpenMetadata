package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("EntityBatchSizeEstimator Tests")
class EntityBatchSizeEstimatorTest {

  @Test
  @DisplayName("LARGE entities get smaller batch size")
  void largeEntitiesGetSmallerBatch() {
    int base = 200;
    assertEquals(100, EntityBatchSizeEstimator.estimateBatchSize("table", base));
    assertEquals(100, EntityBatchSizeEstimator.estimateBatchSize("topic", base));
    assertEquals(100, EntityBatchSizeEstimator.estimateBatchSize("dashboard", base));
    assertEquals(100, EntityBatchSizeEstimator.estimateBatchSize("mlmodel", base));
    assertEquals(100, EntityBatchSizeEstimator.estimateBatchSize("container", base));
    assertEquals(100, EntityBatchSizeEstimator.estimateBatchSize("storedProcedure", base));
  }

  @Test
  @DisplayName("LARGE entities respect minimum batch size of 25")
  void largeEntitiesRespectMinimum() {
    assertEquals(25, EntityBatchSizeEstimator.estimateBatchSize("table", 40));
    assertEquals(25, EntityBatchSizeEstimator.estimateBatchSize("table", 10));
  }

  @Test
  @DisplayName("SMALL entities get larger batch size")
  void smallEntitiesGetLargerBatch() {
    int base = 200;
    assertEquals(400, EntityBatchSizeEstimator.estimateBatchSize("user", base));
    assertEquals(400, EntityBatchSizeEstimator.estimateBatchSize("team", base));
    assertEquals(400, EntityBatchSizeEstimator.estimateBatchSize("bot", base));
    assertEquals(400, EntityBatchSizeEstimator.estimateBatchSize("role", base));
    assertEquals(400, EntityBatchSizeEstimator.estimateBatchSize("policy", base));
    assertEquals(400, EntityBatchSizeEstimator.estimateBatchSize("tag", base));
    assertEquals(400, EntityBatchSizeEstimator.estimateBatchSize("classification", base));
  }

  @Test
  @DisplayName("SMALL entities respect maximum batch size of 1000")
  void smallEntitiesRespectMaximum() {
    assertEquals(1000, EntityBatchSizeEstimator.estimateBatchSize("user", 600));
    assertEquals(1000, EntityBatchSizeEstimator.estimateBatchSize("user", 800));
  }

  @Test
  @DisplayName("MEDIUM (unknown) entities get base batch size unchanged")
  void mediumEntitiesUnchanged() {
    int base = 200;
    assertEquals(base, EntityBatchSizeEstimator.estimateBatchSize("pipeline", base));
    assertEquals(base, EntityBatchSizeEstimator.estimateBatchSize("database", base));
    assertEquals(base, EntityBatchSizeEstimator.estimateBatchSize("glossaryTerm", base));
    assertEquals(base, EntityBatchSizeEstimator.estimateBatchSize("unknownEntity", base));
  }

  @Test
  @DisplayName("handles zero and negative base batch size gracefully")
  void handlesZeroAndNegative() {
    assertEquals(0, EntityBatchSizeEstimator.estimateBatchSize("table", 0));
    assertTrue(EntityBatchSizeEstimator.estimateBatchSize("table", -1) < 0);
  }
}
