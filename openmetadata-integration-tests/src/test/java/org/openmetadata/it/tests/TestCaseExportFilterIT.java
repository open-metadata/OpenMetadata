/*
 *  Copyright 2026 Collate.
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URLEncoder;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.CsvJobClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;

/**
 * Filters and pagination on {@code GET /v1/dataQuality/testCases/name/{name}/export} and its async
 * twin (issue #26756). Every case runs through both endpoints and requires the same rows from each.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class TestCaseExportFilterIT {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final CsvJobClient CLIENT = CsvJobClient.onDefaultServer();
  private static final String TEST_CASES_PATH = "/v1/dataQuality/testCases";
  private static final Duration SEARCH_CONVERGENCE_TIMEOUT = Duration.ofSeconds(90);

  @Test
  void test_exportFiltersAndPagesIdenticallyOnBothEndpoints(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);
    TestCase failedTable =
        createTestCase(
            client, "exp_failed_tbl_" + ns.uniqueShortId(), table, null, TestCaseStatus.Failed);
    TestCase successTable =
        createTestCase(
            client, "exp_success_tbl_" + ns.uniqueShortId(), table, null, TestCaseStatus.Success);
    TestCase failedColumn =
        createTestCase(
            client, "exp_failed_col_" + ns.uniqueShortId(), table, "id", TestCaseStatus.Failed);
    Set<String> all = Set.of(failedTable.getName(), successTable.getName(), failedColumn.getName());
    String tableFqn = table.getFullyQualifiedName();
    awaitIndexed(tableFqn, all.size(), 2);

    assertEquals(all, exportedNames(tableFqn, "", all), "No params must export everything");
    assertEquals(
        Set.of(failedTable.getName(), failedColumn.getName()),
        exportedNames(tableFqn, "testCaseStatus=Failed", all));
    assertEquals(
        Set.of(failedColumn.getName()),
        exportedNames(tableFqn, "testCaseStatus=Failed&testCaseType=column", all));
    assertEquals(
        Set.of(failedColumn.getName()),
        exportedNames(tableFqn, "entityFQN=" + encode(tableFqn + ".id"), all));

    Set<String> firstPage = exportedNames(tableFqn, "limit=2&offset=0", all);
    Set<String> secondPage = exportedNames(tableFqn, "limit=2&offset=2", all);
    assertEquals(2, firstPage.size());
    assertEquals(1, secondPage.size());
    Set<String> union = new HashSet<>(firstPage);
    union.addAll(secondPage);
    assertEquals(all, union, "Consecutive pages must cover every test case exactly once");
    assertEquals(Set.of(), exportedNames(tableFqn, "limit=2&offset=3", all));
  }

  @Test
  void test_asyncExportProgressReflectsFilteredCount(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);
    createTestCase(
        client, "prog_failed_1_" + ns.uniqueShortId(), table, null, TestCaseStatus.Failed);
    createTestCase(
        client, "prog_failed_2_" + ns.uniqueShortId(), table, "id", TestCaseStatus.Failed);
    createTestCase(
        client, "prog_success_" + ns.uniqueShortId(), table, null, TestCaseStatus.Success);
    String tableFqn = table.getFullyQualifiedName();
    awaitIndexed(tableFqn, 3, 2);

    String jobId = CLIENT.startExport(exportPath(tableFqn, "exportAsync", "testCaseStatus=Failed"));
    JsonNode job = CLIENT.awaitJobStatus(jobId, "COMPLETED");

    assertEquals(2, job.path("total").asInt(), "Progress total must count the filtered rows");
  }

  @Test
  void test_exportRejectsInvalidFilters(TestNamespace ns) throws Exception {
    Table table = createTable(ns);
    Table otherTable = createTable(ns);
    String tableFqn = table.getFullyQualifiedName();

    for (String endpoint : List.of("export", "exportAsync")) {
      assertBadRequest(exportPath(tableFqn, endpoint, "testCaseStatus=Broken"));
      assertBadRequest(exportPath(tableFqn, endpoint, "testCaseType=view"));
      assertBadRequest(exportPath(tableFqn, endpoint, "limit=0"));
      assertBadRequest(exportPath(tableFqn, endpoint, "offset=-1"));
      assertBadRequest(
          exportPath(
              tableFqn,
              endpoint,
              "entityFQN="
                  + encode(tableFqn)
                  + "&entityLink="
                  + encode("<#E::table::" + tableFqn + ">")));
    }
    // A table-scoped export must not reach another table's test cases through entityFQN.
    for (String endpoint : List.of("export", "exportAsync")) {
      assertBadRequest(
          exportPath(
              tableFqn, endpoint, "entityFQN=" + encode(otherTable.getFullyQualifiedName())));
    }
  }

  // Short names keep the generated test suite FQN within the 256 character column.
  private Table createTable(TestNamespace ns) {
    String shortId = ns.uniqueShortId();
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName("svc_" + shortId, ns);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName("s_" + shortId, ns, service);
    return TableTestFactory.createSimpleWithName(
        "t_" + shortId, ns, schema.getFullyQualifiedName());
  }

  private TestCase createTestCase(
      OpenMetadataClient client, String name, Table table, String column, TestCaseStatus status) {
    TestCaseBuilder builder = TestCaseBuilder.create(client).name(name);
    TestCase testCase =
        column == null
            ? builder
                .forTable(table)
                .testDefinition("tableRowCountToEqual")
                .parameter("value", "100")
                .create()
            : builder.forColumn(table, column).testDefinition("columnValuesToBeNotNull").create();
    CreateTestCaseResult result = new CreateTestCaseResult();
    result.setTimestamp(System.currentTimeMillis());
    result.setTestCaseStatus(status);
    result.setResult(status.value());
    client.testCaseResults().create(testCase.getFullyQualifiedName(), result);
    return testCase;
  }

  // Filtered exports resolve matches through search, so wait for the documents and their latest
  // result status to land before exporting.
  private void awaitIndexed(String tableFqn, int total, int failed) {
    Awaitility.await("test cases and their results are indexed")
        .atMost(SEARCH_CONVERGENCE_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              assertEquals(total, searchTotal(tableFqn, ""));
              assertEquals(failed, searchTotal(tableFqn, "&testCaseStatus=Failed"));
            });
  }

  private int searchTotal(String tableFqn, String extraQuery) throws Exception {
    String path =
        TEST_CASES_PATH
            + "/search/list?limit=0&includeAllTests=true&entityLink="
            + encode("<#E::table::" + tableFqn + ">")
            + extraQuery;
    HttpResponse<String> response = CLIENT.request("GET", path, null);
    assertEquals(200, response.statusCode(), response.body());
    return MAPPER.readTree(response.body()).path("paging").path("total").asInt();
  }

  /** Exports through both endpoints, asserts they agree, and returns the test case names seen. */
  private Set<String> exportedNames(String tableFqn, String query, Set<String> candidates)
      throws Exception {
    HttpResponse<String> sync = CLIENT.request("GET", exportPath(tableFqn, "export", query), null);
    assertEquals(200, sync.statusCode(), sync.body());

    String jobId = CLIENT.startExport(exportPath(tableFqn, "exportAsync", query));
    CLIENT.awaitJobStatus(jobId, "COMPLETED");
    HttpResponse<String> async = CLIENT.downloadResult(jobId);
    assertEquals(200, async.statusCode(), async.body());

    Set<String> syncNames = namesIn(sync.body(), candidates);
    assertEquals(
        syncNames,
        namesIn(async.body(), candidates),
        "export and exportAsync must return the same rows for '" + query + "'");
    return syncNames;
  }

  private Set<String> namesIn(String csv, Set<String> candidates) {
    List<String> rows = Arrays.asList(csv.split("\n"));
    Set<String> found =
        candidates.stream()
            .filter(name -> rows.stream().skip(1).anyMatch(row -> row.contains(name)))
            .collect(Collectors.toSet());
    long matchingRows =
        rows.stream().skip(1).filter(row -> candidates.stream().anyMatch(row::contains)).count();
    assertEquals(found.size(), matchingRows, "Each test case must be exported at most once");
    return found;
  }

  private void assertBadRequest(String path) throws Exception {
    HttpResponse<String> response = CLIENT.request("GET", path, null);
    assertTrue(
        response.statusCode() == 400,
        "Expected 400 for " + path + " but got " + response.statusCode() + ": " + response.body());
  }

  private static String exportPath(String name, String endpoint, String query) {
    String path = TEST_CASES_PATH + "/name/" + encode(name) + "/" + endpoint;
    return query.isEmpty() ? path : path + "?" + query;
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
  }
}
