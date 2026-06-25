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

import java.util.List;

public record LlmMessage(
    Role role, String content, String toolCallId, List<LlmToolCall> toolCalls) {
  public enum Role {
    system,
    user,
    assistant,
    tool
  }

  public static LlmMessage system(String content) {
    return new LlmMessage(Role.system, content, null, null);
  }

  public static LlmMessage user(String content) {
    return new LlmMessage(Role.user, content, null, null);
  }

  public static LlmMessage assistant(String content) {
    return new LlmMessage(Role.assistant, content, null, null);
  }

  public static LlmMessage assistantWithToolCalls(String content, List<LlmToolCall> toolCalls) {
    return new LlmMessage(Role.assistant, content, null, toolCalls);
  }

  public static LlmMessage toolResult(String toolCallId, String content) {
    return new LlmMessage(Role.tool, content, toolCallId, null);
  }
}
