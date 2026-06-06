package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.SearchIndexJob;
import org.openmetadata.service.apps.bundles.searchIndex.promotion.RatioPromotionPolicy;
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;

class DistributedReindexFinalizerTest {

  private static final RatioPromotionPolicy DEFAULT_POLICY =
      RatioPromotionPolicy.withDefaultThreshold();

  @Test
  void finalizeRemainingEntitiesPromotesColumnOnceWhenTableAndColumnRemain() {
    RecreateIndexHandler indexPromotionHandler = mock(RecreateIndexHandler.class);
    ReindexContext stagedIndexContext = stagedContext(Entity.TABLE, Entity.TABLE_COLUMN);

    DistributedReindexFinalizer finalizer =
        new DistributedReindexFinalizer(indexPromotionHandler, stagedIndexContext, DEFAULT_POLICY);
    finalizer.finalizeRemainingEntities(Set.of(), Map.of(Entity.TABLE, successfulStats()), true);

    ArgumentCaptor<EntityReindexContext> contextCaptor =
        ArgumentCaptor.forClass(EntityReindexContext.class);
    ArgumentCaptor<Boolean> successCaptor = ArgumentCaptor.forClass(Boolean.class);
    verify(indexPromotionHandler, times(2))
        .finalizeReindex(contextCaptor.capture(), successCaptor.capture());

    Map<String, Boolean> finalizations = finalizations(contextCaptor, successCaptor);
    assertEquals(Set.of(Entity.TABLE, Entity.TABLE_COLUMN), finalizations.keySet());
    assertEquals(Boolean.TRUE, finalizations.get(Entity.TABLE));
    assertEquals(Boolean.TRUE, finalizations.get(Entity.TABLE_COLUMN));
  }

  @Test
  void finalizeRemainingEntitiesTreatsEntityWithoutStatsAsSuccess() {
    // vectorEmbedding has a staged index (built by RecreateWithEmbeddings) but the
    // distributed reader/sink pipeline doesn't run for it, so entityStats has no entry.
    // The finalizer must still promote the staged index rather than mark the entity
    // failed and roll the whole job up to FAILED.
    RecreateIndexHandler indexPromotionHandler = mock(RecreateIndexHandler.class);
    ReindexContext stagedIndexContext = stagedContext("vectorEmbedding");

    DistributedReindexFinalizer finalizer =
        new DistributedReindexFinalizer(indexPromotionHandler, stagedIndexContext, DEFAULT_POLICY);
    finalizer.finalizeRemainingEntities(Set.of(), Map.of(), true);

    ArgumentCaptor<EntityReindexContext> contextCaptor =
        ArgumentCaptor.forClass(EntityReindexContext.class);
    ArgumentCaptor<Boolean> successCaptor = ArgumentCaptor.forClass(Boolean.class);
    verify(indexPromotionHandler, times(1))
        .finalizeReindex(contextCaptor.capture(), successCaptor.capture());

    assertEquals("vectorEmbedding", contextCaptor.getValue().getEntityType());
    assertEquals(Boolean.TRUE, successCaptor.getValue());
  }

  @Test
  void finalizeRemainingEntitiesDoesNotRepromoteAlreadyPromotedColumnWhenTableRemains() {
    RecreateIndexHandler indexPromotionHandler = mock(RecreateIndexHandler.class);
    ReindexContext stagedIndexContext = stagedContext(Entity.TABLE, Entity.TABLE_COLUMN);

    DistributedReindexFinalizer finalizer =
        new DistributedReindexFinalizer(indexPromotionHandler, stagedIndexContext, DEFAULT_POLICY);
    finalizer.finalizeRemainingEntities(
        Set.of(Entity.TABLE_COLUMN), Map.of(Entity.TABLE, successfulStats()), true);

    ArgumentCaptor<EntityReindexContext> contextCaptor =
        ArgumentCaptor.forClass(EntityReindexContext.class);
    ArgumentCaptor<Boolean> successCaptor = ArgumentCaptor.forClass(Boolean.class);
    verify(indexPromotionHandler, times(1))
        .finalizeReindex(contextCaptor.capture(), successCaptor.capture());

    assertEquals(Entity.TABLE, contextCaptor.getValue().getEntityType());
    assertEquals(Boolean.TRUE, successCaptor.getValue());
  }

  @Test
  void finalizeRemainingEntitiesPromotesPartialSuccessAboveThreshold() {
    RecreateIndexHandler indexPromotionHandler = mock(RecreateIndexHandler.class);
    ReindexContext stagedIndexContext = stagedContext(Entity.TABLE);

    SearchIndexJob.EntityTypeStats partial =
        SearchIndexJob.EntityTypeStats.builder()
            .entityType(Entity.TABLE)
            .totalRecords(100)
            .successRecords(99)
            .failedRecords(1)
            .build();

    DistributedReindexFinalizer finalizer =
        new DistributedReindexFinalizer(
            indexPromotionHandler, stagedIndexContext, new RatioPromotionPolicy(0.95));
    finalizer.finalizeRemainingEntities(Set.of(), Map.of(Entity.TABLE, partial), false);

    ArgumentCaptor<Boolean> successCaptor = ArgumentCaptor.forClass(Boolean.class);
    verify(indexPromotionHandler, times(1)).finalizeReindex(any(), successCaptor.capture());
    assertEquals(
        Boolean.TRUE,
        successCaptor.getValue(),
        "99/100 records succeeded — above 0.95 threshold — must still promote");
  }

  @Test
  void finalizeRemainingEntitiesFlagsBelowThresholdAsNotFullySuccessful() {
    RecreateIndexHandler indexPromotionHandler = mock(RecreateIndexHandler.class);
    ReindexContext stagedIndexContext = stagedContext(Entity.TABLE);

    SearchIndexJob.EntityTypeStats lowSuccess =
        SearchIndexJob.EntityTypeStats.builder()
            .entityType(Entity.TABLE)
            .totalRecords(100)
            .successRecords(40)
            .failedRecords(60)
            .build();

    DistributedReindexFinalizer finalizer =
        new DistributedReindexFinalizer(
            indexPromotionHandler, stagedIndexContext, new RatioPromotionPolicy(0.95));
    finalizer.finalizeRemainingEntities(Set.of(), Map.of(Entity.TABLE, lowSuccess), false);

    ArgumentCaptor<Boolean> successCaptor = ArgumentCaptor.forClass(Boolean.class);
    verify(indexPromotionHandler, times(1)).finalizeReindex(any(), successCaptor.capture());
    assertEquals(
        Boolean.FALSE,
        successCaptor.getValue(),
        "40/100 records succeeded — below 0.95 threshold — finalizer reports NOT fully"
            + " successful; DefaultRecreateHandler will rescue via doc-count when this is false.");
  }

  @Test
  void finalizeRemainingEntitiesFlagsZeroSuccessAsNotFullySuccessful() {
    RecreateIndexHandler indexPromotionHandler = mock(RecreateIndexHandler.class);
    ReindexContext stagedIndexContext = stagedContext(Entity.TABLE);

    SearchIndexJob.EntityTypeStats zeroSuccess =
        SearchIndexJob.EntityTypeStats.builder()
            .entityType(Entity.TABLE)
            .totalRecords(100)
            .successRecords(0)
            .failedRecords(100)
            .build();

    DistributedReindexFinalizer finalizer =
        new DistributedReindexFinalizer(
            indexPromotionHandler, stagedIndexContext, new RatioPromotionPolicy(0.95));
    finalizer.finalizeRemainingEntities(Set.of(), Map.of(Entity.TABLE, zeroSuccess), false);

    ArgumentCaptor<Boolean> successCaptor = ArgumentCaptor.forClass(Boolean.class);
    verify(indexPromotionHandler, times(1)).finalizeReindex(any(), successCaptor.capture());
    assertEquals(
        Boolean.FALSE,
        successCaptor.getValue(),
        "zero successful records — handler's docCount rescue will then drop the empty staged"
            + " index.");
  }

  private Map<String, Boolean> finalizations(
      ArgumentCaptor<EntityReindexContext> contextCaptor, ArgumentCaptor<Boolean> successCaptor) {
    List<EntityReindexContext> contexts = contextCaptor.getAllValues();
    List<Boolean> outcomes = successCaptor.getAllValues();
    return Map.of(
        contexts.get(0).getEntityType(),
        outcomes.get(0),
        contexts.get(1).getEntityType(),
        outcomes.get(1));
  }

  private SearchIndexJob.EntityTypeStats successfulStats() {
    return SearchIndexJob.EntityTypeStats.builder()
        .entityType(Entity.TABLE)
        .totalRecords(1)
        .successRecords(1)
        .failedRecords(0)
        .build();
  }

  private ReindexContext stagedContext(String... entities) {
    ReindexContext context = new ReindexContext();
    for (String entity : entities) {
      context.add(
          entity,
          entity + "_index",
          entity + "_original",
          entity + "_staged",
          Set.of(entity),
          entity,
          List.of());
    }
    return context;
  }
}
