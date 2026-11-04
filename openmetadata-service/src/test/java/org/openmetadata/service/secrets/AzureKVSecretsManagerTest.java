/*
 *  Copyright 2024 Collate
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.azure.core.exception.HttpResponseException;
import com.azure.core.exception.ResourceNotFoundException;
import com.azure.core.http.HttpResponse;
import com.azure.core.util.polling.SyncPoller;
import com.azure.security.keyvault.secrets.SecretClient;
import com.azure.security.keyvault.secrets.models.KeyVaultSecret;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.secrets.Parameters;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.fernet.Fernet;

class AzureKVSecretsManagerTest {
  private static final String OWNED_NAME = "openmetadata-prefix-queryrunner-user-abc-key";

  private static AzureKVSecretsManager secretsManager;

  @BeforeAll
  static void setUp() {
    Fernet.getInstance().setFernetKey("jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=");
    Parameters parameters = new Parameters();
    parameters.setAdditionalProperty("vaultName", "test-vault");
    parameters.setAdditionalProperty("tenantId", "test-tenant");
    parameters.setAdditionalProperty("clientId", "test-client");
    parameters.setAdditionalProperty("clientSecret", "test-secret");
    secretsManager =
        AzureKVSecretsManager.getInstance(
            new SecretsManager.SecretsConfig(
                "openmetadata", "prefix", List.of("key:value"), parameters));
  }

  @Test
  void isNotFoundExceptionRecognizesAzureNotFoundButNotOtherErrors() {
    assertTrue(
        secretsManager.isNotFoundException(new ResourceNotFoundException("secret not found", null)),
        "Azure ResourceNotFoundException must be classified as a genuine not-found");
    assertFalse(
        secretsManager.isNotFoundException(new RuntimeException("forbidden / throttled")),
        "Other read failures must not be mistaken for a missing secret");
  }

  @Test
  void upsertUsesIdempotentSetSecretWithoutAnExistenceRead() {
    SecretClient mockClient = mock(SecretClient.class);
    when(mockClient.setSecret(any(KeyVaultSecret.class)))
        .thenReturn(new KeyVaultSecret("name", "value"));
    secretsManager.setClient(mockClient);

    secretsManager.upsertSecret("openmetadata-prefix-database-password", "s3cret");

    verify(mockClient).setSecret(any(KeyVaultSecret.class));
    verify(mockClient, never()).getSecret(anyString());
  }

  @Test
  void anOwnedKeyDeletedEarlierIsRecoveredAndWritten() {
    SoftDeletingVault vault = new SoftDeletingVault();
    secretsManager.setClient(vault.client);
    secretsManager.upsertOwnedSecret(OWNED_NAME, "first");
    secretsManager.deleteSecret(OWNED_NAME);

    secretsManager.upsertOwnedSecret(OWNED_NAME, "second");

    assertEquals(Map.of(OWNED_NAME, "second"), vault.live);
    assertTrue(vault.deleted.isEmpty());
  }

  @Test
  void aNameBasedKeyDeletedEarlierIsNotRecovered() {
    SoftDeletingVault vault = new SoftDeletingVault();
    secretsManager.setClient(vault.client);
    secretsManager.upsertSecret(OWNED_NAME, "first");
    secretsManager.deleteSecret(OWNED_NAME);

    assertThrows(
        SecretsManagerException.class, () -> secretsManager.upsertSecret(OWNED_NAME, "second"));
    assertTrue(vault.live.isEmpty());
    verify(vault.client, never()).beginRecoverDeletedSecret(anyString());
  }

  @Test
  void aRecoveredSecretIsDeletedAgainWhenTheWriteFails() {
    SoftDeletingVault vault = new SoftDeletingVault();
    secretsManager.setClient(vault.client);
    secretsManager.upsertOwnedSecret(OWNED_NAME, "first");
    secretsManager.deleteSecret(OWNED_NAME);
    vault.refuseWritesAfterRecovery = true;

    assertThrows(
        SecretsManagerException.class,
        () -> secretsManager.upsertOwnedSecret(OWNED_NAME, "second"));
    assertTrue(vault.live.isEmpty());
    assertEquals(Map.of(OWNED_NAME, "first"), vault.deleted);
  }

  @Test
  void aSecretNameInAnyCaseBelongsToTheSameOwner() {
    UUID pipelineId = UUID.randomUUID();
    SecretOwner owner = SecretOwner.builder("pipeline").id(pipelineId).build();
    String name =
        secretsManager.buildSecretId(true)
            + "-pipeline-"
            + SecretKeyEncoding.encodeId(pipelineId)
            + "-key";

    assertTrue(
        secretsManager
            .ownedSecrets()
            .isOwnedBy(SecretsManager.SECRET_FIELD_PREFIX + name.toUpperCase(Locale.ROOT), owner));
  }

  /** A Key Vault with soft delete on: a deleted name is refused with a 409 until recovered. */
  private static final class SoftDeletingVault {
    private final Map<String, String> live = new HashMap<>();
    private final Map<String, String> deleted = new HashMap<>();
    private final SecretClient client = mock(SecretClient.class);
    private boolean refuseWritesAfterRecovery;
    private boolean recovered;

    @SuppressWarnings("unchecked")
    private SoftDeletingVault() {
      when(client.setSecret(any(KeyVaultSecret.class)))
          .thenAnswer(call -> set(call.getArgument(0)));
      when(client.beginDeleteSecret(anyString()))
          .thenAnswer(
              call -> {
                String name = call.getArgument(0);
                deleted.put(name, live.remove(name));
                return mock(SyncPoller.class);
              });
      when(client.beginRecoverDeletedSecret(anyString()))
          .thenAnswer(
              call -> {
                String name = call.getArgument(0);
                live.put(name, deleted.remove(name));
                recovered = true;
                return mock(SyncPoller.class);
              });
    }

    private KeyVaultSecret set(KeyVaultSecret secret) {
      if (deleted.containsKey(secret.getName())) {
        throw new HttpResponseException("deleted but recoverable", response(409));
      }
      if (recovered && refuseWritesAfterRecovery) {
        throw new HttpResponseException("forbidden", response(403));
      }
      live.put(secret.getName(), secret.getValue());
      return secret;
    }

    private static HttpResponse response(int statusCode) {
      HttpResponse response = mock(HttpResponse.class);
      when(response.getStatusCode()).thenReturn(statusCode);
      return response;
    }
  }
}
