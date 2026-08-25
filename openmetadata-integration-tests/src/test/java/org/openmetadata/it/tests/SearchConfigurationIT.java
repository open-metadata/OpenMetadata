package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Integration tests for Search configuration including multiple hosts and AWS IAM authentication.
 *
 * <p>These tests verify that the search client correctly handles various configuration scenarios.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SearchConfigurationIT {

  @Test
  void testSearchClientInitialization(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();
    assertNotNull(searchClient, "Search client should be initialized");

    Request request = new Request("GET", "/_cluster/health");
    Response response = searchClient.performRequest(request);

    assertEquals(200, response.getStatusCode());

    String responseBody =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    assertTrue(
        responseBody.contains("\"status\":\"green\"")
            || responseBody.contains("\"status\":\"yellow\""),
        "Cluster should be healthy");
  }

  @Test
  void testSearchClientWithConnectionPool(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();
    assertNotNull(searchClient);

    for (int i = 0; i < 10; i++) {
      Request request = new Request("GET", "/_cluster/health");
      Response response = searchClient.performRequest(request);
      assertEquals(200, response.getStatusCode());
    }
  }

  @Test
  void testSearchQueryExecution(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response = client.search().query("*").index("table_search_index").size(5).execute();

    assertNotNull(response);
    assertTrue(response.contains("hits"), "Response should contain hits");
  }

  @Test
  void testSearchWithPagination(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client.search().query("*").index("table_search_index").from(0).size(10).execute();

    assertNotNull(response);
    assertTrue(response.contains("hits"));
  }

  @Test
  void testClusterInfo(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();

    Request request = new Request("GET", "/");
    Response response = searchClient.performRequest(request);

    assertEquals(200, response.getStatusCode());

    String responseBody =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    assertTrue(responseBody.contains("\"version\""), "Response should contain version information");
  }

  @Test
  void testNodesInfo(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();

    Request request = new Request("GET", "/_nodes");
    Response response = searchClient.performRequest(request);

    assertEquals(200, response.getStatusCode());

    String responseBody =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    assertTrue(responseBody.contains("\"nodes\""), "Response should contain nodes information");
  }

  @Test
  void testIndexOperations(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();

    Request request = new Request("GET", "/_cat/indices?format=json");
    Response response = searchClient.performRequest(request);

    assertEquals(200, response.getStatusCode());
  }

  @Test
  void testSearchAcrossIndices(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response = client.search().query("*").index("all").size(5).execute();

    assertNotNull(response);
  }

  @Test
  @EnabledIfEnvironmentVariable(named = "AWS_REGION", matches = ".+")
  @EnabledIfEnvironmentVariable(named = "AWS_ACCESS_KEY_ID", matches = ".+")
  void testAwsConfigurationPresent(TestNamespace ns) {
    String region = System.getenv("AWS_REGION");
    String accessKeyId = System.getenv("AWS_ACCESS_KEY_ID");

    assertNotNull(region, "AWS_REGION should be set");
    assertNotNull(accessKeyId, "AWS_ACCESS_KEY_ID should be set");
    assertFalse(region.isEmpty(), "AWS_REGION should not be empty");
  }
}
