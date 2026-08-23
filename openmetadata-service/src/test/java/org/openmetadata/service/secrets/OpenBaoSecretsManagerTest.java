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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.security.secrets.Parameters;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.fernet.Fernet;

/**
 * Covers configuration validation and the read-path contract without a container, using the
 * package-private constructor that accepts an already-built client.
 */
class OpenBaoSecretsManagerTest {

  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";

  private OpenBaoClient client;

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    client = mock(OpenBaoClient.class);
    // Surefire reuses one JVM across classes and getInstance caches into a static, so a manager
    // built by another test class would otherwise be handed back here.
    OpenBaoSecretsManager.resetInstance();
  }

  @AfterEach
  void clearSingleton() {
    OpenBaoSecretsManager.resetInstance();
  }

  private static Parameters parameters(String... keyValues) {
    Parameters parameters = new Parameters();
    for (int i = 0; i < keyValues.length; i += 2) {
      parameters.setAdditionalProperty(keyValues[i], keyValues[i + 1]);
    }
    return parameters;
  }

  private OpenBaoSecretsManager managerWith(String clusterName, String prefix) {
    return new OpenBaoSecretsManager(
        new SecretsManager.SecretsConfig(
            clusterName,
            prefix,
            List.of(),
            parameters(OpenBaoSecretsManager.ADDRESS, "http://bao")),
        client);
  }

  @Test
  void missingAddressIsRejectedByName() {
    SecretsManagerException error =
        assertThrows(
            SecretsManagerException.class,
            () ->
                OpenBaoSecretsManager.getInstance(
                    new SecretsManager.SecretsConfig("openmetadata", "", List.of(), parameters())));
    assertTrue(
        error.getMessage().contains("baoAddress"),
        "The error must name the parameter the operator has to set");
  }

  /**
   * The path handed to OpenBao must not keep the leading separator {@code buildSecretId} emits, or
   * it produces a double slash in {@code /v1/{mount}/data/{path}} and never matches.
   */
  @Test
  void leadingSeparatorIsStrippedFromThePath() {
    assertEquals(
        "openmetadata/databaseservice/prod/password",
        OpenBaoSecretsManager.kvPathForTest("/openmetadata/databaseservice/prod/password"));
  }

  @Test
  void pathWithoutLeadingSeparatorIsUnchanged() {
    assertEquals("a/b", OpenBaoSecretsManager.kvPathForTest("a/b"));
  }

  /**
   * The prefix and the cluster name must stay separated. Overriding {@code needsStartingSeparator}
   * to false would have fixed the leading slash while silently concatenating these two, letting
   * {@code (ab, c)} and {@code (a, bc)} collide on one path and overwrite each other's credentials.
   */
  @Test
  void prefixAndClusterNameRemainSeparateSegments() {
    OpenBaoSecretsManager manager = managerWith("prod", "team");
    when(client.read(anyString())).thenReturn(Optional.of("v"));
    manager.getSecret(manager.buildSecretId(true, "databaseService", "mysql"));
    ArgumentCaptor<String> path = ArgumentCaptor.forClass(String.class);
    verify(client).read(path.capture());
    assertTrue(
        path.getValue().startsWith("team/prod/"),
        "Expected prefix and cluster as distinct segments, got: " + path.getValue());
  }

  @Test
  void illegalClusterNameIsRejectedAtConstructionNotAtFirstSave() {
    SecretsManagerException error =
        assertThrows(
            SecretsManagerException.class,
            () ->
                OpenBaoSecretsManager.getInstance(
                    new SecretsManager.SecretsConfig(
                        "bad cluster%name",
                        "", List.of(), parameters(OpenBaoSecretsManager.ADDRESS, "http://bao"))));
    assertTrue(error.getMessage().contains("clusterName"), "must name the offending field");
  }

  @Test
  void absentSecretReadsAsNullSoTheExistenceProbeWorks() {
    OpenBaoSecretsManager manager = managerWith("openmetadata", "");
    when(client.read("a/b")).thenReturn(Optional.empty());
    assertNull(manager.getSecret("/a/b"), "getSecret backs existSecret and must return null");
    assertFalse(manager.existSecret("/a/b"));
  }

  /**
   * The resolution path must fail loudly. Returning null here would hand a null credential to bot
   * authentication mechanisms and the ingestion-bot JWT, surfacing much later as an unrelated
   * authentication failure.
   */
  @Test
  void resolvingAMissingReferenceThrowsAndNamesThePath() {
    OpenBaoSecretsManager manager = managerWith("openmetadata", "");
    when(client.read("a/b")).thenReturn(Optional.empty());
    SecretsManagerException error =
        assertThrows(SecretsManagerException.class, () -> manager.getSecretValue("secret:/a/b"));
    assertTrue(error.getMessage().contains("a/b"), "the operator needs to know which path");
  }

  @Test
  void resolvingAPresentReferenceReturnsTheValue() {
    OpenBaoSecretsManager manager = managerWith("openmetadata", "");
    when(client.read("a/b")).thenReturn(Optional.of("p4ss"));
    assertEquals("p4ss", manager.getSecretValue("secret:/a/b"));
  }

  /** KV v2 writes are create-or-version, so the inherited existence probe must not run. */
  @Test
  void writeDoesNotReadFirst() {
    OpenBaoSecretsManager manager = managerWith("openmetadata", "");
    manager.upsertSecret("/a/b", "value");
    verify(client).write("a/b", "value");
    verify(client, never()).read(anyString());
  }

  @Test
  void nullValuesAreStoredAsTheSharedSentinel() {
    OpenBaoSecretsManager manager = managerWith("openmetadata", "");
    manager.upsertSecret("/a/b", null);
    verify(client).write("a/b", ExternalSecretsManager.NULL_SECRET_STRING);
  }

  @Test
  void deleteRemovesEveryVersion() {
    OpenBaoSecretsManager manager = managerWith("openmetadata", "");
    manager.deleteSecretInternal("/a/b");
    verify(client).deleteAllVersions("a/b");
  }

  /**
   * Not-found is a value on this provider, never an exception, so this classifier must stay inert.
   * Returning true for any exception would let a permission failure be read as a missing secret and
   * silently overwrite a live credential.
   */
  @Test
  void isNotFoundExceptionIsAlwaysFalse() {
    OpenBaoSecretsManager manager = managerWith("openmetadata", "");
    assertFalse(manager.isNotFoundException(new RuntimeException("anything")));
    assertFalse(
        manager.isNotFoundException(new OpenBaoClient.OpenBaoRequestException("read failed")));
  }
}
