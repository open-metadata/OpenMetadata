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
 * A context memory's privacy comes from its own {@code shareConfig}, not from a role or policy, so
 * no {@code authorize()} call can enforce it - and {@code ViewAll} on every resource is granted to
 * every user by DataConsumerPolicy. These tests pin the MCP read paths that reach a memory by name:
 * each must answer another user's PRIVATE memory the way the REST endpoint does, with a denial and
 * no body.
 */
class McpContextMemoryVisibilityIT extends McpTestBase {

  private static final String SECRET_ANSWER = "the-forecast-is-locked-to-its-owner";

  private static String memoryFqn;
  private static String memoryId;
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

  @Test
  void companyContextByName_withholdsAMemoryTheCallerMayNotSee() throws Exception {
    Map<String, Object> call =
        McpTestUtils.createToolCallRequest("company_context", Map.of("fqn", memoryFqn));

    assertThat(executeMcpRequest(call, intruderToken).toString()).doesNotContain(SECRET_ANSWER);
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
