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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.StringReader;
import java.net.URLEncoder;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeEach;
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
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateLogicalTestCases;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

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

  private OpenMetadataClient exportClient;

  @BeforeEach
  void createExportCaller(TestNamespace ns) {
    // Export retention is capped per user; sharing admin lets concurrent tests evict our result.
    String name = "export_caller_" + ns.uniqueShortId();
    String email = name + "@example.com";
    ns.trackRoot(
        Entity.USER,
        SdkClients.adminClient()
            .users()
            .create(new CreateUser().withName(name).withEmail(email).withIsAdmin(true)));
    exportClient = SdkClients.createClient(email, email, new String[] {});
  }

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
    assertEquals(all, exportedNames(tableFqn, "testCaseStatus=Failed&testCaseStatus=Success", all));
    assertEquals(all, exportedNames(tableFqn, "testCaseStatus=Failed,Success", all));
    assertEquals(
        Set.of(failedColumn.getName()),
        exportedNames(tableFqn, "testCaseStatus=Failed&testCaseType=column", all));
    assertEquals(
        Set.of(failedColumn.getName()),
        exportedNames(tableFqn, "entityFQN=" + encode(tableFqn + ".id"), all));
    assertEquals(
        Set.of(failedColumn.getName()),
        exportedNames(tableFqn, "entityLink=" + encode(failedColumn.getEntityLink()), all));

    assertEquals(
        Set.of(successTable.getName()),
        exportedNames(tableFqn, "q=" + encode(successTable.getName()), all));
    assertEquals(
        all, exportedNames(tableFqn, "serviceName=" + encode(table.getService().getName()), all));
    assertEquals(Set.of(), exportedNames(tableFqn, "serviceName=no_such_service", all));
    assertEquals(Set.of(), exportedNames(tableFqn, "testPlatforms=dbt", all));
    long now = System.currentTimeMillis();
    assertEquals(
        all,
        exportedNames(
            tableFqn, "startTimestamp=" + (now - 3_600_000) + "&endTimestamp=" + now, all));
    assertEquals(Set.of(), exportedNames(tableFqn, "startTimestamp=0&endTimestamp=1", all));

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
  void test_exportMatchesInheritedOwnersTagsAndTier(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String ownerName = "exp_owner_" + ns.uniqueShortId();
    User owner =
        ns.trackRoot(
            Entity.USER,
            client
                .users()
                .create(
                    new CreateUser().withName(ownerName).withEmail(ownerName + "@example.com")));
    Table table = createTable(ns);
    table.setOwners(List.of(owner.getEntityReference()));
    table.setTags(List.of(classificationTag("PII.Sensitive"), classificationTag("Tier.Tier1")));
    table = client.tables().update(table.getId().toString(), table);
    TestCase testCase =
        createTestCase(
            client, "exp_owned_" + ns.uniqueShortId(), table, null, TestCaseStatus.Failed);
    Set<String> names = Set.of(testCase.getName());
    String tableFqn = table.getFullyQualifiedName();
    awaitIndexed(tableFqn, 1, 1);
    Awaitility.await("inherited metadata is searchable")
        .atMost(SEARCH_CONVERGENCE_TIMEOUT)
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertEquals(
                    1,
                    searchTotal(
                        tableFqn,
                        "&owner=" + encode(ownerName) + "&tags=PII.Sensitive&tier=Tier.Tier1")));

    assertEquals(names, exportedNames(tableFqn, "owner=" + encode(ownerName), names));
    assertEquals(Set.of(), exportedNames(tableFqn, "owner=admin", names));
    assertEquals(names, exportedNames(tableFqn, "tags=PII.Sensitive", names));
    assertEquals(Set.of(), exportedNames(tableFqn, "tags=PII.NonSensitive", names));
    assertEquals(names, exportedNames(tableFqn, "tier=Tier.Tier1", names));
    assertEquals(Set.of(), exportedNames(tableFqn, "tier=Tier.Tier2", names));
  }

  @Test
  void test_exportFiltersStayWithinSuiteScope(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);
    TestCase member =
        createTestCase(
            client, "exp_member_" + ns.uniqueShortId(), table, null, TestCaseStatus.Failed);
    TestCase nonMember =
        createTestCase(
            client, "exp_other_" + ns.uniqueShortId(), table, "id", TestCaseStatus.Failed);
    TestSuite suite =
        ns.trackRoot(
            Entity.TEST_SUITE,
            client
                .testSuites()
                .create(new CreateTestSuite().withName("exp_suite_" + ns.uniqueShortId())));
    client
        .testCases()
        .addToLogicalTestSuite(
            new CreateLogicalTestCases()
                .withTestSuiteId(suite.getId())
                .withTestCaseIds(List.of(member.getId())));
    awaitIndexed(table.getFullyQualifiedName(), 2, 2);
    Awaitility.await("suite membership is searchable")
        .atMost(SEARCH_CONVERGENCE_TIMEOUT)
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertEquals(
                    1,
                    searchTotal(table.getFullyQualifiedName(), "&testSuiteId=" + suite.getId())));

    Set<String> candidates = Set.of(member.getName(), nonMember.getName());
    assertEquals(
        Set.of(member.getName()),
        exportedNames(suite.getFullyQualifiedName(), "testCaseStatus=Failed", candidates));
    assertEquals(
        Set.of(), exportedNames(suite.getFullyQualifiedName(), "testCaseType=column", candidates));
    assertEquals(
        Set.of(member.getName()),
        exportedNames(
            member.getTestSuite().getFullyQualifiedName(), "testCaseType=table", candidates));
  }

  @Test
  void test_platformExportHonorsEntityFilterAndPagination(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);
    TestCase tableTest =
        createTestCase(
            client, "exp_platform_tbl_" + ns.uniqueShortId(), table, null, TestCaseStatus.Failed);
    TestCase columnTest =
        createTestCase(
            client, "exp_platform_col_" + ns.uniqueShortId(), table, "id", TestCaseStatus.Failed);
    awaitIndexed(table.getFullyQualifiedName(), 2, 2);
    String query = "entityFQN=" + encode(table.getFullyQualifiedName());
    Set<String> names = Set.of(tableTest.getName(), columnTest.getName());

    assertEquals(names, exportedNames("*", query, names));
    Set<String> first = exportedNames("*", query + "&limit=1&offset=0", names);
    Set<String> second = exportedNames("*", query + "&limit=1&offset=1", names);
    assertEquals(1, first.size());
    assertEquals(1, second.size());
    Set<String> union = new HashSet<>(first);
    union.addAll(second);
    assertEquals(names, union);
  }

  private static TagLabel classificationTag(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
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

    String jobId = startExport(exportPath(tableFqn, "exportAsync", "testCaseStatus=Failed"));
    JsonNode job = awaitExport(jobId);

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
      assertBadRequest(exportPath(tableFqn, endpoint, "startTimestamp=1"));
      assertBadRequest(exportPath(tableFqn, endpoint, "endTimestamp=1"));
      assertBadRequest(exportPath(tableFqn, endpoint, "startTimestamp=2&endTimestamp=1"));
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
    String sync = exportBody(exportPath(tableFqn, "export", query));

    String jobId = startExport(exportPath(tableFqn, "exportAsync", query));
    awaitExport(jobId);
    String async = exportBody("/v1/csvAsyncJobs/" + jobId + "/result");

    Set<String> syncNames = namesIn(sync, candidates);
    assertEquals(
        syncNames,
        namesIn(async, candidates),
        "export and exportAsync must return the same rows for '" + query + "'");
    return syncNames;
  }

  private Set<String> namesIn(String csv, Set<String> candidates) throws Exception {
    try (CSVParser parser =
        CSVFormat.DEFAULT.withFirstRecordAsHeader().parse(new StringReader(csv))) {
      List<String> names = parser.getRecords().stream().map(record -> record.get("name*")).toList();
      Set<String> found = new HashSet<>(names);
      assertEquals(found.size(), names.size(), "Each test case must be exported at most once");
      assertTrue(candidates.containsAll(found), "Export contains unexpected test cases: " + found);
      return found;
    }
  }

  private void assertBadRequest(String path) {
    OpenMetadataException exception =
        assertThrows(OpenMetadataException.class, () -> exportBody(path));
    assertEquals(400, exception.getStatusCode(), exception.getMessage());
  }

  private String exportBody(String path) {
    return exportClient.getHttpClient().executeForString(HttpMethod.GET, path, null);
  }

  private String startExport(String path) throws Exception {
    String jobId = MAPPER.readTree(exportBody(path)).path("jobId").asText();
    assertTrue(!jobId.isEmpty(), "Export must create a job");
    return jobId;
  }

  private JsonNode awaitExport(String jobId) throws Exception {
    return Awaitility.await("export " + jobId + " completes")
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> MAPPER.readTree(exportBody("/v1/csvAsyncJobs/" + jobId)),
            job -> "COMPLETED".equals(job.path("status").asText()));
  }

  private static String exportPath(String name, String endpoint, String query) {
    String path = TEST_CASES_PATH + "/name/" + encode(name) + "/" + endpoint;
    return query.isEmpty() ? path : path + "?" + query;
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
  }
}
