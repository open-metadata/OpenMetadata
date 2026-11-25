/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.openmetadata.it.tests.MetricMigrationSqlFixture.readMigrationScripts;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v1130.QuartzTablePurge;
import org.openmetadata.service.util.EntityUtil;
import org.testcontainers.containers.JdbcDatabaseContainer;

/**
 * The 1.13.0 data migration empties the Quartz tables. Runs it in a scratch database, so the
 * suite's own scheduler keeps its jobs, and plays the part of an older server that is still running
 * during the upgrade.
 */
// The methods share one scratch database, and each one empties it.
@Execution(ExecutionMode.SAME_THREAD)
class QuartzTablePurgeMigrationIT {
  private static final String SCHEDULER = "OMAppsJobScheduler";
  private static final String JOB = "AuditLogConsumerJob";
  private static final String GROUP = "OMJobGroup";
  private static final long CHECKIN_INTERVAL = 7_500;
  private static final String FAILURE_TRIGGER = "qrtz_purge_fail";
  private static final String ATTEMPT_COUNTER = "qrtz_purge_attempts";
  // As created by the v000 Flyway migration on both databases.
  private static final String MIGRATION_LOG_DDL =
      """
      CREATE TABLE SERVER_MIGRATION_SQL_LOGS (
        version VARCHAR(256) NOT NULL,
        sqlStatement VARCHAR(10000) NOT NULL,
        checksum VARCHAR(256) PRIMARY KEY,
        executedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""";
  private static final String NON_RETRYABLE_STATE = "45000";

  private static final String SCRATCH_DATABASE =
      "qrtz_purge_%s".formatted(UUID.randomUUID().toString().replace("-", "").substring(0, 12));
  private static ConnectionType connectionType;
  private static Jdbi scratch;

  @BeforeAll
  static void createScratchQuartzSchema() throws Exception {
    // The bootstrap exposes the container as a GenericContainer; only a JDBC container carries the
    // URL and credentials needed to create a second database beside the suite's.
    assumeTrue(
        TestSuiteBootstrap.getDatabaseContainer() instanceof JdbcDatabaseContainer<?>,
        "needs the suite's database container to create a scratch database");
    connectionType = TestSuiteBootstrap.getConnectionType();
    admin().useHandle(handle -> handle.execute("CREATE DATABASE %s".formatted(SCRATCH_DATABASE)));
    scratch = Jdbi.create(scratchUrl(), adminUser(), container().getPassword());
    List<String> quartzDdl =
        readMigrationScripts(connectionType, "1.3.1").schemaStatements().stream()
            .filter(statement -> statement.contains("QRTZ_"))
            .toList();
    scratch.useHandle(
        handle -> {
          quartzDdl.forEach(handle::execute);
          handle.execute(MIGRATION_LOG_DDL);
        });
  }

  @AfterAll
  static void dropScratchDatabase() {
    if (scratch != null) {
      admin().useHandle(handle -> handle.execute("DROP DATABASE %s".formatted(SCRATCH_DATABASE)));
    }
  }

  @BeforeEach
  void seedScheduledJob() {
    QuartzTablePurge.purge(scratch, connectionType);
    scratch.useHandle(
        handle -> {
          handle.execute("DELETE FROM SERVER_MIGRATION_SQL_LOGS");
          insertJob(handle);
          insertTrigger(handle, "existingTrigger");
          handle.execute(
              "INSERT INTO QRTZ_LOCKS (SCHED_NAME, LOCK_NAME) VALUES (?, 'TRIGGER_ACCESS')",
              SCHEDULER);
          insertCheckIn(handle, "stoppedServer", System.currentTimeMillis() - 3_600_000);
        });
  }

  @Test
  void purgeEmptiesEveryQuartzTable() {
    QuartzTablePurge.purge(scratch, connectionType);

    scratch.useHandle(handle -> QuartzTablePurge.TABLES.forEach(t -> assertEmpty(handle, t)));
  }

  @Test
  void purgeWaitsForARunningSchedulersTriggerWriteInsteadOfFailingOnTheForeignKey()
      throws Exception {
    try (Handle oldServer = scratch.open()) {
      oldServer.begin();
      insertTrigger(oldServer, "reinsertedByOldServer");

      CompletableFuture<Void> purge =
          CompletableFuture.runAsync(() -> QuartzTablePurge.purge(scratch, connectionType));
      // Commit only once the database reports the purge waiting on the old server's locks, so the
      // write always lands while the purge is in flight.
      await()
          .atMost(Duration.ofSeconds(30))
          .until(QuartzTablePurgeMigrationIT::purgeIsWaitingOnALock);
      assertFalse(purge.isDone(), "the purge finished while the old server still held its write");

      oldServer.commit();
      purge.get(60, TimeUnit.SECONDS);
    }

    scratch.useHandle(handle -> QuartzTablePurge.TABLES.forEach(t -> assertEmpty(handle, t)));
  }

  @Test
  void aNonRetryableFailureRollsBackAndStopsAtOnce() {
    assertPurgeFailsAndRollsBack(NON_RETRYABLE_STATE, 1);
  }

  @Test
  void aPersistentDeadlockStopsAfterThreeAttempts() {
    assertPurgeFailsAndRollsBack(deadlockState(), 3);
  }

  @Test
  void aTransientDeadlockRollsBackAndTheRetrySucceeds() {
    scratch.useHandle(
        handle -> {
          insertFiredTrigger(handle);
          failDeletesOfFiredTriggers(handle, deadlockState(), 1);
        });
    try {
      QuartzTablePurge.purge(scratch, connectionType);

      scratch.useHandle(
          handle -> {
            QuartzTablePurge.TABLES.forEach(t -> assertEmpty(handle, t));
            assertEquals(2, failureAttempts(handle), "one failed attempt, then one retry");
          });
    } finally {
      scratch.useHandle(QuartzTablePurgeMigrationIT::stopFailingDeletes);
    }
  }

  @Test
  void aForcedRerunDoesNotPurgeASecondTime() {
    QuartzTablePurge.purgeOnce(scratch, connectionType);
    scratch.useHandle(
        handle -> {
          assertEmpty(handle, "QRTZ_JOB_DETAILS");
          insertJob(handle);
        });

    QuartzTablePurge.purgeOnce(scratch, connectionType);

    scratch.useHandle(handle -> assertRowCount(handle, "QRTZ_JOB_DETAILS", 1));
  }

  @Test
  void aDatabaseTheOldSqlPurgeClearedIsNotPurgedAgain() {
    scratch.useHandle(
        handle ->
            handle.execute(
                "INSERT INTO SERVER_MIGRATION_SQL_LOGS (version, sqlStatement, checksum) VALUES (?, ?, ?)",
                "1.13.0",
                QuartzTablePurge.LEGACY_LAST_DELETE,
                EntityUtil.hash(QuartzTablePurge.LEGACY_LAST_DELETE)));

    QuartzTablePurge.purgeOnce(scratch, connectionType);

    scratch.useHandle(handle -> assertRowCount(handle, "QRTZ_JOB_DETAILS", 1));
  }

  @Test
  void onlyRecentCheckInsCountAsALiveScheduler() {
    long now = System.currentTimeMillis();
    scratch.useHandle(
        handle -> {
          insertCheckIn(handle, "runningServer", now - CHECKIN_INTERVAL);
          assertEquals(
              List.of("runningServer"), QuartzTablePurge.liveSchedulerInstances(handle, now));
        });
  }

  // QRTZ_FIRED_TRIGGERS is purged after the trigger and job tables, so a failure there proves the
  // earlier deletes roll back with it.
  private static void assertPurgeFailsAndRollsBack(String sqlState, int expectedAttempts) {
    scratch.useHandle(
        handle -> {
          insertFiredTrigger(handle);
          failDeletesOfFiredTriggers(handle, sqlState, Integer.MAX_VALUE);
        });
    try {
      IllegalStateException failure =
          assertThrows(
              IllegalStateException.class, () -> QuartzTablePurge.purge(scratch, connectionType));
      assertTrue(
          failure.getMessage().contains("after %d attempt(s)".formatted(expectedAttempts)),
          failure.getMessage());
      scratch.useHandle(
          handle -> {
            assertRowCount(handle, "QRTZ_JOB_DETAILS", 1);
            assertRowCount(handle, "QRTZ_TRIGGERS", 1);
          });
      assertFalse(QuartzTablePurge.isAlreadyPurged(scratch), "a failed purge records no marker");
    } finally {
      scratch.useHandle(QuartzTablePurgeMigrationIT::stopFailingDeletes);
    }
  }

  // The attempt counter lives where a rollback cannot undo it (a sequence on Postgres, a MyISAM
  // table on MySQL), so the trigger can fail only the first attempts.
  private static void failDeletesOfFiredTriggers(
      Handle handle, String sqlState, int failingAttempts) {
    if (connectionType == ConnectionType.MYSQL) {
      handle.execute(
          "CREATE TABLE %s (attempts INT NOT NULL) ENGINE=MyISAM".formatted(ATTEMPT_COUNTER));
      handle.execute("INSERT INTO %s VALUES (0)".formatted(ATTEMPT_COUNTER));
      handle.execute(
          """
          CREATE TRIGGER %1$s BEFORE DELETE ON QRTZ_FIRED_TRIGGERS FOR EACH ROW
          BEGIN
            UPDATE %2$s SET attempts = attempts + 1;
            IF (SELECT attempts FROM %2$s) <= %3$d THEN
              SIGNAL SQLSTATE '%4$s' SET MESSAGE_TEXT = 'injected purge failure';
            END IF;
          END"""
              .formatted(FAILURE_TRIGGER, ATTEMPT_COUNTER, failingAttempts, sqlState));
    } else {
      handle.execute("CREATE SEQUENCE %s".formatted(ATTEMPT_COUNTER));
      handle.execute(
          """
          CREATE OR REPLACE FUNCTION %1$s() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            IF nextval('%2$s') <= %3$d THEN
              RAISE EXCEPTION 'injected purge failure' USING ERRCODE = '%4$s';
            END IF;
            RETURN NULL;
          END $$"""
              .formatted(FAILURE_TRIGGER, ATTEMPT_COUNTER, failingAttempts, sqlState));
      handle.execute(
          "CREATE TRIGGER %1$s BEFORE DELETE ON QRTZ_FIRED_TRIGGERS EXECUTE FUNCTION %1$s()"
              .formatted(FAILURE_TRIGGER));
    }
  }

  private static long failureAttempts(Handle handle) {
    String query =
        connectionType == ConnectionType.MYSQL
            ? "SELECT attempts FROM %s"
            : "SELECT last_value FROM %s";
    return handle.createQuery(query.formatted(ATTEMPT_COUNTER)).mapTo(Long.class).one();
  }

  private static void stopFailingDeletes(Handle handle) {
    if (connectionType == ConnectionType.MYSQL) {
      handle.execute("DROP TRIGGER IF EXISTS %s".formatted(FAILURE_TRIGGER));
      handle.execute("DROP TABLE IF EXISTS %s".formatted(ATTEMPT_COUNTER));
    } else {
      handle.execute("DROP TRIGGER IF EXISTS %s ON QRTZ_FIRED_TRIGGERS".formatted(FAILURE_TRIGGER));
      handle.execute("DROP FUNCTION IF EXISTS %s()".formatted(FAILURE_TRIGGER));
      handle.execute("DROP SEQUENCE IF EXISTS %s".formatted(ATTEMPT_COUNTER));
    }
  }

  private static String deadlockState() {
    return connectionType == ConnectionType.MYSQL ? "40001" : "40P01";
  }

  // Postgres reports a backend blocked on a lock; MySQL reports a metadata-lock wait for LOCK
  // TABLES
  // and an InnoDB lock wait for a row-level delete.
  private static boolean purgeIsWaitingOnALock() {
    String query =
        connectionType == ConnectionType.MYSQL
            ? """
              SELECT (SELECT COUNT(*) FROM information_schema.processlist
                       WHERE db = DATABASE() AND state LIKE 'Waiting for%lock')
                   + (SELECT COUNT(*) FROM information_schema.innodb_trx trx
                       JOIN information_schema.processlist p ON p.id = trx.trx_mysql_thread_id
                       WHERE p.db = DATABASE() AND trx.trx_state = 'LOCK WAIT')"""
            : """
              SELECT COUNT(*) FROM pg_stat_activity
              WHERE datname = current_database() AND wait_event_type = 'Lock'""";
    return scratch.withHandle(handle -> handle.createQuery(query).mapTo(Long.class).one()) > 0;
  }

  private static void insertFiredTrigger(Handle handle) {
    handle.execute(
        """
        INSERT INTO QRTZ_FIRED_TRIGGERS (SCHED_NAME, ENTRY_ID, TRIGGER_NAME, TRIGGER_GROUP,
          INSTANCE_NAME, FIRED_TIME, SCHED_TIME, PRIORITY, STATE)
        VALUES (?, 'firedEntry', 'existingTrigger', ?, 'oldServer', 0, 0, 5, 'EXECUTING')""",
        SCHEDULER,
        GROUP);
  }

  private static void insertJob(Handle handle) {
    String no = connectionType == ConnectionType.MYSQL ? "'0'" : "FALSE";
    handle.execute(
        """
        INSERT INTO QRTZ_JOB_DETAILS (SCHED_NAME, JOB_NAME, JOB_GROUP, JOB_CLASS_NAME, IS_DURABLE,
          IS_NONCONCURRENT, IS_UPDATE_DATA, REQUESTS_RECOVERY)
        VALUES (?, ?, ?, 'org.openmetadata.Job', %1$s, %1$s, %1$s, %1$s)"""
            .formatted(no),
        SCHEDULER,
        JOB,
        GROUP);
  }

  private static void insertTrigger(Handle handle, String trigger) {
    handle.execute(
        """
        INSERT INTO QRTZ_TRIGGERS (SCHED_NAME, TRIGGER_NAME, TRIGGER_GROUP, JOB_NAME, JOB_GROUP,
          TRIGGER_STATE, TRIGGER_TYPE, START_TIME)
        VALUES (?, ?, ?, ?, ?, 'WAITING', 'SIMPLE', 0)""",
        SCHEDULER,
        trigger,
        GROUP,
        JOB,
        GROUP);
    handle.execute(
        """
        INSERT INTO QRTZ_SIMPLE_TRIGGERS (SCHED_NAME, TRIGGER_NAME, TRIGGER_GROUP, REPEAT_COUNT,
          REPEAT_INTERVAL, TIMES_TRIGGERED)
        VALUES (?, ?, ?, -1, 5000, 0)""",
        SCHEDULER,
        trigger,
        GROUP);
  }

  private static void insertCheckIn(Handle handle, String instance, long lastCheckIn) {
    handle.execute(
        """
        INSERT INTO QRTZ_SCHEDULER_STATE (SCHED_NAME, INSTANCE_NAME, LAST_CHECKIN_TIME,
          CHECKIN_INTERVAL)
        VALUES (?, ?, ?, ?)""",
        SCHEDULER,
        instance,
        lastCheckIn,
        CHECKIN_INTERVAL);
  }

  private static void assertEmpty(Handle handle, String table) {
    assertRowCount(handle, table, 0);
  }

  private static void assertRowCount(Handle handle, String table, long expected) {
    long rows =
        handle.createQuery("SELECT COUNT(*) FROM %s".formatted(table)).mapTo(Long.class).one();
    assertEquals(expected, rows, "rows in %s".formatted(table));
  }

  private static JdbcDatabaseContainer<?> container() {
    return (JdbcDatabaseContainer<?>) TestSuiteBootstrap.getDatabaseContainer();
  }

  // The MySQL suite user may only use its own database; root can create another.
  private static String adminUser() {
    return connectionType == ConnectionType.MYSQL ? "root" : container().getUsername();
  }

  private static Jdbi admin() {
    return Jdbi.create(container().getJdbcUrl(), adminUser(), container().getPassword());
  }

  private static String scratchUrl() {
    String database = container().getDatabaseName();
    return container()
        .getJdbcUrl()
        .replace("/%s".formatted(database), "/%s".formatted(SCRATCH_DATABASE));
  }
}
