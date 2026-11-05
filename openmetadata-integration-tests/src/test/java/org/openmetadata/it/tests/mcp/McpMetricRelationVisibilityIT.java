package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreateMetricGroup;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/**
 * get_entity_details answers with a metric's relations and a metric group's member count, so it
 * hides the ones a caller may not view exactly as the REST reads do.
 *
 * <p>ADR:2026-10-31-metric-and-metric-group-responses-hide-relations-the-viewer-cannot-see
 */
class McpMetricRelationVisibilityIT extends McpTestBase {

  private static final String RESTRICTED_TAG = "PII.Sensitive";

  private static Metric hiddenParent;
  private static Metric hiddenRelated;
  private static Metric current;
  private static Metric hiddenChild;
  private static Metric visibleChild;
  private static Metric memberOfHiddenGroup;
  private static Metric hiddenMember;
  private static MetricGroup hiddenGroup;
  private static MetricGroup visibleGroup;
  private static String restrictedToken;
  private static String suffix;

  @BeforeAll
  static void setup() throws Exception {
    initAuth();
    suffix = UUID.randomUUID().toString().substring(0, 8);
    hiddenParent = createMetric(restricted(metric("mcp_rel_hidden_parent_" + suffix)));
    hiddenRelated = createMetric(restricted(metric("mcp_rel_hidden_related_" + suffix)));
    current =
        createMetric(
            metric("mcp_rel_current_" + suffix)
                .withParent(hiddenParent.getFullyQualifiedName())
                .withRelatedMetrics(List.of(hiddenRelated.getFullyQualifiedName())));
    hiddenChild =
        createMetric(
            restricted(
                metric("mcp_rel_hidden_child_" + suffix)
                    .withParent(current.getFullyQualifiedName())));
    visibleChild =
        createMetric(
            metric("mcp_rel_visible_child_" + suffix).withParent(current.getFullyQualifiedName()));
    memberOfHiddenGroup = createMetric(metric("mcp_rel_in_hidden_group_" + suffix));
    hiddenGroup =
        put(
            "metricGroups",
            new CreateMetricGroup()
                .withName("mcp_rel_hidden_group_" + suffix)
                .withTags(List.of(new TagLabel().withTagFQN(RESTRICTED_TAG)))
                .withMetrics(List.of(memberOfHiddenGroup.getFullyQualifiedName())),
            MetricGroup.class);
    hiddenMember = createMetric(restricted(metric("mcp_rel_hidden_member_" + suffix)));
    Metric visibleMember = createMetric(metric("mcp_rel_visible_member_" + suffix));
    visibleGroup =
        put(
            "metricGroups",
            new CreateMetricGroup()
                .withName("mcp_rel_visible_group_" + suffix)
                .withMetrics(
                    List.of(
                        hiddenMember.getFullyQualifiedName(),
                        visibleMember.getFullyQualifiedName())),
            MetricGroup.class);
    restrictedToken = bearerFor(createRestrictedUser(suffix));
  }

  @Test
  void metricRead_omitsTheRelationsTheCallerCannotView() throws Exception {
    // The admin read is the barrier: it proves each hidden reference is on the entity, so its
    // absence below is the visibility rule and not a relation that was never stored.
    JsonNode unrestricted = readEntity(Entity.METRIC, current.getFullyQualifiedName(), authToken);
    assertThat(unrestricted.path("parent").path("id").asText())
        .isEqualTo(hiddenParent.getId().toString());
    assertThat(idsOf(unrestricted.path("children")))
        .containsExactlyInAnyOrder(hiddenChild.getId().toString(), visibleChild.getId().toString());
    assertThat(idsOf(unrestricted.path("relatedMetrics")))
        .containsExactly(hiddenRelated.getId().toString());
    assertThat(unrestricted.path("childrenCount").asInt()).isEqualTo(2);

    JsonNode restricted =
        readEntity(Entity.METRIC, current.getFullyQualifiedName(), restrictedToken);
    assertThat(isAbsent(restricted.path("parent"))).isTrue();
    assertThat(idsOf(restricted.path("children"))).containsExactly(visibleChild.getId().toString());
    assertThat(idsOf(restricted.path("relatedMetrics"))).isEmpty();
    assertThat(restricted.path("childrenCount").asInt()).isEqualTo(1);
    assertThat(restricted.toString())
        .doesNotContain(hiddenParent.getName(), hiddenChild.getName(), hiddenRelated.getName());
  }

  @Test
  void metricRead_omitsAGroupTheCallerCannotView() throws Exception {
    JsonNode unrestricted =
        readEntity(Entity.METRIC, memberOfHiddenGroup.getFullyQualifiedName(), authToken);
    assertThat(unrestricted.path("metricGroup").path("id").asText())
        .isEqualTo(hiddenGroup.getId().toString());

    JsonNode restricted =
        readEntity(Entity.METRIC, memberOfHiddenGroup.getFullyQualifiedName(), restrictedToken);
    assertThat(isAbsent(restricted.path("metricGroup"))).isTrue();
    assertThat(restricted.toString()).doesNotContain(hiddenGroup.getName());
  }

  @Test
  void metricGroupRead_countsOnlyTheMembersTheCallerCanView() throws Exception {
    JsonNode unrestricted =
        readEntity(Entity.METRIC_GROUP, visibleGroup.getFullyQualifiedName(), authToken);
    assertThat(unrestricted.path("metricCount").asInt()).isEqualTo(2);

    JsonNode restricted =
        readEntity(Entity.METRIC_GROUP, visibleGroup.getFullyQualifiedName(), restrictedToken);
    assertThat(restricted.path("metricCount").asInt()).isEqualTo(1);
    assertThat(restricted.toString()).doesNotContain(hiddenMember.getName());
  }

  /** A patch answers with the patched entity, so a write by the restricted caller is a read too. */
  @Test
  void patchResponse_omitsTheRelationsTheCallerCannotView() throws Exception {
    JsonNode unrestricted = patchDescription(current, "Patched by the admin", authToken);
    assertThat(unrestricted.path("parent").path("id").asText())
        .isEqualTo(hiddenParent.getId().toString());

    JsonNode restricted =
        patchDescription(current, "Patched by the restricted user", restrictedToken);
    assertThat(isAbsent(restricted.path("parent"))).isTrue();
    assertThat(idsOf(restricted.path("relatedMetrics"))).isEmpty();
    assertThat(restricted.toString())
        .doesNotContain(hiddenParent.getName(), hiddenRelated.getName());
  }

  /** A metric created below a parent inherits the parent's group, which the creator may not view. */
  @Test
  void createResponse_omitsAnInheritedGroupTheCallerCannotView() throws Exception {
    String name = "mcp_rel_created_variant_%s".formatted(suffix);
    JsonNode created =
        callTool(
            McpTestUtils.createToolCallRequest(
                "create_entity",
                Map.of(
                    "entityType",
                    Entity.METRIC,
                    "name",
                    name,
                    "description",
                    "Variant created through MCP",
                    "attributes",
                    Map.of(
                        "parent",
                        Map.of("id", memberOfHiddenGroup.getId().toString(), "type", Entity.METRIC),
                        "metricExpression",
                        Map.of("language", "SQL", "code", "SELECT COUNT(*) FROM orders")))),
            restrictedToken);
    assertThat(isAbsent(created.path("metricGroup"))).isTrue();
    assertThat(created.toString()).doesNotContain(hiddenGroup.getName());

    // The admin read is the barrier: the variant did inherit the hidden group.
    JsonNode unrestricted = readEntity(Entity.METRIC, name, authToken);
    assertThat(unrestricted.path("metricGroup").path("id").asText())
        .isEqualTo(hiddenGroup.getId().toString());
  }

  private JsonNode readEntity(String entityType, String fqn, String token) throws Exception {
    return callTool(McpTestUtils.createGetEntityToolCall(entityType, fqn), token);
  }

  private JsonNode patchDescription(Metric metric, String description, String token)
      throws Exception {
    String patch =
        OBJECT_MAPPER.writeValueAsString(
            List.of(Map.of("op", "add", "path", "/description", "value", description)));
    return callTool(
        McpTestUtils.createPatchEntityToolCall(
            Entity.METRIC, metric.getFullyQualifiedName(), patch),
        token);
  }

  private JsonNode callTool(Map<String, Object> request, String token) throws Exception {
    JsonNode response = executeMcpRequest(request, token);
    assertThat(response.path("result").path("isError").asBoolean(false))
        .as(response.toString())
        .isFalse();
    return OBJECT_MAPPER.readTree(
        response.path("result").path("content").get(0).path("text").asText());
  }

  private static List<String> idsOf(JsonNode references) {
    return StreamSupport.stream(references.spliterator(), false)
        .map(reference -> reference.path("id").asText())
        .toList();
  }

  private static boolean isAbsent(JsonNode node) {
    return node.isMissingNode() || node.isNull();
  }

  private static CreateMetric metric(String name) {
    return new CreateMetric().withName(name).withDescription("MCP metric relation visibility IT");
  }

  private static CreateMetric restricted(CreateMetric create) {
    return create.withTags(List.of(new TagLabel().withTagFQN(RESTRICTED_TAG)));
  }

  private static Metric createMetric(CreateMetric create) throws Exception {
    return post("metrics", create, Metric.class);
  }

  /**
   * Views, creates and describes across the catalog, except that the metrics and metric groups
   * tagged as restricted are hidden from it.
   */
  private static User createRestrictedUser(String suffix) throws Exception {
    List<MetadataOperation> viewOperations =
        List.of(MetadataOperation.VIEW_BASIC, MetadataOperation.VIEW_ALL);
    Rule allowCatalog =
        new Rule()
            .withName("AllowCatalog")
            .withResources(List.of("All"))
            .withOperations(
                List.of(
                    MetadataOperation.VIEW_BASIC,
                    MetadataOperation.VIEW_ALL,
                    MetadataOperation.CREATE,
                    MetadataOperation.EDIT_DESCRIPTION))
            .withEffect(Rule.Effect.ALLOW);
    Rule denyRestricted =
        new Rule()
            .withName("DenyRestrictedMetrics")
            .withResources(List.of(Entity.METRIC, Entity.METRIC_GROUP))
            .withOperations(viewOperations)
            .withCondition("matchAnyTag('%s')".formatted(RESTRICTED_TAG))
            .withEffect(Rule.Effect.DENY);
    Policy policy =
        post(
            "policies",
            new CreatePolicy()
                .withName("mcp_rel_policy_" + suffix)
                .withRules(List.of(allowCatalog, denyRestricted)),
            Policy.class);
    Role role =
        post(
            "roles",
            new CreateRole()
                .withName("mcp_rel_role_" + suffix)
                .withPolicies(List.of(policy.getFullyQualifiedName())),
            Role.class);
    String name = "mcp_rel_restricted_" + suffix;
    return post(
        "users",
        new CreateUser()
            .withName(name)
            .withEmail("%s@test.openmetadata.org".formatted(name))
            .withRoles(List.of(role.getId())),
        User.class);
  }

  private static String bearerFor(User user) {
    String email = user.getEmail();
    return "Bearer %s".formatted(JwtAuthProvider.tokenFor(email, email, new String[] {}, 3_600));
  }
}
