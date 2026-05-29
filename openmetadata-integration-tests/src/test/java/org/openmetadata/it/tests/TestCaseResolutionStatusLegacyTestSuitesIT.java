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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
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
 * Regression for the testCaseIncidentStatus/search/list 400 caused by a legacy {@code testSuites}
 * field on TCRS docs. Before {@code SearchRepository.inheritableFields} was trimmed, the search
 * pipeline propagated {@code testSuites} from testCase onto every child alias, including the
 * {@code test_case_resolution_status_search_index}. The field outlives the propagation refactor in
 * any cluster that ran the older code, and {@code TestCaseResolutionStatus} has
 * {@code additionalProperties: false} with no {@code testSuites} property — strict Jackson then
 * rejects the doc on read.
 *
 * <p>This test recreates the polluted shape with a Painless update against the live index, then
 * verifies that {@code searchList(latest=true)} and {@code searchList(latest=false)} both still
 * deserialize successfully.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TestCaseResolutionStatusLegacyTestSuitesIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String INDEX_NAME = "openmetadata_test_case_resolution_status_search_index";

  @Test
  void listingApiSurvivesLegacyTestSuitesFieldOnIncidentDoc() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    long ts = System.currentTimeMillis();

    Database database = null;
    try (Rest5Client searchClient = TestSuiteBootstrap.createSearchClient()) {
      database =
          client
              .databases()
              .create(
                  new CreateDatabase()
                      .withName("legacy_testsuites_db_" + ts)
                      .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
      DatabaseSchema schema =
          client
              .databaseSchemas()
              .create(
                  new CreateDatabaseSchema()
                      .withName("legacy_testsuites_schema_" + ts)
                      .withDatabase(database.getFullyQualifiedName()));
      Table table =
          client
              .tables()
              .create(
                  new CreateTable()
                      .withName("legacy_testsuites_table_" + ts)
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

      TestCase testCase =
          client
              .testCases()
              .create(
                  new CreateTestCase()
                      .withName("legacy_testsuites_tc_" + ts)
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
      injectLegacyTestSuitesField(searchClient, testCase.getFullyQualifiedName());
      refreshIndex(searchClient);
      assertTopLevelTestSuitesPresent(searchClient, testCase.getFullyQualifiedName());

      assertSearchListLatestReturnsCleanly(client, testCase.getFullyQualifiedName());
      assertSearchListWithOffsetReturnsCleanly(client, testCase.getFullyQualifiedName());
    } finally {
      if (database != null) {
        try {
          client
              .databases()
              .delete(
                  database.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
        } catch (Exception ignored) {
          // best-effort cleanup
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
                  "Incident must be indexed before we inject the legacy field");
            });
  }

  private void injectLegacyTestSuitesField(Rest5Client searchClient, String testCaseFqn)
      throws Exception {
    String suiteId = UUID.randomUUID().toString();
    String legacySuiteName = "legacy_propagated_suite_" + System.currentTimeMillis();
    String body =
        """
        {
          "query": {
            "term": {
              "testCase.fullyQualifiedName.keyword": "%s"
            }
          },
          "script": {
            "source": "ctx._source.testSuites = params.testSuites;",
            "lang": "painless",
            "params": {
              "testSuites": [
                {
                  "id": "%s",
                  "name": "%s",
                  "fullyQualifiedName": "%s",
                  "type": "testSuite"
                }
              ]
            }
          }
        }
        """
            .formatted(testCaseFqn, suiteId, legacySuiteName, legacySuiteName);

    Request request = new Request("POST", "/" + INDEX_NAME + "/_update_by_query?refresh=true");
    request.setJsonEntity(body);
    Response response = searchClient.performRequest(request);
    assertEquals(
        200, response.getStatusCode(), "Painless update_by_query to inject testSuites failed");
  }

  private void refreshIndex(Rest5Client searchClient) throws Exception {
    Request request = new Request("POST", "/" + INDEX_NAME + "/_refresh");
    searchClient.performRequest(request);
  }

  private void assertTopLevelTestSuitesPresent(Rest5Client searchClient, String testCaseFqn)
      throws Exception {
    String query =
        """
        {
          "size": 1,
          "query": {
            "term": {
              "testCase.fullyQualifiedName.keyword": "%s"
            }
          }
        }
        """
            .formatted(testCaseFqn);

    Request request = new Request("POST", "/" + INDEX_NAME + "/_search");
    request.setJsonEntity(query);
    Response response = searchClient.performRequest(request);
    String body =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    JsonNode source = MAPPER.readTree(body).path("hits").path("hits").path(0).path("_source");
    assertTrue(
        source.has("testSuites"),
        () ->
            "Test scaffolding failed: doc should have testSuites after injection. Source: "
                + source);
  }

  private void assertSearchListLatestReturnsCleanly(OpenMetadataClient client, String testCaseFqn) {
    await("searchList(latest=true) survives legacy testSuites field")
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
                              .withLimit(15)
                              .withLatest(true)
                              .addFilter("testCaseFQN", testCaseFqn));
              assertNotNull(
                  resp, "searchList must return a body; null body implies deserialization failure");
              assertEquals(
                  1,
                  resp.getData().size(),
                  "Filtered listing should return exactly the polluted incident");
            });
  }

  private void assertSearchListWithOffsetReturnsCleanly(
      OpenMetadataClient client, String testCaseFqn) {
    await("searchList(latest=false) survives legacy testSuites field")
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
                              .withLimit(15)
                              .withLatest(false)
                              .addFilter("testCaseFQN", testCaseFqn));
              assertNotNull(
                  resp, "searchList must return a body; null body implies deserialization failure");
              assertTrue(
                  resp.getData().size() >= 1,
                  "Offset listing should still return the polluted incident");
            });
  }
}
