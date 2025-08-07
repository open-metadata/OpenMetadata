package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.AwsConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;

/**
 * Basic construction tests for OpenSearch client with different auth paths.
 * These tests verify that the client can be created successfully when
 * - Basic auth is configured
 * - IAM (SigV4) auth is enabled with region
 * - No auth is configured
 *
 * We do not perform network calls; construction should not contact the cluster.
 */
public class OpenSearchClientIamAuthTest {

  private ElasticSearchConfiguration baseConfig() {
    ElasticSearchConfiguration cfg = new ElasticSearchConfiguration();
    cfg.setHost("localhost");
    cfg.setPort(9200);
    cfg.setScheme("http");
    cfg.setConnectionTimeoutSecs(5);
    cfg.setSocketTimeoutSecs(5);
    cfg.setBatchSize(10);
    return cfg;
  }

  @Test
  @DisplayName("Creates client with IAM (SigV4) auth when region provided")
  void createsClientWithIamAuth() {
    ElasticSearchConfiguration cfg = baseConfig();
    AwsConfiguration aws = new AwsConfiguration();
    aws.setUseIamAuth(true);
    aws.setRegion("us-east-1");
    aws.setServiceName("es");
    cfg.setAws(aws);

    OpenSearchClient client = new OpenSearchClient(cfg);
    assertNotNull(client.getHighLevelClient(), "Expected non-null OpenSearch client with IAM auth");
  }

  @Test
  @DisplayName("Creates client with basic auth when username/password provided")
  void createsClientWithBasicAuth() {
    ElasticSearchConfiguration cfg = baseConfig();
    cfg.setUsername("test-user");
    cfg.setPassword("test-password");

    OpenSearchClient client = new OpenSearchClient(cfg);
    assertNotNull(
        client.getHighLevelClient(), "Expected non-null OpenSearch client with basic auth");
  }

  @Test
  @DisplayName("Creates client without auth when none configured")
  void createsClientWithoutAuth() {
    ElasticSearchConfiguration cfg = baseConfig();
    OpenSearchClient client = new OpenSearchClient(cfg);
    assertNotNull(client.getHighLevelClient(), "Expected non-null OpenSearch client without auth");
  }

  @Test
  @DisplayName("Creates client when IAM enabled but region missing (falls back)")
  void createsClientWithIamAuthMissingRegion() {
    ElasticSearchConfiguration cfg = baseConfig();
    AwsConfiguration aws = new AwsConfiguration();
    aws.setUseIamAuth(true);
    // Intentionally no region
    cfg.setAws(aws);
    OpenSearchClient client = new OpenSearchClient(cfg);
    assertNotNull(client.getHighLevelClient(), "Expected client creation even if region missing");
  }
}
