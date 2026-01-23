package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.AwsConfiguration;
import org.openmetadata.service.util.AwsCredentialsUtil;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.AwsSessionCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;

class AwsCredentialsProviderTest {

  @Test
  void testStaticCredentialsWithAccessKeyAndSecret() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");

    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertInstanceOf(StaticCredentialsProvider.class, provider);

    AwsCredentials credentials = provider.resolveCredentials();
    assertInstanceOf(AwsBasicCredentials.class, credentials);
    assertEquals("AKIAIOSFODNN7EXAMPLE", credentials.accessKeyId());
    assertEquals("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", credentials.secretAccessKey());
  }

  @Test
  void testSessionCredentialsWithToken() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    awsConfig.setSessionToken("FwoGZXIvYXdzEBYaDKTsessiontoken123");

    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertInstanceOf(StaticCredentialsProvider.class, provider);

    AwsCredentials credentials = provider.resolveCredentials();
    assertInstanceOf(AwsSessionCredentials.class, credentials);
    assertEquals("AKIAIOSFODNN7EXAMPLE", credentials.accessKeyId());
    assertEquals("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", credentials.secretAccessKey());

    AwsSessionCredentials sessionCreds = (AwsSessionCredentials) credentials;
    assertEquals("FwoGZXIvYXdzEBYaDKTsessiontoken123", sessionCreds.sessionToken());
  }

  @Test
  void testDefaultCredentialsProviderWhenNoStaticCredentials() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setRegion("us-east-1");

    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertInstanceOf(DefaultCredentialsProvider.class, provider);
  }

  @Test
  void testDefaultCredentialsProviderWithOnlyAccessKey() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");

    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertInstanceOf(DefaultCredentialsProvider.class, provider);
  }

  @Test
  void testDefaultCredentialsProviderWithOnlySecretKey() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");

    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertInstanceOf(DefaultCredentialsProvider.class, provider);
  }

  @Test
  void testDefaultCredentialsProviderWithEmptyCredentials() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setAccessKeyId("");
    awsConfig.setSecretAccessKey("");

    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertInstanceOf(DefaultCredentialsProvider.class, provider);
  }

  @Test
  void testNullAwsConfig() {
    AwsConfiguration awsConfig = new AwsConfiguration();

    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertInstanceOf(DefaultCredentialsProvider.class, provider);
  }

  @Test
  void testSessionTokenIgnoredWithoutAccessKeyAndSecret() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setSessionToken("FwoGZXIvYXdzEBYaDKTsessiontoken123");

    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertInstanceOf(DefaultCredentialsProvider.class, provider);
  }

  @Test
  void testAwsConfigurationWithServiceName() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setRegion("us-east-1");
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    awsConfig.setServiceName("aoss");

    AwsCredentialsProvider provider = AwsCredentialsUtil.buildCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertInstanceOf(StaticCredentialsProvider.class, provider);
    assertEquals("aoss", awsConfig.getServiceName());
  }
}
