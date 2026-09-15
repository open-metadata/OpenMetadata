package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;

class ChangeEventJsonUtilsTest {

  private static String changeEventJson(String eventType) {
    return """
        {"id":"%s","eventType":"%s","entityType":"glossaryTerm","userName":"admin",\
"timestamp":1700000000000}"""
        .formatted(UUID.randomUUID(), eventType);
  }

  @Test
  @DisplayName("A readable payload is returned unchanged")
  void readsAValidChangeEvent() {
    ChangeEvent event =
        ChangeEventJsonUtils.readOrNull(changeEventJson("entityCreated"), ChangeEvent.class);

    assertEquals(EventType.ENTITY_CREATED, event.getEventType());
  }

  // A row written before #29039 names an EventType this build no longer declares. The generated
  // enum's @JsonCreator throws on it, which would otherwise 500 the alert diagnostics endpoints.
  @Test
  @DisplayName("A payload naming a retired event type is skipped instead of throwing")
  void returnsNullForARetiredEventType() {
    assertNull(ChangeEventJsonUtils.readOrNull(changeEventJson("taskResolved"), ChangeEvent.class));
  }

  @Test
  @DisplayName("Malformed json is skipped instead of throwing")
  void returnsNullForMalformedJson() {
    assertNull(ChangeEventJsonUtils.readOrNull("{\"eventType\":", ChangeEvent.class));
  }

  @Test
  @DisplayName("A null payload stays null, matching JsonUtils")
  void returnsNullForNullJson() {
    assertNull(ChangeEventJsonUtils.readOrNull(null, ChangeEvent.class));
  }

  // Guards the premise of this helper: the strict reader really does throw on a retired value.
  @Test
  @DisplayName("The strict reader throws on the same payload")
  void strictReadStillThrows() {
    String json = changeEventJson("taskResolved");
    assertThrows(JsonParsingException.class, () -> JsonUtils.readValue(json, ChangeEvent.class));
  }
}
