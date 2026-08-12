package org.openmetadata.service.llm;

/** No-op client used when LLM completion is disabled or in tests. Returns an empty pill array. */
public class NoopCompletionClient extends LLMCompletionClient {
  public NoopCompletionClient() {
    super(1);
  }

  @Override
  protected CompletionResult doComplete(
      String systemPrompt, String userPrompt, CompletionOptions options) {
    return new CompletionResult("[]", 0, 0);
  }

  @Override
  public String getModelId() {
    return "noop";
  }
}
