package org.openmetadata.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.server.McpStatelessServerFeatures;
import io.modelcontextprotocol.spec.McpError;
import io.modelcontextprotocol.spec.McpSchema;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.server.transport.JsonRpcErrorBody;
import org.openmetadata.mcp.tools.DefaultToolContext;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.ImpersonationDeniedException;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/**
 * Tests that MCP tool execution correctly sets ImpersonationContext on the execution thread.
 *
 * <p>Key invariant: ImpersonationContext must be set on the TOOL EXECUTION thread, not on the
 * Jetty servlet thread that handles OAuth token validation. ThreadLocal values do not cross thread
 * boundaries.
 */
public class McpImpersonationTest {

  @AfterEach
  void clearContext() {
    ImpersonationContext.clear();
  }

  /**
   * Verifies that when a tool is registered via McpServer.getTool(), the tool callback receives
   * ImpersonationContext set to the MCP bot name on the calling thread.
   */
  @Test
  void toolCallbackSetsImpersonationContextOnExecutionThread() {
    AtomicReference<String> capturedImpersonation = new AtomicReference<>();

    JwtFilter jwtFilter = mock(JwtFilter.class);
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn("admin");
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    when(jwtFilter.getCatalogSecurityContext(anyString())).thenReturn(securityContext);

    Authorizer authorizer = mock(Authorizer.class);
    Limits limits = mock(Limits.class);

    DefaultToolContext toolContext = mock(DefaultToolContext.class);
    doAnswer(
            invocation -> {
              capturedImpersonation.set(ImpersonationContext.getImpersonatedBy());
              return new DefaultToolContext.CallToolOutcome(
                  McpSchema.CallToolResult.builder()
                      .content(List.of(McpSchema.TextContent.builder("{}").build()))
                      .isError(false)
                      .build(),
                  0L,
                  null);
            })
        .when(toolContext)
        .callToolWithMetadata(any(), any(), anyString(), any(), any());

    TestMcpServer server = new TestMcpServer(toolContext, jwtFilter, authorizer, limits);
    McpSchema.Tool tool =
        McpSchema.Tool.builder("test_tool", Map.of("type", "object")).description("desc").build();
    McpStatelessServerFeatures.SyncToolSpecification spec = server.buildToolSpec(tool);

    McpTransportContext context =
        McpTransportContext.create(Map.of("Authorization", "Bearer test-token"));
    spec.callHandler().apply(context, mock(McpSchema.CallToolRequest.class));

    assertThat(capturedImpersonation.get())
        .as("ImpersonationContext must be set to MCP bot name on the tool execution thread")
        .isEqualTo("McpApplicationBot");
  }

  /**
   * An X-Impersonate-User call runs as the target and is attributed to the bot that asked, as on
   * REST, so the authorizer re-checks that bot's grant rather than the MCP bot's.
   */
  @Test
  void impersonatedToolCallIsAttributedToTheBotThatAsked() {
    AtomicReference<String> capturedImpersonation = new AtomicReference<>();
    JwtFilter jwtFilter = mock(JwtFilter.class);
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn("viewer");
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    when(securityContext.impersonatedUser()).thenReturn("ingestion-bot");
    when(jwtFilter.getCatalogSecurityContext("test-token", null, "viewer"))
        .thenReturn(securityContext);
    DefaultToolContext toolContext = mock(DefaultToolContext.class);
    doAnswer(
            invocation -> {
              capturedImpersonation.set(ImpersonationContext.getImpersonatedBy());
              return new DefaultToolContext.CallToolOutcome(
                  McpSchema.CallToolResult.builder()
                      .content(List.of(McpSchema.TextContent.builder("{}").build()))
                      .isError(false)
                      .build(),
                  0L,
                  null);
            })
        .when(toolContext)
        .callToolWithMetadata(any(), any(), anyString(), eq(securityContext), any());
    TestMcpServer server =
        new TestMcpServer(toolContext, jwtFilter, mock(Authorizer.class), mock(Limits.class));
    McpSchema.Tool tool =
        McpSchema.Tool.builder("test_tool", Map.of("type", "object")).description("desc").build();

    McpTransportContext context =
        McpTransportContext.create(
            Map.of(
                "Authorization",
                "test-token",
                AuthEnrichedMcpContextExtractor.IMPERSONATE_USER_HEADER,
                "viewer"));
    server.buildToolSpec(tool).callHandler().apply(context, mock(McpSchema.CallToolRequest.class));

    assertThat(capturedImpersonation.get()).isEqualTo("ingestion-bot");
  }

  /** A refused X-Impersonate-User is the caller's error, not -32603 "internal error". */
  @Test
  void refusedImpersonationAnswersUnauthorized() {
    JwtFilter jwtFilter = mock(JwtFilter.class);
    when(jwtFilter.getCatalogSecurityContext("test-token", null, "viewer"))
        .thenThrow(new ImpersonationDeniedException("Only bot users can impersonate other users"));
    TestMcpServer server =
        new TestMcpServer(
            mock(DefaultToolContext.class), jwtFilter, mock(Authorizer.class), mock(Limits.class));
    McpSchema.Tool tool =
        McpSchema.Tool.builder("test_tool", Map.of("type", "object")).description("desc").build();
    McpTransportContext context =
        McpTransportContext.create(
            Map.of(
                "Authorization",
                "test-token",
                AuthEnrichedMcpContextExtractor.IMPERSONATE_USER_HEADER,
                "viewer"));

    assertThatThrownBy(
            () ->
                server
                    .buildToolSpec(tool)
                    .callHandler()
                    .apply(context, mock(McpSchema.CallToolRequest.class)))
        .isInstanceOfSatisfying(
            McpError.class,
            error ->
                assertThat(error.getJsonRpcError().code())
                    .isEqualTo(JsonRpcErrorBody.UNAUTHORIZED));
  }

  @Test
  void toolCallbackCarriesTheActivePersonaIntoTheSecurityContext() {
    JwtFilter jwtFilter = mock(JwtFilter.class);
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn("steward");
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    when(jwtFilter.getCatalogSecurityContext("test-token", "Data Steward"))
        .thenReturn(securityContext);
    DefaultToolContext toolContext = mock(DefaultToolContext.class);
    when(toolContext.callToolWithMetadata(any(), any(), anyString(), eq(securityContext), any()))
        .thenReturn(
            new DefaultToolContext.CallToolOutcome(
                McpSchema.CallToolResult.builder()
                    .content(List.of(McpSchema.TextContent.builder("{}").build()))
                    .isError(false)
                    .build(),
                0L,
                null));
    TestMcpServer server =
        new TestMcpServer(toolContext, jwtFilter, mock(Authorizer.class), mock(Limits.class));
    McpSchema.Tool tool =
        McpSchema.Tool.builder("test_tool", Map.of("type", "object")).description("desc").build();

    McpTransportContext context =
        McpTransportContext.create(
            Map.of(
                "Authorization",
                "test-token",
                AuthEnrichedMcpContextExtractor.ACTIVE_PERSONA_HEADER,
                "Data Steward"));
    server.buildToolSpec(tool).callHandler().apply(context, mock(McpSchema.CallToolRequest.class));

    verify(jwtFilter).getCatalogSecurityContext("test-token", "Data Steward");
  }

  /**
   * Verifies that ImpersonationContext is cleared after tool execution completes, preventing
   * ThreadLocal leaks on Reactor thread pool reuse.
   */
  @Test
  void impersonationContextClearedAfterToolExecution() {
    JwtFilter jwtFilter = mock(JwtFilter.class);
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn("admin");
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    when(jwtFilter.getCatalogSecurityContext(anyString())).thenReturn(securityContext);

    DefaultToolContext toolContext = mock(DefaultToolContext.class);
    when(toolContext.callToolWithMetadata(any(), any(), anyString(), any(), any()))
        .thenReturn(
            new DefaultToolContext.CallToolOutcome(
                McpSchema.CallToolResult.builder()
                    .content(List.of(McpSchema.TextContent.builder("{}").build()))
                    .isError(false)
                    .build(),
                0L,
                null));

    TestMcpServer server =
        new TestMcpServer(toolContext, jwtFilter, mock(Authorizer.class), mock(Limits.class));
    McpSchema.Tool tool =
        McpSchema.Tool.builder("test_tool", Map.of("type", "object")).description("desc").build();
    McpStatelessServerFeatures.SyncToolSpecification spec = server.buildToolSpec(tool);

    McpTransportContext context =
        McpTransportContext.create(Map.of("Authorization", "Bearer token"));
    spec.callHandler().apply(context, mock(McpSchema.CallToolRequest.class));

    assertThat(ImpersonationContext.getImpersonatedBy())
        .as(
            "ImpersonationContext must be cleared after tool execution to prevent ThreadLocal leaks")
        .isNull();
  }

  /**
   * Verifies that ImpersonationContext is cleared even when tool execution throws an exception.
   */
  @Test
  void impersonationContextClearedOnToolException() {
    JwtFilter jwtFilter = mock(JwtFilter.class);
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn("admin");
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    when(jwtFilter.getCatalogSecurityContext(anyString())).thenReturn(securityContext);

    DefaultToolContext toolContext = mock(DefaultToolContext.class);
    when(toolContext.callToolWithMetadata(any(), any(), eq("error_tool"), any(), any()))
        .thenThrow(new RuntimeException("tool failed"));

    TestMcpServer server =
        new TestMcpServer(toolContext, jwtFilter, mock(Authorizer.class), mock(Limits.class));
    McpSchema.Tool tool =
        McpSchema.Tool.builder("error_tool", Map.of("type", "object")).description("desc").build();
    McpStatelessServerFeatures.SyncToolSpecification spec = server.buildToolSpec(tool);

    try {
      McpTransportContext context =
          McpTransportContext.create(Map.of("Authorization", "Bearer token"));
      spec.callHandler().apply(context, mock(McpSchema.CallToolRequest.class));
    } catch (Exception ignored) {
    }

    assertThat(ImpersonationContext.getImpersonatedBy())
        .as("ImpersonationContext must be cleared even when tool throws an exception")
        .isNull();
  }

  /**
   * Verifies that getMcpBotName() falls back to DEFAULT_MCP_BOT_NAME without caching it, so that
   * subsequent calls retry the app registry once it becomes available.
   */
  @Test
  void getMcpBotName_fallsBackToDefaultWithoutCaching() {
    JwtFilter jwtFilter = mock(JwtFilter.class);
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn("admin");
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    when(jwtFilter.getCatalogSecurityContext(anyString())).thenReturn(securityContext);

    AtomicReference<String> firstCall = new AtomicReference<>();
    AtomicReference<String> secondCall = new AtomicReference<>();

    DefaultToolContext toolContext = mock(DefaultToolContext.class);
    doAnswer(
            invocation -> {
              if (firstCall.get() == null) {
                firstCall.set(ImpersonationContext.getImpersonatedBy());
              } else {
                secondCall.set(ImpersonationContext.getImpersonatedBy());
              }
              return new DefaultToolContext.CallToolOutcome(
                  McpSchema.CallToolResult.builder()
                      .content(List.of(McpSchema.TextContent.builder("{}").build()))
                      .isError(false)
                      .build(),
                  0L,
                  null);
            })
        .when(toolContext)
        .callToolWithMetadata(any(), any(), anyString(), any(), any());

    TestMcpServer server =
        new TestMcpServer(toolContext, jwtFilter, mock(Authorizer.class), mock(Limits.class));
    McpSchema.Tool tool =
        McpSchema.Tool.builder("test_tool", Map.of("type", "object")).description("desc").build();
    McpStatelessServerFeatures.SyncToolSpecification spec = server.buildToolSpec(tool);

    McpTransportContext context =
        McpTransportContext.create(Map.of("Authorization", "Bearer token"));
    spec.callHandler().apply(context, mock(McpSchema.CallToolRequest.class));
    spec.callHandler().apply(context, mock(McpSchema.CallToolRequest.class));

    assertThat(firstCall.get())
        .as("First call with no app registered must still fall back to McpApplicationBot")
        .isEqualTo("McpApplicationBot");
    assertThat(secondCall.get())
        .as("Second call must also use McpApplicationBot (retry path works)")
        .isEqualTo("McpApplicationBot");
  }

  /** Test-only subclass of McpServer that exposes the tool spec builder for unit testing. */
  static class TestMcpServer extends McpServer {
    TestMcpServer(
        DefaultToolContext toolContext, JwtFilter jwtFilter, Authorizer authorizer, Limits limits) {
      super(toolContext, null);
      this.jwtFilter = jwtFilter;
      this.authorizer = authorizer;
      this.limits = limits;
    }

    McpStatelessServerFeatures.SyncToolSpecification buildToolSpec(McpSchema.Tool tool) {
      return getTool(tool);
    }
  }
}
