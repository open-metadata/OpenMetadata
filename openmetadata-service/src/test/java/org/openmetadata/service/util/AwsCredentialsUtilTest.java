package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.credentials.AWSBaseConfig;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;

class AwsCredentialsUtilTest {

  @Test
  void testBuildCredentialsProviderWithStaticCredentials() {
    AWSBaseConfig config = new AWSBaseConfig();
    config.setRegion("us-east-1");
    config.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    config.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");

    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(config);

    assertNotNull(provider);
    assertInstanceOf(StaticCredentialsProvider.class, provider);
  }

  @Test
  void testBuildCredentialsProviderWithSessionCredentials() {
    AWSBaseConfig config = new AWSBaseConfig();
    config.setRegion("us-east-1");
    config.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    config.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    config.setSessionToken("FwoGZXIvYXdzEBYaDKT...");

    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(config);

    assertNotNull(provider);
    assertInstanceOf(StaticCredentialsProvider.class, provider);
  }

  @Test
  void testBuildCredentialsProviderWithNoCredentials() {
    AWSBaseConfig config = new AWSBaseConfig();
    config.setRegion("us-east-1");
    config.setEnabled(true);

    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(config);

    assertNotNull(provider);
    assertInstanceOf(DefaultCredentialsProvider.class, provider);
  }

  @Test
  void testBuildCredentialsProviderWithOnlyAccessKey() {
    AWSBaseConfig config = new AWSBaseConfig();
    config.setRegion("us-east-1");
    config.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    config.setEnabled(true);

    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(config);

    assertNotNull(provider);
    assertInstanceOf(DefaultCredentialsProvider.class, provider);
  }

  @Test
  void testBuildCredentialsProviderWithEmptyCredentials() {
    AWSBaseConfig config = new AWSBaseConfig();
    config.setRegion("us-east-1");
    config.setAccessKeyId("");
    config.setSecretAccessKey("");
    config.setEnabled(true);

    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(config);

    assertNotNull(provider);
    assertInstanceOf(DefaultCredentialsProvider.class, provider);
  }

  @Test
  void testIsAwsConfiguredWithRegion() {
    AWSBaseConfig config = new AWSBaseConfig();
    config.setRegion("us-east-1");

    assertTrue(AwsCredentialsUtil.isAwsConfigured(config));
  }

  @Test
  void testIsAwsConfiguredWithoutRegion() {
    AWSBaseConfig config = new AWSBaseConfig();

    assertFalse(AwsCredentialsUtil.isAwsConfigured(config));
  }

  @Test
  void testIsAwsConfiguredWithEmptyRegion() {
    AWSBaseConfig config = new AWSBaseConfig();
    config.setRegion("");

    assertFalse(AwsCredentialsUtil.isAwsConfigured(config));
  }

  @Test
  void testIsAwsConfiguredWithNullConfig() {
    assertFalse(AwsCredentialsUtil.isAwsConfigured(null));
  }

  @Test
  void testGetRegionWithValidRegion() {
    AWSBaseConfig config = new AWSBaseConfig();
    config.setRegion("us-west-2");

    Region region = AwsCredentialsUtil.getRegion(config);

    assertNotNull(region);
    assertEquals(Region.US_WEST_2, region);
  }

  @Test
  void testGetRegionWithEmptyRegion() {
    AWSBaseConfig config = new AWSBaseConfig();
    config.setRegion("");

    Region region = AwsCredentialsUtil.getRegion(config);

    assertNull(region);
  }

  @Test
  void testGetRegionWithNullRegion() {
    AWSBaseConfig config = new AWSBaseConfig();

    Region region = AwsCredentialsUtil.getRegion(config);

    assertNull(region);
  }

  @Test
  void testAwsConfigInheritance() {
    // Test that AwsConfiguration (which extends AWSBaseConfig) works with the utility
    org.openmetadata.schema.service.configuration.elasticsearch.AwsConfiguration awsConfig =
        new org.openmetadata.schema.service.configuration.elasticsearch.AwsConfiguration();
    awsConfig.setRegion("eu-west-1");
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    awsConfig.setServiceName("es");

    // AwsConfiguration extends AWSBaseConfig, so it should work with the utility
    assertTrue(AwsCredentialsUtil.isAwsConfigured(awsConfig));
    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(awsConfig);
    assertNotNull(provider);
    assertInstanceOf(StaticCredentialsProvider.class, provider);
    assertEquals("es", awsConfig.getServiceName());
  }

  @Test
  void testAssumeRoleConfiguration() {
    AWSBaseConfig config = new AWSBaseConfig();
    config.setRegion("us-east-1");
    config.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    config.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    config.setAssumeRoleArn("arn:aws:iam::123456789012:role/CrossAccountRole");
    config.setAssumeRoleSessionName("TestSession");

    // Verify the config is set correctly
    assertEquals("arn:aws:iam::123456789012:role/CrossAccountRole", config.getAssumeRoleArn());
    assertEquals("TestSession", config.getAssumeRoleSessionName());
    assertTrue(AwsCredentialsUtil.isAwsConfigured(config));
  }

  @Test
  void testEndpointUrlConfiguration() {
    AWSBaseConfig config = new AWSBaseConfig();
    config.setRegion("us-east-1");
    config.setEndpointUrl(URI.create("http://localhost:4566"));

    assertEquals(URI.create("http://localhost:4566"), config.getEndpointUrl());
    assertTrue(AwsCredentialsUtil.isAwsConfigured(config));
  }

  @Test
  void testBuildCredentialsProviderThrowsWhenNotConfigured() {
    AWSBaseConfig config = new AWSBaseConfig();
    config.setRegion("us-east-1");

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> AwsCredentialsUtil.buildCredentialsProvider(config));

    assertTrue(exception.getMessage().contains("AWS credentials not configured"));
  }
}
