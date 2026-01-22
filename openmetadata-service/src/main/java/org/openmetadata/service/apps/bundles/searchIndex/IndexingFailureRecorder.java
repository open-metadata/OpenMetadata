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
    SINK
  }

  private static final int DEFAULT_BATCH_SIZE = 100;

  private final CollectionDAO.SearchIndexFailureDAO failureDAO;
  private final String jobId;
  private final String runId;
  private final int batchSize;
  private final List<CollectionDAO.SearchIndexFailureDAO.SearchIndexFailureRecord> buffer;
  private final ReentrantLock lock = new ReentrantLock();
  private volatile boolean closed = false;

  public IndexingFailureRecorder(CollectionDAO collectionDAO, String jobId, String runId) {
    this(collectionDAO, jobId, runId, DEFAULT_BATCH_SIZE);
  }

  public IndexingFailureRecorder(
      CollectionDAO collectionDAO, String jobId, String runId, int batchSize) {
    this.failureDAO = collectionDAO.searchIndexFailureDAO();
    this.jobId = jobId;
    this.runId = runId;
    this.batchSize = batchSize;
    this.buffer = new ArrayList<>(batchSize);
  }

  public void recordReaderFailure(String entityType, String errorMessage) {
    recordReaderFailure(entityType, errorMessage, null);
  }

  public void recordReaderFailure(String entityType, String errorMessage, String stackTrace) {
    recordFailure(entityType, null, null, FailureStage.READER, errorMessage, stackTrace);
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

    CollectionDAO.SearchIndexFailureDAO.SearchIndexFailureRecord record =
        new CollectionDAO.SearchIndexFailureDAO.SearchIndexFailureRecord(
            UUID.randomUUID().toString(),
            jobId,
            runId,
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
      return;
    }

    List<CollectionDAO.SearchIndexFailureDAO.SearchIndexFailureRecord> toFlush =
        new ArrayList<>(buffer);
    buffer.clear();

    try {
      failureDAO.insertBatch(toFlush);
      LOG.debug("Flushed {} failure records for job {}", toFlush.size(), jobId);
    } catch (Exception e) {
      LOG.error("Failed to flush {} failure records for job {}", toFlush.size(), jobId, e);
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
