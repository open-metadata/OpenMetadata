package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.feed.CreateThread;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

class ThreadTaskRetirementTest {
  @Test
  void rejectsTaskThreads() {
    assertThrows(
        JsonParsingException.class, () -> JsonUtils.readValue("{\"type\":\"Task\"}", Thread.class));
  }

  @Test
  void rejectsTaskThreadRequests() {
    assertThrows(
        JsonParsingException.class,
        () -> JsonUtils.readValue("{\"type\":\"Task\"}", CreateThread.class));
  }

  @Test
  void rejectsTaskDetailsOnOtherThreadTypes() {
    assertThrows(
        JsonParsingException.class,
        () -> JsonUtils.readValue("{\"type\":\"Conversation\",\"task\":{}}", Thread.class));
    assertThrows(
        JsonParsingException.class,
        () -> JsonUtils.readValue("{\"taskDetails\":{}}", CreateThread.class));
  }

  @ParameterizedTest
  @ValueSource(strings = {"Conversation", "Announcement", "Chatbot"})
  void preservesOtherThreadTypes(String type) {
    String json = "{\"type\":\"%s\",\"message\":\"A message\"}".formatted(type);
    Thread thread = JsonUtils.readValue(json, Thread.class);

    assertEquals(type, thread.getType().value());
    assertEquals("A message", thread.getMessage());
  }
}
