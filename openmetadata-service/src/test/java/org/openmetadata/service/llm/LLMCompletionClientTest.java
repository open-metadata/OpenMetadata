package org.openmetadata.service.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.configuration.LLMConfiguration;

class LLMCompletionClientTest {

  record PillLike(
      String title, String question, String answer, String summary, String memoryType) {}

  private static class StubClient extends LLMCompletionClient {
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
    List<PillLike> pills = new StubClient(json).completeStructured("sys", "user", PillLike.class);
    assertEquals(1, pills.size());
    assertEquals("Q", pills.get(0).question());
  }

  @Test
  void completeStructuredStripsCodeFence() {
    String json = "```json\n[{\"question\":\"Q\",\"answer\":\"A\"}]\n```";
    List<PillLike> pills = new StubClient(json).completeStructured("sys", "user", PillLike.class);
    assertEquals(1, pills.size());
    assertEquals("A", pills.get(0).answer());
  }

  @Test
  void completeStructuredAcceptsSingleObject() {
    String json = "{\"title\":\"T\",\"question\":\"Q\",\"answer\":\"A\"}";
    List<PillLike> pills = new StubClient(json).completeStructured("sys", "user", PillLike.class);
    assertEquals(1, pills.size());
    assertEquals("Q", pills.getFirst().question());
  }

  @Test
  void correctsTheFormatOnRetryWithoutRepeatingTheInvalidResponse() {
    AtomicInteger attempts = new AtomicInteger();
    LLMCompletionClient client =
        new StubClient("[]") {
          @Override
          protected CompletionResult doComplete(
              String systemPrompt, String userPrompt, CompletionOptions options) {
            if (attempts.getAndIncrement() == 0) {
              return new CompletionResult("I cannot identify an equivalent fact.", 0, 0);
            }
            assertTrue(systemPrompt.contains("previous response"));
            assertTrue(systemPrompt.contains("JSON array"));
            assertEquals("document", userPrompt);
            return new CompletionResult("[]", 0, 0);
          }
        };

    assertEquals(List.of(), client.completeStructured("Compare facts", "document", PillLike.class));
    assertEquals(2, attempts.get());
  }

  @Test
  void rejectsProseAfterBothAttempts() {
    assertThrows(
        LLMCompletionException.class,
        () ->
            new StubClient("I cannot identify an equivalent fact.")
                .completeStructured("Compare facts", "document", PillLike.class));
  }

  @Test
  void retriesProviderFailuresWithoutChangingTheFormatInstructions() {
    AtomicInteger attempts = new AtomicInteger();
    LLMCompletionClient client =
        new StubClient("[]") {
          @Override
          protected CompletionResult doComplete(
              String systemPrompt, String userPrompt, CompletionOptions options) {
            if (attempts.getAndIncrement() == 0) {
              throw new LLMCompletionException("Provider temporarily unavailable");
            }
            assertEquals("Compare facts", systemPrompt);
            return new CompletionResult("[]", 0, 0);
          }
        };

    assertEquals(List.of(), client.completeStructured("Compare facts", "document", PillLike.class));
    assertEquals(2, attempts.get());
  }

  @ParameterizedTest
  @CsvSource({"3, 3", "0, 5", "-1, 5", ", 5"})
  void concurrencyUsesTheConfiguredPositiveLimitOrTheDefault(Integer configured, int expected) {
    assertEquals(
        expected,
        LLMCompletionClient.resolveMaxConcurrent(
            new LLMConfiguration().withMaxConcurrentRequests(configured)));
  }

  @Test
  void concurrencyUsesTheDefaultWhenConfigurationIsMissing() {
    assertEquals(5, LLMCompletionClient.resolveMaxConcurrent(null));
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
        GoogleCompletionClient.parseResult(
                "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"ok\"}]}}]}")
            .text());
  }

  @Test
  void googleParseRejectsCandidateWithoutContent() {
    assertThrows(
        LLMCompletionException.class,
        () ->
            GoogleCompletionClient.parseResult("{\"candidates\":[{\"finishReason\":\"SAFETY\"}]}"));
  }

  @ParameterizedTest
  @CsvSource({
    "eu.anthropic.claude-haiku-5-5, false",
    "global.anthropic.claude-sonnet-5-5, false",
    "claude-opus-5-5, false",
    "us.anthropic.claude-opus-4-7, false",
    "claude-fable-5-1, false",
    "o3-mini, false",
    "o1, false",
    "openai.gpt-5.6, false",
    "eu.anthropic.claude-haiku-4-5-20251001-v1:0, true",
    "us.anthropic.claude-sonnet-4-5-20250929-v1:0, true",
    "claude-opus-4-5, true",
    "anthropic.claude-3-5-sonnet-20240620-v1:0, true",
    "gpt-4o-mini, true",
    "gemini-2.5-flash, true"
  })
  void supportsTemperatureFollowsModelId(String modelId, boolean expected) {
    assertEquals(expected, LLMCompletionClient.supportsTemperature(modelId));
  }

  @Test
  void supportsTemperatureWhenModelIdIsUnset() {
    assertTrue(LLMCompletionClient.supportsTemperature(null));
  }

  @ParameterizedTest
  @CsvSource({
    "o1, true",
    "o1-mini, true",
    "o1-preview, true",
    "o3, true",
    "o3-mini, true",
    "o4-mini, true",
    "O3-MINI, true",
    "gpt-5, true",
    "gpt-5-mini, true",
    "gpt-5-nano, true",
    "gpt-5.2, true",
    "openai.gpt-5.6, true",
    "gpt-6, true",
    "gpt-4o, false",
    "gpt-4o-mini, false",
    "gpt-4o1, false",
    "o10, false",
    "pro3-chat, false",
    "gpt-4.1, false",
    "gpt-4-turbo, false",
    "gpt-3.5-turbo, false",
    "claude-opus-4-5, false",
    "gemini-2.5-flash, false"
  })
  void usesMaxCompletionTokensFollowsModelId(String modelId, boolean expected) {
    assertEquals(expected, LLMCompletionClient.usesMaxCompletionTokens(modelId));
  }

  @Test
  void usesMaxTokensWhenModelIdIsUnset() {
    assertFalse(LLMCompletionClient.usesMaxCompletionTokens(null));
  }
}
