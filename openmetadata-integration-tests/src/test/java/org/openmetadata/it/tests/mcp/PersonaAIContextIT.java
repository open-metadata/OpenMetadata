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
package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.schema.type.personaContext.ContextSection;
import org.openmetadata.service.Entity;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PersonaAIContextIT extends McpTestBase {
  private static Persona persona;
  private static Table table;
  private static String directMemberToken;
  private static String inheritedMemberToken;
  private static String nonMemberToken;
  private static String botToken;

  @BeforeAll
  static void setup() throws Exception {
    initAuth();
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    table = createServiceDatabaseSchemaTable("persona_context_" + suffix);

    User directMember = createUser("persona_direct_" + suffix);
    User inheritedMember = createUser("persona_inherited_" + suffix);
    User nonMember = createUser("persona_non_member_" + suffix);
    User bot = get("users/name/profiler-bot", User.class);

    persona =
        post(
            "personas",
            new CreatePersona()
                .withName("persona_context_" + suffix)
                .withDescription("Persona AI context integration test")
                .withUsers(List.of(directMember.getId())),
            Persona.class);

    post(
        "teams",
        new CreateTeam()
            .withName("persona_context_team_" + suffix)
            .withTeamType(CreateTeam.TeamType.GROUP)
            .withUsers(List.of(inheritedMember.getId()))
            .withDefaultPersona(persona.getId()),
        JsonNode.class);

    directMemberToken = tokenFor(directMember);
    inheritedMemberToken = tokenFor(inheritedMember);
    nonMemberToken = tokenFor(nonMember);
    botToken = tokenFor(bot);

    put(
        contextPath(),
        new PersonaContextDefinition()
            .withEnabled(true)
            .withCharacterBudget(400_000)
            .withCacheTtlMinutes(30),
        PersonaContextDefinition.class);
    post(contextPath() + "/rules", tableRule("Baseline tables"), PersonaContextDefinition.class);
  }

  @Test
  void ruleCrudPreviewDocumentCacheAndMcpRoundTrip() throws Exception {
    ContextRule requested = tableRule("CRUD tables");
    PersonaContextDefinition created =
        post(contextPath() + "/rules", requested, PersonaContextDefinition.class);
    ContextRule createdRule =
        created.getRules().stream()
            .filter(rule -> requested.getName().equals(rule.getName()))
            .findFirst()
            .orElseThrow();
    assertThat(createdRule.getId()).isNotNull();
    assertThat(createdRule.getSections())
        .contains(ContextSection.DESCRIPTION, ContextSection.JOINS, ContextSection.METRICS);

    JsonNode preview = post(contextPath() + "/rules/preview", requested, JsonNode.class);
    assertThat(preview.get("matchedCount").asInt()).isGreaterThanOrEqualTo(1);
    assertThat(preview.get("sampleNames").isArray()).isTrue();

    HttpResponse<String> duplicate =
        postResponse(contextPath() + "/rules", tableRule(" crud TABLES "), authToken);
    assertThat(duplicate.statusCode()).isEqualTo(400);

    ContextRule updatedRule = tableRule("Updated CRUD tables").withMaxAssets(2);
    PersonaContextDefinition updated =
        put(
            contextPath() + "/rules/" + createdRule.getId(),
            updatedRule,
            PersonaContextDefinition.class);
    assertThat(updated.getRules()).anyMatch(rule -> updatedRule.getName().equals(rule.getName()));

    HttpResponse<String> firstDocument = getResponse(contextPath() + "/document", authToken);
    HttpResponse<String> secondDocument = getResponse(contextPath() + "/document", authToken);
    assertThat(firstDocument.statusCode()).isEqualTo(200);
    assertThat(secondDocument.statusCode()).isEqualTo(200);
    assertThat(firstDocument.headers().firstValue("X-Cache")).isPresent();
    assertThat(secondDocument.headers().firstValue("X-Cache")).isPresent();
    assertThat(secondDocument.headers().firstValue("X-Cache").orElseThrow()).isIn("HIT", "BYPASS");
    JsonNode document = OBJECT_MAPPER.readTree(secondDocument.body());
    assertThat(document.get("markdown").asText()).contains(table.getFullyQualifiedName());

    HttpResponse<String> refreshed =
        postResponse(contextPath() + "/document:refresh", Map.of(), authToken);
    assertThat(refreshed.statusCode()).isEqualTo(200);
    assertThat(refreshed.headers().firstValue("X-Cache").orElseThrow()).isEqualTo("BYPASS");

    JsonNode mcp =
        executeMcp(
            McpTestUtils.createToolCallRequest(
                "get_persona_context",
                Map.of("personaName", persona.getFullyQualifiedName(), "format", "json")),
            directMemberToken);
    assertThat(mcp.path("result").path("isError").asBoolean(false)).isFalse();
    assertThat(mcp.toString()).contains(persona.getFullyQualifiedName());

    HttpResponse<String> deleted =
        deleteResponse(contextPath() + "/rules/" + createdRule.getId(), authToken);
    assertThat(deleted.statusCode()).isEqualTo(200);
  }

  @Test
  void searchScopedRuleIsServedAsASearchFilterInsteadOfBeingPreloaded() throws Exception {
    ContextRule requested = tableRule("Scoped tables").withFilteredInSearch(true);
    PersonaContextDefinition created =
        post(contextPath() + "/rules", requested, PersonaContextDefinition.class);
    ContextRule createdRule =
        created.getRules().stream()
            .filter(rule -> requested.getName().equals(rule.getName()))
            .findFirst()
            .orElseThrow();
    assertThat(createdRule.getFilteredInSearch()).isTrue();

    try {
      HttpResponse<String> response =
          getResponse(
              "personas/name/"
                  + persona.getFullyQualifiedName()
                  + "/context?format=json&refresh=true",
              authToken);
      assertThat(response.statusCode()).isEqualTo(200);
      JsonNode context = OBJECT_MAPPER.readTree(response.body());

      JsonNode searchScope = context.get("searchScope");
      assertThat(searchScope).isNotNull();
      assertThat(searchScope.get("entityTypes").toString()).contains(Entity.TABLE);
      assertThat(searchScope.get("queryFilter").asText()).contains("entityType");
      assertThat(searchScope.get("rules").get(0).get("ruleName").asText())
          .isEqualTo(requested.getName());

      // The whole point of the mode: the rule selects the table for search without spending any of
      // the context budget preloading it.
      assertThat(context.get("rules").toString()).doesNotContain(requested.getName());
    } finally {
      deleteResponse(contextPath() + "/rules/" + createdRule.getId(), authToken);
    }
  }

  @Test
  void ruleCreatedWithoutTheFieldKeepsLegacyPreloading() throws Exception {
    ContextRule requested = tableRule("Legacy tables").withFilteredInSearch(null);
    PersonaContextDefinition created =
        post(contextPath() + "/rules", requested, PersonaContextDefinition.class);
    ContextRule createdRule = ruleNamed(created, requested.getName());
    assertThat(createdRule.getFilteredInSearch()).isNull();

    try {
      HttpResponse<String> response =
          getResponse(
              "personas/name/"
                  + persona.getFullyQualifiedName()
                  + "/context?format=json&refresh=true",
              authToken);
      assertThat(response.statusCode()).isEqualTo(200);
      JsonNode context = OBJECT_MAPPER.readTree(response.body());

      assertThat(context.path("searchScope").path("queryFilter").asText()).isBlank();
      assertThat(context.path("rules").toString()).contains(requested.getName());
    } finally {
      deleteResponse(contextPath() + "/rules/" + createdRule.getId(), authToken);
    }
  }

  /**
   * An update that omits {@code filteredInSearch} must not change the delivery mode. The endpoint
   * replaces the whole rule and the field has no schema default, so a null on the wire is both "I
   * omitted it" and "stored before the field existed" — resolving it the wrong way silently sends a
   * scoped rule back to preloading, which is invisible until the context document grows again.
   */
  @Test
  void updatingARuleWithoutTheFieldKeepsItsDeliveryMode() throws Exception {
    String suffix = shortId();
    Persona owned =
        post(
            "personas",
            new CreatePersona()
                .withName("persona_mode_" + suffix)
                .withDescription("filteredInSearch round-trip integration test"),
            Persona.class);
    String rulesPath = "personas/" + owned.getId() + "/aiContext/rules";

    try {
      ContextRule requested =
          scopedFqnRule("Round trip", table.getFullyQualifiedName()).withFilteredInSearch(true);
      PersonaContextDefinition created = post(rulesPath, requested, PersonaContextDefinition.class);
      ContextRule stored = ruleNamed(created, "Round trip");
      assertThat(stored.getFilteredInSearch()).isTrue();

      // A round-trip that drops the field must leave it scoped.
      PersonaContextDefinition afterOmitted =
          put(
              rulesPath + "/" + stored.getId(),
              requested.withFilteredInSearch(null),
              PersonaContextDefinition.class);
      assertThat(ruleNamed(afterOmitted, "Round trip").getFilteredInSearch())
          .as("omitting the field must not flip a scoped rule back to preloading")
          .isTrue();

      // An explicit false still wins — carrying the stored value must not make the field
      // unsettable.
      PersonaContextDefinition afterExplicit =
          put(
              rulesPath + "/" + stored.getId(),
              requested.withFilteredInSearch(false),
              PersonaContextDefinition.class);
      assertThat(ruleNamed(afterExplicit, "Round trip").getFilteredInSearch()).isFalse();

      // And once explicitly preloading, omitting the field keeps it preloading.
      PersonaContextDefinition afterOmittedAgain =
          put(
              rulesPath + "/" + stored.getId(),
              requested.withFilteredInSearch(null),
              PersonaContextDefinition.class);
      assertThat(ruleNamed(afterOmittedAgain, "Round trip").getFilteredInSearch()).isFalse();
    } finally {
      deleteResponse("personas/" + owned.getId() + "?hardDelete=true", authToken);
    }
  }

  private static ContextRule ruleNamed(PersonaContextDefinition definition, String name) {
    return definition.getRules().stream()
        .filter(rule -> name.equals(rule.getName()))
        .findFirst()
        .orElseThrow();
  }

  /**
   * The unit test pins the shape of the union — `minimum_should_match: 1` over one clause per rule.
   * Shape is not behaviour: a filter can be structurally OR-shaped and still not return both sets if
   * the nesting is subtly wrong, and only a real search engine can tell the difference. This drives
   * the composed filter through Elasticsearch and asserts the selected asset set is A u B. Knowledge
   * types deliberately pass through a scoped asset filter, so they are not part of this assertion.
   *
   * <p>Uses its own persona rather than the shared one: methods in this module run concurrently, so
   * a sibling test adding or removing a scoped rule would change the scope under this assertion.
   */
  @Test
  void twoScopedRulesSelectTheUnionOfBothWhenTheFilterIsActuallySearched() throws Exception {
    String suffix = shortId();
    Table other = createServiceDatabaseSchemaTable("persona_union_" + suffix);
    Table excluded = createServiceDatabaseSchemaTable("persona_excluded_" + suffix);
    Persona owned =
        post(
            "personas",
            new CreatePersona()
                .withName("persona_union_" + suffix)
                .withDescription("Union-of-scoped-rules integration test"),
            Persona.class);
    String rulesPath = "personas/" + owned.getId() + "/aiContext/rules";

    try {
      addRule(rulesPath, scopedFqnRule("Union first", table.getFullyQualifiedName()));
      // One rule: only its own table is in scope. This is the baseline the second rule widens.
      awaitScopeIncludes(
          owned,
          Set.of(table.getFullyQualifiedName()),
          Set.of(other.getFullyQualifiedName(), excluded.getFullyQualifiedName()));

      addRule(rulesPath, scopedFqnRule("Union second", other.getFullyQualifiedName()));
      // Two rules: both tables. An intersection would be empty here, since no table carries both
      // FQNs — so an empty or single-entry result means the clauses are being AND-ed.
      awaitScopeIncludes(
          owned,
          Set.of(table.getFullyQualifiedName(), other.getFullyQualifiedName()),
          Set.of(excluded.getFullyQualifiedName()));
    } finally {
      deleteResponse("personas/" + owned.getId() + "?hardDelete=true", authToken);
    }
  }

  /** Polls until the served scope includes selected assets and excludes unscoped assets. */
  private static void awaitScopeIncludes(
      Persona owner, Set<String> selectedAssets, Set<String> excludedAssets) {
    Awaitility.await("persona search scope selects " + selectedAssets)
        .atMost(Duration.ofSeconds(60))
        .pollDelay(Duration.ofSeconds(1))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              Set<String> results = searchWithPersonaScope(owner);
              assertThat(results).containsAll(selectedAssets);
              assertThat(results).doesNotContainAnyElementsOf(excludedAssets);
            });
  }

  /** Runs the persona's own compiled scope through search and returns the FQNs it selects. */
  private static Set<String> searchWithPersonaScope(Persona owner) throws Exception {
    HttpResponse<String> context =
        getResponse("personas/" + owner.getId() + "/context?format=json&refresh=true", authToken);
    assertThat(context.statusCode()).isEqualTo(200);
    String queryFilter =
        OBJECT_MAPPER.readTree(context.body()).path("searchScope").path("queryFilter").asText();
    assertThat(queryFilter).as("a scoped rule must produce a filter").isNotEmpty();

    HttpResponse<String> hits =
        getResponse(
            "search/query?q=*&index=all&size=50&track_total_hits=true&query_filter="
                + URLEncoder.encode(queryFilter, StandardCharsets.UTF_8),
            authToken);
    assertThat(hits.statusCode()).isEqualTo(200);
    Set<String> fqns = new HashSet<>();
    OBJECT_MAPPER
        .readTree(hits.body())
        .path("hits")
        .path("hits")
        .forEach(hit -> fqns.add(hit.path("_source").path("fullyQualifiedName").asText()));
    return fqns;
  }

  private static void addRule(String rulesPath, ContextRule rule) throws Exception {
    post(rulesPath, rule, PersonaContextDefinition.class);
  }

  private static ContextRule scopedFqnRule(String name, String fqn) {
    return new ContextRule()
        .withName(name)
        .withEntityType(Entity.TABLE)
        .withQueryFilter("{\"query\":{\"term\":{\"fullyQualifiedName\":\"" + fqn + "\"}}}")
        .withSections(Set.of())
        .withMaxAssets(10)
        .withEnabled(true)
        .withFilteredInSearch(true);
  }

  private static String shortId() {
    return UUID.randomUUID().toString().substring(0, 8);
  }

  @Test
  void enforcesMemberInheritedBotAdminAndRefreshAuthorization() throws Exception {
    String personaContextPath =
        "personas/name/" + persona.getFullyQualifiedName() + "/context?format=json";
    assertThat(getResponse(personaContextPath, directMemberToken).statusCode()).isEqualTo(200);
    assertThat(getResponse(personaContextPath, inheritedMemberToken).statusCode()).isEqualTo(200);
    assertThat(getResponse(personaContextPath, nonMemberToken).statusCode()).isEqualTo(403);
    // The rule definitions are readable by anyone who can view the persona; only the materialized
    // document — which searches without an RBAC filter — stays admin-only.
    assertThat(getResponse(contextPath(), directMemberToken).statusCode()).isEqualTo(200);
    assertThat(getResponse(contextPath() + "/document", directMemberToken).statusCode())
        .isEqualTo(403);
    assertThat(getResponse(personaContextPath + "&refresh=true", directMemberToken).statusCode())
        .isEqualTo(403);
    assertThat(getResponse(personaContextPath + "&refresh=true", botToken).statusCode())
        .isEqualTo(200);

    JsonNode deniedMcp =
        executeMcp(
            McpTestUtils.createToolCallRequest(
                "get_persona_context", Map.of("personaName", persona.getFullyQualifiedName())),
            nonMemberToken);
    assertThat(deniedMcp.toString()).contains("not assigned to persona");
  }

  @Test
  void aiContextRulesAreReadableByAnyUserButEditableOnlyByAdmins() throws Exception {
    HttpResponse<String> read = getResponse(contextPath(), nonMemberToken);
    assertThat(read.statusCode()).isEqualTo(200);
    JsonNode definition = OBJECT_MAPPER.readTree(read.body());
    assertThat(definition.get("rules").isArray()).isTrue();
    assertThat(definition.get("rules")).isNotEmpty();
    // The rules are the whole payload for a non-admin: cache diagnostics describe a materialization
    // they are not allowed to trigger or read.
    assertThat(definition.hasNonNull("cacheState")).isFalse();
    assertThat(definition.hasNonNull("lastError")).isFalse();
    assertThat(definition.hasNonNull("lastGeneratedAt")).isFalse();
    assertThat(definition.get("rules"))
        .allSatisfy(rule -> assertThat(rule.get("matchedCount")).isNull());

    ContextRule rule = tableRule("Non admin write attempt");
    assertThat(putResponse(contextPath(), definition, nonMemberToken).statusCode()).isEqualTo(403);
    assertThat(postResponse(contextPath() + "/rules", rule, nonMemberToken).statusCode())
        .isEqualTo(403);
    assertThat(
            putResponse(contextPath() + "/rules/" + UUID.randomUUID(), rule, nonMemberToken)
                .statusCode())
        .isEqualTo(403);
    assertThat(
            deleteResponse(contextPath() + "/rules/" + UUID.randomUUID(), nonMemberToken)
                .statusCode())
        .isEqualTo(403);

    // Preview and document run the rule searches with no RBAC filter, so they can surface entities
    // the caller cannot view. They stay admin-only even though the rules themselves are public.
    assertThat(postResponse(contextPath() + "/rules/preview", rule, nonMemberToken).statusCode())
        .isEqualTo(403);
    assertThat(getResponse(contextPath() + "/document", nonMemberToken).statusCode())
        .isEqualTo(403);
    assertThat(
            postResponse(contextPath() + "/document:refresh", Map.of(), nonMemberToken)
                .statusCode())
        .isEqualTo(403);

    // Materializing populates the cache, so the admin view of the same endpoint carries the
    // diagnostics the non-admin view withheld. Polled because a sibling test may invalidate the
    // shared persona's cache between the two calls.
    assertThat(getResponse(contextPath() + "/document", authToken).statusCode()).isEqualTo(200);
    Awaitility.await("admin sees the cache diagnostics")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () ->
                assertThat(
                        OBJECT_MAPPER
                            .readTree(getResponse(contextPath(), authToken).body())
                            .hasNonNull("cacheState"))
                    .isTrue());
  }

  private JsonNode executeMcp(Map<String, Object> requestBody, String token) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp")))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .header("Authorization", token)
            .POST(
                HttpRequest.BodyPublishers.ofString(OBJECT_MAPPER.writeValueAsString(requestBody)))
            .timeout(Duration.ofSeconds(30))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertThat(response.statusCode()).isEqualTo(200);
    return OBJECT_MAPPER.readTree(extractJsonFromResponse(response.body()));
  }

  private static User createUser(String name) throws Exception {
    return post(
        "users", new CreateUser().withName(name).withEmail(name + "@example.com"), User.class);
  }

  private static String tokenFor(User user) {
    return "Bearer "
        + JwtAuthProvider.tokenFor(user.getEmail(), user.getEmail(), new String[] {}, 3_600);
  }

  private static ContextRule tableRule(String name) {
    return new ContextRule()
        .withName(name)
        .withEntityType(Entity.TABLE)
        .withQueryFilter(
            "{\"query\":{\"term\":{\"fullyQualifiedName\":\""
                + table.getFullyQualifiedName()
                + "\"}}}")
        .withSections(Set.of())
        .withMaxAssets(1)
        .withEnabled(true)
        .withFilteredInSearch(false);
  }

  private static String contextPath() {
    return "personas/" + persona.getId() + "/aiContext";
  }
}
