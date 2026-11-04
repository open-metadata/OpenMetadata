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
package org.openmetadata.it.bootstrap;

import com.sun.management.HotSpotDiagnosticMXBean;
import io.micrometer.core.instrument.Measurement;
import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.Metrics;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Records what the embedded server was doing when it stopped making progress.
 *
 * <p>The parallel lane has wedged with asynchronous deletes that never finished: their database
 * permits stayed taken, new work queued behind them, and statements that needed the rows they held
 * waited until MySQL gave up after 50 seconds, or forever on Postgres. The server log names only
 * the waiters. When queued asynchronous database work stops completing, or a database transaction
 * stays open, for longer than the threshold, this writes the open transactions and lock waits as
 * the database sees them, and a dump of every JVM thread including virtual threads, into the CI
 * diagnostics directory that the workflow uploads.
 */
final class ServerStallWatchdog implements AutoCloseable {
  private static final Logger LOG = LoggerFactory.getLogger(ServerStallWatchdog.class);
  static final int MAX_REPORTS = 3;
  private static final Duration CHECK_INTERVAL = Duration.ofSeconds(30);
  private static final String SUBMITTED_TASKS = "async.operations.db.submitted";
  private static final String ACTIVE_TASKS = "async.operations.db.active";
  private static final String QUEUED_TASKS = "async.operations.db.queued";
  private static final String OPERATION_TAG = "operation";

  private final DatabaseProbe database;
  private final Supplier<AsyncBacklog> backlogSampler;
  private final Path reportDirectory;
  private final Duration threshold;
  private final Clock clock;
  private final ScheduledExecutorService scheduler =
      Executors.newSingleThreadScheduledExecutor(
          Thread.ofPlatform().name("server-stall-watchdog").daemon().factory());
  private long completedAtLastProgress;
  private Instant lastProgress;
  private Instant lastReport = Instant.EPOCH;
  private int reports;

  ServerStallWatchdog(
      final DatabaseProbe database,
      final Supplier<AsyncBacklog> backlogSampler,
      final Path reportDirectory,
      final Duration threshold,
      final Clock clock) {
    this.database = database;
    this.backlogSampler = backlogSampler;
    this.reportDirectory = reportDirectory;
    this.threshold = threshold;
    this.clock = clock;
    this.completedAtLastProgress = backlogSampler.get().completed();
    this.lastProgress = clock.instant();
  }

  static ServerStallWatchdog forEmbeddedServer(
      final DatabaseProbe database, final Path reportDirectory, final Duration threshold) {
    return new ServerStallWatchdog(
        database, AsyncBacklog::fromServerMetrics, reportDirectory, threshold, Clock.systemUTC());
  }

  void start() {
    final long seconds = CHECK_INTERVAL.toSeconds();
    scheduler.scheduleWithFixedDelay(this::checkSafely, seconds, seconds, TimeUnit.SECONDS);
  }

  @Override
  public void close() {
    scheduler.shutdownNow();
  }

  /** A check that throws would cancel every later run of the schedule, so none may escape. */
  private void checkSafely() {
    try {
      check();
    } catch (SQLException | IOException | RuntimeException e) {
      LOG.warn("Server stall watchdog check failed", e);
    }
  }

  void check() throws SQLException, IOException {
    final AsyncBacklog backlog = backlogSampler.get();
    final Instant now = clock.instant();
    recordProgress(backlog, now);
    final Optional<String> reason = stallReason(backlog, database.oldestOpenTransaction(), now);
    if (reason.isPresent() && mayReport(now)) {
      report(reason.get(), backlog, database.describe(), now);
    }
  }

  private void recordProgress(final AsyncBacklog backlog, final Instant now) {
    if (backlog.completed() != completedAtLastProgress || backlog.queued() == 0) {
      completedAtLastProgress = backlog.completed();
      lastProgress = now;
    }
  }

  private Optional<String> stallReason(
      final AsyncBacklog backlog, final Duration oldestTransaction, final Instant now) {
    return Stream.of(stalledBacklog(backlog, now), longTransaction(oldestTransaction))
        .flatMap(Optional::stream)
        .findFirst();
  }

  private Optional<String> stalledBacklog(final AsyncBacklog backlog, final Instant now) {
    final Duration stalledFor = Duration.between(lastProgress, now);
    return backlog.queued() > 0 && stalledFor.compareTo(threshold) >= 0
        ? Optional.of(
            String.format(
                "no queued async database task completed for %ds (%s)",
                stalledFor.toSeconds(), backlog))
        : Optional.empty();
  }

  private Optional<String> longTransaction(final Duration oldestTransaction) {
    return oldestTransaction.compareTo(threshold) >= 0
        ? Optional.of(
            String.format(
                "a database transaction has been open for %ds", oldestTransaction.toSeconds()))
        : Optional.empty();
  }

  private boolean mayReport(final Instant now) {
    return reports < MAX_REPORTS && Duration.between(lastReport, now).compareTo(threshold) >= 0;
  }

  private void report(
      final String reason,
      final AsyncBacklog backlog,
      final String databaseState,
      final Instant now)
      throws IOException {
    reports++;
    lastReport = now;
    Files.createDirectories(reportDirectory);
    final Path summary = reportDirectory.resolve("server-stall-" + reports + ".txt");
    final Path threads =
        reportDirectory.resolve("server-stall-" + reports + "-threads.json").toAbsolutePath();
    Files.writeString(
        summary,
        String.join(
            System.lineSeparator(),
            "At: " + now,
            "Reason: " + reason,
            "Async database tasks by operation: " + backlog.byOperation(),
            "",
            databaseState));
    dumpThreads(threads);
    LOG.warn("Server stall: {}. Wrote {} and {}", reason, summary.toAbsolutePath(), threads);
  }

  /** Includes virtual threads, which {@code Thread.getAllStackTraces()} leaves out. */
  private static void dumpThreads(final Path threads) throws IOException {
    Files.deleteIfExists(threads);
    ManagementFactory.getPlatformMXBean(HotSpotDiagnosticMXBean.class)
        .dumpThreads(threads.toString(), HotSpotDiagnosticMXBean.ThreadDumpFormat.JSON);
  }

  /** Totals of the server's DB-bounded async executor, read from the meters it publishes. */
  record AsyncBacklog(long submitted, long active, long queued, String byOperation) {
    long completed() {
      return submitted - active - queued;
    }

    static AsyncBacklog fromServerMetrics() {
      return new AsyncBacklog(
          total(SUBMITTED_TASKS), total(ACTIVE_TASKS), total(QUEUED_TASKS), describeOperations());
    }

    @Override
    public String toString() {
      return String.format("submitted=%d active=%d queued=%d", submitted, active, queued);
    }

    private static long total(final String meterName) {
      return Math.round(
          Metrics.globalRegistry.find(meterName).meters().stream()
              .mapToDouble(AsyncBacklog::value)
              .sum());
    }

    private static String describeOperations() {
      return Stream.of(ACTIVE_TASKS, QUEUED_TASKS)
          .flatMap(name -> Metrics.globalRegistry.find(name).meters().stream())
          .filter(meter -> value(meter) > 0)
          .map(
              meter ->
                  String.format(
                      "%s %s=%d",
                      meter.getId().getTag(OPERATION_TAG),
                      meter.getId().getName(),
                      Math.round(value(meter))))
          .collect(Collectors.joining(", "));
    }

    private static double value(final Meter meter) {
      return StreamSupport.stream(meter.measure().spliterator(), false)
          .mapToDouble(Measurement::getValue)
          .filter(Double::isFinite)
          .sum();
    }
  }

  /** What the database reports about open transactions and the locks they wait for. */
  interface DatabaseProbe {
    Duration oldestOpenTransaction() throws SQLException;

    String describe();

    static DatabaseProbe mysql(final String jdbcUrl, final String rootPassword) {
      return new SqlDatabaseProbe(
          jdbcUrl,
          "root",
          rootPassword,
          "SELECT COALESCE(MAX(TIMESTAMPDIFF(SECOND, trx_started, NOW())), 0)"
              + " FROM information_schema.innodb_trx",
          List.of(
              "SELECT trx_id, trx_mysql_thread_id, trx_state, trx_started, trx_rows_locked,"
                  + " trx_lock_structs, trx_rows_modified, LEFT(trx_query, 2000) AS trx_query"
                  + " FROM information_schema.innodb_trx ORDER BY trx_started",
              "SELECT * FROM sys.innodb_lock_waits",
              "SELECT ID, USER, COMMAND, TIME, STATE, LEFT(INFO, 2000) AS INFO"
                  + " FROM information_schema.PROCESSLIST WHERE COMMAND <> 'Sleep'"
                  + " OR ID IN (SELECT trx_mysql_thread_id FROM information_schema.innodb_trx)",
              "SELECT OBJECT_SCHEMA, OBJECT_NAME, LOCK_TYPE, LOCK_STATUS, OWNER_THREAD_ID"
                  + " FROM performance_schema.metadata_locks WHERE LOCK_STATUS = 'PENDING'",
              "SHOW ENGINE INNODB STATUS"));
    }

    static DatabaseProbe postgres(final String jdbcUrl, final String user, final String password) {
      return new SqlDatabaseProbe(
          jdbcUrl,
          user,
          password,
          "SELECT COALESCE(EXTRACT(EPOCH FROM MAX(now() - xact_start)), 0)::bigint"
              + " FROM pg_stat_activity WHERE datname = current_database()"
              + " AND pid <> pg_backend_pid()",
          List.of(
              "SELECT pid, state, xact_start, query_start, wait_event_type, wait_event,"
                  + " pg_blocking_pids(pid) AS blocked_by, left(query, 2000) AS query"
                  + " FROM pg_stat_activity WHERE datname = current_database()"
                  + " AND pid <> pg_backend_pid() AND state <> 'idle' ORDER BY xact_start",
              "SELECT locktype, relation::regclass AS relation, mode, pid"
                  + " FROM pg_locks WHERE NOT granted"));
    }
  }

  private record SqlDatabaseProbe(
      String jdbcUrl,
      String user,
      String password,
      String oldestTransactionQuery,
      List<String> stateQueries)
      implements DatabaseProbe {
    @Override
    public Duration oldestOpenTransaction() throws SQLException {
      try (Connection connection = connect();
          Statement statement = connection.createStatement();
          ResultSet rows = statement.executeQuery(oldestTransactionQuery)) {
        return Duration.ofSeconds(rows.next() ? rows.getLong(1) : 0);
      }
    }

    @Override
    public String describe() {
      try (Connection connection = connect()) {
        return stateQueries.stream()
            .map(query -> "== " + query + System.lineSeparator() + rowsOf(connection, query))
            .collect(Collectors.joining(System.lineSeparator()));
      } catch (SQLException e) {
        return "could not connect to describe the database: " + e.getMessage();
      }
    }

    private Connection connect() throws SQLException {
      return DriverManager.getConnection(jdbcUrl, user, password);
    }

    /** One failing diagnostic query must not lose the others. */
    private static String rowsOf(final Connection connection, final String query) {
      try (Statement statement = connection.createStatement();
          ResultSet rows = statement.executeQuery(query)) {
        return render(rows);
      } catch (SQLException e) {
        return "query failed: " + e.getMessage();
      }
    }

    private static String render(final ResultSet rows) throws SQLException {
      final ResultSetMetaData columns = rows.getMetaData();
      final StringBuilder rendered = new StringBuilder();
      while (rows.next()) {
        for (int column = 1; column <= columns.getColumnCount(); column++) {
          rendered
              .append(columns.getColumnLabel(column))
              .append('=')
              .append(rows.getString(column));
          rendered.append(column < columns.getColumnCount() ? " | " : System.lineSeparator());
        }
      }
      return rendered.toString();
    }
  }
}
