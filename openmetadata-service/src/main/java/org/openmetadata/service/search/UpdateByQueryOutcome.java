package org.openmetadata.service.search;

import java.util.List;
import lombok.extern.slf4j.Slf4j;

/** What an update-by-query did on {@code indices}, after {@link UpdateByQueryReconciler}. */
@Slf4j
public record UpdateByQueryOutcome(
    String operation,
    List<String> indices,
    long updatedDocuments,
    long versionConflicts,
    List<String> failureReasons)
    implements UpdateByQueryReconciler.Outcome<UpdateByQueryOutcome> {

  @Override
  public UpdateByQueryOutcome withUpdatedDocuments(long updatedDocuments) {
    return new UpdateByQueryOutcome(
        operation, indices, updatedDocuments, versionConflicts, failureReasons);
  }

  /**
   * Logs shard failures as errors, and the conflicts left after the last attempt as a warning: the
   * change did not reach those documents.
   */
  public void report() {
    if (!failureReasons.isEmpty()) {
      LOG.error("{} on {} failed: {}", operation, indices, String.join(", ", failureReasons));
    }
    if (versionConflicts > 0) {
      LOG.warn(
          "{} on {} left {} document(s) unchanged after {} attempts: a concurrent write held them",
          operation,
          indices,
          versionConflicts,
          UpdateByQueryReconciler.MAX_ATTEMPTS);
    }
  }

  /**
   * Queues each of {@code entityIds} for a reindex when conflicts are left: the caller knows which
   * documents the query targeted, so rebuilding them from their entities repairs whichever were
   * held.
   */
  public void requeueIfConflicted(List<String> entityIds) {
    if (versionConflicts > 0) {
      String reason =
          String.format(
              "%s: %d version conflict(s) left after %d attempts",
              operation, versionConflicts, UpdateByQueryReconciler.MAX_ATTEMPTS);
      entityIds.forEach(id -> SearchIndexRetryQueue.enqueue(id, null, reason));
    }
  }
}
