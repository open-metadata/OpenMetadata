package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;

class DistributedReindexFinalizerTest {

  @Test
  void finalizeRemainingEntitiesPromotesColumnOnceWhenTableAndColumnRemain() {
    RecreateIndexHandler indexPromotionHandler = mock(RecreateIndexHandler.class);
    ReindexContext stagedIndexContext = stagedContext(Entity.TABLE, Entity.TABLE_COLUMN);

    DistributedReindexFinalizer finalizer =
        new DistributedReindexFinalizer(indexPromotionHandler, stagedIndexContext);
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
  void finalizeRemainingEntitiesDoesNotRepromoteAlreadyPromotedColumnWhenTableRemains() {
    RecreateIndexHandler indexPromotionHandler = mock(RecreateIndexHandler.class);
    ReindexContext stagedIndexContext = stagedContext(Entity.TABLE, Entity.TABLE_COLUMN);

    DistributedReindexFinalizer finalizer =
        new DistributedReindexFinalizer(indexPromotionHandler, stagedIndexContext);
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
