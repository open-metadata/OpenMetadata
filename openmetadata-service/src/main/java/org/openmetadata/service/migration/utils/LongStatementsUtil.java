package org.openmetadata.service.migration.utils;

import static org.openmetadata.service.util.EntityUtil.hash;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.QueryStatus;

public class LongStatementsUtil {
  /*
   * This function emulates what migrations from sql files normally go through:
   * 1. Execute query
   * 2. Upsert the query into the `SERVER_MIGRATION_SQL_LOGS` table
   *
   * But since the statement column is capped at 10000 characters, we store a truncated
   * version
   *
   * Reference:
   * org.openmetadata.service.migration.api.MigrationProcessImpl.performSqlExecutionAndUpdate
   * */
  public static Map<String, QueryStatus> executeAndUpdate(
      Handle handle,
      MigrationDAO migrationDAO,
      String version,
      boolean isForceMigration,
      String queryTemplate,
      Object... args) {
    Map<String, QueryStatus> result = new HashMap<>();

    String truncatedQuery = "[Truncated] - " + queryTemplate + " - args: " + Arrays.toString(args);

    if (truncatedQuery.length() > 10000) {
      truncatedQuery = truncatedQuery.substring(0, 10000);
    }

    try {
      handle.execute(queryTemplate, args);
      migrationDAO.upsertServerMigrationSQL(version, truncatedQuery, hash(truncatedQuery));
      result.put(
          truncatedQuery,
          new QueryStatus(QueryStatus.Status.SUCCESS, "Successfully Executed Query"));
    } catch (Exception e) {
      String message = String.format("Failed to run sql: [%s] due to [%s]", queryTemplate, e);
      result.put(truncatedQuery, new QueryStatus(QueryStatus.Status.FAILURE, message));
      if (!isForceMigration) {
        throw new RuntimeException(message, e);
      }
    }
    return result;
  }
}
