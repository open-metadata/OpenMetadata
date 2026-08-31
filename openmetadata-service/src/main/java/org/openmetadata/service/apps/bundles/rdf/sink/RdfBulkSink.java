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
package org.openmetadata.service.apps.bundles.rdf.sink;

import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.apps.bundles.rdf.RdfBatchProcessor;
import org.openmetadata.service.apps.bundles.rdf.RdfBatchProcessor.BatchProcessingResult;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

/**
 * Buffering sink between partition readers and the RDF store, mirroring the search bulk sink's
 * shape but adapted to a single-writer backend.
 *
 * <p>Why this exists: TDB2 allows exactly one write transaction, and Fuseki acquires that writer
 * lock BEFORE reading the request body — so a second concurrent request from this process only
 * queues inside Fuseki while our own client timeout ticks against queue position. Worker-per-write
 * concurrency therefore cannot add throughput and actively causes queue-position timeouts. This
 * sink inverts the shape: N readers submit batches, translation fans out to a bounded shared pool,
 * and exactly ONE writer thread drains batches to the store in FIFO order — so at most one HTTP
 * write is ever in flight per dataset, the client timeout measures real server work, and reader
 * and translate time overlap the storage round trip instead of extending it.
 *
 * <p>Backpressure chain: writer busy → bounded submission queue fills → {@link #submit} blocks the
 * reader. Translation uses a shared bounded pool with {@link ThreadPoolExecutor.CallerRunsPolicy},
 * so a translate backlog also slows submitters rather than growing memory.
 *
 * <p>Delivery/ordering: futures complete in submission order (single FIFO drain), which lets
 * partition workers advance their cursor on acknowledgement with no watermark bookkeeping.
 */
@Slf4j
public class RdfBulkSink implements AutoCloseable {

  /**
   * Shared translate pool. Static like the search sink's doc-build executor: sized for the
   * process, not per job, so concurrent jobs cannot multiply thread counts. CallerRunsPolicy is
   * the backpressure valve — a full queue makes the submitting reader translate inline.
   */
  private static final int TRANSLATE_POOL_SIZE =
      Math.min(50, Runtime.getRuntime().availableProcessors() * 4);

  private static final int TRANSLATE_QUEUE_CAPACITY = 2_000;

  private static final ExecutorService TRANSLATE_EXECUTOR =
      new ThreadPoolExecutor(
          TRANSLATE_POOL_SIZE,
          TRANSLATE_POOL_SIZE,
          60L,
          TimeUnit.SECONDS,
          new LinkedBlockingQueue<>(TRANSLATE_QUEUE_CAPACITY),
          // Platform threads, not virtual: translation is CPU-bound JSON-to-RDF mapping, so a
          // fixed pool is the point. Pooling virtual threads would park TRANSLATE_POOL_SIZE of
          // them forever and give none of their benefit, since they never block on IO here.
          platformThreadFactory("rdf-translate-"),
          new ThreadPoolExecutor.CallerRunsPolicy());

  private static java.util.concurrent.ThreadFactory platformThreadFactory(String prefix) {
    java.util.concurrent.atomic.AtomicInteger counter =
        new java.util.concurrent.atomic.AtomicInteger();
    return runnable -> {
      Thread thread = new Thread(runnable, prefix + counter.getAndIncrement());
      thread.setDaemon(true);
      return thread;
    };
  }

  /**
   * Small on purpose: each queued batch pins its translated models in memory, and queue depth
   * beyond "enough to keep the writer busy" only adds heap pressure and ack latency. A few
   * batches of lookahead keep the writer fed while the readers work on the next.
   */
  private static final int SUBMISSION_QUEUE_CAPACITY = 4;

  private static final long WRITER_POLL_MS = 200L;

  private final RdfRepository rdfRepository;
  private final RdfBatchProcessor batchProcessor;
  private final BooleanSupplier stopRequested;
  private final BlockingQueue<SubmittedBatch> submissionQueue =
      new LinkedBlockingQueue<>(SUBMISSION_QUEUE_CAPACITY);
  private final Thread writerThread;
  private final AtomicBoolean closed = new AtomicBoolean(false);

  private record SubmittedBatch(
      String entityType,
      List<? extends EntityInterface> entities,
      CompletableFuture<List<RdfStorageInterface.EntityWriteRequest>> translation,
      CompletableFuture<BatchProcessingResult> ack) {}

  public RdfBulkSink(
      RdfRepository rdfRepository,
      RdfBatchProcessor batchProcessor,
      BooleanSupplier stopRequested) {
    this.rdfRepository = rdfRepository;
    this.batchProcessor = batchProcessor;
    this.stopRequested = stopRequested != null ? stopRequested : () -> false;
    this.writerThread =
        Thread.ofPlatform().name("rdf-sink-writer").daemon().unstarted(this::drainLoop);
    this.writerThread.start();
  }

  /**
   * Enqueue a batch. Blocks when the submission queue is full (backpressure to the reader).
   * Translation starts immediately on the shared pool; the returned future completes — in
   * submission order — once the batch has been written (or terminally failed) by the writer
   * thread. After {@link #close()} the future completes exceptionally.
   */
  public CompletableFuture<BatchProcessingResult> submit(
      String entityType, List<? extends EntityInterface> entities) throws InterruptedException {
    if (closed.get()) {
      throw new IllegalStateException("RdfBulkSink is closed");
    }
    CompletableFuture<List<RdfStorageInterface.EntityWriteRequest>> translation =
        CompletableFuture.supplyAsync(
            () -> rdfRepository.translateEntities(entities), TRANSLATE_EXECUTOR);
    SubmittedBatch batch =
        new SubmittedBatch(entityType, entities, translation, new CompletableFuture<>());
    submissionQueue.put(batch);
    return batch.ack();
  }

  private void drainLoop() {
    while (!closed.get() || !submissionQueue.isEmpty()) {
      SubmittedBatch batch = pollNext();
      if (batch != null) {
        completeBatch(batch);
      }
    }
  }

  private SubmittedBatch pollNext() {
    SubmittedBatch batch = null;
    try {
      batch = submissionQueue.poll(WRITER_POLL_MS, TimeUnit.MILLISECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      closed.set(true);
    }
    return batch;
  }

  /**
   * Runs entirely on the single writer thread: exactly one storage round trip is in flight at any
   * moment, including the bisect fallback and the relationship/lineage/glossary writes inside
   * {@link RdfBatchProcessor#processEntitiesPreTranslated}.
   */
  private void completeBatch(SubmittedBatch batch) {
    try {
      List<RdfStorageInterface.EntityWriteRequest> preTranslated = batch.translation().join();
      BatchProcessingResult result =
          batchProcessor.processEntitiesPreTranslated(
              batch.entityType(), batch.entities(), preTranslated, stopRequested);
      batch.ack().complete(result);
    } catch (Exception e) {
      // Translation failure or an unexpected processor error: the ack carries the
      // exception so the worker accounts the whole batch as failed with a cause.
      // join() wraps in CompletionException — unwrap so callers see the real cause.
      Throwable cause =
          e instanceof CompletionException wrapped && wrapped.getCause() != null
              ? wrapped.getCause()
              : e;
      batch.ack().completeExceptionally(cause);
    }
  }

  /**
   * Drain and stop. Ordered BEFORE blue/green promotion: the promotion sanity check reads triple
   * counts, and an undrained sink would under-count. Batches still queued when the writer exits
   * (interrupt path) are failed exceptionally rather than silently dropped.
   */
  @Override
  public void close() {
    if (closed.compareAndSet(false, true)) {
      try {
        writerThread.join(TimeUnit.MINUTES.toMillis(10));
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
      if (writerThread.isAlive()) {
        LOG.warn("RDF sink writer did not drain within 10 minutes; interrupting");
        writerThread.interrupt();
      }
      SubmittedBatch orphan;
      while ((orphan = submissionQueue.poll()) != null) {
        orphan.ack().completeExceptionally(new IllegalStateException("RdfBulkSink closed"));
      }
    }
  }
}
