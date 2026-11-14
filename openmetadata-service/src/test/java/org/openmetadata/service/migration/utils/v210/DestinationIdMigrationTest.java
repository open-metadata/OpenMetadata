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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class DestinationIdMigrationTest {
  private static final String SHARED = "22222222-2222-2222-2222-222222222222";

  @Test
  void anAlertWhoseIdsAreItsOwnIsLeftAsItIs() {
    Set<UUID> taken = new HashSet<>();
    assertTrue(DestinationIdMigration.withOwnIds(alert(SHARED, null), taken).isEmpty());
    assertTrue(taken.contains(UUID.fromString(SHARED)));
  }

  @Test
  void theFirstReadKeepsASharedIdAndTheOthersGetTheirOwn() {
    Set<UUID> taken = new HashSet<>();
    DestinationIdMigration.withOwnIds(alert(SHARED, null), taken);

    String stored = alert(SHARED, SHARED);
    JsonNode migrated =
        JsonUtils.readTree(DestinationIdMigration.withOwnIds(stored, taken).orElseThrow());

    JsonNode destinations = migrated.path("destinations");
    assertNotEquals(SHARED, destinations.get(0).path("id").asText(), "another alert keeps it");
    assertNotEquals(SHARED, destinations.get(1).path("id").asText());
    assertNotEquals(destinations.get(0).path("id"), destinations.get(1).path("id"));
    ObjectNode expected = (ObjectNode) JsonUtils.readTree(stored);
    ((ObjectNode) expected.path("destinations").get(0)).set("id", destinations.get(0).path("id"));
    ((ObjectNode) expected.path("destinations").get(1)).set("id", destinations.get(1).path("id"));
    assertEquals(expected, migrated, "only the ids change");
  }

  @Test
  void aDestinationStoredWithoutAnIdGetsOne() {
    JsonNode migrated =
        JsonUtils.readTree(
            DestinationIdMigration.withOwnIds(alertWithoutIds(), new HashSet<>()).orElseThrow());
    UUID.fromString(migrated.path("destinations").get(0).path("id").asText());
  }

  private static String alert(String firstId, String secondId) {
    String second =
        secondId == null
            ? ""
            : """
              , {"id": "%s", "type": "Webhook", "config": {"endpoint": "https://b.example.com"}}
              """
                .formatted(secondId);
    return """
        {"id": "%s", "name": "alert", "somethingNewer": true, "destinations": [
          {"id": "%s", "type": "Webhook", "config": {"endpoint": "https://a.example.com"}}%s]}
        """
        .formatted(UUID.randomUUID(), firstId, second);
  }

  private static String alertWithoutIds() {
    return """
        {"id": "%s", "name": "alert", "destinations": [{"type": "Email"}]}
        """
        .formatted(UUID.randomUUID());
  }
}
