/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class BedrockCompletionClientTest {

  private static final String RESPONSE =
      "{\"content\":[{\"type\":\"text\",\"text\":\"ok\"}],"
          + "\"usage\":{\"input_tokens\":30,\"output_tokens\":9}}";

  @Test
  void parsesTextAndUsage() {
    CompletionResult result = BedrockCompletionClient.parseResult(RESPONSE);
    assertEquals("ok", result.text());
    assertEquals(30, result.inputTokens());
    assertEquals(9, result.outputTokens());
  }

  @Test
  void requestBodyHonorsOverrides() {
    String body = BedrockCompletionClient.buildRequestBody("sys", "user", 256, 0.0);
    assertTrue(body.contains("\"max_tokens\":256"));
    assertTrue(body.contains("\"anthropic_version\""));
  }
}
