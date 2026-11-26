package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.api.parallel.Resources;
import org.openmetadata.service.util.ThrottlingAwsEndpoint;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;

/**
 * The secrets managers' own clients keep the pre-2.58 retry budget: a throttled call is attempted
 * four times. aws.endpointUrl points the clients they build at a local throttling endpoint.
 * ADR:2026-11-26-aws-clients-keep-the-legacy-retry-mode
 */
@ResourceLock(Resources.SYSTEM_PROPERTIES)
class AWSSecretsManagerRetryTest {
  private static final List<String> PROPERTIES =
      List.of(
          "aws.endpointUrl",
          "aws.region",
          "aws.accessKeyId",
          "aws.secretAccessKey",
          "aws.configFile");
  private static final SecretsManager.SecretsConfig CONFIG =
      new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null);

  private final Map<String, String> previous = new HashMap<>();
  private ThrottlingAwsEndpoint endpoint;

  @BeforeEach
  void pointAwsAtTheThrottlingEndpoint(@TempDir final Path home) throws Exception {
    assumeTrue(
        System.getenv("AWS_RETRY_MODE") == null && System.getProperty("aws.retryMode") == null,
        "an operator retry mode is set in this environment");
    endpoint = new ThrottlingAwsEndpoint();
    PROPERTIES.forEach(name -> previous.put(name, System.getProperty(name)));
    System.setProperty("aws.endpointUrl", endpoint.uri().toString());
    System.setProperty("aws.region", "us-east-1");
    System.setProperty("aws.accessKeyId", "key");
    System.setProperty("aws.secretAccessKey", "secret");
    System.setProperty("aws.configFile", Files.writeString(home.resolve("config"), "").toString());
  }

  @AfterEach
  void restoreAws() throws ReflectiveOperationException {
    previous.forEach(
        (name, value) -> {
          if (value == null) {
            System.clearProperty(name);
          } else {
            System.setProperty(name, value);
          }
        });
    if (endpoint != null) {
      endpoint.close();
    }
    resetSingleton(AWSSecretsManager.class);
    resetSingleton(AWSSSMSecretsManager.class);
  }

  /** The singletons now hold clients aimed at the stopped endpoint; later tests start fresh. */
  private static void resetSingleton(final Class<?> managerClass)
      throws ReflectiveOperationException {
    final Field instance = managerClass.getDeclaredField("instance");
    instance.setAccessible(true);
    instance.set(null, null);
  }

  @Test
  void secretsManagerClientWithoutCredentialsRetriesFourTimes() {
    assertFourAttempts(
        AWSSecretsManager.getInstance(CONFIG), AWSSecretsManager::initClientWithoutCredentials);
  }

  @Test
  void secretsManagerClientWithCredentialsRetriesFourTimes() {
    assertFourAttempts(
        AWSSecretsManager.getInstance(CONFIG),
        manager -> manager.initClientWithCredentials("us-east-1", staticCredentials()));
  }

  @Test
  void ssmClientWithoutCredentialsRetriesFourTimes() {
    assertFourAttempts(
        AWSSSMSecretsManager.getInstance(CONFIG),
        AWSSSMSecretsManager::initClientWithoutCredentials);
  }

  @Test
  void ssmClientWithCredentialsRetriesFourTimes() {
    assertFourAttempts(
        AWSSSMSecretsManager.getInstance(CONFIG),
        manager -> manager.initClientWithCredentials("us-east-1", staticCredentials()));
  }

  private <T extends AWSBasedSecretsManager> void assertFourAttempts(
      final T manager, final Consumer<T> initClient) {
    initClient.accept(manager);
    assertThrows(RuntimeException.class, () -> manager.getSecret("throttled"));
    assertEquals(4, endpoint.attempts());
  }

  private static StaticCredentialsProvider staticCredentials() {
    return StaticCredentialsProvider.create(AwsBasicCredentials.create("key", "secret"));
  }
}
