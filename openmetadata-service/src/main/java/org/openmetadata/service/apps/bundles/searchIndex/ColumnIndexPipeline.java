/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.apps.bundles.searchIndex.BulkSinkSupport.BULK_OPERATION_METADATA_OVERHEAD;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.Semaphore;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.indexes.ColumnSearchIndex;

/**
 * Table column fan-out for the reindex sinks: bounded submission, doc build, and drain.
 *
 * <p>The Elasticsearch and OpenSearch sinks had a line-for-line identical copy of this, differing
 * only in which client's {@code BulkOperation} they built. That one line is now {@link
 * ColumnDocSink}, so the throttling contract below has a single implementation instead of two that
 * could drift.
 *
 * <p>Both the executor and the permit cap are static. Total in-flight column tasks — and so the
 * number of retained {@link Table} entities — stay bounded process-wide no matter how many sinks
 * run concurrently.
 */
@Slf4j
final class ColumnIndexPipeline {

  /** The one engine-specific step: hand a built column doc to that engine's bulk processor. */
  @FunctionalInterface
  interface ColumnDocSink {
    void submit(String indexName, String docId, String json, long estimatedSizeBytes);
  }

  /**
   * The task body, supplied by the sink as a method reference to its own {@code
   * indexTableColumns}. Routing through the sink keeps that method the override point the
   * column-backpressure regression tests drive.
   */
  @FunctionalInterface
  interface ColumnIndexer {
    void index(EntityInterface entity, ReindexContext reindexContext);
  }

  private static final int DEFAULT_POOL_SIZE =
      Math.min(50, Runtime.getRuntime().availableProcessors() * 4);

  /**
   * Bounded + CallerRuns, like the sinks' doc-build pools. In practice {@link #TASK_SEMAPHORE} is
   * the binding limit and CallerRuns is only a backstop, so capacity is kept well above the permit
   * count — the semaphore, not the queue, is what throttles.
   */
  private static final int QUEUE_CAPACITY = Math.max(16, 4 * DEFAULT_POOL_SIZE);

  /**
   * Dedicated pool, isolated from the sinks' entity doc-build pools so a burst of column work
   * cannot starve entity doc-build (which is joined per batch and shares a single FIFO queue).
   */
  private static final ThreadPoolExecutor BUILD_EXECUTOR = createBuildExecutor(DEFAULT_POOL_SIZE);

  /**
   * Process-wide upper bound on in-flight column-index tasks. Each queued or running task retains
   * its full {@link Table} — every column — until it runs, so unbounded fire-and-forget submission
   * lets a fast partition reader pin thousands of Tables at once in the executor queue: the OOM
   * root cause for wide tables. {@link #submit} blocks the reader once this many tasks are
   * outstanding rather than queueing another that pins a Table.
   *
   * <p>This is a hard memory ceiling. It is deliberately fixed and is NOT scaled by {@link
   * #setBuildPoolSize}, which tunes doc-build parallelism rather than the memory bound.
   */
  private static final int MAX_INFLIGHT_COLUMN_TASKS = Math.max(8, 2 * DEFAULT_POOL_SIZE);

  private static final Semaphore TASK_SEMAPHORE = new Semaphore(MAX_INFLIGHT_COLUMN_TASKS);

  private static ThreadPoolExecutor createBuildExecutor(int poolSize) {
    ThreadPoolExecutor pool =
        new ThreadPoolExecutor(
            poolSize,
            poolSize,
            60L,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(QUEUE_CAPACITY),
            Thread.ofVirtual().name("reindex-column-build-", 0).factory(),
            new ThreadPoolExecutor.CallerRunsPolicy());
    pool.allowCoreThreadTimeOut(true);
    return pool;
  }

  static synchronized void setBuildPoolSize(int poolSize) {
    int newSize = Math.max(1, Math.min(50, poolSize));
    if (newSize <= BUILD_EXECUTOR.getMaximumPoolSize()) {
      BUILD_EXECUTOR.setCorePoolSize(newSize);
      BUILD_EXECUTOR.setMaximumPoolSize(newSize);
    } else {
      BUILD_EXECUTOR.setMaximumPoolSize(newSize);
      BUILD_EXECUTOR.setCorePoolSize(newSize);
    }
  }

  private final SearchRepository searchRepository;
  private final ColumnIndexer columnIndexer;
  private final ColumnDocSink docSink;
  private final BulkCounters counters;

  /** Doc-build failures, which never reach the bulk processor and so are not in {@link #counters}. */
  private final AtomicLong buildFailed = new AtomicLong(0);

  private final ConcurrentLinkedDeque<CompletableFuture<Void>> pendingFutures =
      new ConcurrentLinkedDeque<>();

  ColumnIndexPipeline(
      SearchRepository searchRepository,
      ColumnIndexer columnIndexer,
      ColumnDocSink docSink,
      BulkCounters counters) {
    this.searchRepository = searchRepository;
    this.columnIndexer = columnIndexer;
    this.docSink = docSink;
    this.counters = counters;
  }

  /**
   * Schedules column indexing for one table, blocking the calling thread once {@link
   * #MAX_INFLIGHT_COLUMN_TASKS} tasks are outstanding rather than queueing another that pins a
   * {@link Table}. The permit is released exactly once — when the task completes, success or
   * failure, or here if scheduling itself fails synchronously.
   */
  void submit(EntityInterface entity, ReindexContext reindexContext) {
    try {
      TASK_SEMAPHORE.acquire();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      // Record the skip so stats() reflects the missing work instead of counting these columns as
      // silently successful.
      buildFailed.incrementAndGet();
      LOG.warn(
          "Interrupted while waiting to submit column-index task for table {}; skipping columns",
          entity.getName());
      return;
    }

    boolean releaseOwnedByTask = false;
    try {
      CompletableFuture<Void> future =
          CompletableFuture.runAsync(
                  () -> columnIndexer.index(entity, reindexContext), BUILD_EXECUTOR)
              .exceptionally(
                  ex -> {
                    LOG.error("Failed to index columns for table {}", entity.getName(), ex);
                    return null;
                  })
              .whenComplete((result, ex) -> TASK_SEMAPHORE.release());
      releaseOwnedByTask = true;
      pendingFutures.add(future);
      pendingFutures.removeIf(CompletableFuture::isDone);
    } finally {
      // If scheduling threw synchronously (e.g. executor shutdown) the task's whenComplete never
      // ran, so release the permit here to avoid leaking it.
      if (!releaseOwnedByTask) {
        TASK_SEMAPHORE.release();
      }
    }
  }

  /** Flattens the table's columns and hands each built doc to the engine's bulk processor. */
  void indexColumns(EntityInterface entity, ReindexContext reindexContext) {
    if (!(entity instanceof Table table)) {
      return;
    }

    IndexMapping columnIndexMapping = searchRepository.getIndexMapping(Entity.TABLE_COLUMN);
    if (columnIndexMapping == null) {
      LOG.debug("No index mapping found for tableColumn. Skipping column indexing.");
      return;
    }
    String columnIndexName = resolveIndexName(columnIndexMapping, reindexContext);

    for (Column column : ColumnSearchIndex.flattenColumns(table.getColumns())) {
      try {
        Map<String, Object> searchIndexDoc =
            new ColumnSearchIndex(column, table).buildSearchIndexDoc();
        String json = JsonUtils.pojoToJson(searchIndexDoc);
        String docId = searchIndexDoc.get("id").toString();
        long estimatedSize =
            (long) json.getBytes(StandardCharsets.UTF_8).length + BULK_OPERATION_METADATA_OVERHEAD;
        docSink.submit(columnIndexName, docId, json, estimatedSize);
      } catch (Exception e) {
        buildFailed.incrementAndGet();
        LOG.error(
            "Failed to index column {} for table {}",
            column.getFullyQualifiedName(),
            table.getFullyQualifiedName(),
            e);
      }
    }
  }

  private String resolveIndexName(IndexMapping columnIndexMapping, ReindexContext reindexContext) {
    String canonical = columnIndexMapping.getIndexName(searchRepository.getClusterAlias());
    if (reindexContext == null) {
      return canonical;
    }
    Optional<String> stagedIndex = reindexContext.getStagedIndex(Entity.TABLE_COLUMN);
    return stagedIndex.orElse(canonical);
  }

  /** Waits for in-flight doc-build tasks so the caller can flush the column processor after. */
  void drainPending(long timeoutSeconds) {
    List<CompletableFuture<Void>> remaining = new ArrayList<>();
    CompletableFuture<Void> f;
    while ((f = pendingFutures.poll()) != null) {
      if (!f.isDone()) {
        remaining.add(f);
      }
    }
    if (remaining.isEmpty()) {
      return;
    }
    try {
      CompletableFuture.allOf(remaining.toArray(CompletableFuture[]::new))
          .get(timeoutSeconds, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      LOG.warn("Interrupted waiting for {} in-flight column doc-build tasks", remaining.size());
      Thread.currentThread().interrupt();
    } catch (Exception e) {
      LOG.warn("Timed out waiting for {} in-flight column doc-build tasks", remaining.size());
    }
  }

  /** Doc-build failures are folded into failed records: the columns are missing either way. */
  StepStats stats() {
    return counters.toStats(buildFailed.get());
  }

  long failedCount() {
    return counters.failed().get() + buildFailed.get();
  }

  long successCount() {
    return counters.success().get();
  }

  /** Visible for the column-backpressure regression tests. */
  int pendingTaskCount() {
    return pendingFutures.size();
  }

  static int maxInflightTasks() {
    return MAX_INFLIGHT_COLUMN_TASKS;
  }
}
