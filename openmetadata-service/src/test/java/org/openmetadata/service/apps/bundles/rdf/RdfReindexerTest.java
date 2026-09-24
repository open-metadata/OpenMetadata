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
package org.openmetadata.service.apps.bundles.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.apps.bundles.rdf.RdfBatchProcessor.BatchProcessingResult;
import org.openmetadata.service.apps.bundles.rdf.RdfReindexer.EntityPages;
import org.openmetadata.service.apps.bundles.rdf.RdfReindexer.KeysetCursor;

/** The reindex reader driven over in-memory entity pages and a writer that acks asynchronously. */
class RdfReindexerTest {
  private static final int PAGE = 3;

  private final RecordingWriter writer = new RecordingWriter();
  private final RecordingListener listener = new RecordingListener();

  @Test
  void everyRowOfEveryTypeIsWrittenOnceAndIndexReturnsOnlyAfterTheLastWrite() throws Exception {
    final Map<String, EntityPages> types =
        Map.of(
            "table", pages(rows("t", 7)), "topic", pages(rows("p", 6)), "chart", pages(List.of()));

    reindexer(types).index(List.of("table", "topic", "chart"));

    assertEquals(rows("t", 7), writer.written("table"));
    assertEquals(rows("p", 6), writer.written("topic"));
    assertEquals(List.of(), writer.written("chart"));
    assertEquals(13, writer.acked.get(), "index() returned before every write was acknowledged");
    assertEquals(7, listener.succeeded("table"));
    assertEquals(6, listener.succeeded("topic"));
  }

  @Test
  void entityWhoseFieldsFailIsIndexedWithStoredDataAndAnUnreadableRowIsDropped() throws Exception {
    final InMemoryPages table = pages(rows("t", 5));
    table.storedDataOnly.add("t1");
    table.unreadable.add("t4");

    reindexer(Map.of("table", table)).index(List.of("table"));

    assertEquals(List.of("t0", "t1", "t2", "t3"), writer.written("table"));
    assertEquals(List.of("table: t4 does not deserialize"), listener.dropped);
    assertEquals(1, listener.failed("table"));
    assertTrue(
        listener.failures.contains("table: 1: t4 does not deserialize"),
        listener.failures::toString);
  }

  @Test
  void typeThatCannotBeReadIsReportedAndTheNextTypeIsStillIndexed() throws Exception {
    final InMemoryPages table = pages(rows("t", 9));
    table.failOnPage = 2;

    reindexer(Map.of("table", table, "topic", pages(rows("p", 4))))
        .index(List.of("table", "topic"));

    assertEquals(List.of("table after 3 rows: connection lost"), listener.unreadableTypes);
    assertEquals(rows("t", 3), writer.written("table"));
    assertEquals(rows("p", 4), writer.written("topic"));
  }

  @Test
  void stopRequestEndsPagingAndSkipsTheRemainingTypes() throws Exception {
    listener.stopAfterPages = 1;

    reindexer(Map.of("table", pages(rows("t", 9)), "topic", pages(rows("p", 4))))
        .index(List.of("table", "topic"));

    assertEquals(rows("t", 3), writer.written("table"));
    assertEquals(List.of(), writer.written("topic"));
  }

  @Test
  void pageTheWriterRejectsCountsAsFailedAndDoesNotHoldUpTheRun() throws Exception {
    writer.rejectContaining = "t3";

    reindexer(Map.of("table", pages(rows("t", 7)))).index(List.of("table"));

    assertEquals(4, listener.succeeded("table"));
    assertEquals(3, listener.failed("table"));
    assertTrue(
        listener.failures.contains("table: 3: Fuseki unavailable"), listener.failures::toString);
  }

  private RdfReindexer reindexer(final Map<String, EntityPages> types) {
    return new RdfReindexer(writer, types::get, listener, PAGE, 2);
  }

  private static InMemoryPages pages(final List<String> rows) {
    return new InMemoryPages(rows);
  }

  private static List<String> rows(final String prefix, final int count) {
    return IntStream.range(0, count).mapToObj(index -> prefix + index).toList();
  }

  private static Table entity(final String row) {
    return new Table().withId(UUID.randomUUID()).withName(row);
  }

  /** Rows sorted by name; each row's name is its keyset position. */
  private static final class InMemoryPages implements EntityPages {
    private final List<String> rows;
    private final Set<String> storedDataOnly = ConcurrentHashMap.newKeySet();
    private final Set<String> unreadable = ConcurrentHashMap.newKeySet();
    private int failOnPage = -1;
    private int pagesRead;

    private InMemoryPages(final List<String> rows) {
      this.rows = rows;
    }

    @Override
    public List<String> readPage(final KeysetCursor after, final int limit) {
      if (++pagesRead == failOnPage) {
        throw new UnableToExecuteStatementException("connection lost");
      }
      final int start = after == KeysetCursor.START ? 0 : rows.indexOf(after.name()) + 1;
      return rows.subList(start, Math.min(rows.size(), start + limit));
    }

    @Override
    public ResultList<? extends EntityInterface> load(final List<String> page) {
      final List<EntityInterface> entities = new ArrayList<>();
      final List<EntityError> errors = new ArrayList<>();
      for (final String row : page) {
        if (unreadable.contains(row)) {
          errors.add(new EntityError().withMessage(row + " does not deserialize"));
        } else if (storedDataOnly.contains(row)) {
          errors.add(new EntityError().withMessage(row + " tags missing").withEntity(entity(row)));
        } else {
          entities.add(entity(row));
        }
      }
      return new ResultList<>(entities, errors, null, null, entities.size());
    }

    @Override
    public KeysetCursor cursorAfter(final List<String> page) {
      final String last = page.getLast();
      return new KeysetCursor(last, last);
    }
  }

  /** Acknowledges each batch a little later, the way the sink's writer thread does. */
  private static final class RecordingWriter implements RdfReindexer.BatchWriter {
    private final Map<String, List<String>> writes = new ConcurrentHashMap<>();
    private final AtomicInteger acked = new AtomicInteger();
    private String rejectContaining;

    @Override
    public CompletableFuture<BatchProcessingResult> submit(
        final String entityType, final List<? extends EntityInterface> entities) {
      final List<String> names = entities.stream().map(EntityInterface::getName).toList();
      return CompletableFuture.supplyAsync(
          () -> {
            if (rejectContaining != null && names.contains(rejectContaining)) {
              throw new IllegalStateException("Fuseki unavailable");
            }
            writes
                .computeIfAbsent(
                    entityType, type -> Collections.synchronizedList(new ArrayList<>()))
                .addAll(names);
            acked.addAndGet(names.size());
            return new BatchProcessingResult(names.size(), 0);
          },
          CompletableFuture.delayedExecutor(20, TimeUnit.MILLISECONDS));
    }

    private List<String> written(final String entityType) {
      return writes.getOrDefault(entityType, List.of()).stream().sorted().toList();
    }
  }

  private static final class RecordingListener implements RdfReindexer.Listener {
    private final Map<String, StepStats> totals = new ConcurrentHashMap<>();
    private final List<String> failures = Collections.synchronizedList(new ArrayList<>());
    private final List<String> dropped = Collections.synchronizedList(new ArrayList<>());
    private final List<String> unreadableTypes = Collections.synchronizedList(new ArrayList<>());
    private final AtomicInteger pagesRead = new AtomicInteger();
    private int stopAfterPages = Integer.MAX_VALUE;

    @Override
    public boolean isStopRequested() {
      return pagesRead.get() >= stopAfterPages;
    }

    @Override
    public void onPageRead() {
      pagesRead.incrementAndGet();
    }

    @Override
    public void onBatchWritten(final String entityType, final StepStats batch) {
      totals.merge(
          entityType,
          batch,
          (sum, next) ->
              new StepStats()
                  .withSuccessRecords(sum.getSuccessRecords() + next.getSuccessRecords())
                  .withFailedRecords(sum.getFailedRecords() + next.getFailedRecords()));
    }

    @Override
    public void onBatchFailed(
        final String entityType, final int failedRecords, final String reason) {
      failures.add(entityType + ": " + failedRecords + ": " + reason);
    }

    @Override
    public void onRowDropped(final String entityType, final String reason) {
      dropped.add(entityType + ": " + reason);
    }

    @Override
    public void onEntityTypeUnreadable(
        final String entityType, final long rowsRead, final String reason) {
      unreadableTypes.add(entityType + " after " + rowsRead + " rows: " + reason);
    }

    private int succeeded(final String entityType) {
      return totals
          .getOrDefault(entityType, new StepStats().withSuccessRecords(0))
          .getSuccessRecords();
    }

    private int failed(final String entityType) {
      return totals
          .getOrDefault(entityType, new StepStats().withFailedRecords(0))
          .getFailedRecords();
    }
  }
}
