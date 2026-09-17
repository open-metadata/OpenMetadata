package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * A logical test suite without test cases must survive a Search Indexing run. The test suite DAO
 * drops empty suites unless {@code includeEmptyTestSuites=true}, so the reindex left them out of
 * the rebuilt index; the next update to such a suite recreated its doc from an upsert (#33492).
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class TestSuiteReindexIT {

  private static final String TEST_SUITE_INDEX = "openmetadata_test_suite_search_index";
  private static final Set<String> SUCCESS_STATUSES = Set.of("success", "completed");

  private static ServerHandle server;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
  }

  @Test
  void reindexKeepsLogicalTestSuiteWithoutTestCases(TestNamespace ns) throws Exception {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");
    TestSuite emptySuite =
        SdkClients.adminClient()
            .testSuites()
            .create(new CreateTestSuite().withName(ns.prefix("empty_logical_suite")));

    reindexTestSuites();

    try (Rest5Client searchClient = TestSuiteBootstrap.createSearchClient()) {
      Awaitility.await("empty logical suite present in the promoted test suite index")
          .atMost(Duration.ofMinutes(2))
          .pollInterval(Duration.ofSeconds(2))
          .ignoreExceptions()
          .untilAsserted(() -> assertEquals(1, countDocsWithId(searchClient, emptySuite.getId())));
    }
  }

  private static void reindexTestSuites() {
    long triggeredAt = System.currentTimeMillis();
    ReindexHelpers.triggerSearchIndexWithConfigWhenIdle(
        server, Map.of("entities", List.of(Entity.TEST_SUITE)), Duration.ofMinutes(2));
    Awaitility.await("test suite reindex completion")
        .atMost(ReindexHelpers.reindexTimeout())
        .pollInterval(Duration.ofSeconds(5))
        .until(
            () ->
                ReindexHelpers.freshRunIsTerminal(
                    server, ReindexHelpers.SEARCH_INDEX_APP, triggeredAt));
    String status = ReindexHelpers.latestRunStatus(server, ReindexHelpers.SEARCH_INDEX_APP);
    assertTrue(SUCCESS_STATUSES.contains(status), "test suite reindex ended with " + status);
  }

  private static int countDocsWithId(Rest5Client searchClient, UUID id) throws Exception {
    searchClient.performRequest(new Request("POST", "/" + TEST_SUITE_INDEX + "/_refresh"));
    Request request = new Request("POST", "/" + TEST_SUITE_INDEX + "/_count");
    request.setJsonEntity("{\"query\": {\"term\": {\"_id\": \"%s\"}}}".formatted(id));
    String body =
        new String(
            searchClient.performRequest(request).getEntity().getContent().readAllBytes(),
            StandardCharsets.UTF_8);
    return JsonUtils.readTree(body).path("count").asInt();
  }
}
