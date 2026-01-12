package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.*;

import org.apache.commons.lang3.StringUtils;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.AwsConfiguration;
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

    AwsCredentialsProvider provider = buildAwsCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertTrue(provider instanceof StaticCredentialsProvider);

    AwsCredentials credentials = provider.resolveCredentials();
    assertTrue(credentials instanceof AwsBasicCredentials);
    assertEquals("AKIAIOSFODNN7EXAMPLE", credentials.accessKeyId());
    assertEquals("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", credentials.secretAccessKey());
  }

  @Test
  void testSessionCredentialsWithToken() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    awsConfig.setSessionToken("FwoGZXIvYXdzEBYaDKTsessiontoken123");

    AwsCredentialsProvider provider = buildAwsCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertTrue(provider instanceof StaticCredentialsProvider);

    AwsCredentials credentials = provider.resolveCredentials();
    assertTrue(credentials instanceof AwsSessionCredentials);
    assertEquals("AKIAIOSFODNN7EXAMPLE", credentials.accessKeyId());
    assertEquals("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", credentials.secretAccessKey());

    AwsSessionCredentials sessionCreds = (AwsSessionCredentials) credentials;
    assertEquals("FwoGZXIvYXdzEBYaDKTsessiontoken123", sessionCreds.sessionToken());
  }

  @Test
  void testDefaultCredentialsProviderWhenNoStaticCredentials() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setRegion("us-east-1");

    AwsCredentialsProvider provider = buildAwsCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertTrue(provider instanceof DefaultCredentialsProvider);
  }

  @Test
  void testDefaultCredentialsProviderWithOnlyAccessKey() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setAccessKeyId("AKIAIOSFODNN7EXAMPLE");

    AwsCredentialsProvider provider = buildAwsCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertTrue(provider instanceof DefaultCredentialsProvider);
  }

  @Test
  void testDefaultCredentialsProviderWithOnlySecretKey() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setSecretAccessKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");

    AwsCredentialsProvider provider = buildAwsCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertTrue(provider instanceof DefaultCredentialsProvider);
  }

  @Test
  void testDefaultCredentialsProviderWithEmptyCredentials() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setAccessKeyId("");
    awsConfig.setSecretAccessKey("");

    AwsCredentialsProvider provider = buildAwsCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertTrue(provider instanceof DefaultCredentialsProvider);
  }

  @Test
  void testNullAwsConfig() {
    AwsConfiguration awsConfig = new AwsConfiguration();

    AwsCredentialsProvider provider = buildAwsCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertTrue(provider instanceof DefaultCredentialsProvider);
  }

  @Test
  void testSessionTokenIgnoredWithoutAccessKeyAndSecret() {
    AwsConfiguration awsConfig = new AwsConfiguration();
    awsConfig.setSessionToken("FwoGZXIvYXdzEBYaDKTsessiontoken123");

    AwsCredentialsProvider provider = buildAwsCredentialsProvider(awsConfig);

    assertNotNull(provider);
    assertTrue(provider instanceof DefaultCredentialsProvider);
  }

  private AwsCredentialsProvider buildAwsCredentialsProvider(AwsConfiguration awsConfig) {
    if (StringUtils.isNotEmpty(awsConfig.getAccessKeyId())
        && StringUtils.isNotEmpty(awsConfig.getSecretAccessKey())) {
      if (StringUtils.isNotEmpty(awsConfig.getSessionToken())) {
        return StaticCredentialsProvider.create(
            AwsSessionCredentials.create(
                awsConfig.getAccessKeyId(),
                awsConfig.getSecretAccessKey(),
                awsConfig.getSessionToken()));
      } else {
        return StaticCredentialsProvider.create(
            AwsBasicCredentials.create(awsConfig.getAccessKeyId(), awsConfig.getSecretAccessKey()));
      }
    }
    return DefaultCredentialsProvider.create();
  }
}
