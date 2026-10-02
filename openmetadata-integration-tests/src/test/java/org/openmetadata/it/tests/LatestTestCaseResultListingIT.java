package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.Consumer;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * "Latest record per test case" listings (a table's latest results, its incidents) must return
 * every test case of the requested table, however many test cases the rest of the instance has,
 * and filters on the latest record must still apply to the latest record only.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class LatestTestCaseResultListingIT {

  private static final Duration SEARCH_TIMEOUT = Duration.ofSeconds(120);
  private static final int BUSIER_TEST_CASES = 101;
  private static final long MINUTE = 60_000L;
  private static final String RESULTS = "/v1/dataQuality/testCases/testCaseResults/search/list";
  private static final String INCIDENTS =
      "/v1/dataQuality/testCases/testCaseIncidentStatus/search/list";

  private final OpenMetadataClient client = SdkClients.adminClient();

  @Test
  void aTablesLatestResultsIncludeTestCasesBeyondTheBusiest100(TestNamespace ns) throws Exception {
    // Grouping used to run over the whole index and keep the 100 test cases with the most
    // results before filtering to the table, so a quiet test case was left out.
    Table noise = ShortStackFactory.table(ns);
    forEachBusierTestCase(
        ns,
        noise,
        test -> {
          postResult(test, now() - 10 * MINUTE, TestCaseStatus.Success);
          postResult(test, now() - 9 * MINUTE, TestCaseStatus.Success);
        });
    Table table = ShortStackFactory.table(ns);
    TestCase quiet = tableTest(ns, table, "quiet");
    postResult(quiet, now(), TestCaseStatus.Failed);

    awaitListed(
        RESULTS,
        Map.of("latest", "true", "entityFQN", table.getFullyQualifiedName(), "limit", "0"),
        "testCaseFQN",
        Set.of(quiet.getFullyQualifiedName()));
  }

  @Test
  void aStatusFilterStillAppliesToTheLatestResultOnly(TestNamespace ns) {
    Table table = ShortStackFactory.table(ns);
    TestCase recovered = tableTest(ns, table, "recovered");
    TestCase failing = tableTest(ns, table, "failing");
    postResult(recovered, now() - MINUTE, TestCaseStatus.Failed);
    postResult(recovered, now(), TestCaseStatus.Success);
    postResult(failing, now(), TestCaseStatus.Failed);

    awaitListed(
        RESULTS,
        Map.of(
            "latest", "true",
            "entityFQN", table.getFullyQualifiedName(),
            "testCaseStatus", "Failed",
            "limit", "10"),
        "testCaseFQN",
        Set.of(failing.getFullyQualifiedName()));
  }

  @Test
  void aTestCaseRemovedFromALogicalSuiteIsNoLongerListedUnderIt(TestNamespace ns) {
    Table table = ShortStackFactory.table(ns);
    TestCase stays = tableTest(ns, table, "stays");
    TestCase leaves = tableTest(ns, table, "leaves");
    TestSuite suite =
        client.testSuites().create(new CreateTestSuite().withName(ns.prefix("logical")));
    changeLogicalSuite(HttpMethod.PUT, "", suite, List.of(stays, leaves));
    postResult(stays, now() - MINUTE, TestCaseStatus.Success);
    postResult(leaves, now() - MINUTE, TestCaseStatus.Success);

    changeLogicalSuite(HttpMethod.POST, "/bulk/remove", suite, List.of(leaves));
    postResult(leaves, now(), TestCaseStatus.Success);

    awaitListed(
        RESULTS,
        Map.of("latest", "true", "testSuiteId", suite.getId().toString(), "limit", "10"),
        "testCaseFQN",
        Set.of(stays.getFullyQualifiedName()));
  }

  @Test
  void aTablesIncidentsIncludeTestCasesBeyondTheBusiest100(TestNamespace ns) throws Exception {
    // The asset summary panel counts incidents with latest=true&limit=0 and the table's FQN.
    Table noise = ShortStackFactory.table(ns);
    forEachBusierTestCase(
        ns,
        noise,
        test -> {
          openIncident(test, TestCaseResolutionStatusTypes.New);
          openIncident(test, TestCaseResolutionStatusTypes.Ack);
        });
    Table table = ShortStackFactory.table(ns);
    TestCase quiet = tableTest(ns, table, "quiet_incident");
    openIncident(quiet, TestCaseResolutionStatusTypes.New);

    awaitListed(
        INCIDENTS,
        Map.of("latest", "true", "originEntityFQN", table.getFullyQualifiedName(), "limit", "0"),
        "testCaseReference.fullyQualifiedName",
        Set.of(quiet.getFullyQualifiedName()));
  }

  private void awaitListed(
      String path, Map<String, String> params, String fqnField, Set<String> expected) {
    await()
        .atMost(SEARCH_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(() -> assertEquals(expected, listedFqns(path, params, fqnField)));
  }

  private Set<String> listedFqns(String path, Map<String, String> params, String fqnField) {
    RequestOptions.Builder options = RequestOptions.builder();
    params.forEach(options::queryParam);
    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, path, null, options.build());
    Set<String> fqns = new HashSet<>();
    String pointer = "/" + fqnField.replace('.', '/');
    for (JsonNode record : JsonUtils.readTree(response).path("data")) {
      JsonNode fqn = record.at(pointer);
      fqns.add(fqn.isMissingNode() ? record.path("testCaseFQN").asText() : fqn.asText());
    }
    return fqns;
  }

  private void changeLogicalSuite(
      HttpMethod method, String suffix, TestSuite suite, List<TestCase> tests) {
    client
        .getHttpClient()
        .executeForString(
            method,
            "/v1/dataQuality/testCases/logicalTestCases" + suffix,
            Map.of(
                "testSuiteId",
                suite.getId().toString(),
                "testCaseIds",
                tests.stream().map(test -> test.getId().toString()).toList()),
            RequestOptions.builder().build());
  }

  private void openIncident(TestCase test, TestCaseResolutionStatusTypes type) {
    client
        .testCaseResolutionStatuses()
        .create(
            new CreateTestCaseResolutionStatus()
                .withTestCaseResolutionStatusType(type)
                .withTestCaseReference(test.getFullyQualifiedName())
                .withSeverity(Severity.Severity2));
  }

  private TestCase tableTest(TestNamespace ns, Table table, String name) {
    return TestCaseBuilder.create(client)
        .name(ns.prefix(name))
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .create();
  }

  private void postResult(TestCase test, long timestamp, TestCaseStatus status) {
    client
        .testCaseResults()
        .create(
            test.getFullyQualifiedName(),
            new CreateTestCaseResult()
                .withTimestamp(timestamp)
                .withTestCaseStatus(status)
                .withResult(status.value()));
  }

  /** Creates test cases that each get two records, so they outrank one with a single record. */
  private void forEachBusierTestCase(TestNamespace ns, Table table, Consumer<TestCase> records)
      throws Exception {
    // The first test case creates the table's test suite; creating it from parallel requests races.
    records.accept(tableTest(ns, table, "busier_0"));
    ExecutorService pool = Executors.newFixedThreadPool(8);
    try {
      List<Future<?>> writes =
          IntStream.range(1, BUSIER_TEST_CASES)
              .<Future<?>>mapToObj(
                  i -> pool.submit(() -> records.accept(tableTest(ns, table, "busier_" + i))))
              .toList();
      for (Future<?> write : writes) {
        write.get();
      }
    } finally {
      pool.shutdown();
    }
  }

  private static long now() {
    return System.currentTimeMillis();
  }
}
