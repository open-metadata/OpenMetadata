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

    long ts = System.currentTimeMillis();
    Database database = null;
    DatabaseSchema schema = null;
    Table table = null;
    TestCase testCase = null;
    try {
      database =
          client
              .databases()
              .create(
                  new CreateDatabase()
                      .withName("soft_delete_db_" + ts)
                      .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
      schema =
          client
              .databaseSchemas()
              .create(
                  new CreateDatabaseSchema()
                      .withName("soft_delete_schema_" + ts)
                      .withDatabase(database.getFullyQualifiedName()));
      table =
          client
              .tables()
              .create(
                  new CreateTable()
                      .withName("soft_delete_table_" + ts)
                      .withDatabaseSchema(schema.getFullyQualifiedName())
                      .withColumns(
                          List.of(
                              new Column().withName("id").withDataType(ColumnDataType.BIGINT))));

      String testDefFqn =
          client
              .testDefinitions()
              .list(new ListParams().withLimit(1))
              .getData()
              .get(0)
              .getFullyQualifiedName();

      testCase =
          client
              .testCases()
              .create(
                  new CreateTestCase()
                      .withName("soft_delete_tc_" + ts)
                      .withEntityLink(
                          "<#E::table::" + table.getFullyQualifiedName() + "::columns::id>")
                      .withTestDefinition(testDefFqn));

      client
          .testCaseResolutionStatuses()
          .create(
              new CreateTestCaseResolutionStatus()
                  .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.New)
                  .withTestCaseReference(testCase.getFullyQualifiedName())
                  .withSeverity(Severity.Severity2));

      awaitIncidentIndexed(client, testCase.getFullyQualifiedName());

      client
          .testCases()
          .delete(testCase.getId().toString(), Map.of("hardDelete", "false", "recursive", "true"));

      assertListingApiReturnsCleanlyAfterSoftDelete(client, testCase.getFullyQualifiedName());
      assertNoTopLevelDeletedFieldOnIncidentDoc(client, testCase.getFullyQualifiedName());
    } finally {
      // Hard-delete the entire database tree so the test leaves no artefacts behind. The
      // testCase + resolution statuses are recursively cascaded with the parent table.
      // Best-effort cleanup — assertion failures take precedence over cleanup exceptions.
      if (database != null) {
        try {
          client
              .databases()
              .delete(
                  database.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
        } catch (Exception ignored) {
          // intentionally swallowed
        }
      }
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
