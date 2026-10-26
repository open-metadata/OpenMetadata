/*
 *  Copyright 2026 Collate
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

package org.openmetadata.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.spec.McpError;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpSchema.JSONRPCResponse.JSONRPCError;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.prompts.DefaultPromptsContext;
import org.openmetadata.mcp.tools.DefaultToolContext;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.credentials.CredentialUnavailableException;

/**
 * Tool and prompt callbacks check the caller's token themselves. When the server cannot confirm it,
 * the caller reads a retryable condition, not an internal error carrying the server's message.
 */
class McpServerUnconfirmedTokenTest {
  private static final String TOKEN = "token";
  private static final JSONRPCError TEMPORARILY_UNAVAILABLE =
      new JSONRPCError(-32003, "Credential verification is temporarily unavailable", null);

  private final McpServer server =
      new McpServer(mock(DefaultToolContext.class), new DefaultPromptsContext());

  @Test
  void toolCallerReadsTemporarilyUnavailable() {
    server.jwtFilter = filterThatCannotConfirm();
    McpSchema.Tool tool =
        McpSchema.Tool.builder().name("search_metadata").description("desc").build();
    McpSchema.CallToolRequest request =
        McpSchema.CallToolRequest.builder().name("search_metadata").arguments(Map.of()).build();
    McpTransportContext context =
        McpTransportContext.create(
            Map.of(AuthEnrichedMcpContextExtractor.AUTHORIZATION_HEADER, TOKEN));

    assertThatThrownBy(() -> server.getTool(tool).callHandler().apply(context, request))
        .isInstanceOfSatisfying(
            McpError.class,
            error -> assertThat(error.getJsonRpcError()).isEqualTo(TEMPORARILY_UNAVAILABLE));
  }

  @Test
  void promptCallerReadsTemporarilyUnavailable() {
    server.jwtFilter = filterThatCannotConfirm();
    McpSchema.Prompt prompt = new McpSchema.Prompt("search_metadata", "desc", List.of());
    McpSchema.GetPromptRequest request =
        new McpSchema.GetPromptRequest("search_metadata", Map.of("Authorization", TOKEN));

    assertThatThrownBy(
            () ->
                server
                    .getPrompt(prompt)
                    .promptHandler()
                    .apply(McpTransportContext.create(Map.of()), request))
        .isInstanceOfSatisfying(
            McpError.class,
            error -> assertThat(error.getJsonRpcError()).isEqualTo(TEMPORARILY_UNAVAILABLE));
  }

  private static JwtFilter filterThatCannotConfirm() {
    JwtFilter jwtFilter = mock(JwtFilter.class);
    when(jwtFilter.getCatalogSecurityContext(TOKEN))
        .thenThrow(new CredentialUnavailableException("No read slot for alice", 2, null));
    return jwtFilter;
  }
}
