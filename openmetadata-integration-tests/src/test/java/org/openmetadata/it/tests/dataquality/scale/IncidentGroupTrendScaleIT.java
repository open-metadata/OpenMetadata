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

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bench.BenchmarkMetrics;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseIncidentGroup;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IncidentGroupTrend;
import org.openmetadata.service.jdbi3.IncidentOpenIntervalDAO;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.FullyQualifiedName;

/** SQL scale regression against the scale framework's running application and migrated database. */
@Tag("scale")
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
class IncidentGroupTrendScaleIT {
  private static final int TABLES = 200;
  private static final int INCIDENTS_PER_TABLE = 50;
  private static final int INCIDENTS = TABLES * INCIDENTS_PER_TABLE;
  private static final int REQUESTS = 30;
  private static final String LARGE_GROUP = "scale_definition";

  @Test
  void openIncidentTrendRemainsCorrectUnderConcurrentLoad(TestNamespace namespace)
      throws Exception {
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();
    Fixture fixture = seedFixture(namespace, jdbi);
    analyzeFixtureTables(jdbi);
    assertIntervalCount(jdbi, fixture);
    assertApplicationReadsFixture(fixture.tables().getFirst());
    List<Measurement> measurements = new ArrayList<>();
    for (int concurrency : List.of(1, 5)) {
      measurements.add(measureScaleQueries(jdbi, fixture, concurrency, false));
      measurements.add(measureScaleQueries(jdbi, fixture, concurrency, true));
    }
    BenchmarkMetrics.write(
        new ScaleReport(TestSuiteBootstrap.getConnectionType(), TABLES, INCIDENTS, measurements),
        "incident-group-trend.json");
  }

  private Fixture seedFixture(TestNamespace namespace, Jdbi jdbi) throws Exception {
    String prefix = namespace.shortPrefix();
    String schemaFqn =
        DatabaseSchemaTestFactory.createSimpleWithName(
                "sc" + prefix,
                namespace,
                DatabaseServiceTestFactory.createPostgresWithName("svc" + prefix, namespace))
            .getFullyQualifiedName();
    List<TableFixture> tables = new ArrayList<>();
    // MySQL's INSERT ... SELECT interval rebuild can lock history read by another loader.
    // Keep fixture writes serial; the measured queries below still run concurrently.
    for (int table = 0; table < TABLES; table++) {
      tables.add(seedTable(namespace, jdbi, schemaFqn, prefix + "_" + table));
    }
    return new Fixture(tables, FullyQualifiedName.buildHash(schemaFqn) + ".%");
  }

  private TableFixture seedTable(
      TestNamespace namespace, Jdbi jdbi, String schemaFqn, String name) {
    Table table = TableTestFactory.createSimpleWithName(name, namespace, schemaFqn);
    TestCase testCase =
        SdkClients.adminClient()
            .testCases()
            .create(
                new CreateTestCase()
                    .withName("incident_trend")
                    .withEntityLink(
                        "<#E::table::" + table.getFullyQualifiedName() + "::columns::id>")
                    .withTestDefinition("columnValuesToBeNotNull"));
    jdbi.useTransaction(handle -> seedHistory(handle, testCase));
    return new TableFixture(table.getFullyQualifiedName(), testCase.getFullyQualifiedName());
  }

  // Historical fixtures use batches so setup does not dominate the scale run. The real generated
  // columns, parent relationships and interval rebuild are used; no schema or global backfill runs.
  private void seedHistory(Handle handle, TestCase testCase) {
    String jsonValue =
        TestSuiteBootstrap.getConnectionType() == ConnectionType.POSTGRES ? "?::jsonb" : "?";
    var history =
        handle.prepareBatch(
            "INSERT INTO test_case_resolution_status_time_series (entityFQNHash, jsonSchema, json) VALUES (?, ?, "
                + jsonValue
                + ")");
    var summaries =
        handle.prepareBatch(
            "INSERT INTO test_case_incident (stateId, entityFQNHash, testCaseResolutionStatusType, createdAt, updatedAt, latestRecordId) VALUES (?, ?, ?, 100, 400, ?)");
    var parents =
        handle.prepareBatch(
            "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) VALUES (?, ?, ?, ?, ?)");
    String hash = FullyQualifiedName.buildHash(testCase.getFullyQualifiedName());
    List<String> stateIds = new ArrayList<>();
    for (int incident = 0; incident < INCIDENTS_PER_TABLE; incident++) {
      List<TestCaseResolutionStatus> records = historyRecords(incident);
      for (TestCaseResolutionStatus record : records) {
        history.add(hash, Entity.TEST_CASE_RESOLUTION_STATUS, JsonUtils.pojoToJson(record));
        parents.add(
            testCase.getId().toString(),
            record.getId().toString(),
            Entity.TEST_CASE,
            Entity.TEST_CASE_RESOLUTION_STATUS,
            Relationship.PARENT_OF.ordinal());
      }
      TestCaseResolutionStatus latest = records.getLast();
      stateIds.add(latest.getStateId().toString());
      summaries.add(
          latest.getStateId().toString(),
          hash,
          latest.getTestCaseResolutionStatusType().value(),
          latest.getId().toString());
    }
    history.execute();
    parents.execute();
    summaries.execute();
    handle.attach(IncidentOpenIntervalDAO.class).rebuildOpenIntervals(stateIds);
  }

  private List<TestCaseResolutionStatus> historyRecords(int incident) {
    UUID stateId = UUID.randomUUID();
    List<TestCaseResolutionStatusTypes> statuses =
        List.of(
            TestCaseResolutionStatusTypes.New,
            TestCaseResolutionStatusTypes.Ack,
            TestCaseResolutionStatusTypes.Assigned,
            incident % 2 == 0
                ? TestCaseResolutionStatusTypes.Resolved
                : TestCaseResolutionStatusTypes.Ack);
    return IntStream.range(0, statuses.size())
        .mapToObj(
            event ->
                new TestCaseResolutionStatus()
                    .withId(UUID.randomUUID())
                    .withStateId(stateId)
                    .withTimestamp((event + 1) * 100L)
                    .withUpdatedAt((event + 1) * 100L)
                    .withTestCaseResolutionStatusType(statuses.get(event)))
        .toList();
  }

  // A bulk fixture can reach reads and cleanup before auto-analyze notices its new rows.
  // Publish planner statistics explicitly so the run does not depend on that background timing.
  private void analyzeFixtureTables(Jdbi jdbi) throws Exception {
    String command =
        TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL
            ? "ANALYZE TABLE "
            : "ANALYZE ";
    jdbi.useHandle(
        handle -> {
          try (var statement = handle.getConnection().createStatement()) {
            statement.execute(
                command
                    + "test_case, test_case_incident, test_case_resolution_status_time_series, "
                    + "test_case_incident_open_interval, entity_relationship");
          }
        });
  }

  private void assertIntervalCount(Jdbi jdbi, Fixture fixture) {
    int actual =
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM test_case_incident_open_interval o "
                            + "JOIN test_case_incident i ON i.stateId = o.stateId WHERE i.entityFQNHash LIKE :scope")
                    .bind("scope", fixture.hashPrefix())
                    .mapTo(Integer.class)
                    .one());
    assertEquals(INCIDENTS, actual);
  }

  private void assertApplicationReadsFixture(TableFixture fixture) {
    var response =
        SdkClients.adminClient()
            .testCaseResolutionStatuses()
            .listIncidentGroups(
                Map.of("groupBy", "table", "testCaseFQN", fixture.testCaseFqn(), "limit", "25"));
    assertEquals(1, response.getData().size());
    TestCaseIncidentGroup group =
        JsonUtils.convertValue(response.getData().getFirst(), TestCaseIncidentGroup.class);
    assertEquals(fixture.tableFqn(), group.getFullyQualifiedName());
    assertEquals(INCIDENTS_PER_TABLE / 2, group.getIncidentCount());
    assertEquals(Integer.valueOf(INCIDENTS_PER_TABLE / 2), group.getTrend().getLast());
  }

  private Measurement measureScaleQueries(
      Jdbi jdbi, Fixture fixture, int concurrency, boolean largeGroup) throws Exception {
    final List<String> keys =
        largeGroup
            ? List.of(LARGE_GROUP)
            : fixture.tables().stream().limit(25).map(TableFixture::tableFqn).toList();
    final String groupKey = largeGroup ? "'" + LARGE_GROUP + "'" : "tc.incidentTableFqn";
    final List<Integer> expected =
        largeGroup
            ? List.of(
                0,
                INCIDENTS,
                INCIDENTS,
                INCIDENTS,
                INCIDENTS / 2,
                INCIDENTS / 2,
                INCIDENTS / 2,
                INCIDENTS / 2,
                INCIDENTS / 2)
            : List.of(0, 50, 50, 50, 25, 25, 25, 25, 25);
    final var dao = jdbi.onDemand(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    Callable<Long> request =
        () -> {
          long started = System.nanoTime();
          var rows =
              dao.listIncidentGroupTrendCounts(
                  groupKey,
                  "",
                  "WHERE i.entityFQNHash LIKE '" + fixture.hashPrefix() + "'",
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
        "Trend query p95 exceeded coarse scale regression budget: "
            + p95Millis
            + " >= "
            + budgetMillis);
    return new Measurement(largeGroup, concurrency, REQUESTS, p95Millis, budgetMillis);
  }

  private record TableFixture(String tableFqn, String testCaseFqn) {}

  private record Fixture(List<TableFixture> tables, String hashPrefix) {}

  private record Measurement(
      boolean largeGroup, int concurrency, int requests, double p95Millis, long budgetMillis) {}

  private record ScaleReport(
      ConnectionType database, int tables, int incidents, List<Measurement> measurements) {}
}
