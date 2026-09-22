package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.service.Entity;

/**
 * A context memory's visibility comes from its own {@code shareConfig} rather than from a role or
 * policy. These tests pin the MCP paths that reach a memory by name - the entity read, its content
 * section, the Company Context lookup and a patch - to that rule, so each answers the way the REST
 * endpoint on {@code /v1/contextCenter/memories} does.
 */
class McpContextMemoryVisibilityIT extends McpTestBase {

  private static final String SECRET_ANSWER = "the-forecast-is-locked-to-its-owner";
  private static final String SHARED_PILL_ANSWER = "the-pill-body-is-for-its-principals";

  private static String memoryFqn;
  private static String memoryId;
  private static String sharedPillFqn;
  private static String ownerToken;
  private static String intruderToken;

  @BeforeAll
  static void setup() throws Exception {
    initAuth();
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    JsonNode owner = createUser("mcp_vis_owner_" + suffix);
    JsonNode intruder = createUser("mcp_vis_intruder_" + suffix);
    ownerToken = bearerFor(owner);
    intruderToken = bearerFor(intruder);

    JsonNode memory =
        post(
            "contextCenter/memories",
            Map.of(
                "name",
                "mcp_vis_note_" + suffix,
                "description",
                "MCP visibility IT",
                "question",
                "What is the forecast?",
                "answer",
                SECRET_ANSWER,
                "owners",
                List.of(Map.of("id", owner.get("id").asText(), "type", Entity.USER)),
                "shareConfig",
                Map.of("visibility", "Private")),
            JsonNode.class);
    memoryFqn = memory.get("fullyQualifiedName").asText();
    memoryId = memory.get("id").asText();
    sharedPillFqn = createSharedPill(suffix, owner);
  }

  /**
   * A file-extracted pill owned by the admin who created it and shared with one principal, so
   * access comes from the sharedWith list rather than from ownership.
   */
  private static String createSharedPill(String suffix, JsonNode sharedPrincipal) throws Exception {
    String name = sharedPrincipal.get("name").asText();
    Map<String, Object> principal =
        Map.of(
            "principal",
            Map.of(
                "id",
                sharedPrincipal.get("id").asText(),
                "type",
                Entity.USER,
                "name",
                name,
                "fullyQualifiedName",
                name));
    JsonNode pill =
        post(
            "contextCenter/memories",
            Map.of(
                "name",
                "mcp_vis_pill_" + suffix,
                "description",
                "MCP visibility IT pill",
                "question",
                "What does the pill say?",
                "answer",
                SHARED_PILL_ANSWER,
                "sourceType",
                "FileExtraction",
                "shareConfig",
                Map.of("visibility", "Shared", "sharedWith", List.of(principal))),
            JsonNode.class);
    return pill.get("fullyQualifiedName").asText();
  }

  @Test
  void plainRead_deniesAnotherUsersPrivateMemory() throws Exception {
    Map<String, Object> call =
        McpTestUtils.createGetEntityToolCall(Entity.CONTEXT_MEMORY, memoryFqn);

    // The owner reading their own memory is the barrier: it proves the denial below is the
    // visibility rule and not a fetch that fails for everyone.
    assertThat(executeMcpRequest(call, ownerToken).toString()).contains(SECRET_ANSWER);

    JsonNode denied = executeMcpRequest(call, intruderToken);
    assertThat(denied.toString()).doesNotContain(SECRET_ANSWER);
    assertThat(denied.path("result").path("isError").asBoolean(false)).isTrue();
  }

  @Test
  void contentRead_deniesAnotherUsersPrivateMemory() throws Exception {
    Map<String, Object> call =
        McpTestUtils.createToolCallRequest(
            "get_entity_details",
            Map.of(
                "entityType",
                Entity.CONTEXT_MEMORY,
                "fqn",
                memoryFqn,
                "include",
                List.of("content")));

    assertThat(executeMcpRequest(call, ownerToken).toString()).contains(SECRET_ANSWER);

    JsonNode denied = executeMcpRequest(call, intruderToken);
    assertThat(denied.toString()).doesNotContain(SECRET_ANSWER);
    assertThat(denied.path("result").path("isError").asBoolean(false)).isTrue();
  }

  /**
   * The Company Context scope is a file-extracted pill shared with the caller, which is what the
   * tool's search half filters on. Reading one by name applies the same rule.
   */
  @Test
  void companyContextByName_answersOnlyAPrincipalThePillIsSharedWith() throws Exception {
    Map<String, Object> call =
        McpTestUtils.createToolCallRequest("company_context", Map.of("fqn", sharedPillFqn));

    assertThat(executeMcpRequest(call, ownerToken).toString()).contains(SHARED_PILL_ANSWER);

    JsonNode withheld = executeMcpRequest(call, intruderToken);
    assertThat(withheld.toString()).doesNotContain(SHARED_PILL_ANSWER);
    assertThat(withheld.toString()).contains("not a shared Company Context knowledge pill");
  }

  /**
   * A patch answers with the patched entity, so an authorized write is also a read - and
   * EditDescription is granted on every resource by DataConsumerPolicy.
   */
  @Test
  void patch_deniesAnotherUsersPrivateMemory() throws Exception {
    Map<String, Object> call =
        McpTestUtils.createToolCallRequest(
            "patch_entity",
            Map.of(
                "entityType",
                Entity.CONTEXT_MEMORY,
                "fqn",
                memoryFqn,
                "patch",
                "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"touched\"}]"));

    JsonNode denied = executeMcpRequest(call, intruderToken);
    assertThat(denied.toString()).doesNotContain(SECRET_ANSWER);
    assertThat(denied.path("result").path("isError").asBoolean(false)).isTrue();

    JsonNode unchanged = get("contextCenter/memories/" + memoryId, JsonNode.class);
    assertThat(unchanged.path("description").asText()).isEqualTo("MCP visibility IT");
  }

  private static JsonNode createUser(String name) throws Exception {
    return post(
        "users", Map.of("name", name, "email", name + "@test.openmetadata.org"), JsonNode.class);
  }

  private static String bearerFor(JsonNode user) {
    String email = user.get("email").asText();
    return "Bearer " + JwtAuthProvider.tokenFor(email, email, new String[] {}, 3_600);
  }
}
