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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.JdbiException;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.rdf.RdfBatchProcessor.BatchProcessingResult;
import org.openmetadata.service.apps.bundles.rdf.sink.RdfBulkSink;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.rdf.RdfIndexingFields;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Reads every entity of the requested types and writes them through the run's single-writer
 * {@link RdfBulkSink}. A keyset page only fetches stored rows, which is cheap, so one thread pages
 * every type; loading each entity's fields is the expensive part of a read, so a pool of reader
 * threads loads pages while the sink keeps Fuseki's one write transaction busy.
 */
@Slf4j
final class RdfReindexer {
  private final BatchWriter writer;
  private final Function<String, EntityPages> pagesOf;
  private final Listener listener;
  private final int batchSize;
  private final int readers;

  /** How a run takes part in its reindex. Batch callbacks may run on any reindex thread. */
  interface Listener {
    boolean isStopRequested();

    void onPageRead();

    void onBatchWritten(String entityType, StepStats batch);

    void onBatchFailed(String entityType, int failedRecords, String reason);

    /** A stored row that does not deserialize, so it is left out of the graph. */
    void onRowDropped(String entityType, String reason);

    /** Reading {@code entityType} stopped after {@code rowsRead} rows; the rest were not indexed. */
    void onEntityTypeUnreadable(String entityType, long rowsRead, String reason);
  }

  /** Where batches are written; in a run, the single-writer sink. */
  @FunctionalInterface
  interface BatchWriter {
    CompletableFuture<BatchProcessingResult> submit(
        String entityType, List<? extends EntityInterface> entities) throws InterruptedException;
  }

  /** One entity type's stored rows, read a keyset page at a time. */
  interface EntityPages {
    List<String> readPage(KeysetCursor after, int limit);

    /** Deserializes rows and loads their fields; failures come back as errors, not exceptions. */
    ResultList<? extends EntityInterface> load(List<String> rows);

    KeysetCursor cursorAfter(List<String> rows);
  }

  /** Where the next keyset page starts: after the sort key of the last row read. */
  record KeysetCursor(String name, String id) {
    static final KeysetCursor START = new KeysetCursor("", "");
  }

  RdfReindexer(
      final BatchWriter writer,
      final Function<String, EntityPages> pagesOf,
      final Listener listener,
      final int batchSize,
      final int readers) {
    this.writer = writer;
    this.pagesOf = pagesOf;
    this.listener = listener;
    this.batchSize = batchSize;
    this.readers = readers;
  }

  /** Reads the stored entities of {@code entityType} through its repository. */
  static EntityPages repositoryPages(final String entityType) {
    return RepositoryPages.of(entityType);
  }

  /** Indexes {@code entityTypes} in order and returns once every page read has been written. */
  void index(final Collection<String> entityTypes) throws InterruptedException {
    final ExecutorService pool =
        Executors.newFixedThreadPool(readers, Thread.ofPlatform().name("rdf-reader-", 0).factory());
    final Semaphore pagesInFlight = new Semaphore(maxPagesInFlight());
    try {
      for (final String entityType : entityTypes) {
        if (listener.isStopRequested()) {
          break;
        }
        indexEntityType(entityType, pool, pagesInFlight);
      }
      pagesInFlight.acquire(maxPagesInFlight());
    } finally {
      pool.shutdownNow();
    }
  }

  /** Enough pages to keep every reader and the sink's lookahead busy, and no more in memory. */
  private int maxPagesInFlight() {
    return readers * 2;
  }

  /**
   * A type that cannot be read is reported and skipped, so one failing table does not cost the
   * rest of the rebuild; a blue/green run still refuses to promote below its success ratio.
   */
  private void indexEntityType(
      final String entityType, final ExecutorService pool, final Semaphore pagesInFlight)
      throws InterruptedException {
    final TypeRead read = new TypeRead(entityType, pagesOf.apply(entityType));
    try {
      pageEntityType(read, pool, pagesInFlight);
    } catch (JdbiException | IllegalStateException unreadable) {
      LOG.error("RDF reindex could not read {} after {} rows", entityType, read.rows, unreadable);
      listener.onEntityTypeUnreadable(entityType, read.rows, unreadable.getMessage());
    }
  }

  private void pageEntityType(
      final TypeRead read, final ExecutorService pool, final Semaphore pagesInFlight)
      throws InterruptedException {
    KeysetCursor cursor = KeysetCursor.START;
    List<String> rows;
    do {
      rows = read.pages.readPage(cursor, batchSize);
      if (!rows.isEmpty()) {
        pagesInFlight.acquire();
        submitPage(read, rows, pool).whenComplete((done, failure) -> pagesInFlight.release());
        read.rows += rows.size();
        cursor = read.pages.cursorAfter(rows);
        listener.onPageRead();
      }
    } while (rows.size() == batchSize && !listener.isStopRequested());
  }

  /** One entity type being read, and how many of its rows went to the readers so far. */
  private static final class TypeRead {
    private final String entityType;
    private final EntityPages pages;
    private long rows;

    private TypeRead(final String entityType, final EntityPages pages) {
      this.entityType = entityType;
      this.pages = pages;
    }
  }

  private CompletableFuture<Void> submitPage(
      final TypeRead read, final List<String> rows, final ExecutorService pool) {
    return CompletableFuture.supplyAsync(() -> load(read, rows), pool)
        .thenCompose(page -> write(read.entityType, page))
        .exceptionally(
            failure -> {
              reportUnwritten(read.entityType, rows.size(), failure);
              return null;
            });
  }

  private CompletableFuture<Void> write(final String entityType, final LoadedPage page) {
    final CompletableFuture<BatchProcessingResult> written =
        page.entities().isEmpty()
            ? CompletableFuture.completedFuture(new BatchProcessingResult(0, 0))
            : submitToWriter(entityType, page.entities());
    return written.thenAccept(result -> report(entityType, page, result));
  }

  private CompletableFuture<BatchProcessingResult> submitToWriter(
      final String entityType, final List<EntityInterface> entities) {
    try {
      return writer.submit(entityType, entities);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new CompletionException(e);
    }
  }

  private void report(
      final String entityType, final LoadedPage page, final BatchProcessingResult result) {
    listener.onBatchWritten(
        entityType,
        new StepStats()
            .withSuccessRecords(result.successCount())
            .withFailedRecords(result.failedCount() + page.dropped())
            .withReaderTimeMs(page.readerTimeMs())
            .withProcessTimeMs(result.processTimeMs())
            .withSinkTimeMs(result.sinkTimeMs()));
    final int failures = result.failedCount() + result.relationshipFailureCount() + page.dropped();
    if (failures > 0) {
      final String reason = result.lastError() != null ? result.lastError() : page.firstError();
      listener.onBatchFailed(entityType, failures, reason);
    }
  }

  private void reportUnwritten(final String entityType, final int records, final Throwable cause) {
    final Throwable reason =
        cause instanceof CompletionException && cause.getCause() != null ? cause.getCause() : cause;
    LOG.error("RDF reindex could not write a page of {} {} entities", records, entityType, reason);
    listener.onBatchWritten(
        entityType, new StepStats().withSuccessRecords(0).withFailedRecords(records));
    listener.onBatchFailed(entityType, records, reason.getMessage());
  }

  /**
   * An entity whose fields failed to load still carries its stored data, so it is indexed with
   * that rather than dropped over one unresolvable field (#29211); only rows that do not
   * deserialize at all are dropped.
   */
  private LoadedPage load(final TypeRead read, final List<String> rows) {
    final long startedAt = System.nanoTime();
    final ResultList<? extends EntityInterface> loaded = read.pages.load(rows);
    final List<EntityInterface> entities = new ArrayList<>(loaded.getData());
    final List<EntityError> errors = listOrEmpty(loaded.getErrors());
    int dropped = 0;
    for (final EntityError error : errors) {
      if (error.getEntity() instanceof EntityInterface storedOnly) {
        LOG.warn(
            "RDF reindex indexes {} {} with its stored data only: {}",
            read.entityType,
            storedOnly.getId(),
            error.getMessage());
        entities.add(storedOnly);
      } else {
        dropped++;
        listener.onRowDropped(read.entityType, error.getMessage());
      }
    }
    final String firstError = errors.isEmpty() ? null : errors.getFirst().getMessage();
    final long readerTimeMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
    return new LoadedPage(entities, dropped, firstError, readerTimeMs);
  }

  private record LoadedPage(
      List<EntityInterface> entities, int dropped, String firstError, long readerTimeMs) {}

  /** An entity type's rows in its repository, paged by the same keyset its list API uses. */
  private record RepositoryPages(EntityRepository<?> repository, Fields fields, ListFilter filter)
      implements EntityPages {
    static RepositoryPages of(final String entityType) {
      return new RepositoryPages(
          Entity.getEntityRepository(entityType),
          Entity.getOnlySupportedFields(entityType, RdfIndexingFields.forEntityType(entityType)),
          new ListFilter(Include.ALL));
    }

    @Override
    public List<String> readPage(final KeysetCursor after, final int limit) {
      return repository.getDao().listAfter(filter, limit, after.name(), after.id());
    }

    @Override
    public ResultList<? extends EntityInterface> load(final List<String> rows) {
      return repository.hydrate(rows, fields, filter);
    }

    @Override
    public KeysetCursor cursorAfter(final List<String> rows) {
      return cursorAfter(repository, filter, rows);
    }

    /** Walks back past any row that does not deserialize; those are dropped by the load. */
    private static <T extends EntityInterface> KeysetCursor cursorAfter(
        final EntityRepository<T> repository, final ListFilter filter, final List<String> rows) {
      for (int index = rows.size() - 1; index >= 0; index--) {
        try {
          final T last = JsonUtils.readValue(rows.get(index), repository.getEntityClass());
          return cursorOf(JsonUtils.readTree(repository.getCursorValue(last, filter)));
        } catch (JsonParsingException unreadable) {
          LOG.debug("Skipping an unreadable row while advancing the RDF reindex cursor");
        }
      }
      throw new IllegalStateException(
          "No readable row in a page of " + repository.getEntityType() + " to continue after");
    }

    private static KeysetCursor cursorOf(final JsonNode cursor) {
      return new KeysetCursor(
          FullyQualifiedName.unquoteName(cursor.path("name").asText()), cursor.path("id").asText());
    }
  }
}
