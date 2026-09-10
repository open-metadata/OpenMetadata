package org.openmetadata.service.search;

import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.SearchRetryUtil.IOOperation;
import org.openmetadata.service.search.SearchUtils.ColumnLineageFlushOutcome;

@Slf4j
public final class ColumnLineageReconciler {
  private static final int MAX_ATTEMPTS = 3;

  private ColumnLineageReconciler() {}

  @FunctionalInterface
  public interface UpdateOperation {
    ColumnLineageFlushOutcome execute() throws IOException;
  }

  /**
   * Retry version conflicts against a refreshed snapshot. Refreshing explicitly also handles an
   * attempt where every document conflicted, so update-by-query had no successful write to refresh.
   * Other failures are left to the caller to report rather than replaying a broken query or script.
   */
  public static ColumnLineageFlushOutcome reconcile(
      Map<String, String> renames, UpdateOperation update, IOOperation refresh) throws IOException {
    // A swap (a -> A, A -> a) can occur for case-distinct columns with different data types.
    // Replaying the whole query would undo documents that succeeded on the first attempt.
    boolean retrySafe = renames.values().stream().noneMatch(renames::containsKey);
    ColumnLineageFlushOutcome outcome = update.execute();
    long updatedDocuments = outcome.updatedDocuments();
    int attempts = 1;
    while (retrySafe
        && attempts < MAX_ATTEMPTS
        && outcome.versionConflicts() > 0
        && outcome.failureReasons().isEmpty()) {
      LOG.debug(
          "Retrying column lineage reconciliation for index {} after {} version conflict(s)",
          outcome.indexName(),
          outcome.versionConflicts());
      refresh.execute();
      outcome = update.execute();
      updatedDocuments += outcome.updatedDocuments();
      attempts++;
    }
    return new ColumnLineageFlushOutcome(
        outcome.operation(),
        outcome.indexName(),
        outcome.requestedFqnCount(),
        updatedDocuments,
        outcome.versionConflicts(),
        outcome.failureReasons());
  }
}
