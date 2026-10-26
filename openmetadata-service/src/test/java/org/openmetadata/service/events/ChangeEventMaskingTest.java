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

package org.openmetadata.service.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

class ChangeEventMaskingTest {

  @BeforeAll
  static void knowTheEntityTypes() {
    EntityInterface.ENTITY_TYPE_TO_CLASS_MAP.putIfAbsent(Entity.USER, User.class);
    EntityInterface.ENTITY_TYPE_TO_CLASS_MAP.putIfAbsent(Entity.TABLE, Table.class);
  }

  @Test
  void aBotsTokenLeavesAnEntityHeldAsAnObject() {
    final String stored = ChangeEventMasking.masked(JsonUtils.pojoToJson(userEvent(bot())));

    final JsonNode entity = storedEntity(stored);
    assertFalse(entity.has("authenticationMechanism"));
    assertEquals("ingestion-bot", entity.path("name").asText());
  }

  @Test
  void aBotsTokenLeavesAnEntityHeldAsAString() {
    final String stored =
        ChangeEventMasking.masked(JsonUtils.pojoToJson(userEvent(JsonUtils.pojoToJson(bot()))));

    final JsonNode entity = storedEntity(stored);
    assertFalse(entity.has("authenticationMechanism"));
    assertEquals("ingestion-bot", entity.path("name").asText());
  }

  @Test
  void anEventOfATypeWithNoMaskedFieldIsStoredAsItCame() {
    final String event =
        JsonUtils.pojoToJson(
            new ChangeEvent()
                .withId(UUID.randomUUID())
                .withEventType(EventType.ENTITY_CREATED)
                .withEntityType(Entity.TABLE)
                .withEntity(Map.of("name", "orders")));

    assertSame(event, ChangeEventMasking.masked(event));
  }

  private static ChangeEvent userEvent(final Object entity) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(Entity.USER)
        .withTimestamp(System.currentTimeMillis())
        .withEntity(entity);
  }

  private static User bot() {
    return new User()
        .withId(UUID.randomUUID())
        .withName("ingestion-bot")
        .withEmail("ingestion-bot@open-metadata.org")
        .withIsBot(true)
        .withAuthenticationMechanism(
            new AuthenticationMechanism()
                .withAuthType(AuthenticationMechanism.AuthType.JWT)
                .withConfig(new JWTAuthMechanism().withJWTToken("eyJ.secret.token")));
  }

  private static JsonNode storedEntity(final String storedEvent) {
    return JsonUtils.readTree(JsonUtils.readTree(storedEvent).path("entity").asText());
  }
}
