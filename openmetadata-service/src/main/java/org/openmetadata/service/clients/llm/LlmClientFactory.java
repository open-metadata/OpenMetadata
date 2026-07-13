/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service.clients.llm;

import org.openmetadata.schema.configuration.LLMConfiguration;

public final class LlmClientFactory {

  private LlmClientFactory() {}

  public static LlmClient create(LLMConfiguration config) {
    if (config == null || config.getProvider() == null) {
      throw new IllegalArgumentException(
          "llmConfiguration.provider must be set to build an LLM client.");
    }
    return switch (config.getProvider()) {
      case OPENAI -> new OpenAiLlmClient(config);
      case ANTHROPIC -> new AnthropicLlmClient(config);
      case BEDROCK -> new BedrockLlmClient(config);
      case AZURE_OPENAI, GOOGLE, NOOP -> throw new IllegalArgumentException(
          "LLM provider '"
              + config.getProvider()
              + "' is not supported by MCP chat. Use one of: openai, anthropic, bedrock.");
    };
  }
}
