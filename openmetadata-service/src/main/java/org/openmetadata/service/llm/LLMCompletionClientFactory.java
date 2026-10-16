package org.openmetadata.service.llm;

import org.openmetadata.schema.configuration.LLMConfiguration;

public final class LLMCompletionClientFactory {
  private LLMCompletionClientFactory() {}

  public static LLMCompletionClient create(LLMConfiguration config) {
    LLMCompletionClient client;
    if (config == null || config.getProvider() == null) {
      client = new NoopCompletionClient();
    } else {
      client =
          switch (config.getProvider()) {
            case OPENAI, AZURE_OPENAI -> new OpenAICompletionClient(config);
            case BEDROCK -> new BedrockCompletionClient(config);
            case GOOGLE -> new GoogleCompletionClient(config);
            case ANTHROPIC -> new AnthropicCompletionClient(config);
            case NOOP -> new NoopCompletionClient();
          };
    }
    return client;
  }
}
