package org.openmetadata.service.migration.utils.v211;

import java.util.List;
import org.jdbi.v3.core.Handle;

/** Reconstructs open periods once, using indexed state-id batches rather than a global history sort. */
public final class IncidentOpenIntervalMigration {
  private static final int BATCH_SIZE = 1000;
  private static final String INSERT_INTERVALS =
      """
      INSERT INTO test_case_incident_open_interval (stateId, openedAt, closedAt)
      WITH ranked AS (
        SELECT stateId, timestamp,
          CASE WHEN testCaseResolutionStatusType IN ('New', 'Ack', 'Assigned') THEN 1 ELSE 0 END AS isOpen,
          ROW_NUMBER() OVER (PARTITION BY stateId, timestamp ORDER BY id DESC) AS position
        FROM test_case_resolution_status_time_series WHERE stateId IN (<stateIds>)
      ), changes AS (
        SELECT stateId, timestamp, isOpen,
          LAG(isOpen, 1, 0) OVER (PARTITION BY stateId ORDER BY timestamp) AS wasOpen
        FROM ranked WHERE position = 1
      ), boundaries AS (
        SELECT stateId, timestamp, isOpen,
          LEAD(timestamp) OVER (PARTITION BY stateId ORDER BY timestamp) AS closedAt
        FROM changes WHERE isOpen <> wasOpen
      )
      SELECT stateId, timestamp, closedAt FROM boundaries WHERE isOpen = 1
      """;

  private IncidentOpenIntervalMigration() {}

  public static void backfill(Handle handle) {
    String after = "";
    List<String> stateIds;
    while (!(stateIds =
            handle
                .createQuery(
                    "SELECT stateId FROM test_case_incident WHERE stateId > :after ORDER BY stateId LIMIT :limit")
                .bind("after", after)
                .bind("limit", BATCH_SIZE)
                .mapTo(String.class)
                .list())
        .isEmpty()) {
      List<String> batch = stateIds;
      handle.useTransaction(
          transaction -> {
            transaction
                .createUpdate(
                    "DELETE FROM test_case_incident_open_interval WHERE stateId IN (<stateIds>)")
                .bindList("stateIds", batch)
                .execute();
            transaction.createUpdate(INSERT_INTERVALS).bindList("stateIds", batch).execute();
          });
      after = stateIds.getLast();
    }
  }
}
