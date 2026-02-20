package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public class IndexingFailureRecorder implements AutoCloseable {

  public enum FailureStage {
    READER,
    READER_EXCEPTION,
    SINK,
    PROCESS,
    VECTOR_SINK
  }

  private static final int DEFAULT_BATCH_SIZE = 100;

  private final CollectionDAO.SearchIndexFailureDAO failureDAO;
  private final String jobId;
  private final String serverId;
  private final int batchSize;
  private final List<CollectionDAO.SearchIndexFailureDAO.SearchIndexFailureRecord> buffer;
  private final ReentrantLock lock = new ReentrantLock();
  private volatile boolean closed = false;

  public IndexingFailureRecorder(CollectionDAO collectionDAO, String jobId, String serverId) {
    this(collectionDAO, jobId, serverId, DEFAULT_BATCH_SIZE);
  }

  public IndexingFailureRecorder(
      CollectionDAO collectionDAO, String jobId, String serverId, int batchSize) {
    this.failureDAO = collectionDAO.searchIndexFailureDAO();
    this.jobId = jobId;
    this.serverId = serverId;
    this.batchSize = batchSize;
    this.buffer = new ArrayList<>(batchSize);
  }

  public void recordReaderFailure(String entityType, String errorMessage) {
    recordReaderFailure(entityType, errorMessage, null);
  }

  public void recordReaderFailure(String entityType, String errorMessage, String stackTrace) {
    recordFailure(
        entityType,
        UUID.randomUUID().toString(),
        "BATCH_FAILED",
        FailureStage.READER_EXCEPTION,
        errorMessage,
        stackTrace);
  }

  public void recordSinkFailure(
      String entityType, String entityId, String entityFqn, String errorMessage) {
    recordSinkFailure(entityType, entityId, entityFqn, errorMessage, null);
  }

  public void recordSinkFailure(
      String entityType,
      String entityId,
      String entityFqn,
      String errorMessage,
      String stackTrace) {
    recordFailure(entityType, entityId, entityFqn, FailureStage.SINK, errorMessage, stackTrace);
  }

  public void recordProcessFailure(
      String entityType, String entityId, String entityFqn, String errorMessage) {
    recordProcessFailure(entityType, entityId, entityFqn, errorMessage, null);
  }

  public void recordProcessFailure(
      String entityType,
      String entityId,
      String entityFqn,
      String errorMessage,
      String stackTrace) {
    recordFailure(entityType, entityId, entityFqn, FailureStage.PROCESS, errorMessage, stackTrace);
  }

  public void recordVectorFailure(
      String entityType, String entityId, String entityFqn, String errorMessage) {
    recordVectorFailure(entityType, entityId, entityFqn, errorMessage, null);
  }

  public void recordVectorFailure(
      String entityType,
      String entityId,
      String entityFqn,
      String errorMessage,
      String stackTrace) {
    recordFailure(
        entityType, entityId, entityFqn, FailureStage.VECTOR_SINK, errorMessage, stackTrace);
  }

  private void recordFailure(
      String entityType,
      String entityId,
      String entityFqn,
      FailureStage stage,
      String errorMessage,
      String stackTrace) {
    if (closed) {
      LOG.warn("Attempting to record failure after recorder is closed");
      return;
    }

    LOG.info(
        "Recording {} failure for entityType={}, entityId={}, error={}",
        stage,
        entityType,
        entityId,
        errorMessage != null
            ? errorMessage.substring(0, Math.min(100, errorMessage.length()))
            : null);

    CollectionDAO.SearchIndexFailureDAO.SearchIndexFailureRecord record =
        new CollectionDAO.SearchIndexFailureDAO.SearchIndexFailureRecord(
            UUID.randomUUID().toString(),
            jobId,
            serverId,
            entityType,
            entityId,
            entityFqn,
            stage.name(),
            truncateIfNeeded(errorMessage, 65000),
            truncateIfNeeded(stackTrace, 65000),
            System.currentTimeMillis());

    lock.lock();
    try {
      buffer.add(record);
      LOG.debug("Buffer size now: {} for job {}", buffer.size(), jobId);
      if (buffer.size() >= batchSize) {
        flushInternal();
      }
    } finally {
      lock.unlock();
    }
  }

  public void flush() {
    lock.lock();
    try {
      flushInternal();
    } finally {
      lock.unlock();
    }
  }

  private void flushInternal() {
    if (buffer.isEmpty()) {
      LOG.debug("No failure records to flush for job {}", jobId);
      return;
    }

    List<CollectionDAO.SearchIndexFailureDAO.SearchIndexFailureRecord> toFlush =
        new ArrayList<>(buffer);
    buffer.clear();

    try {
      LOG.info(
          "Flushing {} failure records for job {} serverId {}", toFlush.size(), jobId, serverId);
      failureDAO.insertBatch(toFlush);
      LOG.info("Successfully flushed {} failure records for job {}", toFlush.size(), jobId);
    } catch (Exception e) {
      LOG.error(
          "Failed to flush {} failure records for job {} - table may not exist: {}",
          toFlush.size(),
          jobId,
          e.getMessage(),
          e);
    }
  }

  private String truncateIfNeeded(String value, int maxLength) {
    if (value == null) {
      return null;
    }
    if (value.length() <= maxLength) {
      return value;
    }
    return value.substring(0, maxLength - 3) + "...";
  }

  public int getBufferedCount() {
    lock.lock();
    try {
      return buffer.size();
    } finally {
      lock.unlock();
    }
  }

  @Override
  public void close() {
    if (closed) {
      return;
    }
    closed = true;
    flush();
  }
}
