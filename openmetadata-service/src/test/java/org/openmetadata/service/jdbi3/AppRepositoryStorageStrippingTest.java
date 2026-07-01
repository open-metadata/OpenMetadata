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

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.lang.reflect.Field;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import sun.misc.Unsafe;

/**
 * Regression guard for the app runtime-secret exposure fix. {@code openMetadataServerConnection}
 * (app bot JWT) and {@code privateConfiguration} (external tokens/passwords) are runtime-only
 * fields re-injected by ApplicationHandler.setAppRuntimeProperties. They must never be written to
 * storage, so AppRepository declares them in getFieldsStrippedFromStorageJson and the base
 * serializer drops them.
 */
class AppRepositoryStorageStrippingTest {

  private static AppRepository allocateRepository() throws Exception {
    Field unsafeField = Unsafe.class.getDeclaredField("theUnsafe");
    unsafeField.setAccessible(true);
    Unsafe unsafe = (Unsafe) unsafeField.get(null);
    return (AppRepository) unsafe.allocateInstance(AppRepository.class);
  }

  @Test
  void getFieldsStrippedFromStorageJson_declaresRuntimeSecretFields() throws Exception {
    AppRepository repository = allocateRepository();
    assertTrue(
        repository.getFieldsStrippedFromStorageJson().contains("openMetadataServerConnection"));
    assertTrue(repository.getFieldsStrippedFromStorageJson().contains("privateConfiguration"));
  }

  @Test
  void storageJson_dropsRuntimeSecretFields() throws Exception {
    AppRepository repository = allocateRepository();
    App app =
        new App()
            .withId(UUID.randomUUID())
            .withName("SecretMaskingTestApp")
            .withPrivateConfiguration(Map.of("token", "waii-secret-token"))
            .withOpenMetadataServerConnection(
                new OpenMetadataConnection()
                    .withSecurityConfig(
                        new OpenMetadataJWTClientConfig().withJwtToken("app-bot-jwt-secret")));

    ObjectNode stored = repository.storageJsonNode(app);

    assertFalse(
        stored.has("privateConfiguration"),
        "privateConfiguration must not be persisted to storage");
    assertFalse(
        stored.has("openMetadataServerConnection"),
        "openMetadataServerConnection must not be persisted to storage");
  }
}
