package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * The two permits a bulk request needs. A slot in its own processor is held from flush until the
 * bulk is written or fails, so a busy processor pushes back on its producers. A connection from the
 * search client's {@link BulkConnectionBudget} is held only while a request is on the wire: a bulk
 * waiting out a retry backoff or an open circuit holds none, so it never keeps another writer on the
 * server, live indexing included, from sending. Every wait ends at the bulk's deadline.
 */
final class BulkSendPermits {

  /**
   * Threads in each bulk processor's scheduler. Its periodic flush can block waiting for a slot, or
   * for the lock a waiting flush holds, while the bulks that hold the slots need a scheduler thread
   * to retry or to resume after a pause. With two threads one is always free for them.
   */
  static final int PROCESSOR_SCHEDULER_THREADS = 2;

  private final Semaphore processorSlots;
  private final BulkConnectionBudget connectionBudget;

  BulkSendPermits(int concurrentRequests, BulkConnectionBudget connectionBudget) {
    this.processorSlots = new Semaphore(Math.max(1, concurrentRequests));
    this.connectionBudget = connectionBudget;
  }

  boolean acquireSlot(BulkAttempt<?> attempt) throws InterruptedException {
    return processorSlots.tryAcquire(waitMillis(attempt), TimeUnit.MILLISECONDS);
  }

  void releaseSlot() {
    processorSlots.release();
  }

  boolean acquireConnection(BulkAttempt<?> attempt) throws InterruptedException {
    return connectionBudget.tryAcquire(waitMillis(attempt), TimeUnit.MILLISECONDS);
  }

  void releaseConnection() {
    connectionBudget.release();
  }

  private static long waitMillis(BulkAttempt<?> attempt) {
    return Math.max(0, attempt.remainingMillis());
  }
}
