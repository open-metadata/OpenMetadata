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

package org.openmetadata.service.migration.utils.v207;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class StoredChangeEventCleanupTest {

  private static final Set<String> FIELDS = Set.of("eventSubscriptions");

  @Test
  void removesTheFieldFromAnEntityStoredAsAString() {
    String entity = "{\"name\":\"orders\",\"eventSubscriptions\":[],\"version\":0.2}";
    String stored = JsonUtils.pojoToJson(Map.of("entity", entity));

    String cleaned = StoredChangeEventCleanup.withoutEntityFields(stored, "", FIELDS).orElseThrow();

    JsonNode cleanedEntity =
        JsonUtils.readTree(JsonUtils.readTree(cleaned).path("entity").asText());
    assertEquals(JsonUtils.readTree("{\"name\":\"orders\",\"version\":0.2}"), cleanedEntity);
  }

  @Test
  void removesTheFieldFromAnEntityStoredAsAnObjectInsideAFailedEvent() {
    String stored =
        """
        {"reason": "timeout", "changeEvent": {"entityType": "app",
         "entity": {"name": "orders", "eventSubscriptions": [{"id": "x"}]}}}
        """;

    String cleaned =
        StoredChangeEventCleanup.withoutEntityFields(stored, "changeEvent", FIELDS).orElseThrow();

    assertEquals(
        JsonUtils.readTree(
            """
            {"reason": "timeout", "changeEvent": {"entityType": "app",
             "entity": {"name": "orders"}}}
            """),
        JsonUtils.readTree(cleaned));
  }

  @Test
  void leavesAnEventWithoutTheFieldAsItIs() {
    Optional<String> cleaned =
        StoredChangeEventCleanup.withoutEntityFields(
            "{\"entity\":\"{\\\"name\\\":\\\"orders\\\"}\"}", "", FIELDS);

    assertTrue(cleaned.isEmpty());
  }
}
