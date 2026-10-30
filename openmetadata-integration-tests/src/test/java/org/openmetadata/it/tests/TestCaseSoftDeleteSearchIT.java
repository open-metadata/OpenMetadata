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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Regression for the live-indexing soft-delete propagation bug. {@code SOFT_DELETE_RESTORE_SCRIPT}
 * was stamping a top-level {@code deleted} field onto child docs of every alias listed in the
 * parent's {@code indexMapping}. For {@code testCase}, two of those children
 * ({@code testCaseResolutionStatus}, {@code testCaseResult}) are time-series indexes whose
 * Java schemas declare no {@code deleted} field. The poisoned doc broke Jackson on read and
 * the Incident Manager UI surfaced an "Unrecognized field 'deleted'" toast.
 *
 * <p>This test exercises the end-to-end path: create a TC + result + incident, soft-delete the
 * TC, and confirm that (a) the resolution-status listing API still parses cleanly and (b) the
 * underlying ES doc carries no top-level {@code deleted} field.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TestCaseSoftDeleteSearchIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void softDeletingTestCaseDoesNotPollutePropagatedTimeSeriesDocs() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    IncidentFixture fixture = createTestCaseWithIncident(client, "soft_delete");
    String testCaseFqn = fixture.testCase().getFullyQualifiedName();
    try {
      client
          .testCases()
          .delete(
              fixture.testCase().getId().toString(),
              Map.of("hardDelete", "false", "recursive", "true"));

      assertListingApiReturnsCleanlyAfterSoftDelete(client, testCaseFqn);
      assertNoTopLevelDeletedFieldOnIncidentDoc(client, testCaseFqn);
      assertIncidentListedOnlyWithDeleted(client, testCaseFqn);
    } finally {
      hardDeleteQuietly(client, fixture.database());
    }
  }

  // A table soft delete or restore reaches its test cases through the cascade, which writes no
  // search document per test case; their incidents must still leave and rejoin the default listing.
  @Test
  void softDeletingAndRestoringTableScopesItsIncidents() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    IncidentFixture fixture = createTestCaseWithIncident(client, "soft_delete_table_cascade");
    try {
      client
          .tables()
          .delete(
              fixture.table().getId().toString(),
              Map.of("hardDelete", "false", "recursive", "true"));

      assertIncidentListedOnlyWithDeleted(client, fixture.testCase().getFullyQualifiedName());

      client.tables().restore(fixture.table().getId());
      assertIncidentListedOnlyWithoutDeleted(client, fixture.testCase().getFullyQualifiedName());
    } finally {
      hardDeleteQuietly(client, fixture.database());
    }
  }

  private record IncidentFixture(Database database, Table table, TestCase testCase) {}

  private IncidentFixture createTestCaseWithIncident(OpenMetadataClient client, String prefix)
      throws Exception {
    long ts = System.currentTimeMillis();
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName(prefix + "_db_" + ts)
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(prefix + "_schema_" + ts)
                    .withDatabase(database.getFullyQualifiedName()));
    Table table =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(prefix + "_table_" + ts)
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(
                        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));

    // A definition that supports the BIGINT `id` column: the server rejects a column type the
    // definition does not list, and the first definition the listing returns need not list it.
    TestCase testCase =
        client
            .testCases()
            .create(
                new CreateTestCase()
                    .withName(prefix + "_tc_" + ts)
                    .withEntityLink(
                        "<#E::table::" + table.getFullyQualifiedName() + "::columns::id>")
                    .withTestDefinition("columnValuesToBeNotNull"));

    client
        .testCaseResolutionStatuses()
        .create(
            new CreateTestCaseResolutionStatus()
                .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.New)
                .withTestCaseReference(testCase.getFullyQualifiedName())
                .withSeverity(Severity.Severity2));

    awaitIncidentIndexed(client, testCase.getFullyQualifiedName());
    return new IncidentFixture(database, table, testCase);
  }

  // Hard-delete the entire database tree so the test leaves no artefacts behind. Best-effort
  // cleanup — assertion failures take precedence over cleanup exceptions.
  private void hardDeleteQuietly(OpenMetadataClient client, Database database) {
    try {
      client
          .databases()
          .delete(database.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
    } catch (Exception ignored) {
      // intentionally swallowed
    }
  }

  private void awaitIncidentIndexed(OpenMetadataClient client, String testCaseFqn) {
    await("Wait for resolution status to be searchable")
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              ListResponse<TestCaseResolutionStatus> resp =
                  client
                      .testCaseResolutionStatuses()
                      .searchList(
                          new ListParams()
                              .withLimit(1)
                              .withLatest(true)
                              .addFilter("testCaseFQN", testCaseFqn));
              assertNotNull(resp);
              assertEquals(
                  1,
                  resp.getData().size(),
                  "Incident for the test case should be indexed before we soft-delete");
            });
  }

  private void assertListingApiReturnsCleanlyAfterSoftDelete(
      OpenMetadataClient client, String testCaseFqn) {
    await("API returns parseable body after soft-delete propagation")
        .atMost(Duration.ofMinutes(1))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              ListResponse<TestCaseResolutionStatus> resp =
                  client
                      .testCaseResolutionStatuses()
                      .searchList(
                          new ListParams()
                              .withLimit(10)
                              .withLatest(true)
                              .addFilter("testCaseFQN", testCaseFqn));
              assertNotNull(
                  resp, "list endpoint must return a body; null implies a deserialization failure");
            });
  }

  // The classic Incident Manager lists from search with the default include=non-deleted, so an
  // incident of a soft-deleted test case must drop out of it and stay reachable with
  // include=deleted.
  private void assertIncidentListedOnlyWithDeleted(OpenMetadataClient client, String testCaseFqn) {
    await("Incident of a soft-deleted test case leaves the default listing")
        .atMost(Duration.ofMinutes(1))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              assertEquals(0, searchIncidents(client, testCaseFqn, null).size());
              assertEquals(1, searchIncidents(client, testCaseFqn, "deleted").size());
            });
  }

  private void assertIncidentListedOnlyWithoutDeleted(
      OpenMetadataClient client, String testCaseFqn) {
    await("Incident of a restored test case returns to the default listing")
        .atMost(Duration.ofMinutes(1))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              assertEquals(1, searchIncidents(client, testCaseFqn, null).size());
              assertEquals(0, searchIncidents(client, testCaseFqn, "deleted").size());
            });
  }

  private List<TestCaseResolutionStatus> searchIncidents(
      OpenMetadataClient client, String testCaseFqn, String include) throws Exception {
    ListParams params =
        new ListParams().withLimit(10).withLatest(true).addFilter("testCaseFQN", testCaseFqn);
    if (include != null) {
      params.addFilter("include", include);
    }
    return client.testCaseResolutionStatuses().searchList(params).getData();
  }

  /**
   * The fix in {@link org.openmetadata.service.search.SearchRepository#softDeleteOrRestoredChildren}
   * filters out time-series child aliases before invoking the soft-delete script. Confirm by
   * querying ES directly for any TCRS doc that has a top-level {@code deleted} field — there
   * must be none for our test case.
   */
  private void assertNoTopLevelDeletedFieldOnIncidentDoc(
      OpenMetadataClient client, String testCaseFqn) throws Exception {
    String rawJson =
        client
            .search()
            .query(
                "testCaseReference.fullyQualifiedName.keyword:\""
                    + testCaseFqn
                    + "\" AND _exists_:deleted")
            .index("test_case_resolution_status_search_index")
            .size(5)
            .execute();
    JsonNode root = MAPPER.readTree(rawJson);
    JsonNode hits = root.path("hits").path("hits");
    assertTrue(
        hits.isArray(), () -> "ES response missing hits.hits array; raw response was: " + rawJson);
    assertFalse(
        hits.elements().hasNext(),
        () ->
            "No `deleted` field should exist on testCaseResolutionStatus docs after a parent"
                + " soft-delete; found "
                + hits.size()
                + " polluted docs. Raw response: "
                + rawJson);
  }
}
