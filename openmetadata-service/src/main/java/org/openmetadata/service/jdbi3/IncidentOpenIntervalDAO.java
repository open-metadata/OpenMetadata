package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.TimeSeriesDAOs.TestCaseResolutionStatusTimeSeriesDAO.OPEN_STATUSES;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.List;
import java.util.stream.Collectors;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindFQN;

/** Compact open periods; audit retention does not discard a surviving incident's periods. */
public interface IncidentOpenIntervalDAO {
  @ConnectionAwareSqlQuery(
      value =
          "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'test_case_incident_open_interval')",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'test_case_incident_open_interval')",
      connectionType = POSTGRES)
  boolean openIntervalTableExists();

  @ConnectionAwareSqlUpdate(
      value =
          """
          INSERT INTO test_case_incident
            (stateId, entityFQNHash, testCaseResolutionStatusType, createdAt, updatedAt, latestRecordId)
          VALUES (:stateId, :entityFQNHash, :statusType, :timestamp, 0, :recordId)
          ON DUPLICATE KEY UPDATE stateId = VALUES(stateId)
          """,
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          """
          INSERT INTO test_case_incident
            (stateId, entityFQNHash, testCaseResolutionStatusType, createdAt, updatedAt, latestRecordId)
          VALUES (:stateId, :entityFQNHash, :statusType, :timestamp, 0, :recordId)
          ON CONFLICT (stateId) DO NOTHING
          """,
      connectionType = POSTGRES)
  void reserveIncident(
      @Bind("stateId") String stateId,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("statusType") String statusType,
      @Bind("timestamp") long timestamp,
      @Bind("recordId") String recordId);

  @SqlQuery("SELECT updatedAt FROM test_case_incident WHERE stateId = :stateId FOR UPDATE")
  long lockIncidentTimestamp(@Bind("stateId") String stateId);

  /** Must run in the transaction that inserts history; reservation also serializes first writes. */
  default long nextIncidentTimestamp(
      String stateId, String entityFQN, String statusType, long timestamp, String recordId) {
    reserveIncident(stateId, entityFQN, statusType, timestamp, recordId);
    return Math.max(timestamp, lockIncidentTimestamp(stateId) + 1);
  }

  @SqlQuery("SELECT stateId FROM test_case_incident WHERE stateId = :stateId FOR UPDATE")
  String lockIncident(@Bind("stateId") String stateId);

  @SqlUpdate("DELETE FROM test_case_incident_open_interval WHERE stateId IN (<stateIds>)")
  void deleteOpenIntervals(@BindList("stateIds") List<String> stateIds);

  @SqlUpdate(
      """
      INSERT INTO test_case_incident_open_interval (stateId, openedAt, closedAt)
      WITH ranked AS (
        SELECT stateId, timestamp,
          CASE WHEN testCaseResolutionStatusType IN (<openStatuses>) THEN 1 ELSE 0 END AS isOpen,
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
      """)
  void insertOpenIntervalsFromHistory(
      @BindList("stateIds") List<String> stateIds, @Define("openStatuses") String openStatuses);

  @Transaction
  default void rebuildOpenIntervals(List<String> stateIds) {
    if (!stateIds.isEmpty()) {
      deleteOpenIntervals(stateIds);
      insertOpenIntervalsFromHistory(
          stateIds,
          OPEN_STATUSES.stream()
              .map(status -> "'" + status.value() + "'")
              .collect(Collectors.joining(", ")));
    }
  }

  @SqlQuery(
      """
      SELECT EXISTS (SELECT 1 FROM test_case_incident_open_interval
      WHERE stateId = :stateId AND closedAt IS NULL)
      """)
  boolean hasOpenInterval(@Bind("stateId") String stateId);

  @SqlUpdate(
      """
      INSERT INTO test_case_incident_open_interval (stateId, openedAt) VALUES (:stateId, :timestamp)
      """)
  void openInterval(@Bind("stateId") String stateId, @Bind("timestamp") long timestamp);

  @SqlUpdate(
      """
      UPDATE test_case_incident_open_interval SET closedAt = :timestamp
      WHERE stateId = :stateId AND closedAt IS NULL
      """)
  void closeInterval(@Bind("stateId") String stateId, @Bind("timestamp") long timestamp);

  /** Called under the incident summary's write lock, with the repository's monotonic timestamp. */
  default void recordOpenInterval(String stateId, long timestamp, boolean isOpen) {
    final boolean hasOpenInterval = hasOpenInterval(stateId);
    if (isOpen && !hasOpenInterval) {
      openInterval(stateId, timestamp);
    } else if (!isOpen && hasOpenInterval) {
      closeInterval(stateId, timestamp);
    }
  }
}
