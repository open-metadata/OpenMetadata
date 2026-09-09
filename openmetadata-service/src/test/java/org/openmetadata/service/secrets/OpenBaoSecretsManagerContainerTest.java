/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.secrets.Parameters;
import org.openmetadata.service.fernet.Fernet;
import org.testcontainers.containers.Container.ExecResult;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * End-to-end test of {@link OpenBaoSecretsManager} against a real OpenBao server in a Testcontainer.
 *
 * <p>Unlike the AWS LocalStack tests this is not an emulator, so the store / update / read / exists
 * / delete cycle is exercised against the actual KV v2 implementation. Skipped automatically when
 * Docker is not available.
 */
@Testcontainers(disabledWithoutDocker = true)
class OpenBaoSecretsManagerContainerTest {

  private static final DockerImageName OPENBAO_IMAGE =
      DockerImageName.parse("openbao/openbao:2.6.2");

  private static final String ROOT_TOKEN = "test-root";
  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";

  /** Matches the mount the compose overlay and bootstrap script create, not dev mode's `secret/`. */
  private static final String MOUNT = "openmetadata";

  @Container
  static final GenericContainer<?> OPENBAO =
      new GenericContainer<>(OPENBAO_IMAGE)
          .withEnv("BAO_DEV_ROOT_TOKEN_ID", ROOT_TOKEN)
          .withEnv("BAO_DEV_LISTEN_ADDRESS", "0.0.0.0:8200")
          .withCommand("server", "-dev")
          .withExposedPorts(8200)
          .waitingFor(Wait.forHttp("/v1/sys/health").forPort(8200).forStatusCode(200));

  private static String address;

  @BeforeAll
  static void createMount() throws IOException, InterruptedException {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    address = "http://" + OPENBAO.getHost() + ":" + OPENBAO.getMappedPort(8200);
    ExecResult result =
        OPENBAO.execInContainer(
            "bao",
            "secrets",
            "enable",
            "-address=http://127.0.0.1:8200",
            "-path=" + MOUNT,
            "-version=2",
            "kv");
    assertEquals(
        0, result.getExitCode(), "Failed to create the KV v2 mount: " + result.getStderr());
  }

  private static Parameters parameters(String mount) {
    Parameters parameters = new Parameters();
    parameters.setAdditionalProperty(OpenBaoSecretsManager.ADDRESS, address);
    parameters.setAdditionalProperty(OpenBaoSecretsManager.MOUNT, mount);
    parameters.setAdditionalProperty(OpenBaoSecretsManager.TOKEN, ROOT_TOKEN);
    parameters.setAdditionalProperty(OpenBaoSecretsManager.AUTH_METHOD, "token");
    return parameters;
  }

  private static OpenBaoSecretsManager manager(String mount) {
    OpenBaoSecretsManager.resetInstance();
    return OpenBaoSecretsManager.getInstance(
        new SecretsManager.SecretsConfig("openmetadata", "", List.of(), parameters(mount)));
  }

  private static OpenBaoClient client(String mount) {
    return new OpenBaoClient(
        new OpenBaoClient.OpenBaoConfig(
            address, mount, "", "token", ROOT_TOKEN, "", "", "", "", false, 5000, 10000));
  }

  @Test
  void fullLifecycleAgainstRealOpenBao() {
    OpenBaoSecretsManager secretsManager = manager(MOUNT);
    String name = "/openmetadata/databaseservice/lifecycle/password";

    assertFalse(secretsManager.existSecret(name), "The secret must not exist before it is written");

    secretsManager.upsertSecret(name, "first-value");
    assertEquals("first-value", secretsManager.getSecret(name));
    assertTrue(secretsManager.existSecret(name));

    // Update in place: KV v2 versions the value, so no read-before-write is needed.
    secretsManager.upsertSecret(name, "second-value");
    assertEquals("second-value", secretsManager.getSecret(name));

    secretsManager.deleteSecretInternal(name);
    assertFalse(secretsManager.existSecret(name), "A hard delete must remove every version");
    assertEquals(Optional.empty(), client(MOUNT).read(name.substring(1)));
  }

  @Test
  void deleteRemovesHistoryNotJustTheLatestVersion() throws IOException, InterruptedException {
    OpenBaoSecretsManager secretsManager = manager(MOUNT);
    String name = "/openmetadata/databaseservice/history/password";
    secretsManager.upsertSecret(name, "v1");
    secretsManager.upsertSecret(name, "v2");

    // Both versions are recoverable while the secret lives, which is exactly why a soft delete
    // would be the wrong choice for an entity deletion.
    assertEquals(0, metadataExitCode(name.substring(1)), "history should exist before the delete");

    secretsManager.deleteSecretInternal(name);
    assertNotEquals(
        0,
        metadataExitCode(name.substring(1)),
        "Metadata must be gone after a hard delete, or rotated plaintext stays recoverable");
  }

  private static int metadataExitCode(String path) throws IOException, InterruptedException {
    return OPENBAO
        .execInContainer(
            "bao", "kv", "metadata", "get", "-address=http://127.0.0.1:8200", MOUNT + "/" + path)
        .getExitCode();
  }

  @Test
  void nullValuesRoundTripAsTheSharedSentinel() {
    OpenBaoSecretsManager secretsManager = manager(MOUNT);
    String name = "/openmetadata/databaseservice/nullable/password";
    secretsManager.upsertSecret(name, null);
    assertEquals(ExternalSecretsManager.NULL_SECRET_STRING, secretsManager.getSecret(name));
    secretsManager.deleteSecretInternal(name);
  }

  /**
   * The failure that would silently discard credentials: a mount that does not exist must be a
   * configuration error, never "the secret is absent".
   */
  @Test
  void typoedMountFailsLoudlyRatherThanReadingAsAbsent() {
    OpenBaoClient goodMount = client(MOUNT);
    goodMount.verifyMount();
    assertEquals(Optional.empty(), goodMount.read("openmetadata/never/written"));

    assertThrows(
        OpenBaoClient.OpenBaoConfigurationException.class,
        () -> client("typo-mount").verifyMount(),
        "A mount that does not exist must fail at construction");
  }

  @AfterEach
  void clearSingleton() {
    // Leaving a live singleton behind would make sibling test classes depend on run order, and
    // leaving its client open leaks a Jersey connection pool per test.
    OpenBaoSecretsManager manager = OpenBaoSecretsManager.currentInstance();
    if (manager != null) {
      manager.close();
    }
    OpenBaoSecretsManager.resetInstance();
  }

  @Test
  void managerConstructionFailsFastOnAnUnknownMount() {
    assertThrows(
        OpenBaoClient.OpenBaoConfigurationException.class,
        () -> manager("does-not-exist"),
        "A wrong mount must stop the server at boot, not at the first save");
  }
}
