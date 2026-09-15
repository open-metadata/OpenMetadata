package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isStaleReferenceMessage;

import es.co.elastic.clients.elasticsearch.ElasticsearchAsyncClient;
import es.co.elastic.clients.elasticsearch._types.Refresh;
import es.co.elastic.clients.elasticsearch.core.BulkResponse;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkResponseItem;
import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;

/**
 * Buffers bulk operations for {@link ElasticSearchBulkSink} and flushes them to the cluster.
 *
 * <p>Extracted from the sink rather than left nested: the sink was 1,700+ lines and this is a
 * separate responsibility with its own state — the operation buffer, the in-flight semaphore, and
 * the docId maps used to attribute failures back to an entity. Keeping request batching next to
 * document construction is what let the sink grow that large.
 */
@Slf4j
class ElasticSearchCustomBulkProcessor {
  /**
   * Cap on how long a flush will wait for a permit before declaring the bulk failed. Mirror
   * of the OpenSearch sink's bounded acquire (PR-level rationale documented there): a single
   * leaked async future drains the semaphore and parks every subsequent caller permanently,
   * freezing the pipeline at whatever record count was in flight. Stored per-instance so
   * tests can shorten it without sleeping for a minute.
   */
  private static final long DEFAULT_SEMAPHORE_ACQUIRE_TIMEOUT_SECONDS = 60L;

  // Volatile for cross-thread visibility — read by flushInternal on the scheduler thread,
  // written by the package-private test setter from a different thread.
  private volatile long semaphoreAcquireTimeoutSeconds = DEFAULT_SEMAPHORE_ACQUIRE_TIMEOUT_SECONDS;

  private final ElasticsearchAsyncClient asyncClient;
  private final List<BulkOperation> buffer = new ArrayList<>();

  /** Maps docId to entityType for failure reporting */
  private final ConcurrentHashMap<String, String> docIdToEntityType = new ConcurrentHashMap<>();

  /** Maps docId to StageStatsTracker for sink stats recording */
  private final ConcurrentHashMap<String, StageStatsTracker> docIdToTracker =
      new ConcurrentHashMap<>();

  private long currentBufferSize = 0;
  private final Lock lock = new ReentrantLock();
  private final int bulkActions;
  private final long maxPayloadSizeBytes;
  private final Semaphore concurrentRequestSemaphore;
  private final AtomicInteger activeBulkRequests = new AtomicInteger(0);
  private final AtomicLong executionIdCounter = new AtomicLong(0);
  private final ScheduledExecutorService scheduler;
  private final AtomicLong totalSubmitted;
  private final AtomicLong totalSuccess;
  private final AtomicLong totalFailed;
  private final AtomicLong totalWarnings;
  private final Runnable statsUpdater;
  private final long initialBackoffMillis;
  private final int maxRetries;
  private volatile boolean closed = false;
  private volatile BulkSink.FailureCallback failureCallback;
  private final BulkCircuitBreaker circuitBreaker;

  ElasticSearchCustomBulkProcessor(
      ElasticSearchClient client,
      int bulkActions,
      long maxPayloadSizeBytes,
      int concurrentRequests,
      long flushIntervalMillis,
      long initialBackoffMillis,
      int maxRetries,
      AtomicLong totalSubmitted,
      AtomicLong totalSuccess,
      AtomicLong totalFailed,
      AtomicLong totalWarnings,
      Runnable statsUpdater,
      BulkCircuitBreaker circuitBreaker) {
    this.asyncClient = new ElasticsearchAsyncClient(client.getNewClient()._transport());
    this.bulkActions = bulkActions;
    this.maxPayloadSizeBytes = maxPayloadSizeBytes;
    this.concurrentRequestSemaphore = new Semaphore(concurrentRequests);
    this.initialBackoffMillis = initialBackoffMillis;
    this.maxRetries = maxRetries;
    this.totalSubmitted = totalSubmitted;
    this.totalSuccess = totalSuccess;
    this.totalFailed = totalFailed;
    this.totalWarnings = totalWarnings;
    this.statsUpdater = statsUpdater;
    this.circuitBreaker = circuitBreaker;
    this.scheduler =
        Executors.newScheduledThreadPool(
            1, Thread.ofPlatform().name("reindex-es-bulk-flush").factory());

    scheduler.scheduleAtFixedRate(
        this::flushIfNeeded, flushIntervalMillis, flushIntervalMillis, TimeUnit.MILLISECONDS);
  }

  /** In-flight bulk requests, for the sink's stats and for flush draining. */
  int activeBulkRequestCount() {
    return activeBulkRequests.get();
  }

  void setFailureCallback(BulkSink.FailureCallback callback) {
    this.failureCallback = callback;
  }

  void add(BulkOperation operation) {
    add(operation, null, null, null);
  }

  void add(BulkOperation operation, String docId, String entityType, StageStatsTracker tracker) {
    add(operation, docId, entityType, tracker, -1);
  }

  void add(
      BulkOperation operation,
      String docId,
      String entityType,
      StageStatsTracker tracker,
      long estimatedSizeBytes) {
    lock.lock();
    try {
      if (closed) {
        throw new IllegalStateException("Bulk processor is closed");
      }

      totalSubmitted.incrementAndGet();

      if (docId != null) {
        if (entityType != null) {
          docIdToEntityType.put(docId, entityType);
        }
        if (tracker != null) {
          docIdToTracker.put(docId, tracker);
        }
      }

      long operationSize =
          estimatedSizeBytes > 0 ? estimatedSizeBytes : estimateOperationSize(operation);

      if (!buffer.isEmpty() && currentBufferSize + operationSize >= maxPayloadSizeBytes) {
        flushInternal();
      }
      buffer.add(operation);
      currentBufferSize += operationSize;

      if (buffer.size() >= bulkActions || currentBufferSize >= maxPayloadSizeBytes) {
        flushInternal();
      }
    } finally {
      lock.unlock();
    }
  }

  private long estimateOperationSize(BulkOperation operation) {
    try {
      StringWriter writer = new StringWriter();
      JsonGenerator generator =
          ElasticSearchBulkSink.JACKSON_JSONP_MAPPER.jsonProvider().createGenerator(writer);
      operation.serialize(generator, ElasticSearchBulkSink.JACKSON_JSONP_MAPPER);
      generator.close();
      return writer.toString().getBytes(StandardCharsets.UTF_8).length;
    } catch (Exception e) {
      LOG.warn("Failed to estimate bulk operation size, using default: {}", e.getMessage());
      return 1024;
    }
  }

  void flush() {
    lock.lock();
    try {
      if (!buffer.isEmpty()) {
        flushInternal();
      }
    } finally {
      lock.unlock();
    }
  }

  /**
   * Flush pending requests and wait for all active bulk requests to complete. Unlike awaitClose,
   * this does not close the processor - it can continue to be used after this call.
   *
   * @param timeout Maximum time to wait
   * @param unit Time unit for timeout
   * @return true if all requests completed within timeout
   */
  boolean flushAndWait(long timeout, TimeUnit unit) throws InterruptedException {
    flush();

    long timeoutMillis = unit.toMillis(timeout);
    long startTime = System.currentTimeMillis();

    // Wait for all active bulk requests to complete with exponential backoff
    long sleepMs = 100;
    while (activeBulkRequests.get() > 0) {
      long elapsed = System.currentTimeMillis() - startTime;
      if (elapsed >= timeoutMillis) {
        LOG.warn(
            "Timeout waiting for {} active bulk requests to complete", activeBulkRequests.get());
        return false;
      }
      Thread.sleep(sleepMs);
      sleepMs = Math.min(sleepMs * 2, 1000);
    }
    return true;
  }

  private void flushIfNeeded() {
    lock.lock();
    try {
      if (!buffer.isEmpty() && !closed) {
        flushInternal();
      }
    } catch (Exception e) {
      // An exception escaping here would cancel the scheduled task permanently
      // (ScheduledExecutorService contract), silently disabling periodic flushing so trailing
      // buffers only ship on an explicit flush/close. Log and continue to the next interval.
      LOG.error("Scheduled flush failed; will retry on the next interval", e);
    } finally {
      lock.unlock();
    }
  }

  private void flushInternal() {
    if (buffer.isEmpty()) {
      return;
    }

    List<BulkOperation> toFlush = new ArrayList<>(buffer);
    buffer.clear();
    currentBufferSize = 0;

    long executionId = executionIdCounter.incrementAndGet();
    int numberOfActions = toFlush.size();
    LOG.debug("Executing bulk request {} with {} actions", executionId, numberOfActions);

    // Bounded acquire: a leaked bulk future (callback never fires) used to drain this
    // semaphore and park every subsequent caller forever. With a timeout we surface the
    // leak as a permanent failure so workers can keep moving and operators see an actual
    // error instead of the pipeline silently freezing at a fixed record count. Mirrors
    // OpenSearchBulkSink.flushInternal so both backends behave the same way.
    boolean acquired;
    try {
      acquired =
          concurrentRequestSemaphore.tryAcquire(semaphoreAcquireTimeoutSeconds, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      LOG.error("Interrupted while waiting for semaphore", e);
      Thread.currentThread().interrupt();
      recordPermanentFailure(toFlush, numberOfActions, "Interrupted while waiting for semaphore");
      return;
    }
    if (!acquired) {
      LOG.error(
          "Bulk semaphore exhausted for {}s — recording {} ops as failed (active bulk requests={}). Likely a leaked async future.",
          semaphoreAcquireTimeoutSeconds,
          numberOfActions,
          activeBulkRequests.get());
      recordPermanentFailure(
          toFlush, numberOfActions, "Bulk semaphore timeout — likely future leak");
      return;
    }

    activeBulkRequests.incrementAndGet();
    executeBulkWithRetry(toFlush, executionId, numberOfActions, 0);
  }

  // Package-private setter for tests to short-circuit the 60s default.
  void setSemaphoreAcquireTimeoutSecondsForTesting(long seconds) {
    this.semaphoreAcquireTimeoutSeconds = seconds;
  }

  private void executeBulkWithRetry(
      List<BulkOperation> operations, long executionId, int numberOfActions, int attemptNumber) {
    if (!circuitBreaker.allowRequest()) {
      LOG.warn(
          "Circuit breaker OPEN - fail-fast for bulk request {} with {} actions",
          executionId,
          numberOfActions);
      recordPermanentFailure(operations, numberOfActions, "Circuit breaker OPEN");
      activeBulkRequests.decrementAndGet();
      concurrentRequestSemaphore.release();
      return;
    }

    // Sink timing wraps the bulk HTTP round-trip — pure Elasticsearch latency.
    long bulkStartNanos = System.nanoTime();
    Set<StageStatsTracker> participatingTrackers = collectTrackers(operations);

    CompletableFuture<BulkResponse> future;
    try {
      future = asyncClient.bulk(b -> b.operations(operations).refresh(Refresh.False));
    } catch (Exception e) {
      // A synchronous throw here (e.g., dead transport) means the completion handler below
      // never runs. Without this catch the semaphore permit and activeBulkRequests slot leak,
      // eventually starving the pipeline and hanging close(). Mirror OpenSearchBulkSink so both
      // backends clean up identically.
      circuitBreaker.recordFailure();
      boolean retryScheduled =
          handleBulkFailure(operations, executionId, numberOfActions, attemptNumber, e);
      if (!retryScheduled) {
        activeBulkRequests.decrementAndGet();
        concurrentRequestSemaphore.release();
      }
      return;
    }

    future.whenComplete(
        (response, error) -> {
          long bulkElapsedNanos = System.nanoTime() - bulkStartNanos;
          for (StageStatsTracker tracker : participatingTrackers) {
            tracker.addStageTime(StageStatsTracker.Stage.SINK, bulkElapsedNanos);
          }
          boolean retryScheduled = false;
          try {
            if (error != null) {
              circuitBreaker.recordFailure();
              retryScheduled =
                  handleBulkFailure(operations, executionId, numberOfActions, attemptNumber, error);
            } else if (response.errors()) {
              circuitBreaker.recordSuccess();
              handlePartialFailure(response, executionId, numberOfActions);
            } else {
              circuitBreaker.recordSuccess();
              totalSuccess.addAndGet(numberOfActions);
              LOG.debug(
                  "Bulk request {} completed successfully with {} actions",
                  executionId,
                  numberOfActions);
              statsUpdater.run();
              // Record SINK success and clean up tracking maps
              int missingTrackers = 0;
              for (BulkOperation op : operations) {
                String docId = getDocId(op);
                if (docId != null) {
                  docIdToEntityType.remove(docId);
                  StageStatsTracker tracker = docIdToTracker.remove(docId);
                  if (tracker != null) {
                    tracker.recordSink(StatsResult.SUCCESS);
                  } else {
                    missingTrackers++;
                  }
                }
              }
              if (missingTrackers > 0) {
                LOG.warn(
                    "Bulk request {} had {} operations without tracker - sink stats not recorded",
                    executionId,
                    missingTrackers);
              }
            }
          } finally {
            if (!retryScheduled) {
              activeBulkRequests.decrementAndGet();
              concurrentRequestSemaphore.release();
            }
          }
        });
  }

  /**
   * Resolve the distinct set of trackers represented in this bulk by walking each operation's
   * docId. Used to charge Sink wall-clock time to every participating entity.
   */
  private Set<StageStatsTracker> collectTrackers(List<BulkOperation> operations) {
    Set<StageStatsTracker> trackers = new HashSet<>();
    for (BulkOperation op : operations) {
      String docId = getDocId(op);
      if (docId != null) {
        StageStatsTracker tracker = docIdToTracker.get(docId);
        if (tracker != null) {
          trackers.add(tracker);
        }
      }
    }
    return trackers;
  }

  private boolean handleBulkFailure(
      List<BulkOperation> operations,
      long executionId,
      int numberOfActions,
      int attemptNumber,
      Throwable error) {
    if (shouldRetry(attemptNumber, error)
        && circuitBreaker.getState() != BulkCircuitBreaker.State.OPEN) {
      long backoffTime = calculateBackoff(attemptNumber);
      LOG.warn(
          "Bulk request {} failed (attempt {}), retrying in {}ms: {}",
          executionId,
          attemptNumber + 1,
          backoffTime,
          error.getMessage());

      scheduler.schedule(
          () -> executeBulkWithRetry(operations, executionId, numberOfActions, attemptNumber + 1),
          backoffTime,
          TimeUnit.MILLISECONDS);
      return true;
    } else {
      LOG.error(
          "Bulk request {} failed completely after {} attempts with {} actions",
          executionId,
          attemptNumber + 1,
          numberOfActions,
          error);
      recordPermanentFailure(operations, numberOfActions, error.getMessage());
      return false;
    }
  }

  private void recordPermanentFailure(
      List<BulkOperation> operations, int numberOfActions, String failureMessage) {
    boolean staleReference = isStaleReferenceMessage(failureMessage);
    if (staleReference) {
      totalWarnings.addAndGet(numberOfActions);
    } else {
      totalFailed.addAndGet(numberOfActions);
    }

    for (BulkOperation op : operations) {
      String docId = getDocId(op);
      if (docId == null) {
        continue;
      }

      String entityType = docIdToEntityType.remove(docId);
      if (entityType == null) {
        entityType = extractEntityTypeFromIndex(getIndex(op));
      }
      StageStatsTracker tracker = docIdToTracker.remove(docId);
      if (tracker != null) {
        tracker.recordSink(staleReference ? StatsResult.WARNING : StatsResult.FAILED);
      }
      if (!staleReference && failureCallback != null) {
        failureCallback.onFailure(
            entityType, docId, null, failureMessage, IndexingFailureRecorder.FailureStage.SINK);
      }
    }

    statsUpdater.run();
  }

  private void handlePartialFailure(BulkResponse response, long executionId, int numberOfActions) {
    int failures = 0;
    int warnings = 0;
    for (BulkResponseItem item : response.items()) {
      String docId = item.id();
      StageStatsTracker tracker = docId != null ? docIdToTracker.remove(docId) : null;
      if (item.error() != null) {
        String failureMessage = item.error().reason();
        boolean staleReference = isStaleReferenceMessage(failureMessage);
        if (staleReference) {
          warnings++;
        } else {
          failures++;
        }
        if (failureMessage != null && failureMessage.contains("document_missing_exception")) {
          LOG.warn(
              "Document missing error for {}: {} - This may occur during concurrent reindexing",
              docId,
              failureMessage);
        } else {
          LOG.warn("Failed to index document {}: {}", docId, failureMessage);
        }
        String entityType = docId != null ? docIdToEntityType.remove(docId) : null;
        if (entityType == null) {
          entityType = extractEntityTypeFromIndex(item.index());
        }
        if (tracker != null) {
          tracker.recordSink(staleReference ? StatsResult.WARNING : StatsResult.FAILED);
        }
        if (!staleReference && failureCallback != null) {
          failureCallback.onFailure(
              entityType, docId, null, failureMessage, IndexingFailureRecorder.FailureStage.SINK);
        }
      } else {
        // Clean up on success
        if (docId != null) {
          docIdToEntityType.remove(docId);
        }
        if (tracker != null) {
          tracker.recordSink(StatsResult.SUCCESS);
        }
      }
    }
    int successes = numberOfActions - failures - warnings;
    totalSuccess.addAndGet(successes);
    totalFailed.addAndGet(failures);
    totalWarnings.addAndGet(warnings);

    LOG.warn(
        "Bulk request {} completed with {} failures and {} warnings out of {} actions",
        executionId,
        failures,
        warnings,
        numberOfActions);
    statsUpdater.run();
  }

  private String getDocId(BulkOperation op) {
    if (op.isIndex()) return op.index().id();
    if (op.isUpdate()) return op.update().id();
    if (op.isDelete()) return op.delete().id();
    return null;
  }

  private String getIndex(BulkOperation op) {
    if (op.isIndex()) return op.index().index();
    if (op.isUpdate()) return op.update().index();
    if (op.isDelete()) return op.delete().index();
    return null;
  }

  private String extractEntityTypeFromIndex(String indexName) {
    return BulkSinkSupport.extractEntityTypeFromIndex(indexName);
  }

  private boolean shouldRetry(int attemptNumber, Throwable error) {
    return BulkSinkSupport.shouldRetry(attemptNumber, error, maxRetries);
  }

  boolean isPayloadTooLargeError(Throwable error) {
    if (error == null || error.getMessage() == null) {
      return false;
    }
    String lowerCaseMessage = error.getMessage().toLowerCase();
    return lowerCaseMessage.contains("request entity too large")
        || lowerCaseMessage.contains("content too long")
        || lowerCaseMessage.contains("413");
  }

  private long calculateBackoff(int attemptNumber) {
    return BulkSinkSupport.calculateBackoff(attemptNumber, initialBackoffMillis);
  }

  boolean awaitClose(long timeout, TimeUnit unit) throws InterruptedException {
    closed = true;
    flush();
    scheduler.shutdown();

    long timeoutMillis = unit.toMillis(timeout);
    long startTime = System.currentTimeMillis();

    // Wait for all active bulk requests to complete with exponential backoff
    long sleepMs = 100;
    while (activeBulkRequests.get() > 0) {
      long elapsed = System.currentTimeMillis() - startTime;
      if (elapsed >= timeoutMillis) {
        LOG.warn(
            "Timeout waiting for {} active bulk requests to complete", activeBulkRequests.get());
        return false;
      }
      Thread.sleep(sleepMs);
      sleepMs = Math.min(sleepMs * 2, 1000);
    }

    return scheduler.awaitTermination(
        timeoutMillis - (System.currentTimeMillis() - startTime), TimeUnit.MILLISECONDS);
  }
}
