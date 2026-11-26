package org.openmetadata.service.attachments;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.api.parallel.Resources;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.service.config.S3Configuration;
import org.openmetadata.service.util.ThrottlingAwsEndpoint;

/**
 * Attachment reads keep the pre-2.58 retry budget: a throttled S3 call is attempted four times.
 * ADR:2026-11-26-aws-clients-keep-the-legacy-retry-mode
 */
@ResourceLock(Resources.SYSTEM_PROPERTIES)
class S3AssetServiceRetryTest {

  @Test
  void aThrottledReadIsAttemptedFourTimes(@TempDir final Path home) throws Exception {
    assumeTrue(
        System.getenv("AWS_RETRY_MODE") == null && System.getProperty("aws.retryMode") == null,
        "an operator retry mode is set in this environment");
    final String previousConfigFile = System.getProperty("aws.configFile");
    System.setProperty("aws.configFile", Files.writeString(home.resolve("config"), "").toString());
    try (ThrottlingAwsEndpoint endpoint = ThrottlingAwsEndpoint.forS3();
        S3AssetService service = new S3AssetService(configuration(endpoint))) {
      assertTrue(
          service
              .read(new Asset().withId(UUID.randomUUID().toString()))
              .isCompletedExceptionally());
      assertEquals(4, endpoint.attempts());
    } finally {
      if (previousConfigFile == null) {
        System.clearProperty("aws.configFile");
      } else {
        System.setProperty("aws.configFile", previousConfigFile);
      }
    }
  }

  private static S3Configuration configuration(final ThrottlingAwsEndpoint endpoint) {
    final S3Configuration configuration = new S3Configuration();
    configuration.setBucketName("attachments");
    configuration.setRegion("us-east-1");
    configuration.setAccessKey("key");
    configuration.setSecretKey("secret");
    configuration.setEndpoint(endpoint.uri().toString());
    return configuration;
  }
}
