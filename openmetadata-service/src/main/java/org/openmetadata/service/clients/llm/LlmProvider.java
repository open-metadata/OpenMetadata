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

import java.util.Locale;

public enum LlmProvider {
  OPENAI,
  ANTHROPIC,
  BEDROCK;

  public static LlmProvider fromValue(String value) {
    LlmProvider provider;
    if (value == null || value.isBlank()) {
      provider = OPENAI;
    } else {
      provider =
          switch (value.toLowerCase(Locale.ROOT)) {
            case "openai" -> OPENAI;
            case "anthropic" -> ANTHROPIC;
            case "bedrock" -> BEDROCK;
            default -> throw new IllegalArgumentException("Unknown LLM provider: " + value);
          };
    }
    return provider;
  }
}
