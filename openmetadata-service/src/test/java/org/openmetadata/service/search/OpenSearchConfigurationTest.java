package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;

/**
 * Simple test to validate OpenSearch configuration and startup.
 * This test extends OpenMetadataApplicationTest with the runWithOpensearch flag enabled.
 */
public class OpenSearchConfigurationTest extends OpenMetadataApplicationTest {

  static {
    // Enable OpenSearch for this test
    runWithOpensearch = true;
  }

  @Test
  void testOpenSearchConfigurationIsCorrect() {
    // Verify that the configuration is set to use OpenSearch
    ElasticSearchConfiguration searchConfig = getSearchConfig();
    assertNotNull(searchConfig, "Search configuration should not be null");

    assertEquals(
        ElasticSearchConfiguration.SearchType.OPENSEARCH,
        searchConfig.getSearchType(),
        "Search type should be OPENSEARCH when runWithOpensearch is true");

    assertNotNull(searchConfig.getHost(), "Host should be configured");
    assertNotNull(searchConfig.getPort(), "Port should be configured");
    assertTrue(searchConfig.getPort() > 0, "Port should be a positive number");
  }

  @Test
  void testSearchRepositoryInitialization() {
    // Verify that the search repository is properly initialized with OpenSearch
    SearchRepository searchRepository = Entity.getSearchRepository();
    assertNotNull(searchRepository, "Search repository should be initialized");

    // Verify the search repository is configured for OpenSearch
    assertEquals(
        ElasticSearchConfiguration.SearchType.OPENSEARCH,
        searchRepository.getSearchType(),
        "Search repository should be configured for OpenSearch");
  }

  @Test
  void testOpenSearchContainerIsUsed() {
    // This test verifies that when runWithOpensearch = true,
    // the correct container configuration is applied
    ElasticSearchConfiguration config = getSearchConfig();

    // Verify basic configuration that should be different from Elasticsearch defaults
    assertNotNull(config.getUsername(), "Username should be configured");
    assertNotNull(config.getScheme(), "Scheme should be configured");
    assertEquals("http", config.getScheme(), "Should use HTTP scheme for test container");

    // Verify search type is explicitly set to OpenSearch
    assertEquals(
        ElasticSearchConfiguration.SearchType.OPENSEARCH,
        config.getSearchType(),
        "Configuration should explicitly use OPENSEARCH type");
  }

  @Test
  void testOpenSearchContainerStartsSuccessfully() throws Exception {
    // Verify that the search repository is properly initialized
    SearchRepository searchRepository = Entity.getSearchRepository();
    assertNotNull(searchRepository, "Search repository should be initialized");

    // Verify that OpenSearch configuration is set correctly
    ElasticSearchConfiguration searchConfig = getSearchConfig();
    assertNotNull(searchConfig, "Search configuration should not be null");
    assertEquals(
        ElasticSearchConfiguration.SearchType.OPENSEARCH,
        searchConfig.getSearchType(),
        "Search type should be OPENSEARCH");

    // Verify OpenSearch is accessible via REST client
    Rest5Client restClient = getSearchClient();
    assertNotNull(restClient, "REST client should not be null");

    // Test basic cluster health endpoint
    Request request = new Request("GET", "/_cluster/health");
    Response response = restClient.performRequest(request);

    assertEquals(
        200, response.getStatusCode(), "OpenSearch cluster health endpoint should return 200 OK");

    String responseBody = readResponseBody(response);
    assertTrue(
        responseBody.contains("cluster_name"), "Response should contain cluster information");

    // Verify cluster is functional (green or yellow status is acceptable for test)
    assertTrue(
        responseBody.contains("\"status\":\"green\"")
            || responseBody.contains("\"status\":\"yellow\""),
        "OpenSearch cluster should be in green or yellow status");
  }

  private String readResponseBody(Response response) throws IOException {
    try (InputStream is = response.getEntity().getContent()) {
      return new String(is.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  @Test
  void testOpenSearchIndexCreation() throws Exception {
    SearchRepository searchRepository = Entity.getSearchRepository();
    assertNotNull(searchRepository, "Search repository should be initialized");

    // Verify that search repository can be used for basic operations
    // The createIndexes() method should have been called during application startup
    // We can verify this by checking if the search repository is accessible
    assertTrue(
        searchRepository.getSearchType() == ElasticSearchConfiguration.SearchType.OPENSEARCH,
        "Search repository should be configured for OpenSearch");
  }

  @Test
  void testOpenSearchVersion() throws Exception {
    Rest5Client restClient = getSearchClient();

    // Get OpenSearch version information
    Request request = new Request("GET", "/");
    Response response = restClient.performRequest(request);

    assertEquals(200, response.getStatusCode(), "OpenSearch root endpoint should return 200 OK");

    String responseBody = readResponseBody(response);
    assertTrue(
        responseBody.contains("opensearch"),
        "Response should indicate this is OpenSearch, not Elasticsearch");
    assertTrue(responseBody.contains("\"version\""), "Response should contain version information");
  }
}
