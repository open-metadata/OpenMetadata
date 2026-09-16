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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.azure.core.exception.ResourceNotFoundException;
import com.azure.security.keyvault.secrets.SecretClient;
import com.azure.security.keyvault.secrets.models.KeyVaultSecret;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.secrets.Parameters;
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
}
