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
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.prompts.DefaultPromptsContext;
import org.openmetadata.mcp.tools.DefaultToolContext;
import org.openmetadata.service.security.JwtFilter;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/**
 * The SDK runs each callback on a Reactor worker, and Reactor drops a JVM-fatal error there instead
 * of failing the call. A callback that hits one must still answer the caller.
 */
class McpServerFatalErrorTest {
  private static final String TOKEN = "token";

  private final McpServer server =
      new McpServer(mock(DefaultToolContext.class), new DefaultPromptsContext());

  @Test
  void toolCallThatOverflowsTheStackIsAnsweredWithAnInternalError() {
    server.jwtFilter = mock(JwtFilter.class);
    when(server.jwtFilter.getCatalogSecurityContext(TOKEN)).thenThrow(new StackOverflowError());
    McpSchema.Tool tool = McpSchema.Tool.builder().name("patch_entity").description("desc").build();
    McpSchema.CallToolRequest request =
        McpSchema.CallToolRequest.builder().name("patch_entity").arguments(Map.of()).build();
    McpTransportContext context =
        McpTransportContext.create(
            Map.of(AuthEnrichedMcpContextExtractor.AUTHORIZATION_HEADER, TOKEN));

    // How the SDK runs a sync tool; without the fix the Mono never completes and block times out.
    Mono<McpSchema.CallToolResult> call =
        Mono.fromCallable(() -> server.getTool(tool).callHandler().apply(context, request))
            .subscribeOn(Schedulers.boundedElastic());

    assertThatThrownBy(() -> call.block(Duration.ofSeconds(10)))
        .isInstanceOfSatisfying(
            McpError.class,
            error ->
                assertThat(error.getJsonRpcError().code())
                    .isEqualTo(McpSchema.ErrorCodes.INTERNAL_ERROR));
  }
}
