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
package org.openmetadata.it.tests.dataquality.scale;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.github.dockerjava.api.model.Ulimit;
import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bench.BenchmarkMetrics;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IncidentGroupTrend;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v211.IncidentOpenIntervalMigration;
import org.testcontainers.containers.JdbcDatabaseContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.containers.PostgreSQLContainer;

/** SQL scale regression; isolated database fixtures keep timings independent of other scale seeds. */
@Tag("scale")
@Execution(ExecutionMode.SAME_THREAD)
class IncidentGroupTrendScaleIT {
  private static final String DATABASE = "incident_trend_scale";
  private static final String DATABASE_USER = "scale_test";
  private static final String DATABASE_PASSWORD = "scale-test-only";
  private static final int TABLES = 200;
  private static final int INCIDENTS = 10000;
  private static final int REQUESTS = 30;

  @Test
  void openIncidentTrendRemainsCorrectUnderConcurrentLoad() throws Exception {
    String dialect = System.getProperty("databaseType", "postgres");
    assertTrue(
        List.of("mysql", "postgres").contains(dialect), "Unsupported databaseType: " + dialect);
    try (JdbcDatabaseContainer<?> database = createDatabase(dialect)) {
      database.start();
      Jdbi jdbi = connect(database);
      createSchema(jdbi, dialect);
      verifyScale(jdbi, dialect);
    }
  }

  private JdbcDatabaseContainer<?> createDatabase(String dialect) {
    JdbcDatabaseContainer<?> database;
    if ("mysql".equals(dialect)) {
      database =
          new MySQLContainer<>(System.getProperty("databaseImage", "mysql:8.3.0"))
              .withCommand("--skip-log-bin", "--innodb-buffer-pool-size=128M")
              .withTmpFs(Map.of("/var/lib/mysql", "rw,size=512m"));
    } else {
      database = new PostgreSQLContainer<>(System.getProperty("databaseImage", "postgres:15"));
    }
    database.withDatabaseName(DATABASE).withUsername(DATABASE_USER).withPassword(DATABASE_PASSWORD);
    database.withCreateContainerCmdModifier(
        cmd -> cmd.getHostConfig().withUlimits(List.of(new Ulimit("nofile", 65536L, 65536L))));
    return database;
  }

  private Jdbi connect(JdbcDatabaseContainer<?> database) {
    Jdbi jdbi = Jdbi.create(database.getJdbcUrl(), database.getUsername(), database.getPassword());
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(database.getDriverClassName()));
    return jdbi;
  }

  private void createSchema(Jdbi jdbi, String dialect) throws Exception {
    String intervalSchema =
        MigrationFile.parseSqlUnits(
                new File(
                    "../bootstrap/sql/migrations/native/2.1.1/" + dialect + "/schemaChanges.sql"),
                "mysql".equals(dialect) ? ConnectionType.MYSQL : ConnectionType.POSTGRES)
            .getFirst()
            .statements()
            .getFirst();
    jdbi.useHandle(
        handle -> {
          handle.execute(
              "CREATE TABLE test_case (fqnHash VARCHAR(36), incidentTableFqn VARCHAR(36), deleted BOOLEAN)");
          handle.execute(
              "CREATE TABLE test_case_incident (stateId VARCHAR(36) PRIMARY KEY, entityFQNHash VARCHAR(768), createdAt BIGINT)");
          handle.execute(
              "CREATE TABLE test_case_resolution_status_time_series (stateId VARCHAR(36), id VARCHAR(36), timestamp BIGINT, testCaseResolutionStatusType VARCHAR(36))");
          handle.execute(
              "CREATE INDEX incident_history_state_timestamp ON test_case_resolution_status_time_series (stateId, timestamp)");
          handle.execute(intervalSchema);
        });
  }

  private void verifyScale(Jdbi jdbi, String dialect) throws Exception {
    jdbi.useTransaction(
        handle -> {
          var tables =
              handle.prepareBatch(
                  "INSERT INTO test_case (fqnHash,incidentTableFqn,deleted) VALUES (?, ?, FALSE)");
          for (int table = 0; table < TABLES; table++) {
            tables.add("scale_test_" + table, "scale_table_" + table);
          }
          tables.execute();
          var incidents =
              handle.prepareBatch(
                  "INSERT INTO test_case_incident "
                      + "(stateId,entityFQNHash,createdAt) VALUES (?,?,100)");
          var history =
              handle.prepareBatch(
                  "INSERT INTO test_case_resolution_status_time_series "
                      + "(stateId,id,timestamp,testCaseResolutionStatusType) VALUES (?,?,?,?)");
          for (int incident = 0; incident < INCIDENTS; incident++) {
            String state = "scale_" + incident;
            incidents.add(state, "scale_test_" + (incident / 50));
            List<String> statuses =
                List.of("New", "Ack", "Assigned", incident % 2 == 0 ? "Resolved" : "Ack");
            for (int event = 0; event < statuses.size(); event++) {
              history.add(state, state + "_" + event, (event + 1) * 100L, statuses.get(event));
            }
          }
          incidents.execute();
          history.execute();
        });
    jdbi.useHandle(IncidentOpenIntervalMigration::backfill);
    assertEquals(
        INCIDENTS,
        jdbi.withHandle(
                handle ->
                    handle
                        .createQuery("SELECT COUNT(*) FROM test_case_incident_open_interval")
                        .mapTo(Integer.class)
                        .one())
            .intValue());
    List<Measurement> measurements = new ArrayList<>();
    for (int concurrency : List.of(1, 5)) {
      measurements.add(measureScaleQueries(jdbi, concurrency, false));
      measurements.add(measureScaleQueries(jdbi, concurrency, true));
    }
    BenchmarkMetrics.write(
        new ScaleReport(dialect, TABLES, INCIDENTS, measurements),
        "incident-group-trend-" + dialect + ".json");
  }

  private Measurement measureScaleQueries(Jdbi jdbi, int concurrency, boolean largeGroup)
      throws Exception {
    final List<String> keys =
        largeGroup
            ? List.of("scale_definition")
            : IntStream.range(0, 25).mapToObj(i -> "scale_table_" + i).toList();
    final String groupKey = largeGroup ? "'scale_definition'" : "tc.incidentTableFqn";
    final List<Integer> expected =
        largeGroup
            ? List.of(0, 10000, 10000, 10000, 5000, 5000, 5000, 5000, 5000)
            : List.of(0, 50, 50, 50, 25, 25, 25, 25, 25);
    final var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    Callable<Long> request =
        () -> {
          long started = System.nanoTime();
          var rows =
              dao.listIncidentGroupTrendCounts(
                  groupKey,
                  "",
                  "WHERE i.stateId LIKE 'scale_%'",
                  IncidentGroupTrend.samplesSql(),
                  keys,
                  new IncidentGroupTrend(0, 800).bindings());
          long elapsed = System.nanoTime() - started;
          var grouped =
              rows.stream()
                  .collect(Collectors.groupingBy(TimeSeriesDAOs.IncidentGroupTrendCount::groupKey));
          assertEquals(Set.copyOf(keys), grouped.keySet());
          grouped
              .values()
              .forEach(values -> assertEquals(expected, IncidentGroupTrend.counts(values)));
          return elapsed;
        };
    request.call();
    List<Long> timings = new ArrayList<>();
    try (var executor = Executors.newFixedThreadPool(concurrency)) {
      for (var result : executor.invokeAll(Collections.nCopies(REQUESTS, request))) {
        timings.add(result.get());
      }
    }
    timings.sort(Long::compareTo);
    double p95Millis = timings.get((int) Math.ceil(timings.size() * 0.95) - 1) / 1_000_000.0;
    long budgetMillis = Long.getLong("incident.trend.scale.p95Millis", 5000L);
    System.out.printf(
        "Incident trend scale: largeGroup=%s concurrency=%d requests=%d p95=%.1fms budget=%dms%n",
        largeGroup, concurrency, timings.size(), p95Millis, budgetMillis);
    assertTrue(
        p95Millis < budgetMillis,
        "Trend query p95 exceeded coarse scale regression budget: " + p95Millis);
    return new Measurement(largeGroup, concurrency, REQUESTS, p95Millis);
  }

  private record Measurement(boolean largeGroup, int concurrency, int requests, double p95Millis) {}

  private record ScaleReport(
      String database, int tables, int incidents, List<Measurement> measurements) {}
}
