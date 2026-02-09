package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.AwsConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.util.AwsCredentialsUtil;

/** Tests for OpenSearch client transport selection logic based on IAM auth configuration. */
class OpenSearchClientTransportTest {

  @Test
  void testIamAuthEnabledDetection() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setEnabled(true);
    awsConfig.setRegion("us-east-2");

    assertTrue(
        AwsCredentialsUtil.isAwsIamAuthEnabled(awsConfig),
        "IAM auth should be enabled when aws.enabled=true and region is set");
  }

  @Test
  void testIamAuthDisabledWhenAwsConfigNull() {
    assertFalse(
        AwsCredentialsUtil.isAwsIamAuthEnabled(null),
        "IAM auth should be disabled when aws config is null");
  }

  @Test
  void testIamAuthDisabledWhenEnabledFalse() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setEnabled(false);
    awsConfig.setRegion("us-east-1");

    assertFalse(
        AwsCredentialsUtil.isAwsIamAuthEnabled(awsConfig),
        "IAM auth should be disabled when aws.enabled=false");
  }

  @Test
  void testIamAuthDisabledWhenRegionNotSet() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setEnabled(true);
    // Region not set

    assertFalse(
        AwsCredentialsUtil.isAwsIamAuthEnabled(awsConfig),
        "IAM auth should be disabled when region is not set");
  }

  @Test
  void testAwsConfigServiceNameDefaultsToEs() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    // serviceName defaults to "es" as per schema

    assertEquals("es", awsConfig.getServiceName(), "Service name should default to 'es'");
  }

  @Test
  void testAwsConfigServiceNameForServerless() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setServiceName("aoss");

    assertEquals(
        "aoss",
        awsConfig.getServiceName(),
        "Service name should be 'aoss' for OpenSearch Serverless");
  }

  @Test
  void testHostUrlParsingHttps() {
    String host = "https://vpc-test.us-east-2.es.amazonaws.com";

    String parsedHost = OpenSearchClient.parseHostForAwsSdk2Transport(host);

    assertEquals(
        "vpc-test.us-east-2.es.amazonaws.com",
        parsedHost,
        "Host should be stripped of https:// prefix");
  }

  @Test
  void testHostUrlParsingWithTrailingSlash() {
    String host = "https://vpc-test.us-east-2.es.amazonaws.com/";

    String parsedHost = OpenSearchClient.parseHostForAwsSdk2Transport(host);

    assertEquals(
        "vpc-test.us-east-2.es.amazonaws.com",
        parsedHost,
        "Host should be stripped of protocol prefix and trailing slash");
  }

  @Test
  void testHostUrlParsingHttp() {
    String host = "http://localhost:9200";

    String parsedHost = OpenSearchClient.parseHostForAwsSdk2Transport(host);

    assertEquals("localhost", parsedHost, "Host should be stripped of http:// prefix and port");
  }

  @Test
  void testHostUrlParsingNoProtocol() {
    String host = "vpc-test.us-east-2.es.amazonaws.com";

    String parsedHost = OpenSearchClient.parseHostForAwsSdk2Transport(host);

    assertEquals(
        "vpc-test.us-east-2.es.amazonaws.com",
        parsedHost,
        "Host without protocol should be unchanged");
  }

  @Test
  void testHostUrlParsingNull() {
    String parsedHost = OpenSearchClient.parseHostForAwsSdk2Transport(null);

    assertNull(parsedHost, "Null host should return null");
  }

  @Test
  void testElasticSearchConfigWithIamAuth() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("https://vpc-test.us-east-2.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");

    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setEnabled(true);
    awsConfig.setRegion("us-east-2");
    config.setAws(awsConfig);

    assertTrue(
        AwsCredentialsUtil.isAwsIamAuthEnabled(config.getAws()),
        "IAM auth should be enabled with proper config");
    assertEquals("us-east-2", config.getAws().getRegion());
  }

  @Test
  void testElasticSearchConfigWithBasicAuth() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("https://localhost");
    config.setPort(9200);
    config.setScheme("https");
    config.setUsername("admin");
    config.setPassword("admin");

    assertFalse(
        AwsCredentialsUtil.isAwsIamAuthEnabled(config.getAws()),
        "IAM auth should be disabled when aws config is not set");
    assertEquals("admin", config.getUsername());
  }

  @Test
  void testElasticSearchConfigWithBothAuthMethods() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("https://vpc-test.us-east-2.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setUsername("admin");
    config.setPassword("admin");

    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setEnabled(true);
    awsConfig.setRegion("us-east-2");
    config.setAws(awsConfig);

    // IAM auth takes precedence when enabled
    assertTrue(
        AwsCredentialsUtil.isAwsIamAuthEnabled(config.getAws()),
        "IAM auth should be enabled and take precedence over basic auth");
  }

  @Test
  void testHostUrlParsingWithPort() {
    String host = "https://vpc-test.us-east-2.es.amazonaws.com:443";

    String parsedHost = OpenSearchClient.parseHostForAwsSdk2Transport(host);

    assertEquals(
        "vpc-test.us-east-2.es.amazonaws.com",
        parsedHost,
        "Host should be stripped of protocol prefix and port");
  }

  @Test
  void testHostUrlParsingWithPortNoProtocol() {
    String host = "vpc-test.us-east-2.es.amazonaws.com:443";

    String parsedHost = OpenSearchClient.parseHostForAwsSdk2Transport(host);

    assertEquals(
        "vpc-test.us-east-2.es.amazonaws.com", parsedHost, "Host should be stripped of port");
  }

  @Test
  void testHostUrlParsingCommaSeparatedHosts() {
    String host = "https://host1.es.amazonaws.com,https://host2.es.amazonaws.com";

    String parsedHost = OpenSearchClient.parseHostForAwsSdk2Transport(host);

    assertEquals(
        "host1.es.amazonaws.com", parsedHost, "Should use first host from comma-separated list");
  }

  @Test
  void testHostUrlParsingCommaSeparatedHostsWithPorts() {
    String host = "host1.es.amazonaws.com:443,host2.es.amazonaws.com:443";

    String parsedHost = OpenSearchClient.parseHostForAwsSdk2Transport(host);

    assertEquals(
        "host1.es.amazonaws.com",
        parsedHost,
        "Should use first host and strip port from comma-separated list");
  }
}
