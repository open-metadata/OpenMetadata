package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.AwsConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;

class SearchClientConfigurationTest {

  @Test
  void testValidSingleHostConfiguration() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("localhost");
    config.setPort(9200);
    config.setScheme("http");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);
    config.setSearchType(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);

    assertDoesNotThrow(() -> validateConfiguration(config));
  }

  @Test
  void testValidMultipleHostsConfiguration() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("es-node1:9200,es-node2:9200,es-node3:9200");
    config.setScheme("http");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);
    config.setSearchType(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);

    assertDoesNotThrow(() -> validateConfiguration(config));
  }

  @Test
  void testValidAwsOpenSearchConfiguration() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("vpc-my-domain.us-east-1.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);
    config.setSearchType(ElasticSearchConfiguration.SearchType.OPENSEARCH);

    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setEnabled(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setServiceName("es");
    config.setAws(awsConfig);

    assertDoesNotThrow(() -> validateConfiguration(config));
    assertTrue(config.getAws().getEnabled());
    assertEquals("us-east-1", config.getAws().getRegion());
  }

  @Test
  void testValidAwsOpenSearchServerlessConfiguration() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("abc123.us-east-1.aoss.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);
    config.setSearchType(ElasticSearchConfiguration.SearchType.OPENSEARCH);

    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setEnabled(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setServiceName("aoss");
    config.setAws(awsConfig);

    assertDoesNotThrow(() -> validateConfiguration(config));
    assertTrue(config.getAws().getEnabled());
    assertEquals("aoss", config.getAws().getServiceName());
  }

  @Test
  void testValidBasicAuthConfiguration() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("localhost");
    config.setPort(9200);
    config.setScheme("http");
    config.setUsername("admin");
    config.setPassword("admin123");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);
    config.setSearchType(ElasticSearchConfiguration.SearchType.OPENSEARCH);

    assertDoesNotThrow(() -> validateConfiguration(config));
    assertEquals("admin", config.getUsername());
  }

  @Test
  void testAwsIamAuthDisabledByDefault() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("vpc-my-domain.us-east-1.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);
    config.setSearchType(ElasticSearchConfiguration.SearchType.OPENSEARCH);

    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setRegion("us-east-1");
    awsConfig.setServiceName("es");
    config.setAws(awsConfig);

    assertDoesNotThrow(() -> validateConfiguration(config));
    assertFalse(
        Boolean.TRUE.equals(config.getAws().getEnabled()),
        "IAM auth should be disabled by default for backward compatibility");
  }

  @Test
  void testInvalidConfigurationMissingHost() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setPort(9200);
    config.setScheme("http");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    assertThrows(IllegalArgumentException.class, () -> validateConfiguration(config));
  }

  @Test
  void testInvalidConfigurationEmptyHost() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("");
    config.setPort(9200);
    config.setScheme("http");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    assertThrows(IllegalArgumentException.class, () -> validateConfiguration(config));
  }

  @Test
  void testAwsConfigWithStaticCredentials() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("vpc-my-domain.us-east-1.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);
    config.setSearchType(ElasticSearchConfiguration.SearchType.OPENSEARCH);

    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setEnabled(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    awsConfig.setServiceName("es");
    config.setAws(awsConfig);

    assertDoesNotThrow(() -> validateConfiguration(config));
    assertNotNull(config.getAws().getAccessKeyId());
    assertNotNull(config.getAws().getSecretAccessKey());
  }

  @Test
  void testAwsConfigWithSessionToken() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("vpc-my-domain.us-east-1.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);
    config.setSearchType(ElasticSearchConfiguration.SearchType.OPENSEARCH);

    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setEnabled(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    awsConfig.setSessionToken("FwoGZXIvYXdzEBYaDKT...");
    awsConfig.setServiceName("es");
    config.setAws(awsConfig);

    assertDoesNotThrow(() -> validateConfiguration(config));
    assertNotNull(config.getAws().getSessionToken());
  }

  @Test
  void testConnectionPoolConfiguration() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("localhost");
    config.setPort(9200);
    config.setScheme("http");
    config.setConnectionTimeoutSecs(10);
    config.setSocketTimeoutSecs(120);
    config.setMaxConnTotal(50);
    config.setMaxConnPerRoute(20);
    config.setKeepAliveTimeoutSecs(600);
    config.setSearchType(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);

    assertDoesNotThrow(() -> validateConfiguration(config));
    assertEquals(50, config.getMaxConnTotal());
    assertEquals(20, config.getMaxConnPerRoute());
    assertEquals(600, config.getKeepAliveTimeoutSecs());
  }

  @Test
  void testMultipleHostsWithConnectionPool() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("es-node1:9200,es-node2:9200,es-node3:9200");
    config.setScheme("http");
    config.setConnectionTimeoutSecs(10);
    config.setSocketTimeoutSecs(120);
    config.setMaxConnTotal(90);
    config.setMaxConnPerRoute(30);
    config.setSearchType(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);

    assertDoesNotThrow(() -> validateConfiguration(config));
    assertEquals(90, config.getMaxConnTotal());
    assertEquals(30, config.getMaxConnPerRoute());
  }

  private void validateConfiguration(ElasticSearchConfiguration config) {
    if (config.getHost() == null || config.getHost().isEmpty()) {
      throw new IllegalArgumentException("'host' must be provided in configuration");
    }
    if (config.getScheme() == null || config.getScheme().isEmpty()) {
      throw new IllegalArgumentException("'scheme' must be provided in configuration");
    }
  }
}
