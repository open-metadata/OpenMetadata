package org.openmetadata.service.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.junit.jupiter.api.Test;

class LLMCompletionClientTest {

  private static final class StubClient extends LLMCompletionClient {
    private final String response;

    StubClient(String response) {
      super(2);
      this.response = response;
    }

    @Override
    protected String doComplete(String systemPrompt, String userPrompt) {
      return response;
    }

    @Override
    public String getModelId() {
      return "stub";
    }
  }

  private static final class ZeroPermitClient extends LLMCompletionClient {
    ZeroPermitClient() {
      super(0);
    }

    @Override
    protected String doComplete(String systemPrompt, String userPrompt) {
      return "[]";
    }

    @Override
    public String getModelId() {
      return "zero";
    }
  }

  @Test
  void completeStructuredParsesPillArray() {
    String json =
        "[{\"title\":\"T\",\"question\":\"Q\",\"answer\":\"A\",\"summary\":\"S\",\"memoryType\":\"Faq\"}]";
    List<KnowledgePill> pills =
        new StubClient(json).completeStructured("sys", "user", KnowledgePill.class);
    assertEquals(1, pills.size());
    assertEquals("Q", pills.get(0).question());
  }

  @Test
  void completeStructuredStripsCodeFence() {
    String json = "```json\n[{\"question\":\"Q\",\"answer\":\"A\"}]\n```";
    List<KnowledgePill> pills =
        new StubClient(json).completeStructured("sys", "user", KnowledgePill.class);
    assertEquals(1, pills.size());
    assertEquals("A", pills.get(0).answer());
  }

  @Test
  void rejectsNonPositiveConcurrency() {
    assertThrows(IllegalArgumentException.class, ZeroPermitClient::new);
  }
}
