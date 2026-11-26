package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.exception.SearchIndexException;
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
