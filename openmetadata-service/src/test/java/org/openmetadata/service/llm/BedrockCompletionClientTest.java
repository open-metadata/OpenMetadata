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

import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.bedrockruntime.model.ContentBlock;
import software.amazon.awssdk.services.bedrockruntime.model.ConversationRole;
import software.amazon.awssdk.services.bedrockruntime.model.ConverseOutput;
import software.amazon.awssdk.services.bedrockruntime.model.ConverseRequest;
import software.amazon.awssdk.services.bedrockruntime.model.ConverseResponse;
import software.amazon.awssdk.services.bedrockruntime.model.Message;
import software.amazon.awssdk.services.bedrockruntime.model.TokenUsage;

class BedrockCompletionClientTest {

  @Test
  void parsesTextAndUsage() {
    ConverseResponse response =
        ConverseResponse.builder()
            .output(
                ConverseOutput.fromMessage(
                    Message.builder()
                        .role(ConversationRole.ASSISTANT)
                        .content(ContentBlock.fromText("ok"))
                        .build()))
            .usage(TokenUsage.builder().inputTokens(30).outputTokens(9).build())
            .build();
    CompletionResult result = BedrockCompletionClient.toResult(response);
    assertEquals("ok", result.text());
    assertEquals(30, result.inputTokens());
    assertEquals(9, result.outputTokens());
  }

  @Test
  void requestHonorsOverrides() {
    ConverseRequest request =
        BedrockCompletionClient.buildRequest("override-model", "sys", "user", 256, 0.0, 15);
    assertEquals("override-model", request.modelId());
    assertEquals(256, request.inferenceConfig().maxTokens());
    assertEquals(0.0f, request.inferenceConfig().temperature(), 0.0001f);
  }
}
