package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.service.Entity;

/**
 * Moving a metric, or changing a group's members, needs EditAll on the metrics that move and on
 * where they land; REST has always asked it. These tests pin create_entity and patch_entity to the
 * same checks, as a user who may edit everything except metrics and groups tagged {@code
 * PII.Sensitive}.
 */
@Execution(ExecutionMode.CONCURRENT)
class McpMetricAuthorizationIT extends McpTestBase {

  private static final String RESTRICTED_TAG_FQN = "PII.Sensitive";
  private static final String DENIED = "Authorization error";

  private static String suffix;
  private static String editorToken;
  private static JsonNode editor;
  private static JsonNode openParent;
  private static JsonNode restrictedParent;

  @BeforeAll
  static void setup() throws Exception {
    initAuth();
    suffix = UUID.randomUUID().toString().substring(0, 8);
    String editorName = "mcp_metric_editor_" + suffix;
    editor =
        post(
            "users",
            Map.of(
                "name",
                editorName,
                "email",
                editorName + "@test.openmetadata.org",
                "roles",
                List.of(restrictedMetricEditorRoleId())),
            JsonNode.class);
    editorToken = "Bearer " + tokenFor(editorName);
    openParent = createMetric("mcp_open_parent", false);
    restrictedParent = createMetric("mcp_restricted_parent", true);
  }

  @Test
  void patchEntity_movesAMetricOnlyUnderAParentTheCallerCanEdit() throws Exception {
    JsonNode source = createMetric("mcp_move_source", false);
    String sourceFqn = source.get("fullyQualifiedName").asText();

    // The move under an open parent is the barrier: it proves the refusal below is the check on
    // where the metric lands, not a patch that fails for this user anyway.
    assertThat(isError(patchMetric(sourceFqn, setParent(openParent)))).isFalse();

    JsonNode denied = patchMetric(sourceFqn, setParent(restrictedParent));
    assertThat(isError(denied)).isTrue();
    assertThat(denied.toString()).contains(DENIED);
    assertThat(parentId(sourceFqn)).isEqualTo(openParent.get("id").asText());
  }

  @Test
  void createEntity_createsAMetricOnlyUnderAParentTheCallerCanEdit() throws Exception {
    assertThat(isError(createChild("mcp_open_child_" + suffix, openParent))).isFalse();

    String deniedName = "mcp_restricted_child_" + suffix;
    JsonNode denied = createChild(deniedName, restrictedParent);
    assertThat(isError(denied)).isTrue();
    assertThat(denied.toString()).contains(DENIED);
    assertThat(getResponse("metrics/name/" + deniedName, authToken).statusCode()).isEqualTo(404);
  }

  @Test
  void patchEntity_addsToAGroupOnlyMetricsTheCallerCanEdit() throws Exception {
    JsonNode group =
        post("metricGroups", Map.of("name", "mcp_open_group_" + suffix), JsonNode.class);
    String groupFqn = group.get("fullyQualifiedName").asText();
    JsonNode openMember = createMetric("mcp_open_member", false);
    JsonNode restrictedMember = createMetric("mcp_restricted_member", true);

    assertThat(isError(patchGroup(groupFqn, addMember(openMember)))).isFalse();

    JsonNode denied = patchGroup(groupFqn, addMember(restrictedMember));
    assertThat(isError(denied)).isTrue();
    assertThat(denied.toString()).contains(DENIED);
    assertThat(memberIds(group.get("id").asText())).containsExactly(openMember.get("id").asText());
  }

  @Test
  void createEntity_createsAGroupOnlyWithMetricsTheCallerCanEdit() throws Exception {
    JsonNode openMember = createMetric("mcp_open_founder", false);
    JsonNode restrictedMember = createMetric("mcp_restricted_founder", true);

    assertThat(isError(createGroup("mcp_open_founded_" + suffix, openMember))).isFalse();

    String deniedName = "mcp_restricted_founded_" + suffix;
    JsonNode denied = createGroup(deniedName, restrictedMember);
    assertThat(isError(denied)).isTrue();
    assertThat(denied.toString()).contains(DENIED);
    assertThat(getResponse("metricGroups/name/" + deniedName, authToken).statusCode())
        .isEqualTo(404);
  }

  @Test
  void patchEntity_appendsOwnersWhileTheChecksRun() throws Exception {
    // The checks apply the patch to a copy first. The copy must carry the fields the patch edits,
    // or an append to /owners fails there before the real patch runs.
    JsonNode group =
        post("metricGroups", Map.of("name", "mcp_owned_group_" + suffix), JsonNode.class);
    JsonNode source = createMetric("mcp_owned_source", false);

    assertThat(isError(patchGroup(group.get("fullyQualifiedName").asText(), appendOwner())))
        .isFalse();
    String moveAndOwn =
        OBJECT_MAPPER.writeValueAsString(
            List.of(
                Map.of("op", "add", "path", "/parent", "value", reference(openParent)),
                Map.of("op", "add", "path", "/owners/-", "value", editorReference())));
    assertThat(isError(patchMetric(source.get("fullyQualifiedName").asText(), moveAndOwn)))
        .isFalse();

    assertThat(ownerIds("metricGroups/" + group.get("id").asText()))
        .containsExactly(editor.get("id").asText());
    assertThat(ownerIds("metrics/" + source.get("id").asText()))
        .containsExactly(editor.get("id").asText());
  }

  private static String appendOwner() throws Exception {
    return OBJECT_MAPPER.writeValueAsString(
        List.of(Map.of("op", "add", "path", "/owners/-", "value", editorReference())));
  }

  private static Map<String, String> editorReference() {
    return Map.of("id", editor.get("id").asText(), "type", Entity.USER);
  }

  private static List<String> ownerIds(String path) throws Exception {
    List<String> ids = new ArrayList<>();
    get(path + "?fields=owners", JsonNode.class)
        .path("owners")
        .forEach(owner -> ids.add(owner.get("id").asText()));
    return ids;
  }

  private JsonNode createGroup(String name, JsonNode member) throws Exception {
    Map<String, Object> arguments =
        Map.of(
            "entityType",
            Entity.METRIC_GROUP,
            "name",
            name,
            "attributes",
            Map.of("metrics", List.of(reference(member))));
    return executeMcpRequest(
        McpTestUtils.createToolCallRequest("create_entity", arguments), editorToken);
  }

  private JsonNode patchMetric(String fqn, String patch) throws Exception {
    return executeMcpRequest(
        McpTestUtils.createPatchEntityToolCall(Entity.METRIC, fqn, patch), editorToken);
  }

  private JsonNode patchGroup(String fqn, String patch) throws Exception {
    return executeMcpRequest(
        McpTestUtils.createPatchEntityToolCall(Entity.METRIC_GROUP, fqn, patch), editorToken);
  }

  private JsonNode createChild(String name, JsonNode parent) throws Exception {
    Map<String, Object> arguments =
        Map.of(
            "entityType",
            Entity.METRIC,
            "name",
            name,
            "attributes",
            Map.of(
                "parent",
                Map.of("id", parent.get("id").asText()),
                "metricExpression",
                Map.of("language", "SQL", "code", "SELECT COUNT(*) FROM orders")));
    return executeMcpRequest(
        McpTestUtils.createToolCallRequest("create_entity", arguments), editorToken);
  }

  private static String setParent(JsonNode parent) throws Exception {
    return OBJECT_MAPPER.writeValueAsString(
        List.of(Map.of("op", "add", "path", "/parent", "value", reference(parent))));
  }

  private static String addMember(JsonNode metric) throws Exception {
    return OBJECT_MAPPER.writeValueAsString(
        List.of(Map.of("op", "add", "path", "/metrics/-", "value", reference(metric))));
  }

  private static Map<String, String> reference(JsonNode metric) {
    return Map.of("id", metric.get("id").asText(), "type", Entity.METRIC);
  }

  private static boolean isError(JsonNode response) {
    return response.has("error") || response.path("result").path("isError").asBoolean(false);
  }

  private static String parentId(String fqn) throws Exception {
    return get("metrics/name/" + fqn + "?fields=parent", JsonNode.class)
        .path("parent")
        .path("id")
        .asText();
  }

  private static List<String> memberIds(String groupId) throws Exception {
    JsonNode members = get("metricGroups/" + groupId + "/metrics", JsonNode.class).path("data");
    List<String> ids = new ArrayList<>();
    members.forEach(member -> ids.add(member.get("id").asText()));
    return ids;
  }

  private static JsonNode createMetric(String prefix, boolean restricted) throws Exception {
    Map<String, Object> tag =
        Map.of(
            "tagFQN",
            RESTRICTED_TAG_FQN,
            "source",
            "Classification",
            "labelType",
            "Manual",
            "state",
            "Confirmed");
    return post(
        "metrics",
        Map.of("name", prefix + "_" + suffix, "tags", restricted ? List.of(tag) : List.of()),
        JsonNode.class);
  }

  /** May create, view and edit anything, except edit a metric or group tagged PII.Sensitive. */
  private static String restrictedMetricEditorRoleId() throws Exception {
    Map<String, Object> allow =
        Map.of(
            "name",
            "AllowCatalogWrites",
            "effect",
            "allow",
            "operations",
            List.of("Create", "ViewAll", "EditAll"),
            "resources",
            List.of("All"));
    Map<String, Object> deny =
        Map.of(
            "name",
            "DenyRestrictedMetrics",
            "effect",
            "deny",
            "operations",
            List.of("EditAll"),
            "resources",
            List.of(Entity.METRIC, Entity.METRIC_GROUP),
            "condition",
            "matchAnyTag('" + RESTRICTED_TAG_FQN + "')");
    JsonNode policy =
        post(
            "policies",
            Map.of("name", "mcp_metric_editor_" + suffix, "rules", List.of(allow, deny)),
            JsonNode.class);
    JsonNode role =
        post(
            "roles",
            Map.of(
                "name",
                "mcp_metric_editor_" + suffix,
                "policies",
                List.of(policy.get("fullyQualifiedName").asText())),
            JsonNode.class);
    return role.get("id").asText();
  }
}
