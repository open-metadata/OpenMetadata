package org.openmetadata.service.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class GoogleCompletionClientTest {

  private static final String RESPONSE =
      "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"yo\"}]}}],"
          + "\"usageMetadata\":{\"promptTokenCount\":15,\"candidatesTokenCount\":3,\"totalTokenCount\":18}}";

  @Test
  void parsesTextAndUsage() {
    CompletionResult result = GoogleCompletionClient.parseResult(RESPONSE);
    assertEquals("yo", result.text());
    assertEquals(15, result.inputTokens());
    assertEquals(3, result.outputTokens());
  }

  @Test
  void requestBodyHonorsOverrides() {
    String body = GoogleCompletionClient.buildRequestBody("sys", "user", 256, 0.0);
    assertTrue(body.contains("\"maxOutputTokens\":256"));
  }
}
