/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.search.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.assertFieldDoesNotExist;
import static org.openmetadata.service.util.TestUtils.assertFieldExists;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilderFactory;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.vector.VectorSearchQueryBuilder;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Execution(ExecutionMode.CONCURRENT)
class ContextMemorySearchVisibilityTest {

  private static final JacksonJsonpMapper JACKSON_JSONP_MAPPER = new JacksonJsonpMapper();

  private static final UUID USER_ID = UUID.randomUUID();
  private static final UUID TEAM_ID = UUID.randomUUID();
  private static final UUID DOMAIN_ID = UUID.randomUUID();

  private SubjectContext nonAdminSubject() {
    User user =
        new User()
            .withId(USER_ID)
            .withName("alice")
            .withIsAdmin(false)
            .withTeams(List.of(ref(TEAM_ID, Entity.TEAM, "analytics")))
            .withDomains(List.of(ref(DOMAIN_ID, Entity.DOMAIN, "finance")));
    return new SubjectContext(user, null);
  }

  private EntityReference ref(UUID id, String type, String name) {
    return new EntityReference().withId(id).withType(type).withName(name);
  }

  private String buildElasticJson(SubjectContext subjectContext) {
    OMQueryBuilder filter =
        new ContextMemorySearchVisibility(new ElasticQueryBuilderFactory())
            .buildVisibilityFilter(subjectContext);
    return serializeElasticQuery(((ElasticQueryBuilder) filter).build());
  }

  private String serializeElasticQuery(Query query) {
    StringWriter writer = new StringWriter();
    JsonGenerator generator = JACKSON_JSONP_MAPPER.jsonProvider().createGenerator(writer);
    query.serialize(generator, JACKSON_JSONP_MAPPER);
    generator.close();
    return writer.toString();
  }

  /**
   * The rule has two renderings: this class, and the raw JSON in {@link VectorSearchQueryBuilder}
   * (which serves both engines from a StringBuilder and so cannot consume an OMQueryBuilder). Nothing
   * else compares them — an integration test exercises one path or the other, never both against each
   * other — so this fails if a future change adds a predicate to one and forgets the other.
   */
  @Test
  void rawJsonVectorClauseKeysOffTheSameFieldsAsThisRule() throws Exception {
    String vectorQuery =
        VectorSearchQueryBuilder.buildQuery(
            new float[] {0.1f}, 5, Map.of(), 0.0, nonAdminSubject());
    // The visibility clause alone: the surrounding KNN query also carries a deleted=false term,
    // which belongs to the query rather than to this rule.
    JsonNode visibilityClause =
        new ObjectMapper()
            .readTree(vectorQuery)
            .path("knn")
            .path("embedding")
            .path("filter")
            .path("bool")
            .path("filter");

    assertEquals(
        Set.of(
            ContextMemorySearchVisibility.FIELD_ENTITY_TYPE,
            ContextMemorySearchVisibility.FIELD_VISIBILITY,
            ContextMemorySearchVisibility.FIELD_OWNERS_ID,
            ContextMemorySearchVisibility.FIELD_SHARED_WITH_IDS),
        termFieldsIn(visibilityClause),
        "the vector rendering must key off exactly the fields this rule uses");
  }

  /** Every field name used by a term/terms clause anywhere in the query. */
  private static Set<String> termFieldsIn(JsonNode node) {
    Set<String> fields = new HashSet<>();
    collectTermFields(node, fields);
    return fields;
  }

  private static void collectTermFields(JsonNode node, Set<String> fields) {
    if (node.isObject()) {
      node.fields()
          .forEachRemaining(
              entry -> {
                if ("term".equals(entry.getKey()) || "terms".equals(entry.getKey())) {
                  entry.getValue().fieldNames().forEachRemaining(fields::add);
                }
                collectTermFields(entry.getValue(), fields);
              });
    } else if (node.isArray()) {
      node.forEach(child -> collectTermFields(child, fields));
    }
  }

  @Test
  void nonAdminSubjectLeavesNonMemoryDocumentsUntouched() {
    DocumentContext json = JsonPath.parse(buildElasticJson(nonAdminSubject()));

    assertFieldExists(
        json,
        "$.bool.should[0].bool.must_not[?(@.term['entityType'].value=='"
            + Entity.CONTEXT_MEMORY
            + "')]",
        "non-memory documents pass through via a must_not entityType branch");
  }

  @Test
  void nonAdminSubjectRestrictsMemoryDocumentsToVisibleOnes() {
    DocumentContext json = JsonPath.parse(buildElasticJson(nonAdminSubject()));

    assertFieldExists(
        json,
        "$.bool.should[1].bool.must[?(@.term['entityType'].value=='"
            + Entity.CONTEXT_MEMORY
            + "')]",
        "the memory branch is scoped to contextMemory documents");
    assertFieldExists(
        json,
        "$.bool.should[1].bool.must[1].bool.should[?(@.term['visibility'].value=='Entity')]",
        "Entity-visibility memories are visible to everyone");
    assertFieldExists(
        json,
        "$.bool.should[1].bool.must[1].bool.should[?(@.nested.query.term['owners.id'].value=='"
            + USER_ID
            + "')]",
        "owners see their own (including Private) memories");
    assertFieldExists(
        json,
        "$.bool.should[1].bool.must[1].bool.should[?(@.bool.must[?(@.terms['sharedWithIds'])])]",
        "Shared memories are matched via sharedWithIds (gated by visibility=Shared)");
  }

  @Test
  void sharedWithIdsBranchIsGatedByVisibilityShared() {
    // ContextMemoryVisibility.isInSharedWithList is consulted ONLY when visibility==Shared, so the
    // sharedWithIds match must be ANDed with visibility=Shared. A bare sharedWithIds clause would
    // leak a memory later flipped to Private but still carrying a stale sharedWithIds list.
    DocumentContext json = JsonPath.parse(buildElasticJson(nonAdminSubject()));

    assertFieldExists(
        json,
        "$.bool.should[1].bool.must[1].bool.should[?(@.bool.must[?(@.term['visibility'].value=='Shared')])]",
        "the sharedWithIds match sits in a bool.must alongside visibility=Shared");
    assertFieldExists(
        json,
        "$.bool.should[1].bool.must[1].bool.should[?(@.bool.must[?(@.terms['sharedWithIds'])])]",
        "that same gated branch carries the sharedWithIds terms");
    assertFieldDoesNotExist(
        json,
        "$.bool.should[1].bool.must[1].bool.should[?(@.terms['sharedWithIds'])]",
        "sharedWithIds must never appear as an ungated (bare) should clause");
  }

  @Test
  void sharedPrincipalIdsIncludeUserTeamsAndDomains() {
    String json = buildElasticJson(nonAdminSubject());

    assertTrue(json.contains(USER_ID.toString()), "sharedWithIds must include the user id");
    assertTrue(json.contains(TEAM_ID.toString()), "sharedWithIds must include the user's team id");
    assertTrue(
        json.contains(DOMAIN_ID.toString()), "sharedWithIds must include the user's domain id");
  }

  @Test
  void outerClauseUsesShouldOnlySoMinimumShouldMatchDefaultsToOne() {
    // The filter excludes invisible memories only because the outer bool is should-only, which
    // makes the engine default minimum_should_match=1. A stray must/filter sibling would flip that
    // default to 0 and turn the whole filter into a silent no-op (fail-open). Guard against it.
    DocumentContext json = JsonPath.parse(buildElasticJson(nonAdminSubject()));

    assertFieldExists(json, "$.bool.should", "the outer access clause must be should-based");
    assertFieldDoesNotExist(
        json, "$.bool.must", "a must sibling would drop minimum_should_match to 0 (fail-open)");
    assertFieldDoesNotExist(
        json, "$.bool.filter", "a filter sibling would drop minimum_should_match to 0 (fail-open)");
  }

  @Test
  void privateMemoriesAreNotMatchedByVisibilityValue() {
    String json = buildElasticJson(nonAdminSubject());

    assertFalse(
        json.contains("Private"),
        "Private memories are reachable only via ownership, never a bare visibility match");
  }

  @Test
  void adminSubjectGetsNoVisibilityFilter() {
    User admin = new User().withId(USER_ID).withName("root").withIsAdmin(true);
    OMQueryBuilder filter =
        new ContextMemorySearchVisibility(new ElasticQueryBuilderFactory())
            .buildVisibilityFilter(new SubjectContext(admin, null));

    assertNull(filter, "Admins bypass memory visibility, mirroring ContextMemoryVisibility");
  }

  @Test
  void nullSubjectGetsNoVisibilityFilter() {
    OMQueryBuilder filter =
        new ContextMemorySearchVisibility(new ElasticQueryBuilderFactory())
            .buildVisibilityFilter(null);

    assertNull(filter, "A missing subject must not silently expose memories");
  }

  @Test
  void orgWideOnlyFilterLeavesNonMemoryDocumentsUntouched() {
    DocumentContext json = JsonPath.parse(orgWideOnlyJson());

    assertFieldExists(
        json,
        "$.bool.should[0].bool.must_not[?(@.term['entityType'].value=='"
            + Entity.CONTEXT_MEMORY
            + "')]",
        "non-memory documents pass through via a must_not entityType branch");
  }

  @Test
  void orgWideOnlyFilterAdmitsOnlyEntityVisibilityMemories() {
    DocumentContext json = JsonPath.parse(orgWideOnlyJson());

    assertFieldExists(
        json,
        "$.bool.should[1].bool.must[?(@.term['visibility'].value=='Entity')]",
        "the memory branch admits Entity-visibility memories");
    assertFieldDoesNotExist(
        json, "$..term['owners.id']", "a subject-less path must not match by ownership");
    assertFieldDoesNotExist(
        json, "$..terms['sharedWithIds']", "a subject-less path must not match by sharedWithIds");
  }

  @Test
  void orgWideOnlyFilterIsShouldOnlySoMinimumShouldMatchDefaultsToOne() {
    DocumentContext json = JsonPath.parse(orgWideOnlyJson());

    assertFieldExists(json, "$.bool.should", "the outer access clause must be should-based");
    assertFieldDoesNotExist(
        json, "$.bool.must", "a must sibling would drop minimum_should_match to 0 (fail-open)");
    assertFieldDoesNotExist(
        json, "$.bool.filter", "a filter sibling would drop minimum_should_match to 0 (fail-open)");
  }

  @Test
  void isOrgWideReadableAdmitsEveryNonMemoryDocument() {
    assertTrue(ContextMemorySearchVisibility.isOrgWideReadable(null));
    assertTrue(ContextMemorySearchVisibility.isOrgWideReadable(Map.of()));
    assertTrue(
        ContextMemorySearchVisibility.isOrgWideReadable(
            Map.of("entityType", Entity.TABLE, "name", "orders")));
  }

  @Test
  void isOrgWideReadableRejectsRestrictedMemories() {
    assertTrue(
        ContextMemorySearchVisibility.isOrgWideReadable(memoryDocument(MemoryVisibility.ENTITY)));
    assertFalse(
        ContextMemorySearchVisibility.isOrgWideReadable(memoryDocument(MemoryVisibility.PRIVATE)));
    assertFalse(
        ContextMemorySearchVisibility.isOrgWideReadable(memoryDocument(MemoryVisibility.SHARED)));
    assertFalse(
        ContextMemorySearchVisibility.isOrgWideReadable(
            Map.of("entityType", Entity.CONTEXT_MEMORY)),
        "a memory with no indexed visibility is not org-wide");
  }

  private Map<String, Object> memoryDocument(MemoryVisibility visibility) {
    return Map.of("entityType", Entity.CONTEXT_MEMORY, "visibility", visibility.value());
  }

  private String orgWideOnlyJson() {
    OMQueryBuilder filter =
        new ContextMemorySearchVisibility(new ElasticQueryBuilderFactory())
            .buildOrgWideOnlyFilter();
    return serializeElasticQuery(((ElasticQueryBuilder) filter).build());
  }

  @Test
  void openSearchBuilderProducesEquivalentFilter() {
    OMQueryBuilder filter =
        new ContextMemorySearchVisibility(new OpenSearchQueryBuilderFactory())
            .buildVisibilityFilter(nonAdminSubject());
    String json = ((OpenSearchQueryBuilder) filter).build().toJsonString();

    assertTrue(json.contains("entityType"), "OpenSearch filter guards on entityType");
    assertTrue(json.contains(Entity.CONTEXT_MEMORY), "OpenSearch filter targets contextMemory");
    assertTrue(json.contains("\"visibility\""), "OpenSearch filter matches the visibility field");
    assertTrue(json.contains("owners.id"), "OpenSearch filter matches owners.id");
    assertTrue(json.contains("sharedWithIds"), "OpenSearch filter matches sharedWithIds");
    assertTrue(json.contains(USER_ID.toString()), "OpenSearch filter binds the user id");
  }
}
