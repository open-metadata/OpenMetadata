package org.openmetadata.service.search;

import io.micrometer.core.instrument.Metrics;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexRetryQueueDAO.BatchUpsertEntry;

@Slf4j
public final class SearchIndexRetryQueue {

  public static final String STATUS_PENDING = "PENDING";
  public static final String STATUS_PENDING_RETRY_1 = "PENDING_RETRY_1";
  public static final String STATUS_PENDING_RETRY_2 = "PENDING_RETRY_2";
  public static final String STATUS_IN_PROGRESS = "IN_PROGRESS";
  public static final String STATUS_COMPLETED = "COMPLETED";
  public static final String STATUS_FAILED = "FAILED";
  public static final String STATUS_SEARCH_UNAVAILABLE = "SEARCH_UNAVAILABLE";

  private static final int MAX_REASON_LENGTH = 8192;
  static final int BUFFER_MAX_SIZE = 2000;
  private static final int FLUSH_BATCH_SIZE = 50;
  private static final int FLUSH_INTERVAL_MS = 500;

  private static final AtomicReference<Set<String>> SUSPENDED_ENTITY_TYPES =
      new AtomicReference<>(Collections.emptySet());
  private static final AtomicBoolean SUSPEND_ALL_STREAMING = new AtomicBoolean(false);
  private static final AtomicBoolean SEARCH_CLIENT_DOWN = new AtomicBoolean(false);
  private static final ConcurrentLinkedQueue<PendingEntry> BUFFER = new ConcurrentLinkedQueue<>();

  private static volatile Thread FLUSHER_THREAD;
  private static volatile boolean FLUSHER_RUNNING;

  record PendingEntry(
      String entityId, String entityFqn, String entityType, String failureReason, String status) {}

  private SearchIndexRetryQueue() {}

  public static void enqueue(EntityInterface entity, String operation, Throwable failure) {
    if (entity == null) {
      return;
    }
    String entityType =
        entity.getEntityReference() != null ? entity.getEntityReference().getType() : "";
    enqueue(
        entity.getId() != null ? entity.getId().toString() : null,
        entity.getFullyQualifiedName(),
        entityType,
        failureReason(operation, failure));
  }

  public static void enqueue(String entityId, String entityFqn, String failureReason) {
    enqueue(entityId, entityFqn, "", failureReason);
  }

  public static void enqueue(
      String entityId, String entityFqn, String entityType, String failureReason) {
    String normalizedEntityId = normalize(entityId);
    String normalizedEntityFqn = normalize(entityFqn);

    if (normalizedEntityId.isEmpty() && normalizedEntityFqn.isEmpty()) {
      return;
    }

    if (BUFFER.size() >= BUFFER_MAX_SIZE) {
      Metrics.counter("search.retry.dropped.overflow").increment();
      LOG.warn(
          "Search retry buffer full ({}) - dropping entry for entityId={} entityFqn={}",
          BUFFER_MAX_SIZE,
          normalizedEntityId,
          normalizedEntityFqn);
      return;
    }

    String status = SEARCH_CLIENT_DOWN.get() ? STATUS_SEARCH_UNAVAILABLE : STATUS_PENDING;
    BUFFER.add(
        new PendingEntry(
            normalizedEntityId,
            normalizedEntityFqn,
            normalize(entityType),
            truncate(failureReason),
            status));
    Metrics.counter("search.retry.enqueued").increment();
  }

  public static void setSearchClientDown(boolean down) {
    SEARCH_CLIENT_DOWN.set(down);
  }

  public static synchronized void startFlusher(CollectionDAO dao) {
    if (isFlusherRunning()) {
      return;
    }
    FLUSHER_RUNNING = true;
    FLUSHER_THREAD = newFlusherThread(dao);
    FLUSHER_THREAD.start();
    LOG.info(
        "Started search retry queue flusher (intervalMs={}, batchSize={}, maxBuffer={})",
        FLUSH_INTERVAL_MS,
        FLUSH_BATCH_SIZE,
        BUFFER_MAX_SIZE);
  }

  public static synchronized void stopFlusher(CollectionDAO dao) {
    FLUSHER_RUNNING = false;
    interruptAndJoinFlusher();
    FLUSHER_THREAD = null;
    flushBuffer(dao);
    LOG.info("Stopped search retry queue flusher");
  }

  static void flushBuffer(CollectionDAO dao) {
    List<BatchUpsertEntry> batch = drainBatch();
    while (!batch.isEmpty()) {
      writeBatch(dao, batch);
      batch = drainBatch();
    }
  }

  private static boolean isFlusherRunning() {
    return FLUSHER_THREAD != null && FLUSHER_THREAD.isAlive();
  }

  private static Thread newFlusherThread(CollectionDAO dao) {
    Thread thread = new Thread(() -> runFlusherLoop(dao), "search-retry-queue-flusher");
    thread.setDaemon(true);
    return thread;
  }

  private static void runFlusherLoop(CollectionDAO dao) {
    while (FLUSHER_RUNNING) {
      try {
        Thread.sleep(FLUSH_INTERVAL_MS);
        flushBuffer(dao);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        break;
      } catch (Exception e) {
        LOG.warn("Search retry flusher error: {}", e.getMessage());
      }
    }
  }

  private static void interruptAndJoinFlusher() {
    Thread flusher = FLUSHER_THREAD;
    if (flusher == null) {
      return;
    }
    flusher.interrupt();
    try {
      flusher.join(5000);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  private static List<BatchUpsertEntry> drainBatch() {
    List<BatchUpsertEntry> batch = new ArrayList<>(FLUSH_BATCH_SIZE);
    PendingEntry entry;
    while (batch.size() < FLUSH_BATCH_SIZE && (entry = BUFFER.poll()) != null) {
      batch.add(toBatchEntry(entry));
    }
    return batch;
  }

  private static BatchUpsertEntry toBatchEntry(PendingEntry entry) {
    return new BatchUpsertEntry(
        entry.entityId(), entry.entityFqn(), entry.failureReason(), entry.status(),
        entry.entityType());
  }

  private static void writeBatch(CollectionDAO dao, List<BatchUpsertEntry> batch) {
    try {
      dao.searchIndexRetryQueueDAO().batchUpsert(batch);
    } catch (Exception e) {
      LOG.warn(
          "Failed to batch upsert {} search retry queue entries: {}", batch.size(), e.getMessage());
    }
  }

  public static String failureReason(String operation, Throwable failure) {
    String safeOperation = normalize(operation);
    String message =
        failure != null && failure.getMessage() != null && !failure.getMessage().isEmpty()
            ? failure.getMessage()
            : failure != null ? failure.getClass().getSimpleName() : "Unknown failure";
    if (safeOperation.isEmpty()) {
      return truncate(message);
    }
    return truncate(safeOperation + ": " + message);
  }

  public static String normalize(String value) {
    if (value == null) {
      return "";
    }
    return value.trim();
  }

  public static boolean isUuid(String value) {
    try {
      UUID.fromString(value);
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  public static boolean isRetryableStatusCode(int status) {
    if (status == 429 || status >= 500) {
      return true;
    }
    return status < 400;
  }

  public static void updateSuspension(Set<String> entityTypes, boolean suspendAll) {
    Set<String> normalized = new HashSet<>();
    for (String entityType : entityTypes == null ? Collections.<String>emptySet() : entityTypes) {
      String normalizedType = normalize(entityType);
      if (!normalizedType.isEmpty()) {
        normalized.add(normalizedType);
      }
    }

    // Set entity types before the boolean so that isEntityTypeSuspended never
    // sees suspendAll=false with an outdated (empty) entity-types set.
    SUSPENDED_ENTITY_TYPES.set(Collections.unmodifiableSet(normalized));
    SUSPEND_ALL_STREAMING.set(suspendAll);
  }

  public static void clearSuspension() {
    SUSPEND_ALL_STREAMING.set(false);
    SUSPENDED_ENTITY_TYPES.set(Collections.emptySet());
  }

  public static boolean isEntityTypeSuspended(String entityType) {
    if (SUSPEND_ALL_STREAMING.get()) {
      return true;
    }
    String normalized = normalize(entityType);
    return !normalized.isEmpty() && SUSPENDED_ENTITY_TYPES.get().contains(normalized);
  }

  public static boolean isStreamingSuspended() {
    return SUSPEND_ALL_STREAMING.get() || !SUSPENDED_ENTITY_TYPES.get().isEmpty();
  }

  public static boolean isSuspendAllStreaming() {
    return SUSPEND_ALL_STREAMING.get();
  }

  public static Set<String> getSuspendedEntityTypes() {
    return SUSPENDED_ENTITY_TYPES.get();
  }

  private static String truncate(String value) {
    if (value == null) {
      return null;
    }
    if (value.length() <= MAX_REASON_LENGTH) {
      return value;
    }
    return value.substring(0, MAX_REASON_LENGTH);
  }
}
