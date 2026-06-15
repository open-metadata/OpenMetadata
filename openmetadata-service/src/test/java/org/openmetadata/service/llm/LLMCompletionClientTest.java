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
    protected CompletionResult doComplete(
        String systemPrompt, String userPrompt, CompletionOptions options) {
      return new CompletionResult(response, 0, 0);
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
    protected CompletionResult doComplete(
        String systemPrompt, String userPrompt, CompletionOptions options) {
      return new CompletionResult("[]", 0, 0);
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

  @Test
  void anthropicParseExtractsText() {
    assertEquals(
        "hello",
        AnthropicCompletionClient.parseResult(
                "{\"content\":[{\"type\":\"text\",\"text\":\"hello\"}],"
                    + "\"usage\":{\"input_tokens\":0,\"output_tokens\":0}}")
            .text());
  }

  @Test
  void anthropicParseRejectsContentWithoutText() {
    assertThrows(
        LLMCompletionException.class,
        () ->
            AnthropicCompletionClient.parseResult(
                "{\"content\":[{\"type\":\"thinking\"}],"
                    + "\"usage\":{\"input_tokens\":0,\"output_tokens\":0}}"));
  }

  @Test
  void openAiParseExtractsContent() {
    assertEquals(
        "hi",
        OpenAICompletionClient.parseResult(
                "{\"choices\":[{\"message\":{\"content\":\"hi\"}}],"
                    + "\"usage\":{\"prompt_tokens\":0,\"completion_tokens\":0}}")
            .text());
  }

  @Test
  void openAiParseRejectsNullMessageContent() {
    assertThrows(
        LLMCompletionException.class,
        () ->
            OpenAICompletionClient.parseResult(
                "{\"choices\":[{\"message\":{\"content\":null,\"tool_calls\":[]}}]}"));
  }

  @Test
  void googleParseExtractsText() {
    assertEquals(
        "ok",
        GoogleCompletionClient.parseContent(
            "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"ok\"}]}}]}"));
  }

  @Test
  void googleParseRejectsCandidateWithoutContent() {
    assertThrows(
        LLMCompletionException.class,
        () ->
            GoogleCompletionClient.parseContent(
                "{\"candidates\":[{\"finishReason\":\"SAFETY\"}]}"));
  }
}
