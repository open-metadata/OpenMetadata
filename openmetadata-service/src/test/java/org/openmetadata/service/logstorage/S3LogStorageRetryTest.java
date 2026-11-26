package org.openmetadata.service.logstorage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.api.parallel.Resources;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.service.util.ThrottlingAwsEndpoint;

/**
 * Pipeline log storage keeps the pre-2.58 retry budget: the bucket check at startup is attempted
 * four times when S3 throttles. ADR:2026-11-26-aws-clients-keep-the-legacy-retry-mode
 */
@ResourceLock(Resources.SYSTEM_PROPERTIES)
class S3LogStorageRetryTest {

  @Test
  void aThrottledBucketCheckIsAttemptedFourTimes(@TempDir final Path home) throws Exception {
    assumeTrue(
        System.getenv("AWS_RETRY_MODE") == null && System.getProperty("aws.retryMode") == null,
        "an operator retry mode is set in this environment");
    final String previousConfigFile = System.getProperty("aws.configFile");
    System.setProperty("aws.configFile", Files.writeString(home.resolve("config"), "").toString());
    final S3LogStorage storage = new S3LogStorage();
    try (ThrottlingAwsEndpoint endpoint = ThrottlingAwsEndpoint.forS3()) {
      assertThrows(
          IOException.class, () -> storage.initialize(Map.of("config", configuration(endpoint))));
      assertEquals(4, endpoint.attempts());
    } finally {
      storage.close();
      if (previousConfigFile == null) {
        System.clearProperty("aws.configFile");
      } else {
        System.setProperty("aws.configFile", previousConfigFile);
      }
    }
  }

  private static LogStorageConfiguration configuration(final ThrottlingAwsEndpoint endpoint) {
    return new LogStorageConfiguration()
        .withType(LogStorageConfiguration.Type.S_3)
        .withBucketName("pipeline-logs")
        .withAwsConfig(
            new AWSCredentials()
                .withAwsRegion("us-east-1")
                .withAwsAccessKeyId("key")
                .withAwsSecretAccessKey("secret")
                .withEndPointURL(endpoint.uri()));
  }
}
