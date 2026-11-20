package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.GlossaryTestFactory;

/**
 * Real MCP dispatch, JWT/RBAC, persistence and edit leases; run with RDF disabled. Status fixtures
 * use the bootstrap's existing automatic-workflow exclusion so persistence assertions are stable.
 */
@Execution(ExecutionMode.SAME_THREAD)
class McpOntologyGovernanceIT extends McpTestBase {
  private static final List<String> ROOTS = new ArrayList<>();
  private static final String SUFFIX = UUID.randomUUID().toString().substring(0, 8);
  private static String editorToken;
  private static JsonNode glossary;
  private static JsonNode restrictedGlossary;
  private static JsonNode source;
  private static JsonNode target;
  private static JsonNode restrictedTerm;

  @BeforeAll
  static void setup() throws Exception {
    initAuth();
    final String name = "ontology_editor_" + SUFFIX;
    final JsonNode policy =
        create(
            "policies",
            Map.of(
                "name",
                name,
                "rules",
                List.of(
                    Map.of(
                        "name",
                        "AllowCatalogWrites",
                        "effect",
                        "allow",
                        "resources",
                        List.of("All"),
                        "operations",
                        List.of("Create", "ViewAll", "EditAll")),
                    Map.of(
                        "name",
                        "DenyRestrictedOntology",
                        "effect",
                        "deny",
                        "resources",
                        List.of("glossary", "glossaryTerm"),
                        "operations",
                        List.of("All"),
                        "condition",
                        "matchAnyTag('PII.Sensitive')"))));
    final JsonNode role =
        create(
            "roles",
            Map.of("name", name, "policies", List.of(policy.path("fullyQualifiedName").asText())));
    create(
        "users",
        Map.of(
            "name",
            name,
            "email",
            name + "@test.openmetadata.org",
            "roles",
            List.of(role.path("id").asText())));
    editorToken = "Bearer " + tokenFor(name);
    glossary =
        create(
            "glossaries",
            Map.of(
                "name",
                GlossaryTestFactory.STATUS_TEST_GLOSSARY_PREFIX + "__mcp_ontology_" + SUFFIX,
                "description",
                "Disposable MCP integration glossary"));
    restrictedGlossary =
        create(
            "glossaries",
            Map.of(
                "name",
                GlossaryTestFactory.STATUS_TEST_GLOSSARY_PREFIX
                    + "__mcp_private_ontology_"
                    + SUFFIX,
                "description",
                "Disposable restricted MCP integration glossary",
                "tags",
                List.of(
                    Map.of(
                        "tagFQN",
                        "PII.Sensitive",
                        "source",
                        "Classification",
                        "labelType",
                        "Manual",
                        "state",
                        "Confirmed"))));
    source = term(glossary, "Source");
    target = term(glossary, "Target");
    restrictedTerm = term(restrictedGlossary, "Private");
  }

  @AfterAll
  static void cleanup() throws Exception {
    Collections.reverse(ROOTS);
    for (final String root : ROOTS) {
      delete(root + "?hardDelete=true&recursive=true");
    }
  }

  @Test
  void permittedNonAdministratorCreatesAnAiSuggestedTypedRelation() throws Exception {
    final JsonNode from = term(glossary, "AllowedFrom");
    final JsonNode result = call("create_term_relation", relation(from, target), editorToken);
    assertThat(result.path("_operation").asText()).isIn("created", "updated", "unchanged");
    final JsonNode edges =
        get("glossaryTerms/" + from.path("id").asText() + "?fields=relatedTerms", JsonNode.class)
            .path("relatedTerms");
    assertThat(edges).hasSize(1);
    assertThat(edges.get(0).path("provenance").asText()).isEqualTo("AiSuggested");
    assertThat(edges.get(0).path("status").asText()).isEqualTo("Unprocessed");
    assertThat(edges.get(0).path("createdBy").asText()).isEqualTo("ontology_editor_" + SUFFIX);
    call("create_term_relation", relation(from, target), editorToken);
    assertThat(
            get(
                    "glossaryTerms/" + from.path("id").asText() + "?fields=relatedTerms",
                    JsonNode.class)
                .path("relatedTerms"))
        .hasSize(1);
  }

  @Test
  void deniedSourceAndTargetCannotPersistAnEdge() throws Exception {
    assertError("create_term_relation", relation(source, restrictedTerm), editorToken, 403);
    assertError("create_term_relation", relation(restrictedTerm, target), editorToken, 403);
    assertThat(
            get(
                    "glossaryTerms/" + source.path("id").asText() + "?fields=relatedTerms",
                    JsonNode.class)
                .path("relatedTerms")
                .size())
        .isZero();
  }

  @Test
  void proposalRoundTripSubmitsWithoutApplyingItsOperation() throws Exception {
    final JsonNode current =
        call(
            "get_entity_details",
            Map.of(
                "entityType",
                "glossaryTerm",
                "fqn",
                source.path("fullyQualifiedName").asText(),
                "includeVersion",
                true),
            editorToken);
    assertThat(current.path("version").asDouble()).isPositive();
    final JsonNode draft =
        call("create_ontology_change_set", proposal(glossary, current), editorToken);
    track("ontologyChangeSets", draft);
    assertThat(draft.path("state").asText()).isEqualTo("DRAFT");
    final String id = draft.path("id").asText();
    final JsonNode read = call("get_ontology_change_set", Map.of("id", id), editorToken);
    assertThat(read.path("operations")).hasSize(1);
    assertThat(read.path("operations").get(0).path("operationType").asText())
        .isEqualTo("DELETE_TERM");
    final JsonNode lease = acquire(id, "proposal-session", editorToken);
    final JsonNode submitted =
        call("submit_ontology_change_set", Map.of("id", id, "lease", token(lease)), editorToken);
    assertThat(submitted.path("state").asText()).isEqualTo("SUBMITTED");
    assertThat(
            submitted.path("applicationResult").isNull()
                || submitted.path("applicationResult").isMissingNode())
        .isTrue();
    assertThat(getResponse("glossaryTerms/" + source.path("id").asText(), authToken).statusCode())
        .isEqualTo(200);
    final JsonNode released =
        call(
            "ontology_change_set_lease",
            Map.of("id", id, "action", "RELEASE", "sessionId", "proposal-session"),
            editorToken);
    assertThat(released.path("released").asBoolean()).isTrue();
  }

  @Test
  void deniedDraftScopeCannotBeReadLeasedOrSubmitted() throws Exception {
    final JsonNode draft =
        call("create_ontology_change_set", proposal(restrictedGlossary), authToken);
    track("ontologyChangeSets", draft);
    final String id = draft.path("id").asText();
    assertError("get_ontology_change_set", Map.of("id", id), editorToken, 403);
    assertError(
        "get_ontology_change_set",
        Map.of("id", id, "cursor", "not-a-valid-cursor"),
        editorToken,
        403);
    assertError(
        "ontology_change_set_lease",
        Map.of("id", id, "action", "ACQUIRE", "sessionId", "forbidden"),
        editorToken,
        403);
    assertError(
        "submit_ontology_change_set",
        Map.of("id", id, "lease", Map.of("sessionId", "forbidden", "version", 1)),
        editorToken,
        403);
    assertError("create_ontology_change_set", proposal(restrictedGlossary), editorToken, 403);
    assertThat(get("ontologyChangeSets/" + id, JsonNode.class).path("state").asText())
        .isEqualTo("DRAFT");
  }

  @Test
  void largeProposalCanBeReadCompletelyThroughBoundedOperationPages() throws Exception {
    final List<Map<String, Object>> operations = new ArrayList<>();
    for (int index = 0; index < 60; index++) {
      final JsonNode targetTerm = term(glossary, "PagedTarget");
      operations.add(
          Map.of(
              "id", UUID.randomUUID().toString(),
              "operationType", "DELETE_TERM",
              "state", "ACTIVE",
              "targetId", targetTerm.path("id").asText(),
              "baseVersion", targetTerm.path("version").asDouble(),
              "rationale", "e".repeat(2000)));
    }
    final Map<String, Object> values = new HashMap<>(proposal(glossary));
    values.put("operations", operations);
    final JsonNode draft = call("create_ontology_change_set", values, editorToken);
    assertThat(draft.path("truncated").asBoolean()).isFalse();
    assertThat(draft.path("id").asText()).isNotBlank();
    assertThat(draft.path("operationCount").asInt()).isEqualTo(60);
    track("ontologyChangeSets", draft);
    final JsonNode stored =
        get(
            "ontologyChangeSets/" + draft.path("id").asText() + "?fields=operations",
            JsonNode.class);
    final JsonNode scope =
        call(
            "get_ontology_change_set",
            Map.of("id", draft.path("id").asText(), "section", "glossaries"),
            editorToken);
    assertThat(scope.at("/glossaries/0/id").asText()).isEqualTo(glossary.path("id").asText());
    final Map<String, Object> read =
        new HashMap<>(Map.of("id", draft.path("id").asText(), "limit", 25));
    final List<JsonNode> reconstructed = new ArrayList<>();
    boolean more = true;
    for (int page = 0; more && page < 60; page++) {
      final JsonNode response = call("get_ontology_change_set", read, editorToken);
      assertThat(response.path("truncated").asBoolean()).isFalse();
      assertThat(response.toString().length()).isLessThan(100_000);
      response.path("operations").forEach(reconstructed::add);
      more = response.path("hasMore").asBoolean();
      if (more) {
        assertThat(response.path("returnedCount").asInt()).isPositive();
        read.put("cursor", response.path("nextCursor").asText());
      }
    }
    assertThat(more).isFalse();
    assertThat(reconstructed).hasSize(60);
    assertThat(OBJECT_MAPPER.<JsonNode>valueToTree(reconstructed))
        .isEqualTo(stored.path("operations"));
    assertThat(
            get("ontologyChangeSets/" + draft.path("id").asText(), JsonNode.class)
                .path("state")
                .asText())
        .isEqualTo("DRAFT");
    final String id = draft.path("id").asText();
    final JsonNode lease = acquire(id, "large-proposal-session", editorToken);
    final JsonNode submitted =
        call("submit_ontology_change_set", Map.of("id", id, "lease", token(lease)), editorToken);
    assertThat(submitted.path("truncated").asBoolean()).isFalse();
    assertThat(submitted.path("id").asText()).isEqualTo(id);
    assertThat(submitted.path("state").asText()).isEqualTo("SUBMITTED");
    assertThat(submitted.path("operationCount").asInt()).isEqualTo(60);
    assertThat(submitted.path("operations")).isEmpty();
    assertThat(
            get("ontologyChangeSets/" + id + "?fields=operations", JsonNode.class)
                .path("operations"))
        .isEqualTo(stored.path("operations"));
    final JsonNode released =
        call(
            "ontology_change_set_lease",
            Map.of("id", id, "action", "RELEASE", "sessionId", "large-proposal-session"),
            editorToken);
    assertThat(released.path("released").asBoolean()).isTrue();
  }

  @Test
  void competingAndStaleSessionsCannotSubmitOrTakeALease() throws Exception {
    final JsonNode draft = call("create_ontology_change_set", proposal(glossary), editorToken);
    track("ontologyChangeSets", draft);
    final String id = draft.path("id").asText();
    assertError(
        "submit_ontology_change_set",
        Map.of("id", id, "lease", Map.of("sessionId", "absent", "version", 1)),
        editorToken,
        409);
    final JsonNode lease = acquire(id, "owner", editorToken);
    assertError(
        "ontology_change_set_lease",
        Map.of("id", id, "action", "ACQUIRE", "sessionId", "competitor"),
        editorToken,
        409);
    assertError(
        "submit_ontology_change_set",
        Map.of(
            "id",
            id,
            "lease",
            Map.of("sessionId", "owner", "version", lease.path("version").asInt() + 1)),
        editorToken,
        409);
    assertThat(get("ontologyChangeSets/" + id, JsonNode.class).path("state").asText())
        .isEqualTo("DRAFT");
    call(
        "ontology_change_set_lease",
        Map.of("id", id, "action", "RELEASE", "sessionId", "owner"),
        editorToken);
  }

  private static Map<String, Object> proposal(final JsonNode scope) {
    final JsonNode term = scope == restrictedGlossary ? restrictedTerm : source;
    return proposal(scope, term);
  }

  private static Map<String, Object> proposal(final JsonNode scope, final JsonNode term) {
    return Map.of(
        "name",
        "proposal_" + UUID.randomUUID(),
        "displayName",
        "MCP proposal",
        "description",
        "Retain for review, do not apply",
        "glossaries",
        List.of(scope.path("fullyQualifiedName").asText()),
        "operations",
        List.of(
            Map.of(
                "id",
                UUID.randomUUID().toString(),
                "operationType",
                "DELETE_TERM",
                "state",
                "ACTIVE",
                "targetId",
                term.path("id").asText(),
                "baseVersion",
                term.path("version").asDouble())));
  }

  private static Map<String, Object> relation(final JsonNode from, final JsonNode to) {
    return Map.of(
        "sourceTermId",
        from.path("id").asText(),
        "targetTermId",
        to.path("id").asText(),
        "relationType",
        "relatedTo");
  }

  private static JsonNode term(final JsonNode scope, final String name) throws Exception {
    final Map<String, Object> values =
        new HashMap<>(
            Map.of(
                "name",
                name + UUID.randomUUID(),
                "description",
                "Disposable MCP integration term",
                "glossary",
                scope.path("fullyQualifiedName").asText()));
    if (scope == restrictedGlossary) {
      values.put(
          "tags",
          List.of(
              Map.of(
                  "tagFQN",
                  "PII.Sensitive",
                  "source",
                  "Classification",
                  "labelType",
                  "Manual",
                  "state",
                  "Confirmed")));
    }
    return post("glossaryTerms", values, JsonNode.class);
  }

  private static JsonNode create(final String collection, final Map<String, Object> body)
      throws Exception {
    final JsonNode result = post(collection, body, JsonNode.class);
    track(collection, result);
    return result;
  }

  private static void track(final String collection, final JsonNode entity) {
    ROOTS.add(collection + "/" + entity.path("id").asText());
  }

  private JsonNode acquire(final String id, final String session, final String caller)
      throws Exception {
    return call(
        "ontology_change_set_lease",
        Map.of("id", id, "action", "ACQUIRE", "sessionId", session),
        caller);
  }

  private static Map<String, Object> token(final JsonNode lease) {
    return Map.of(
        "sessionId", lease.path("sessionId").asText(), "version", lease.path("version").asInt());
  }

  private JsonNode call(final String tool, final Map<String, Object> values, final String caller)
      throws Exception {
    final JsonNode response =
        executeMcpRequest(McpTestUtils.createToolCallRequest(tool, values), caller);
    assertThat(response.path("result").path("isError").asBoolean())
        .as(response.toString())
        .isFalse();
    assertThat(response.has("error")).as(response.toString()).isFalse();
    return response.path("result").path("structuredContent");
  }

  private void assertError(
      final String tool, final Map<String, Object> values, final String caller, final int status)
      throws Exception {
    final JsonNode response =
        executeMcpRequest(McpTestUtils.createToolCallRequest(tool, values), caller);
    assertThat(response.path("result").path("isError").asBoolean())
        .as(response.toString())
        .isTrue();
    assertThat(response.path("result").path("structuredContent").path("statusCode").asInt())
        .isEqualTo(status);
  }
}
