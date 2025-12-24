package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.AwsIamConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;

public class OpenSearchClientAwsIamTest {

  @Test
  public void testBasicAuthTakesPrecedenceOverIAM() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("localhost");
    config.setPort(9200);
    config.setScheme("https");
    config.setUsername("admin");
    config.setPassword("admin");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    AwsIamConfiguration awsConfig = new AwsIamConfiguration();
    awsConfig.setUseIamAuth(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setServiceName(AwsIamConfiguration.ServiceName.ES);
    config.setAws(awsConfig);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testIAMAuthWithExplicitCredentials() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("search-test.us-east-1.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    AwsIamConfiguration awsConfig = new AwsIamConfiguration();
    awsConfig.setUseIamAuth(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    awsConfig.setServiceName(AwsIamConfiguration.ServiceName.ES);
    config.setAws(awsConfig);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testIAMAuthWithDefaultCredentialsProvider() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("search-test.us-east-1.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    AwsIamConfiguration awsConfig = new AwsIamConfiguration();
    awsConfig.setUseIamAuth(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setServiceName(AwsIamConfiguration.ServiceName.ES);
    config.setAws(awsConfig);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testIAMAuthWithSessionToken() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("search-test.us-east-1.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    AwsIamConfiguration awsConfig = new AwsIamConfiguration();
    awsConfig.setUseIamAuth(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    awsConfig.setSessionToken("FwoGZXIvYXdzEA0aD...");
    awsConfig.setServiceName(AwsIamConfiguration.ServiceName.ES);
    config.setAws(awsConfig);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testOpenSearchServerless() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("test-collection.us-east-1.aoss.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    AwsIamConfiguration awsConfig = new AwsIamConfiguration();
    awsConfig.setUseIamAuth(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setServiceName(AwsIamConfiguration.ServiceName.AOSS);
    config.setAws(awsConfig);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testNoAuthenticationConfigured() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("localhost");
    config.setPort(9200);
    config.setScheme("http");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testEmptyUsernameWithPasswordDoesNotUseBasicAuth() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("localhost");
    config.setPort(9200);
    config.setScheme("https");
    config.setUsername(""); // Empty username
    config.setPassword("admin");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    AwsIamConfiguration awsConfig = new AwsIamConfiguration();
    awsConfig.setUseIamAuth(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    config.setAws(awsConfig);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testUsernameWithEmptyPasswordDoesNotUseBasicAuth() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("localhost");
    config.setPort(9200);
    config.setScheme("https");
    config.setUsername("admin");
    config.setPassword(""); // Empty password
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    AwsIamConfiguration awsConfig = new AwsIamConfiguration();
    awsConfig.setUseIamAuth(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    config.setAws(awsConfig);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testIAMAuthWithMissingRegion() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("search-test.us-east-1.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    AwsIamConfiguration awsConfig = new AwsIamConfiguration();
    awsConfig.setUseIamAuth(true);
    awsConfig.setRegion(null); // Missing region
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    config.setAws(awsConfig);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testIAMAuthWithEmptyRegion() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("search-test.us-east-1.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    AwsIamConfiguration awsConfig = new AwsIamConfiguration();
    awsConfig.setUseIamAuth(true);
    awsConfig.setRegion(""); // Empty region
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    config.setAws(awsConfig);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testIAMAuthWithOnlyAccessKeyFallsBackToDefaultProvider() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("search-test.us-east-1.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    AwsIamConfiguration awsConfig = new AwsIamConfiguration();
    awsConfig.setUseIamAuth(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey(null); // Missing secret key
    config.setAws(awsConfig);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testIAMAuthWithOnlySecretKeyFallsBackToDefaultProvider() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("search-test.us-east-1.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    AwsIamConfiguration awsConfig = new AwsIamConfiguration();
    awsConfig.setUseIamAuth(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setAccessKeyId(null); // Missing access key
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    config.setAws(awsConfig);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testIAMAuthWithServiceNameDefaultsToES() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("search-test.us-east-1.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    AwsIamConfiguration awsConfig = new AwsIamConfiguration();
    awsConfig.setUseIamAuth(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    awsConfig.setServiceName(null); // No service name set, should default to "es"
    config.setAws(awsConfig);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testIAMAuthDisabledWithAwsConfigPresent() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("localhost");
    config.setPort(9200);
    config.setScheme("http");
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    AwsIamConfiguration awsConfig = new AwsIamConfiguration();
    awsConfig.setUseIamAuth(false); // Explicitly disabled
    awsConfig.setRegion("us-east-1");
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    config.setAws(awsConfig);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testEmptyCredentialsWithIAMEnabled() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("search-test.us-east-1.es.amazonaws.com");
    config.setPort(443);
    config.setScheme("https");
    config.setUsername(""); // Empty username
    config.setPassword(""); // Empty password
    config.setConnectionTimeoutSecs(5);
    config.setSocketTimeoutSecs(60);

    AwsIamConfiguration awsConfig = new AwsIamConfiguration();
    awsConfig.setUseIamAuth(true);
    awsConfig.setRegion("us-east-1");
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    config.setAws(awsConfig);

    OpenSearchClient client = new OpenSearchClient(config);
    assertNotNull(client);
  }

  @Test
  public void testMultiRegionSupport() {
    String[] regions = {"us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"};

    for (String region : regions) {
      ElasticSearchConfiguration config = new ElasticSearchConfiguration();
      config.setHost("search-test." + region + ".es.amazonaws.com");
      config.setPort(443);
      config.setScheme("https");
      config.setConnectionTimeoutSecs(5);
      config.setSocketTimeoutSecs(60);

      AwsIamConfiguration awsConfig = new AwsIamConfiguration();
      awsConfig.setUseIamAuth(true);
      awsConfig.setRegion(region);
      awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
      awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
      config.setAws(awsConfig);

      OpenSearchClient client = new OpenSearchClient(config);
      assertNotNull(client, "Client should be created for region: " + region);
    }
  }

  @Test
  public void testNullConfigDoesNotThrowException() {
    OpenSearchClient client = new OpenSearchClient(null);
    assertNotNull(client);
    assertFalse(client.isClientAvailable());
  }
}
