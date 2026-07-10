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

/**
 * Holds the platform-wide {@link LLMConfiguration} loaded from {@code openmetadata.yaml} at startup,
 * so any feature needing LLM access (e.g. the MCP Chat application) can read it without threading
 * the config through every layer. Features build their own client from this config via {@link
 * LlmClientFactory}.
 */
public final class LlmConfigHolder {
  private static volatile LLMConfiguration configuration;

  private LlmConfigHolder() {}

  public static synchronized void initialize(LLMConfiguration config) {
    configuration = config;
  }

  public static LLMConfiguration get() {
    return configuration;
  }

  public static boolean isEnabled() {
    LLMConfiguration current = configuration;
    return current != null && Boolean.TRUE.equals(current.getEnabled());
  }
}
