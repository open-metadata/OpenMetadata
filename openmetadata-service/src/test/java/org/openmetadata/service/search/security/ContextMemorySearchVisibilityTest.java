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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.assertFieldDoesNotExist;
import static org.openmetadata.service.util.TestUtils.assertFieldExists;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilderFactory;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
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
        "$.bool.should[1].bool.must[1].bool.should[?(@.terms['sharedWithIds'])]",
        "Shared memories are matched via sharedWithIds");
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
