package org.openmetadata.service.llm;

/** No-op client used when LLM completion is disabled or in tests. Returns an empty pill array. */
public class NoopCompletionClient extends LLMCompletionClient {
  public NoopCompletionClient() {
    super(1);
  }

  @Override
  protected String doComplete(String systemPrompt, String userPrompt) {
    return "[]";
  }

  @Override
  public String getModelId() {
    return "noop";
  }
}
