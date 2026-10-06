package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * The data quality lineage endpoint behind the "upstream failure" icon: an upstream asset is
 * returned when one of its test cases currently fails, however many test cases the instance has.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class DataQualityLineageIT {

  private static final Duration SEARCH_TIMEOUT = Duration.ofSeconds(120);
  private static final int BUSIER_TEST_CASES = 101;
  private static final long MINUTE = 60_000L;

  private final OpenMetadataClient client = SdkClients.adminClient();

  @Test
  void upstreamFailureIsFoundWhenOtherTestCasesHaveMoreResults(TestNamespace ns) throws Exception {
    // The old lookup grouped every result in the instance and kept the 100 test cases with the
    // most results before filtering to the asset, so a quiet failing test was dropped.
    createBusierTestCases(ns);
    Table upstream = ShortStackFactory.table(ns);
    Table downstream = ShortStackFactory.table(ns);
    addLineage(upstream, downstream);
    postResult(columnTest(ns, upstream, "failing_column"), now(), TestCaseStatus.Failed);

    awaitFailingNodes(downstream, 1, Set.of(upstream));
  }

  @Test
  void aNewerPassingRunClearsTheUpstreamFailure(TestNamespace ns) {
    Table upstream = ShortStackFactory.table(ns);
    Table downstream = ShortStackFactory.table(ns);
    addLineage(upstream, downstream);
    TestCase test = tableTest(ns, upstream, "recovered");
    postResult(test, now() - MINUTE, TestCaseStatus.Failed);
    awaitFailingNodes(downstream, 1, Set.of(upstream));

    postResult(test, now(), TestCaseStatus.Success);

    awaitFailingNodes(downstream, 1, Set.of());
  }

  @Test
  void aSoftDeletedFailingTestIsIgnored(TestNamespace ns) {
    Table upstream = ShortStackFactory.table(ns);
    Table downstream = ShortStackFactory.table(ns);
    addLineage(upstream, downstream);
    TestCase test = tableTest(ns, upstream, "soft_deleted");
    postResult(test, now(), TestCaseStatus.Failed);
    awaitFailingNodes(downstream, 1, Set.of(upstream));

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/dataQuality/testCases/" + test.getId(),
            null,
            RequestOptions.builder()
                .queryParam("hardDelete", "false")
                .queryParam("recursive", "true")
                .build());

    awaitFailingNodes(downstream, 1, Set.of());
  }

  @Test
  void theAssetsOwnFailureIsReportedAsItself(TestNamespace ns) {
    Table upstream = ShortStackFactory.table(ns);
    Table downstream = ShortStackFactory.table(ns);
    addLineage(upstream, downstream);
    postResult(tableTest(ns, downstream, "own_failure"), now(), TestCaseStatus.Failed);

    awaitFailingNodes(downstream, 1, Set.of(downstream));
  }

  @Test
  void onlyTheRequestedUpstreamDepthIsChecked(TestNamespace ns) {
    Table grandparent = ShortStackFactory.table(ns);
    Table parent = ShortStackFactory.table(ns);
    Table child = ShortStackFactory.table(ns);
    addLineage(grandparent, parent);
    addLineage(parent, child);
    postResult(tableTest(ns, grandparent, "two_hops_up"), now(), TestCaseStatus.Failed);

    awaitFailingNodes(child, 2, Set.of(grandparent));
    assertEquals(Set.of(), failingNodeFqns(child, 1));
  }

  @Test
  void aMixedCaseTableNameIsMatched(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    Table upstream =
        TableTestFactory.createSimpleWithName(
            "Mixed_Case_" + ns.uniqueShortId(),
            ns,
            anchor.getDatabaseSchema().getFullyQualifiedName());
    Table downstream = ShortStackFactory.table(ns);
    addLineage(upstream, downstream);
    postResult(tableTest(ns, upstream, "mixed_case"), now(), TestCaseStatus.Failed);

    awaitFailingNodes(downstream, 1, Set.of(upstream));
  }

  @Test
  void aLineageLookupDoesNotReplaceTheRegisteredRepositories(TestNamespace ns) {
    assumeTrue(
        !OssTestServer.isExternalMode(), "Reads the server's repository registry in this JVM");
    Table upstream = ShortStackFactory.table(ns);
    Table downstream = ShortStackFactory.table(ns);
    addLineage(upstream, downstream);
    EntityRepository<?> before = Entity.getEntityRepository(Entity.TEST_CASE);

    failingNodeFqns(downstream, 3);

    assertSame(before, Entity.getEntityRepository(Entity.TEST_CASE));
  }

  private void awaitFailingNodes(Table start, int upstreamDepth, Set<Table> expectedFailing) {
    await()
        .atMost(SEARCH_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> assertEquals(fqns(expectedFailing), failingNodeFqns(start, upstreamDepth)));
  }

  private Set<String> failingNodeFqns(Table start, int upstreamDepth) {
    JsonNode response = dataQualityLineage(start, upstreamDepth);
    Set<String> names = new HashSet<>();
    response.path("nodes").forEach(node -> names.add(node.path("fullyQualifiedName").asText()));
    return names;
  }

  private JsonNode dataQualityLineage(Table start, int upstreamDepth) {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/lineage/getDataQualityLineage",
                null,
                RequestOptions.builder()
                    .queryParam("fqn", start.getFullyQualifiedName())
                    .queryParam("upstreamDepth", String.valueOf(upstreamDepth))
                    .queryParam("includeDeleted", "false")
                    .build());
    return JsonUtils.readTree(response);
  }

  private static Set<String> fqns(Set<Table> tables) {
    Set<String> names = new HashSet<>();
    tables.forEach(table -> names.add(table.getFullyQualifiedName()));
    return names;
  }

  private void addLineage(Table from, Table to) {
    AddLineage lineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(from.getEntityReference())
                    .withToEntity(to.getEntityReference()));
    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              client.lineage().addLineage(lineage);
              return true;
            });
  }

  private TestCase tableTest(TestNamespace ns, Table table, String name) {
    return TestCaseBuilder.create(client)
        .name(ns.prefix(name))
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .create();
  }

  private TestCase columnTest(TestNamespace ns, Table table, String name) {
    return TestCaseBuilder.create(client)
        .name(ns.prefix(name))
        .forColumn(table, "id")
        .testDefinition("columnValuesToBeNotNull")
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

  /** Test cases with two results each, so they outrank a test case with a single result. */
  private void createBusierTestCases(TestNamespace ns) throws Exception {
    Table noise = ShortStackFactory.table(ns);
    long start = now() - 10 * MINUTE;
    // The first test case creates the table's test suite; creating it from parallel requests races.
    createBusierTestCase(ns, noise, 0, start);
    ExecutorService pool = Executors.newFixedThreadPool(8);
    try {
      List<Future<?>> writes =
          IntStream.range(1, BUSIER_TEST_CASES)
              .<Future<?>>mapToObj(
                  i -> pool.submit(() -> createBusierTestCase(ns, noise, i, start)))
              .toList();
      for (Future<?> write : writes) {
        write.get();
      }
    } finally {
      pool.shutdown();
    }
  }

  private void createBusierTestCase(TestNamespace ns, Table table, int index, long start) {
    TestCase test = tableTest(ns, table, "busier_" + index);
    postResult(test, start, TestCaseStatus.Success);
    postResult(test, start + MINUTE, TestCaseStatus.Success);
  }

  private static long now() {
    return System.currentTimeMillis();
  }
}
