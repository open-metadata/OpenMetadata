/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.rdf.distributed;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.rdf.RdfBatchProcessor;
import org.openmetadata.service.apps.bundles.rdf.sink.RdfBulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.HeapBackpressure;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.rdf.RdfIndexingFields;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;

@Slf4j
public class RdfPartitionWorker {
  private static final long MAX_CURSOR_INITIALIZATION_OFFSET = (long) Integer.MAX_VALUE + 1L;
  private static final int PROGRESS_UPDATE_INTERVAL = 100;

  /**
   * Read-ahead bound: how many submitted-but-unacknowledged batches a worker may hold. Each
   * pending batch pins its entities and translated models, so this is a memory ceiling; beyond
   * "keep the single sink writer fed" more lookahead only adds heap pressure.
   */
  private static final int MAX_OUTSTANDING_BATCHES = 3;

  private final DistributedRdfIndexCoordinator coordinator;
  private final RdfBulkSink sink;
  private final RdfBatchProcessor batchProcessor;
  private final int batchSize;
  private final AtomicBoolean stopped = new AtomicBoolean(false);

  public RdfPartitionWorker(
      DistributedRdfIndexCoordinator coordinator,
      RdfBulkSink sink,
      RdfBatchProcessor batchProcessor,
      int batchSize) {
    this.coordinator = coordinator;
    this.sink = sink;
    this.batchProcessor = batchProcessor;
    this.batchSize = batchSize;
  }

  /** One read-batch in flight at the sink; folded into the accumulator when its acks arrive. */
  private record PendingSubmission(
      long cursorDelta,
      int dataCount,
      int unrecoverable,
      String readerError,
      CompletableFuture<RdfBatchProcessor.BatchProcessingResult> mainAck,
      CompletableFuture<RdfBatchProcessor.BatchProcessingResult> recoveredAck) {}

  /**
   * Fold state. {@code ackedOffset} is the crash-resume point: it advances only when a batch's
   * acknowledgement arrives (FIFO from the sink, so acks are contiguous), never at read time —
   * the reader may be several batches ahead of what the store has durably accepted.
   */
  private static final class Accumulator {
    private long ackedOffset;
    private long processedCount;
    private long successCount;
    private long failedCount;
    private long readerTimeMs;
    private long processTimeMs;
    private long sinkTimeMs;
    private long relationshipFailureCount;
    private String lastError;
    private boolean truncatedByStop;
  }

  public PartitionResult processPartition(RdfIndexPartition partition) {
    String entityType = partition.getEntityType();
    long readOffset = Math.max(partition.getCursor(), partition.getRangeStart());
    Accumulator acc = new Accumulator();
    acc.ackedOffset = readOffset;
    acc.processedCount = partition.getProcessedCount();
    acc.successCount = partition.getSuccessCount();
    acc.failedCount = partition.getFailedCount();
    // Seeded from the partition row (like the counts) so a reclaimed partition
    // keeps the prior claim's accumulated timing instead of restarting at zero.
    acc.readerTimeMs = partition.getReaderTimeMs();
    acc.processTimeMs = partition.getProcessTimeMs();
    acc.sinkTimeMs = partition.getSinkTimeMs();
    Deque<PendingSubmission> pending = new ArrayDeque<>();

    try {
      String keysetCursor = initializeKeysetCursor(partition, entityType, readOffset);
      while (readOffset < partition.getRangeEnd()
          && !stopped.get()
          && !Thread.currentThread().isInterrupted()) {
        // The reader is the only stage that may run ahead; pause it when the JVM
        // heap is under pressure — pending batches pin translated models.
        HeapBackpressure.awaitHeadroom();
        int currentBatchSize = (int) Math.min(batchSize, partition.getRangeEnd() - readOffset);
        long readStartNanos = System.nanoTime();
        ResultList<? extends EntityInterface> resultList =
            readEntitiesKeyset(entityType, keysetCursor, currentBatchSize);
        acc.readerTimeMs += TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - readStartNanos);

        if (resultList == null || listOrEmpty(resultList.getData()).isEmpty()) {
          break;
        }

        pending.add(submitBatch(entityType, resultList));
        readOffset += pending.peekLast().cursorDelta();

        foldCompletedHead(partition, pending, acc);
        while (pending.size() >= MAX_OUTSTANDING_BATCHES && !acc.truncatedByStop) {
          foldOne(partition, pending.remove(), acc);
        }
        if (acc.truncatedByStop) {
          break;
        }

        keysetCursor = resultList.getPaging() != null ? resultList.getPaging().getAfter() : null;
        if (keysetCursor == null && readOffset < partition.getRangeEnd()) {
          keysetCursor = initializeKeysetCursor(partition, entityType, readOffset);
          if (keysetCursor == null) {
            break;
          }
        }
      }

      while (!pending.isEmpty() && !acc.truncatedByStop) {
        foldOne(partition, pending.remove(), acc);
      }
      pending.clear();

      // Flush the final timing interval before terminal-state updates: the
      // completion/fail updates deliberately do NOT touch the timing columns,
      // so this is the write that makes the tail of the partition's timing
      // durable. The persisted cursor is the ACKED offset — never the read
      // offset — so a crash or stop resumes from the last batch the store
      // actually accepted.
      flushTimingProgress(
          partition,
          acc.ackedOffset,
          acc.processedCount,
          acc.successCount,
          acc.failedCount,
          acc.readerTimeMs,
          acc.processTimeMs,
          acc.sinkTimeMs);

      if (acc.truncatedByStop || stopped.get() || Thread.currentThread().isInterrupted()) {
        return new PartitionResult(
            acc.processedCount,
            acc.successCount,
            acc.failedCount,
            acc.relationshipFailureCount,
            true,
            acc.lastError);
      }

      coordinator.completePartition(
          partition.getId(),
          acc.ackedOffset,
          acc.processedCount,
          acc.successCount,
          acc.failedCount,
          acc.lastError);
      return new PartitionResult(
          acc.processedCount,
          acc.successCount,
          acc.failedCount,
          acc.relationshipFailureCount,
          false,
          acc.lastError);
    } catch (Exception e) {
      LOG.error("Failed to process RDF partition {}", partition.getId(), e);
      coordinator.failPartition(
          partition.getId(),
          acc.ackedOffset,
          acc.processedCount,
          acc.successCount,
          acc.failedCount,
          e.getMessage());
      return new PartitionResult(
          acc.processedCount,
          acc.successCount,
          acc.failedCount,
          acc.relationshipFailureCount,
          false,
          e.getMessage());
    }
  }

  /**
   * Submit the read batch (and, separately, any reader-recoverable entities) to the sink. The
   * recoverable batch rides FIFO immediately behind its main batch, so both are folded together
   * when this submission's turn comes.
   */
  private PendingSubmission submitBatch(
      String entityType, ResultList<? extends EntityInterface> resultList)
      throws InterruptedException {
    List<EntityError> readerFailures = listOrEmpty(resultList.getErrors());
    String readerError = logReaderFailures(entityType, readerFailures);
    List<EntityInterface> recoverable = recoverableEntities(readerFailures);
    CompletableFuture<RdfBatchProcessor.BatchProcessingResult> mainAck =
        sink.submit(entityType, resultList.getData());
    CompletableFuture<RdfBatchProcessor.BatchProcessingResult> recoveredAck =
        recoverable.isEmpty() ? null : sink.submit(entityType, recoverable);
    return new PendingSubmission(
        resultList.getData().size() + readerFailures.size(),
        resultList.getData().size(),
        readerFailures.size() - recoverable.size(),
        readerError,
        mainAck,
        recoveredAck);
  }

  private void foldCompletedHead(
      RdfIndexPartition partition, Deque<PendingSubmission> pending, Accumulator acc) {
    while (!acc.truncatedByStop
        && !pending.isEmpty()
        && pending.peek().mainAck().isDone()
        && (pending.peek().recoveredAck() == null || pending.peek().recoveredAck().isDone())) {
      foldOne(partition, pending.remove(), acc);
    }
  }

  private void foldOne(RdfIndexPartition partition, PendingSubmission submission, Accumulator acc) {
    int recoveredCount =
        (int) submission.cursorDelta() - submission.dataCount() - submission.unrecoverable();
    RdfBatchProcessor.BatchProcessingResult main =
        joinAck(submission.mainAck(), submission.dataCount());
    RdfBatchProcessor.BatchProcessingResult recovered =
        submission.recoveredAck() != null
            ? joinAck(submission.recoveredAck(), recoveredCount)
            : new RdfBatchProcessor.BatchProcessingResult(0, 0);

    // A batch the sink skipped because the run is stopping reports zero counts.
    // Do NOT advance the acked cursor past it: those entities were never
    // written, and the resume must re-read them.
    if (stopped.get()
        && submission.dataCount() > 0
        && main.successCount() + main.failedCount() == 0) {
      acc.truncatedByStop = true;
      return;
    }

    acc.processedCount += submission.cursorDelta();
    acc.successCount += main.successCount() + recovered.successCount();
    // failedCount tracks entity-level failures only (one record == one entity);
    // relationship/lineage edge failures are counted separately.
    acc.failedCount += main.failedCount() + recovered.failedCount() + submission.unrecoverable();
    acc.relationshipFailureCount +=
        main.relationshipFailureCount() + recovered.relationshipFailureCount();
    acc.sinkTimeMs += main.sinkTimeMs() + recovered.sinkTimeMs();
    acc.processTimeMs += main.processTimeMs() + recovered.processTimeMs();
    acc.ackedOffset += submission.cursorDelta();
    if (main.lastError() != null) {
      acc.lastError = main.lastError();
    } else if (recovered.lastError() != null) {
      acc.lastError = recovered.lastError();
    } else if (submission.readerError() != null) {
      acc.lastError = submission.readerError();
    }

    if (acc.processedCount % PROGRESS_UPDATE_INTERVAL < submission.cursorDelta()) {
      coordinator.updatePartitionProgress(
          partition.toBuilder()
              .cursor(acc.ackedOffset)
              .processedCount(acc.processedCount)
              .successCount(acc.successCount)
              .failedCount(acc.failedCount)
              .readerTimeMs(acc.readerTimeMs)
              .processTimeMs(acc.processTimeMs)
              .sinkTimeMs(acc.sinkTimeMs)
              .build());
    }
  }

  /**
   * An exceptionally-completed ack (translation failure or unexpected sink error) accounts the
   * whole sub-batch as failed rather than aborting the partition: the failure is already recorded
   * and logged, and the remaining batches are unaffected.
   */
  private RdfBatchProcessor.BatchProcessingResult joinAck(
      CompletableFuture<RdfBatchProcessor.BatchProcessingResult> ack, int terminalFailureCount) {
    RdfBatchProcessor.BatchProcessingResult result;
    try {
      result = ack.join();
    } catch (CompletionException e) {
      Throwable cause = e.getCause() != null ? e.getCause() : e;
      LOG.error("RDF sink batch failed terminally", cause);
      result =
          new RdfBatchProcessor.BatchProcessingResult(0, terminalFailureCount, cause.getMessage());
    }
    return result;
  }

  public void stop() {
    stopped.set(true);
  }

  private void flushTimingProgress(
      RdfIndexPartition partition,
      long cursor,
      long processedCount,
      long successCount,
      long failedCount,
      long readerTimeMs,
      long processTimeMs,
      long sinkTimeMs) {
    try {
      coordinator.updatePartitionProgress(
          partition.toBuilder()
              .cursor(cursor)
              .processedCount(processedCount)
              .successCount(successCount)
              .failedCount(failedCount)
              .readerTimeMs(readerTimeMs)
              .processTimeMs(processTimeMs)
              .sinkTimeMs(sinkTimeMs)
              .build());
    } catch (Exception statsFailure) {
      LOG.warn(
          "Could not flush final timing progress for partition {}",
          partition.getId(),
          statsFailure);
    }
  }

  /**
   * Log every reader failure with the offending entity's id/FQN and reason, and return a
   * representative message for the partition's {@code lastError}. A failure whose entity
   * deserialized (recoverable) is logged at WARN — its core data is re-indexed afterwards, not
   * dropped. A row that could not be deserialized at all is logged at ERROR — it is dropped from
   * the graph. The representative message prefers the first dropped (unrecoverable) failure so
   * {@code lastError} describes a genuine drop, and otherwise falls back to the first non-null
   * message so a batch of recoverable failures still surfaces a reason (#29211). Without this the
   * failure count rose with no way to identify the affected entities; the only other trace was a
   * DEBUG line in {@link org.openmetadata.service.jdbi3.EntityRepository#listAfterKeyset}.
   */
  private String logReaderFailures(String entityType, List<EntityError> readerFailures) {
    String firstDropped = null;
    String firstMessage = null;
    for (EntityError failure : readerFailures) {
      String message = failure.getMessage();
      if (firstMessage == null && message != null) {
        firstMessage = message;
      }
      if (failure.getEntity() instanceof EntityInterface) {
        LOG.warn(
            "RDF reindex could not fully hydrate {} entity {} — attempting to index core data only. "
                + "Reason: {}",
            entityType,
            describeFailedEntity(failure),
            message);
      } else {
        if (firstDropped == null && message != null) {
          firstDropped = message;
        }
        LOG.error(
            "RDF reindex could not deserialize a {} row — dropping it from the graph. Reason: {}",
            entityType,
            message);
        batchProcessor.recordReaderFailure(entityType, message);
      }
    }
    return firstDropped != null ? firstDropped : firstMessage;
  }

  /**
   * Entities that deserialized but failed field resolution still carry their core stored data on
   * the {@link EntityError}. Return them so the indexer can re-index them with that core data
   * instead of dropping them from the graph over a single unresolvable field (#29211).
   */
  private static List<EntityInterface> recoverableEntities(List<EntityError> readerFailures) {
    List<EntityInterface> recoverable = new ArrayList<>();
    for (EntityError failure : readerFailures) {
      if (failure.getEntity() instanceof EntityInterface entity) {
        recoverable.add(entity);
      }
    }
    return recoverable;
  }

  private static String describeFailedEntity(EntityError failure) {
    Object rawEntity = failure.getEntity();
    String descriptor;
    if (rawEntity instanceof EntityInterface entity) {
      descriptor = describeEntityReference(entity);
    } else if (rawEntity != null) {
      descriptor = rawEntity.toString();
    } else {
      descriptor = "<unknown>";
    }
    return descriptor;
  }

  private static String describeEntityReference(EntityInterface entity) {
    UUID id = entity.getId();
    String descriptor = id != null ? id.toString() : "<no-id>";
    String fqn = entity.getFullyQualifiedName();
    if (fqn != null) {
      descriptor = descriptor + " (" + fqn + ")";
    }
    return descriptor;
  }

  private ResultList<? extends EntityInterface> readEntitiesKeyset(
      String entityType, String keysetCursor, int limit) throws SearchIndexException {
    List<String> fields = RdfIndexingFields.forEntityType(entityType);
    PaginatedEntitiesSource source = new PaginatedEntitiesSource(entityType, limit, fields, 0);
    return source.readNextKeyset(keysetCursor);
  }

  private String initializeKeysetCursor(
      RdfIndexPartition partition, String entityType, long offset) {
    if (offset <= 0) {
      return null;
    }
    String precomputed =
        coordinator.getPartitionStartCursor(partition.getJobId(), entityType, offset);
    if (precomputed != null) {
      return precomputed;
    }
    int cursorOffset = toCursorOffset(entityType, offset);
    return Entity.getEntityRepository(entityType)
        .getCursorAtOffset(new ListFilter(Include.ALL), cursorOffset);
  }

  private int toCursorOffset(String entityType, long offset) {
    long cursorOffset = offset - 1L;
    if (cursorOffset > Integer.MAX_VALUE) {
      throw new IllegalArgumentException(
          String.format(
              "Keyset cursor initialization for entityType %s does not support offsets above %d",
              entityType, MAX_CURSOR_INITIALIZATION_OFFSET));
    }
    return Math.toIntExact(cursorOffset);
  }

  /**
   * Outcome of processing a single partition.
   *
   * @param processedCount entities + reader-error rows seen
   * @param successCount entities written successfully
   * @param failedCount entity-level failures (counts toward failedRecords stats)
   * @param relationshipFailureCount per-edge relationship/lineage failures, NOT
   *     included in failedCount because they don't map to "records"; surfaced so
   *     completion tracking and run-record reporting can still flag the partition
   * @param stopped whether the partition exited via stop signal
   * @param errorMessage representative failure message if any
   */
  public record PartitionResult(
      long processedCount,
      long successCount,
      long failedCount,
      long relationshipFailureCount,
      boolean stopped,
      String errorMessage) {

    /** Did this partition encounter any failure (entity-level or relationship)? */
    public boolean hasAnyFailure() {
      return failedCount > 0 || relationshipFailureCount > 0;
    }
  }
}
