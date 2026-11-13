package org.openmetadata.service.security.listaccess;

import java.util.List;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Compiles the caller's policies into the rows of one listed type they may read, deciding each row
 * as {@code DefaultAuthorizer.authorize} decides it
 * (ADR:2026-11-13-a-listing-filters-its-rows-in-sql-compiled-from-the-callers-policies).
 */
public final class ListAccess {
  private ListAccess() {}

  public static CallerScope forCaller(
      SubjectContext subject, String listedType, List<MetadataOperation> operations) {
    RowStorage storage = RowStorages.of(listedType);
    RowFilter rows =
        subject.isAdmin() ? RowFilter.ALL_ROWS : compile(subject, listedType, operations, storage);
    return CallerScope.compiled(storage, rows, operations);
  }

  private static RowFilter compile(
      SubjectContext subject,
      String listedType,
      List<MetadataOperation> operations,
      RowStorage storage) {
    TeamPolicySnapshot teams = TeamPolicySnapshot.current();
    return new RowFilterCompiler(new SubjectCaller(subject), teams, teams.denies())
        .compile(new ListTarget(listedType, operations, storage));
  }
}
