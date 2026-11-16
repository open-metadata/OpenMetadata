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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
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
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.secrets.Parameters;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.fernet.Fernet;

class AzureKVSecretsManagerTest {
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
  void anOwnedFieldWhoseNameADeletedSecretHoldsGetsAFreshKey() {
    SoftDeletingVault vault = new SoftDeletingVault();
    secretsManager.setClient(vault.client);
    SecretOwner owner = SecretOwner.builder("pipeline").id(UUID.randomUUID()).build();
    String first = storedReference(owner, "first", Set.of());
    secretsManager.ownedSecrets().delete(Set.of(first), owner);

    String second = storedReference(owner, "second", Set.of());

    assertNotEquals(first, second);
    assertTrue(second.startsWith(first));
    assertTrue(secretsManager.ownedSecrets().isOwnedBy(second, owner));
    assertEquals("second", vault.live.get(secretName(second)));
    assertEquals("first", vault.deleted.get(secretName(first)));
    verify(vault.client, never()).beginRecoverDeletedSecret(anyString());
  }

  @Test
  void onlyAConflictMeansADeletedSecretHoldsTheName() {
    assertTrue(
        secretsManager.isNameReserved(
            new SecretsManagerException("wrapped", new HttpResponseException("", response(409)))));
    assertFalse(
        secretsManager.isNameReserved(
            new SecretsManagerException("wrapped", new HttpResponseException("", response(403)))));
    assertFalse(secretsManager.isNameReserved(new RuntimeException("throttled")));
  }

  private static String storedReference(
      SecretOwner owner, String password, Set<String> keptReferences) {
    SnowflakeConnection connection =
        (SnowflakeConnection)
            secretsManager
                .ownedSecrets()
                .encrypt(
                    new SnowflakeConnection().withUsername("user").withPassword(password),
                    owner,
                    List.of(),
                    keptReferences);
    return Fernet.getInstance().decrypt(connection.getPassword());
  }

  private static String secretName(String reference) {
    return reference.substring(SecretsManager.SECRET_FIELD_PREFIX.length());
  }

  private static HttpResponse response(int statusCode) {
    HttpResponse response = mock(HttpResponse.class);
    when(response.getStatusCode()).thenReturn(statusCode);
    return response;
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

  /** A Key Vault with soft delete on: a deleted secret keeps its name, refused with a 409. */
  private static final class SoftDeletingVault {
    private final Map<String, String> live = new HashMap<>();
    private final Map<String, String> deleted = new HashMap<>();
    private final SecretClient client = mock(SecretClient.class);

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
    }

    private KeyVaultSecret set(KeyVaultSecret secret) {
      if (deleted.containsKey(secret.getName())) {
        throw new HttpResponseException("deleted but recoverable", response(409));
      }
      live.put(secret.getName(), secret.getValue());
      return secret;
    }
  }
}
