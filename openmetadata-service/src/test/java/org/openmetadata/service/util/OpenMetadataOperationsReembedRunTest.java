package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.util.OpenMetadataOperations.ReembedBatch;
import org.openmetadata.service.util.OpenMetadataOperations.ReembedRun;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;

/**
 * A {@code reembed} run records the model on the indexes it wrote only when it re-embedded every
 * entity, so that a run that left any entity out never claims a model an index does not hold.
 */
class OpenMetadataOperationsReembedRunTest {

  @Test
  void aRunThatReembeddedEveryEntityRecordsTheModel() {
    AtomicBoolean recorded = new AtomicBoolean();

    int exitCode =
        OpenMetadataOperations.reembedExitCode(
            Map.of("table", new AtomicInteger(0)), () -> recorded.compareAndSet(false, true));

    assertEquals(0, exitCode);
    assertTrue(recorded.get());
  }

  @Test
  void aRunThatLeftAnEntityOutRecordsNoModel() {
    AtomicBoolean recorded = new AtomicBoolean();

    int exitCode =
        OpenMetadataOperations.reembedExitCode(
            Map.of("table", new AtomicInteger(0), "topic", new AtomicInteger(1)),
            () -> recorded.compareAndSet(false, true));

    assertEquals(1, exitCode);
    assertFalse(recorded.get());
  }

  @Test
  void aRunWhoseIndexCouldNotRecordTheModelFails() {
    assertEquals(1, OpenMetadataOperations.reembedExitCode(Map.of(), () -> false));
  }

  @Test
  void aBatchThatCannotBeReadCountsEveryEntityItShouldHoldAsNotReembedded() throws Exception {
    PaginatedEntitiesSource source = mock(PaginatedEntitiesSource.class);
    when(source.readWithCursor(anyString()))
        .thenThrow(new SearchIndexException(new IllegalStateException("connection reset")));
    ReembedRun run = run();

    OpenMetadataOperations.produceReembedBatch(
        source, new ReembedBatch("table", 300, 42), run, new CountDownLatch(1));

    assertEquals(42, run.failedCounts().get("table").get());
    assertEquals(0, run.taskQueue().size());
  }

  @Test
  void aBatchReadWithErrorsCountsTheEntitiesThatCouldNotBeRead() throws Exception {
    PaginatedEntitiesSource source = mock(PaginatedEntitiesSource.class);
    ResultList<Table> page = new ResultList<>();
    page.setData(List.of(new Table()));
    page.setErrors(List.of(new EntityError(), new EntityError()));
    when(source.readWithCursor(anyString())).thenAnswer(invocation -> page);
    ReembedRun run = run();

    OpenMetadataOperations.produceReembedBatch(
        source, new ReembedBatch("table", 0, 3), run, new CountDownLatch(1));

    assertEquals(2, run.failedCounts().get("table").get());
    assertEquals(1, run.taskQueue().size());
  }

  @Test
  void aTypeWhoseIndexCannotTakeTheModelsVectorsIsLeftOutBeforeAnyProviderCall() {
    SearchRepository repo = repositoryWhere(true, Map.of("table", true, "topic", false));
    Map<String, Integer> totals = new ConcurrentHashMap<>(Map.of("table", 6, "topic", 4));
    Map<String, AtomicInteger> failed = new ConcurrentHashMap<>();

    leaveOutTypesThatCannotTakeVectors(repo, totals, failed);

    assertEquals(Map.of("table", 6), totals);
    assertEquals(4, failed.get("topic").get());
    assertFalse(failed.containsKey("table"));
  }

  @Test
  void aChunkIndexThatCannotTakeTheModelsVectorsLeavesEveryTypeOut() {
    SearchRepository repo = repositoryWhere(false, Map.of("table", true, "topic", true));
    Map<String, Integer> totals = new ConcurrentHashMap<>(Map.of("table", 6, "topic", 4));
    Map<String, AtomicInteger> failed = new ConcurrentHashMap<>();

    leaveOutTypesThatCannotTakeVectors(repo, totals, failed);

    assertTrue(totals.isEmpty());
    assertEquals(6, failed.get("table").get());
    assertEquals(4, failed.get("topic").get());
  }

  /** Entity types whose index takes the model's vectors in place, and whether the chunk index does. */
  private static SearchRepository repositoryWhere(
      boolean chunksTakeVectors, Map<String, Boolean> entityIndexTakesVectors) {
    SearchRepository repo = mock(SearchRepository.class);
    when(repo.getClusterAlias()).thenReturn("");
    when(repo.takesVectorsInPlace("data_asset_embeddings_chunks")).thenReturn(chunksTakeVectors);
    entityIndexTakesVectors.forEach(
        (entityType, takes) -> {
          String index = entityType + "_search_index";
          when(repo.getIndexMapping(entityType))
              .thenReturn(
                  IndexMapping.builder()
                      .indexName(index)
                      .alias(entityType)
                      .parentAliases(List.of())
                      .childAliases(List.of())
                      .build());
          when(repo.takesVectorsInPlace(index)).thenReturn(takes);
        });
    return repo;
  }

  private static void leaveOutTypesThatCannotTakeVectors(
      SearchRepository repo, Map<String, Integer> totals, Map<String, AtomicInteger> failed) {
    VectorIndexService vecService = mock(VectorIndexService.class);
    when(vecService.getChunkIndexName()).thenReturn("data_asset_embeddings_chunks");
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(repo);
      OpenMetadataOperations.leaveOutTypesThatCannotTakeVectors(vecService, totals, failed);
    }
  }

  private static ReembedRun run() {
    return new ReembedRun(
        new LinkedBlockingQueue<>(),
        new AtomicBoolean(false),
        new ConcurrentHashMap<>(),
        new ConcurrentHashMap<>(),
        null,
        null);
  }
}
