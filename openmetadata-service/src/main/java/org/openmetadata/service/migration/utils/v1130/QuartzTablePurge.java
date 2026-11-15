package org.openmetadata.service.migration.utils.v1130;

import java.sql.SQLException;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.JdbiException;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;

/**
 * Empties the Quartz tables so no persisted job keeps App JSON with the pre-1.13 {@code preview}
 * field; the server reschedules apps, alerts and the audit-log consumer at startup.
 *
 * <p>An upgrade can run this while an old server is still up, and that server's scheduler keeps
 * writing triggers. Deleting table by table lets one of those writes land between the trigger and
 * job deletes, which then fails on the foreign key. Every table is therefore locked first and
 * emptied in one transaction, so the old scheduler waits for the purge instead of racing it. The
 * purge runs once per database: {@code migrate --force} reruns every data migration, and a second
 * purge would drop the live server's schedules.
 * ADR:2026-11-02-the-1-13-0-quartz-purge-is-one-locked-transaction
 */
@Slf4j
public final class QuartzTablePurge {
  static final String VERSION = "1.13.0";
  private static final String LOCKS_TABLE = "QRTZ_LOCKS";
  private static final String MIGRATION_LOG = "SERVER_MIGRATION_SQL_LOGS";

  // Foreign-key children before their parents.
  public static final List<String> TABLES =
      List.of(
          "QRTZ_SIMPLE_TRIGGERS",
          "QRTZ_CRON_TRIGGERS",
          "QRTZ_SIMPROP_TRIGGERS",
          "QRTZ_BLOB_TRIGGERS",
          "QRTZ_TRIGGERS",
          "QRTZ_JOB_DETAILS",
          "QRTZ_FIRED_TRIGGERS",
          LOCKS_TABLE,
          "QRTZ_SCHEDULER_STATE");

  // Recorded when this purge commits.
  public static final String PURGE_MARKER = "-- 1.13.0 data migration: Quartz tables purged";
  // The last statement of the purge that schemaChanges.sql ran before this class existed; its log
  // row means that purge finished.
  public static final String LEGACY_LAST_DELETE = "DELETE FROM QRTZ_SCHEDULER_STATE";

  private static final int MAX_ATTEMPTS = 3;
  private static final String LIVE_SCHEDULER_WARNING =
      """
      Quartz scheduler instances {} checked in recently, so an older OpenMetadata server is \
      probably still running. Stop it before starting this version; it can write stale jobs back \
      after the purge.""";
  private static final String PURGE_FAILED =
      """
      Failed to purge the Quartz tables after %d attempt(s). If an older OpenMetadata server is \
      still running against this database, stop it and rerun the migration.""";
  private static final String POSTGRES_DEADLOCK = "40P01";
  private static final String SERIALIZATION_FAILURE = "40001";

  private QuartzTablePurge() {}

  public static void purgeOnce(Jdbi jdbi, ConnectionType connectionType) {
    if (isAlreadyPurged(jdbi)) {
      LOG.info("Quartz tables were already purged by the {} migration; skipping", VERSION);
    } else {
      purge(jdbi, connectionType);
    }
  }

  public static boolean isAlreadyPurged(Jdbi jdbi) {
    long recorded =
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery(
                        """
                        SELECT COUNT(*) FROM SERVER_MIGRATION_SQL_LOGS
                        WHERE version = :version AND (checksum = :marker OR checksum = :legacy)""")
                    .bind("version", VERSION)
                    .bind("marker", EntityUtil.hash(PURGE_MARKER))
                    .bind("legacy", EntityUtil.hash(LEGACY_LAST_DELETE))
                    .mapTo(Long.class)
                    .one());
    return recorded > 0;
  }

  // Quartz's own transactions take these tables in different orders (acquiring triggers reads
  // QRTZ_TRIGGERS before QRTZ_JOB_DETAILS without touching QRTZ_LOCKS; firing one locks QRTZ_LOCKS
  // first), so no lock order rules out a deadlock with a live scheduler. The database aborts one
  // side; when that is the purge, it retries.
  public static void purge(Jdbi jdbi, ConnectionType connectionType) {
    int attempt = 1;
    boolean purged = false;
    while (!purged) {
      try {
        jdbi.useHandle(handle -> purgeLocked(handle, connectionType));
        purged = true;
      } catch (JdbiException e) {
        if (attempt >= MAX_ATTEMPTS || !isDeadlock(e)) {
          throw new IllegalStateException(PURGE_FAILED.formatted(attempt), e);
        }
        LOG.warn("Quartz table purge hit a deadlock on attempt {}; retrying", attempt);
        attempt++;
      }
    }
  }

  private static void purgeLocked(Handle handle, ConnectionType connectionType) {
    // MySQL needs autocommit off (which begin() does), not START TRANSACTION, for LOCK TABLES to
    // hold until COMMIT; UNLOCK TABLES would commit an open transaction, so it runs after it ends.
    handle.begin();
    try {
      handle.execute(lockStatement(connectionType));
      warnAboutLiveSchedulers(handle);
      TABLES.forEach(table -> handle.execute("DELETE FROM %s".formatted(table)));
      recordPurge(handle, connectionType);
      handle.commit();
    } catch (JdbiException e) {
      handle.rollback();
      throw e;
    } finally {
      if (connectionType == ConnectionType.MYSQL) {
        handle.execute("UNLOCK TABLES");
      }
    }
  }

  static String lockStatement(ConnectionType connectionType) {
    String statement;
    if (connectionType == ConnectionType.MYSQL) {
      // A session holding LOCK TABLES can use no other table, so the migration log is locked too.
      statement =
          "LOCK TABLES %s"
              .formatted(
                  Stream.concat(TABLES.stream(), Stream.of(MIGRATION_LOG))
                      .map(table -> "%s WRITE".formatted(table))
                      .collect(Collectors.joining(", ")));
    } else {
      // QRTZ_LOCKS first: a scheduler firing a trigger takes its QRTZ_LOCKS row before writing,
      // so the purge queues behind it. Trigger acquisition takes the tables in another order; that
      // deadlock is left to the retry in purge().
      statement =
          "LOCK TABLE %s, %s IN ACCESS EXCLUSIVE MODE"
              .formatted(
                  LOCKS_TABLE,
                  TABLES.stream()
                      .filter(table -> !table.equals(LOCKS_TABLE))
                      .collect(Collectors.joining(", ")));
    }
    return statement;
  }

  private static void recordPurge(Handle handle, ConnectionType connectionType) {
    String insert =
        connectionType == ConnectionType.MYSQL
            ? """
              INSERT IGNORE INTO SERVER_MIGRATION_SQL_LOGS (version, sqlStatement, checksum)
              VALUES (:version, :statement, :checksum)"""
            : """
              INSERT INTO SERVER_MIGRATION_SQL_LOGS (version, sqlStatement, checksum)
              VALUES (:version, :statement, :checksum) ON CONFLICT (checksum) DO NOTHING""";
    handle
        .createUpdate(insert)
        .bind("version", VERSION)
        .bind("statement", PURGE_MARKER)
        .bind("checksum", EntityUtil.hash(PURGE_MARKER))
        .execute();
  }

  // The purge still runs: the lock already stops a live scheduler from breaking it, and refusing
  // would fail every upgrade that keeps the old server up during migrate.
  private static void warnAboutLiveSchedulers(Handle handle) {
    List<String> live = liveSchedulerInstances(handle, System.currentTimeMillis());
    if (!live.isEmpty()) {
      LOG.warn(LIVE_SCHEDULER_WARNING, live);
    }
  }

  public static List<String> liveSchedulerInstances(Handle handle, long nowMillis) {
    return handle
        .createQuery(
            """
            SELECT INSTANCE_NAME FROM QRTZ_SCHEDULER_STATE
            WHERE LAST_CHECKIN_TIME > :now - 2 * CHECKIN_INTERVAL""")
        .bind("now", nowMillis)
        .mapTo(String.class)
        .list();
  }

  static boolean isDeadlock(Throwable failure) {
    boolean deadlock = false;
    for (Throwable t = failure; t != null && !deadlock; t = t.getCause()) {
      // Jdbi wraps the driver's SQLException as a cause; its SQLState is the portable signal.
      if (t instanceof SQLException sql) {
        deadlock =
            POSTGRES_DEADLOCK.equals(sql.getSQLState())
                || SERIALIZATION_FAILURE.equals(sql.getSQLState());
      }
    }
    return deadlock;
  }
}
