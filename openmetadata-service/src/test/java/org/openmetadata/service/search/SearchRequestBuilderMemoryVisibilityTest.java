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

package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.elasticsearch.ElasticSearchRequestBuilder;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilderFactory;
import org.openmetadata.service.search.opensearch.OpenSearchRequestBuilder;
import org.openmetadata.service.search.security.ContextMemorySearchVisibility;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * ContextMemory privacy is enforced per query, not by keeping restricted memories out of the index,
 * so the request builders must fail closed: a search path that never evaluated the caller's subject
 * gets org-wide (Entity) memories only. Without this default, every path that forgets to call
 * {@code applyContextMemoryVisibility} — {@code /search/fieldQuery}, {@code /search/sourceUrl},
 * deep pagination, the entity-relationship traversals — would return other users' private memories.
 */
@Execution(ExecutionMode.CONCURRENT)
class SearchRequestBuilderMemoryVisibilityTest {

  private static final JacksonJsonpMapper JACKSON_JSONP_MAPPER = new JacksonJsonpMapper();

  @Test
  void elasticBuildRestrictsMemoriesWhenVisibilityWasNeverResolved() {
    String json = serialize(new ElasticSearchRequestBuilder().build("table_search_index"));

    assertTrue(json.contains(Entity.CONTEXT_MEMORY), "the memory guard must be present");
    assertTrue(json.contains("\"Entity\""), "only org-wide memories may pass");
  }

  @Test
  void elasticBuildLeavesQueryAloneWhenVisibilityWasResolved() {
    String json =
        serialize(
            new ElasticSearchRequestBuilder()
                .contextMemoryVisibilityResolved()
                .build("table_search_index"));

    assertFalse(
        json.contains(Entity.CONTEXT_MEMORY),
        "a subject-aware caller already applied its own visibility filter");
  }

  @Test
  void openSearchBuildRestrictsMemoriesWhenVisibilityWasNeverResolved() {
    String json = new OpenSearchRequestBuilder().build("table_search_index").toJsonString();

    assertTrue(json.contains(Entity.CONTEXT_MEMORY), "the memory guard must be present");
    assertTrue(json.contains("\"Entity\""), "only org-wide memories may pass");
  }

  @Test
  void openSearchBuildLeavesQueryAloneWhenVisibilityWasResolved() {
    String json =
        new OpenSearchRequestBuilder()
            .contextMemoryVisibilityResolved()
            .build("table_search_index")
            .toJsonString();

    assertFalse(
        json.contains(Entity.CONTEXT_MEMORY),
        "a subject-aware caller already applied its own visibility filter");
  }

  @Test
  void onlyAnIdentifiedSubjectMayMarkVisibilityResolved() {
    // buildVisibilityFilter returns null both for admins and for a null/unidentifiable subject.
    // Only the former may mark the request resolved — internal callers that pass a null
    // SubjectContext must fall back to the org-wide-only default, not search unfiltered.
    ContextMemorySearchVisibility visibility =
        new ContextMemorySearchVisibility(new ElasticQueryBuilderFactory());

    assertFalse(visibility.isSubjectResolvable(null), "a null subject is not resolvable");
    assertFalse(
        visibility.isSubjectResolvable(new SubjectContext(new User(), null)),
        "a subject whose user carries no id is not resolvable");
    assertTrue(
        visibility.isSubjectResolvable(
            new SubjectContext(new User().withId(UUID.randomUUID()).withIsAdmin(true), null)),
        "an identified admin is resolvable and needs no filter");
  }

  private String serialize(SearchRequest request) {
    StringWriter writer = new StringWriter();
    JsonGenerator generator = JACKSON_JSONP_MAPPER.jsonProvider().createGenerator(writer);
    request.serialize(generator, JACKSON_JSONP_MAPPER);
    generator.close();
    return writer.toString();
  }
}
