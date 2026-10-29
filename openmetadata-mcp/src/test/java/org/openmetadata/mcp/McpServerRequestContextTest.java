package org.openmetadata.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.server.McpStatelessServerFeatures;
import io.modelcontextprotocol.spec.McpSchema;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.mcp.prompts.DefaultPromptsContext;
import org.openmetadata.mcp.tools.DefaultToolContext;
import org.openmetadata.mcp.usage.McpUsageRecorder;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.ActivePersonaContext;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.util.PerRequestContextCleaner;
import org.openmetadata.service.util.RequestEntityCache;

/**
 * The MCP SDK runs each tool and prompt callback on a Reactor bounded-elastic worker that outlives
 * the call. These tests drive successive callbacks through one reused thread to prove that what a
 * call leaves in its thread-local request state cannot reach the next call, whichever way the
 * first one ended.
 */
class McpServerRequestContextTest {
  private static final String BOT = "McpApplicationBot";
  private static final String TOOL = "test_tool";
  private static final long WAIT_SECONDS = 10;

  private final UUID policyId = UUID.randomUUID();
  private final List<Boolean> cachedAtEntry = new CopyOnWriteArrayList<>();
  private ExecutorService worker;

  @BeforeEach
  void startWorker() {
    worker = Executors.newSingleThreadExecutor();
  }

  @AfterEach
  void stopWorkerAndClearThisThread() {
    worker.shutdownNow();
    PerRequestContextCleaner.clear();
  }

  @Test
  void entityCachedByOneCallIsNotVisibleToTheNextCallOnTheSameThread() throws Exception {
    DefaultToolContext toolContext = toolContextObservingAndCaching();
    McpServer server = serverFor(toolContext, jwtFilterFor("alice"));

    callOnWorker(server);
    callOnWorker(server);

    assertThat(cachedAtEntry).containsExactly(false, false);
    assertThat(onWorker(this::isPolicyCached)).isFalse();
  }

  @Test
  void stateLeftByAnUncleanedThreadIsDroppedBeforeTheCallStarts() throws Exception {
    DefaultToolContext toolContext = toolContextObservingAndCaching();
    McpServer server = serverFor(toolContext, jwtFilterFor("alice"));
    onWorker(
        () -> {
          cachePolicy();
          return null;
        });

    callOnWorker(server);

    assertThat(cachedAtEntry).containsExactly(false);
  }

  @Test
  void toolFailureStillCleansTheThread() throws Exception {
    DefaultToolContext toolContext = mock(DefaultToolContext.class);
    when(toolContext.callToolWithMetadata(any(), any(), anyString(), any(), any()))
        .thenAnswer(
            invocation -> {
              cachePolicy();
              throw new IllegalStateException("tool failed");
            });
    McpServer server = serverFor(toolContext, jwtFilterFor("alice"));

    assertThatThrownBy(() -> callOnWorker(server)).hasRootCauseMessage("tool failed");

    assertThat(onWorker(this::isPolicyCached)).isFalse();
    assertThat(onWorker(ImpersonationContext::getImpersonatedBy)).isNull();
  }

  @Test
  void authenticationFailureStillCleansTheThread() throws Exception {
    JwtFilter rejecting = mock(JwtFilter.class);
    when(rejecting.getCatalogSecurityContext(anyString()))
        .thenThrow(new IllegalArgumentException("invalid token"));
    McpServer server = serverFor(mock(DefaultToolContext.class), rejecting);
    onWorker(
        () -> {
          cachePolicy();
          ImpersonationContext.setImpersonatedBy("stale-bot");
          return null;
        });

    assertThatThrownBy(() -> callOnWorker(server)).hasRootCauseMessage("invalid token");

    assertThat(onWorker(this::isPolicyCached)).isFalse();
    assertThat(onWorker(ImpersonationContext::getImpersonatedBy)).isNull();
  }

  @Test
  void usageRecordingFailureStillCleansTheThread() {
    DefaultToolContext toolContext = toolContextObservingAndCaching();
    McpServer server = serverFor(toolContext, jwtFilterFor("alice"));

    try (MockedStatic<McpUsageRecorder> usage = mockStatic(McpUsageRecorder.class)) {
      usage
          .when(
              () ->
                  McpUsageRecorder.record(any(), any(), Mockito.anyBoolean(), any(), any(), any()))
          .thenThrow(new IllegalStateException("usage store down"));

      assertThatThrownBy(() -> callTool(server, "alice")).hasMessageContaining("usage store down");
    }

    assertThat(isPolicyCached()).isFalse();
    assertThat(ImpersonationContext.getImpersonatedBy()).isNull();
  }

  @Test
  void impersonationLeftOnTheThreadNeverReachesTheNextCall() throws Exception {
    List<String> seen = new CopyOnWriteArrayList<>();
    DefaultToolContext toolContext = mock(DefaultToolContext.class);
    when(toolContext.callToolWithMetadata(any(), any(), anyString(), any(), any()))
        .thenAnswer(
            invocation -> {
              seen.add(ImpersonationContext.getImpersonatedBy());
              seen.add(String.valueOf(ImpersonationContext.isValidated("stale-bot", "bob")));
              return successfulOutcome();
            });
    McpServer server = serverFor(toolContext, jwtFilterFor("alice"));
    onWorker(
        () -> {
          ImpersonationContext.setImpersonatedBy("stale-bot");
          ImpersonationContext.markValidated("stale-bot", "bob");
          return null;
        });

    callOnWorker(server);

    assertThat(seen).containsExactly(BOT, "false");
    assertThat(onWorker(ImpersonationContext::getImpersonatedBy)).isNull();
  }

  @Test
  void activePersonaIsResolvedPerCallAndNeverInheritedFromThePreviousOne() throws Exception {
    List<String> personaSeenByTool = new CopyOnWriteArrayList<>();
    DefaultToolContext toolContext = mock(DefaultToolContext.class);
    when(toolContext.callToolWithMetadata(any(), any(), anyString(), any(), any()))
        .thenAnswer(
            invocation -> {
              personaSeenByTool.add(String.valueOf(ActivePersonaContext.getActivePersona()));
              return successfulOutcome();
            });
    JwtFilter jwtFilter = jwtFilterFor("alice");
    when(jwtFilter.getCatalogSecurityContext(anyString(), eq("Data Steward")))
        .thenAnswer(
            invocation -> {
              ActivePersonaContext.setActivePersona("Data Steward");
              return securityContextFor("alice");
            });
    McpServer server = serverFor(toolContext, jwtFilter);

    callOnWorker(
        server, Map.of(AuthEnrichedMcpContextExtractor.ACTIVE_PERSONA_HEADER, "Data Steward"));
    callOnWorker(server);

    assertThat(personaSeenByTool).containsExactly("Data Steward", "null");
    assertThat(onWorker(ActivePersonaContext::getActivePersona)).isNull();
  }

  @Test
  void usageIsAttributedToTheUserOfEachCall() throws Exception {
    JwtFilter jwtFilter = mock(JwtFilter.class);
    CatalogSecurityContext alice = securityContextFor("alice");
    CatalogSecurityContext bob = securityContextFor("bob");
    when(jwtFilter.getCatalogSecurityContext("token-alice")).thenReturn(alice);
    when(jwtFilter.getCatalogSecurityContext("token-bob")).thenReturn(bob);
    McpServer server = serverFor(toolContextObservingAndCaching(), jwtFilter);

    try (MockedStatic<McpUsageRecorder> usage = mockStatic(McpUsageRecorder.class)) {
      callTool(server, "alice");
      callTool(server, "bob");

      usage.verify(
          () -> McpUsageRecorder.record(eq(TOOL), eq("alice"), eq(true), any(), any(), any()));
      usage.verify(
          () -> McpUsageRecorder.record(eq(TOOL), eq("bob"), eq(true), any(), any(), any()));
    }
  }

  @Test
  void promptCallbackStartsAndEndsClean() throws Exception {
    DefaultPromptsContext promptsContext = mock(DefaultPromptsContext.class);
    when(promptsContext.callPrompt(any(), anyString(), any()))
        .thenAnswer(
            invocation -> {
              cachedAtEntry.add(isPolicyCached());
              cachePolicy();
              return new McpSchema.GetPromptResult("ok", new ArrayList<>());
            });
    McpServer server = new McpServer(mock(DefaultToolContext.class), promptsContext);
    server.jwtFilter = jwtFilterFor("alice");
    McpStatelessServerFeatures.SyncPromptSpecification spec = server.getPrompt(promptNamed("p"));

    onWorker(() -> spec.promptHandler().apply(transportContext(Map.of()), promptRequest()));
    onWorker(() -> spec.promptHandler().apply(transportContext(Map.of()), promptRequest()));

    assertThat(cachedAtEntry).containsExactly(false, false);
    assertThat(onWorker(this::isPolicyCached)).isFalse();
  }

  @Test
  void promptFailureStillCleansTheThread() throws Exception {
    DefaultPromptsContext promptsContext = mock(DefaultPromptsContext.class);
    when(promptsContext.callPrompt(any(), anyString(), any()))
        .thenAnswer(
            invocation -> {
              cachePolicy();
              throw new IllegalStateException("prompt failed");
            });
    McpServer server = new McpServer(mock(DefaultToolContext.class), promptsContext);
    McpStatelessServerFeatures.SyncPromptSpecification spec = server.getPrompt(promptNamed("p"));

    assertThatThrownBy(
            () ->
                onWorker(
                    () -> spec.promptHandler().apply(transportContext(Map.of()), promptRequest())))
        .hasRootCauseMessage("prompt failed");

    assertThat(onWorker(this::isPolicyCached)).isFalse();
  }

  private DefaultToolContext toolContextObservingAndCaching() {
    DefaultToolContext toolContext = mock(DefaultToolContext.class);
    doAnswer(
            invocation -> {
              cachedAtEntry.add(isPolicyCached());
              cachePolicy();
              return successfulOutcome();
            })
        .when(toolContext)
        .callToolWithMetadata(any(), any(), anyString(), any(), any());
    return toolContext;
  }

  private McpServer serverFor(DefaultToolContext toolContext, JwtFilter jwtFilter) {
    McpServer server = new McpServer(toolContext, null);
    server.jwtFilter = jwtFilter;
    server.authorizer = mock(Authorizer.class);
    server.limits = mock(Limits.class);
    return server;
  }

  private static JwtFilter jwtFilterFor(String userName) {
    JwtFilter jwtFilter = mock(JwtFilter.class);
    CatalogSecurityContext securityContext = securityContextFor(userName);
    when(jwtFilter.getCatalogSecurityContext(anyString())).thenReturn(securityContext);
    return jwtFilter;
  }

  private static CatalogSecurityContext securityContextFor(String userName) {
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(() -> userName);
    return securityContext;
  }

  private static DefaultToolContext.CallToolOutcome successfulOutcome() {
    McpSchema.CallToolResult result =
        McpSchema.CallToolResult.builder()
            .content(List.of(new McpSchema.TextContent("{}")))
            .isError(false)
            .build();
    return new DefaultToolContext.CallToolOutcome(result, 0L, null);
  }

  private McpSchema.CallToolResult callOnWorker(McpServer server) throws Exception {
    return callOnWorker(server, Map.of());
  }

  private McpSchema.CallToolResult callOnWorker(McpServer server, Map<String, Object> extra)
      throws Exception {
    return onWorker(() -> callToolWith(server, TOOL, new HashMap<>(), extra, "token"));
  }

  private McpSchema.CallToolResult callTool(McpServer server, String userName) {
    return callToolWith(server, TOOL, new HashMap<>(), Map.of(), "token-" + userName);
  }

  private McpSchema.CallToolResult callToolWith(
      McpServer server,
      String toolName,
      Map<String, Object> arguments,
      Map<String, Object> extraContext,
      String token) {
    McpSchema.Tool tool = McpSchema.Tool.builder().name(toolName).description("desc").build();
    Map<String, Object> context = new HashMap<>(extraContext);
    context.put(AuthEnrichedMcpContextExtractor.AUTHORIZATION_HEADER, token);
    return server
        .getTool(tool)
        .callHandler()
        .apply(
            transportContext(context),
            McpSchema.CallToolRequest.builder().name(toolName).arguments(arguments).build());
  }

  private static McpTransportContext transportContext(Map<String, Object> values) {
    return McpTransportContext.create(values);
  }

  private static McpSchema.Prompt promptNamed(String name) {
    return new McpSchema.Prompt(name, "desc", List.of());
  }

  private static McpSchema.GetPromptRequest promptRequest() {
    return new McpSchema.GetPromptRequest("p", Map.of("Authorization", "token"));
  }

  private <T> T onWorker(Callable<T> action) throws Exception {
    return worker.submit(action).get(WAIT_SECONDS, TimeUnit.SECONDS);
  }

  private void cachePolicy() {
    Policy policy = new Policy().withId(policyId).withName("DataConsumerPolicy");
    RequestEntityCache.putById(Entity.POLICY, policyId, null, null, false, policy, Policy.class);
  }

  private boolean isPolicyCached() {
    return RequestEntityCache.getById(Entity.POLICY, policyId, null, null, false, Policy.class)
        != null;
  }
}
