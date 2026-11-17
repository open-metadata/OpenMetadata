package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.ChangeRequestITSupport.INCLUDE_DESCRIPTION;
import static org.openmetadata.it.tests.ChangeRequestITSupport.ORIGINAL_DN;
import static org.openmetadata.it.tests.ChangeRequestITSupport.PUBLISHED;
import static org.openmetadata.it.tests.ChangeRequestITSupport.createBot;
import static org.openmetadata.it.tests.ChangeRequestITSupport.createBotUser;
import static org.openmetadata.it.tests.ChangeRequestITSupport.deployHookWorkflow;
import static org.openmetadata.it.tests.ChangeRequestITSupport.descriptionOf;
import static org.openmetadata.it.tests.ChangeRequestITSupport.filterScopedTo;
import static org.openmetadata.it.tests.ChangeRequestITSupport.gatedGlossary;
import static org.openmetadata.it.tests.ChangeRequestITSupport.generateBotToken;
import static org.openmetadata.it.tests.ChangeRequestITSupport.onlyPendingRequest;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.tests.mcp.McpTestBase;
import org.openmetadata.it.tests.mcp.McpTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;

/**
 * {@code X-Impersonate-User} on {@code /mcp} follows REST's rules, and a write an approval workflow
 * holds answers as held.
 */
// The held-write test deploys an Enforce workflow, which receives the signals of every glossary
// event, so the class runs alone, as ChangeRequestAdmissionIT does.
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class McpImpersonationIT extends McpTestBase {
  private static final String IMPERSONATE_HEADER = "X-Impersonate-User";
  private static final String USER_CONTEXT = "get_user_context";
  private static final Map<String, Object> USER_ONLY =
      Map.of("includeOwnedSummary", false, "includeFollowedSummary", false);
  private static final int UNAUTHORIZED = -32001;
  private static final int FORBIDDEN = 403;
  private static final String NO_EXCLUDE = "";

  @BeforeAll
  static void setUp() throws Exception {
    initAuth();
  }

  @Test
  void aGrantedBotRunsAsTheUserItImpersonates(TestNamespace ns) throws Exception {
    User viewer = createUser(ns, "viewer");
    User botUser = createBotUser(ns, "mcpimp");
    createBot(ns.prefix("mcp_imp_bot"), botUser, true);
    String botToken = bearer(generateBotToken(botUser));

    JsonNode asViewer = payload(callTool(botToken, viewer.getName(), USER_CONTEXT, USER_ONLY));
    JsonNode asItself = payload(callTool(botToken, null, USER_CONTEXT, USER_ONLY));

    assertEquals(lower(viewer.getName()), lower(asViewer.path("user").path("name").asText()));
    assertEquals(lower(botUser.getName()), lower(asItself.path("user").path("name").asText()));
  }

  @Test
  void aBotWithoutTheGrantIsRefused(TestNamespace ns) throws Exception {
    User viewer = createUser(ns, "viewer");
    User botUser = createBotUser(ns, "mcpnogrant");
    createBot(ns.prefix("mcp_nogrant_bot"), botUser, false);

    JsonNode response =
        callTool(bearer(generateBotToken(botUser)), viewer.getName(), USER_CONTEXT, USER_ONLY);

    assertEquals(UNAUTHORIZED, response.path("error").path("code").asInt(), response.toString());
  }

  @Test
  void aUserTokenAskingToImpersonateIsRefused(TestNamespace ns) throws Exception {
    User viewer = createUser(ns, "viewer");

    JsonNode response = callTool(authToken, viewer.getName(), USER_CONTEXT, USER_ONLY);

    assertEquals(UNAUTHORIZED, response.path("error").path("code").asInt(), response.toString());
  }

  /** Even impersonating an admin: a policy outlives the request, as REST's PolicyResource holds. */
  @Test
  void anImpersonatedCallCannotCreateAPolicy(TestNamespace ns) throws Exception {
    User botUser = createBotUser(ns, "mcpgrant");
    createBot(ns.prefix("mcp_grant_bot"), botUser, true);
    String policyName = ns.prefix("impPolicy");

    JsonNode result =
        callTool(
                bearer(generateBotToken(botUser)),
                "admin",
                "create_entity",
                Map.of("entityType", Entity.POLICY, "name", policyName))
            .path("result");

    assertTrue(result.path("isError").asBoolean(), result.toString());
    assertEquals(FORBIDDEN, result.path("structuredContent").path("statusCode").asInt());
    assertThrows(Exception.class, () -> SdkClients.adminClient().policies().getByName(policyName));
  }

  @Test
  void aHeldPatchAnswersPendingApprovalWithItsChangeRequest(TestNamespace ns) throws Exception {
    Glossary glossary = gatedGlossary(ns, ORIGINAL_DN);
    deployHookWorkflow(
        ns, INCLUDE_DESCRIPTION, NO_EXCLUDE, filterScopedTo(glossary.getFullyQualifiedName()));

    JsonNode reply =
        payload(
            callTool(
                authToken,
                null,
                "patch_entity",
                Map.of(
                    "entityType",
                    Entity.GLOSSARY,
                    "fqn",
                    glossary.getFullyQualifiedName(),
                    "patch",
                    "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"proposed\"}]")));

    assertEquals("pendingApproval", reply.path("_operation").asText(), reply.toString());
    assertEquals(
        onlyPendingRequest(glossary.getId()).getId().toString(),
        reply.path("changeRequestId").asText());
    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
  }

  /** McpTestBase sends no headers beyond the token, so the impersonation header is added here. */
  private JsonNode callTool(
      String token, String impersonate, String tool, Map<String, Object> arguments)
      throws Exception {
    String body =
        OBJECT_MAPPER.writeValueAsString(McpTestUtils.createToolCallRequest(tool, arguments));
    HttpRequest.Builder request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp")))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .header("Authorization", token)
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .timeout(Duration.ofSeconds(30));
    if (impersonate != null) {
      request.header(IMPERSONATE_HEADER, impersonate);
    }
    HttpResponse<String> response =
        HTTP_CLIENT.send(request.build(), HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), response.body());
    return OBJECT_MAPPER.readTree(extractJsonFromResponse(response.body()));
  }

  private static JsonNode payload(JsonNode response) throws Exception {
    JsonNode result = response.path("result");
    assertTrue(result.isObject(), response.toString());
    return result.has("structuredContent")
        ? result.get("structuredContent")
        : OBJECT_MAPPER.readTree(result.path("content").get(0).path("text").asText());
  }

  private static User createUser(TestNamespace ns, String suffix) {
    String name = suffix + ns.shortPrefix();
    return SdkClients.adminClient()
        .users()
        .create(new CreateUser().withName(name).withEmail(name + "@test.com"));
  }

  private static String bearer(String token) {
    return "Bearer " + token;
  }

  private static String lower(String value) {
    return value.toLowerCase(Locale.ROOT);
  }
}
