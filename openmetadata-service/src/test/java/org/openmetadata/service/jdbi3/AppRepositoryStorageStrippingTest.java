/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Regression guard for the app runtime-secret exposure fix. {@code openMetadataServerConnection}
 * (app bot JWT) and {@code privateConfiguration} (external tokens/passwords) are runtime-only
 * fields re-injected by ApplicationHandler.setAppRuntimeProperties. They must never be written to
 * current-entity storage or to version-history snapshots.
 */
class AppRepositoryStorageStrippingTest {

  private static AppRepository testRepository() {
    return mock(AppRepository.class, CALLS_REAL_METHODS);
  }

  private static App appWithRuntimeSecrets() {
    return new App()
        .withId(UUID.randomUUID())
        .withName("SecretMaskingTestApp")
        .withPrivateConfiguration(Map.of("token", "waii-secret-token"))
        .withOpenMetadataServerConnection(
            new OpenMetadataConnection()
                .withSecurityConfig(
                    new OpenMetadataJWTClientConfig().withJwtToken("app-bot-jwt-secret")));
  }

  @Test
  void getFieldsStrippedFromStorageJson_declaresRuntimeSecretFields() {
    AppRepository repository = testRepository();
    assertTrue(
        repository.getFieldsStrippedFromStorageJson().contains("openMetadataServerConnection"));
    assertTrue(repository.getFieldsStrippedFromStorageJson().contains("privateConfiguration"));
  }

  @Test
  void storageJson_dropsRuntimeSecretFields() {
    AppRepository repository = testRepository();

    ObjectNode stored = repository.storageJsonNode(appWithRuntimeSecrets());

    assertFalse(
        stored.has("privateConfiguration"),
        "privateConfiguration must not be persisted to storage");
    assertFalse(
        stored.has("openMetadataServerConnection"),
        "openMetadataServerConnection must not be persisted to storage");
  }

  @Test
  void versionHistoryJson_dropsRuntimeSecretFields() {
    AppRepository repository = testRepository();

    ObjectNode snapshot =
        (ObjectNode)
            JsonUtils.readTree(repository.serializeForVersionHistory(appWithRuntimeSecrets()));

    assertFalse(
        snapshot.has("privateConfiguration"),
        "privateConfiguration must not appear in version-history snapshots");
    assertFalse(
        snapshot.has("openMetadataServerConnection"),
        "openMetadataServerConnection must not appear in version-history snapshots");
    assertTrue(snapshot.has("name"), "non-secret fields must remain in version-history snapshots");
  }
}
