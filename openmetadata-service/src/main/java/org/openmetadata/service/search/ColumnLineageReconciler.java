package org.openmetadata.service.search;

import java.io.IOException;
import java.util.Map;
import org.openmetadata.service.search.SearchRetryUtil.IOOperation;
import org.openmetadata.service.search.SearchUtils.ColumnLineageFlushOutcome;

/** {@link UpdateByQueryReconciler} for the column lineage reconciliation. */
public final class ColumnLineageReconciler {

  private ColumnLineageReconciler() {}

  @FunctionalInterface
  public interface UpdateOperation {
    ColumnLineageFlushOutcome execute() throws IOException;
  }

  public static ColumnLineageFlushOutcome reconcile(
      Map<String, String> renames, UpdateOperation update, IOOperation refresh) throws IOException {
    // A swap (a -> A, A -> a) can occur for case-distinct columns with different data types.
    // Replaying the whole query would undo documents that succeeded on the first attempt.
    boolean retrySafe = renames.values().stream().noneMatch(renames::containsKey);
    return UpdateByQueryReconciler.reconcile(update::execute, refresh, retrySafe);
  }
}
