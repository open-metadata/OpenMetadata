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
package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * Unit tests for {@link AIContextFinder}'s pure hit-mapping helpers and the Mode-B markdown that
 * routes company knowledge to candidate assets.
 */
class AIContextFinderTest {

  @Test
  void knowledgeType_mapsKnownEntityTypesAndToleratesUnknown() {
    assertEquals(KnowledgeItem.Type.GLOSSARY_TERM, AIContextFinder.knowledgeType("glossaryTerm"));
    assertEquals(KnowledgeItem.Type.METRIC, AIContextFinder.knowledgeType("metric"));
    assertEquals(KnowledgeItem.Type.PAGE, AIContextFinder.knowledgeType("page"));
    assertNull(AIContextFinder.knowledgeType("table"));
    assertNull(AIContextFinder.knowledgeType(null));
  }

  @Test
  void resolveKnowledgeId_fallsBackToParentIdForChunkDocs() {
    String id = "11111111-1111-1111-1111-111111111111";
    String parentId = "22222222-2222-2222-2222-222222222222";
    assertEquals(
        id,
        AIContextFinder.resolveKnowledgeId(Map.of("id", id, "parentId", parentId)).toString(),
        "entity-doc hits must use their own id");
    assertEquals(
        parentId,
        AIContextFinder.resolveKnowledgeId(Map.of("parentId", parentId)).toString(),
        "chunk-doc hits carry only parentId and must still route");
    assertNull(AIContextFinder.resolveKnowledgeId(Map.of("name", "x")));
  }

  @Test
  void content_prefersLlmContextThenDescription() {
    assertEquals(
        "rich context",
        AIContextFinder.content(
            Map.of("textToLLMContext", "rich context", "description", "plain")));
    assertEquals("plain", AIContextFinder.content(Map.of("description", "plain")));
  }

  @Test
  void toKnowledgeItem_buildsItemAndSkipsUnroutableHits() {
    KnowledgeItem item =
        AIContextFinder.toKnowledgeItem(
            Map.of(
                "entityType", "glossaryTerm",
                "fullyQualifiedName", "Business.Order",
                "name", "Order",
                "description", "An order placed by a customer."));
    assertEquals(KnowledgeItem.Type.GLOSSARY_TERM, item.getType());
    assertEquals("Business.Order", item.getFullyQualifiedName());
    assertTrue(item.getContent().contains("An order"));
    assertNull(
        AIContextFinder.toKnowledgeItem(Map.of("entityType", "table", "fullyQualifiedName", "x")),
        "non-knowledge entityType must not become a KnowledgeItem");
  }

  @Test
  void toKnowledgeItem_filtersDraftGlossaryTerms() {
    assertNull(
        AIContextFinder.toKnowledgeItem(
            Map.of(
                "entityType", "glossaryTerm",
                "fullyQualifiedName", "Business.Draft",
                "name", "Draft",
                "entityStatus", "Draft")),
        "non-Approved glossary terms are untrusted as business-rule context");
    assertEquals(
        KnowledgeItem.Type.GLOSSARY_TERM,
        AIContextFinder.toKnowledgeItem(
                Map.of(
                    "entityType", "glossaryTerm",
                    "fullyQualifiedName", "Business.Live",
                    "name", "Live",
                    "entityStatus", "Approved"))
            .getType());
    assertEquals(
        KnowledgeItem.Type.PAGE,
        AIContextFinder.toKnowledgeItem(
                Map.of(
                    "entityType", "page",
                    "fullyQualifiedName", "Article_1",
                    "name", "Guide",
                    "entityStatus", "Draft"))
            .getType(),
        "the Approved filter applies to glossary terms only");
  }

  @Test
  void tagSearchRequest_matchesTheExactTagInTheFilterRatherThanTheQueryText() {
    String quotedFqn = "Business.\"Order.Line\"";

    SearchRequest request = AIContextFinder.tagSearchRequest(quotedFqn, "all", 10, List.of());

    assertEquals("*", request.getQuery());
    JsonNode bool = JsonUtils.readTree(request.getQueryFilter()).at("/query/bool");
    assertEquals(quotedFqn, bool.at("/filter/term/tags.tagFQN").asText());
    assertTrue(bool.path("must_not").isMissingNode(), "no entity types are excluded");
  }

  @Test
  void collectHit_keepsItemsOfDifferentTypesSharingAnFqn() {
    AIContextFinder finder = new AIContextFinder();
    Map<String, KnowledgeItem> items = new LinkedHashMap<>();
    Map<String, AIContextFinder.CandidateAsset> candidates = new LinkedHashMap<>();
    finder.collectHit(
        Map.of("entityType", "metric", "fullyQualifiedName", "Revenue", "name", "Revenue"),
        items,
        candidates);
    finder.collectHit(
        Map.of("entityType", "page", "fullyQualifiedName", "Revenue", "name", "Revenue"),
        items,
        candidates);
    finder.collectHit(
        Map.of("entityType", "page", "fullyQualifiedName", "Revenue", "name", "Revenue"),
        items,
        candidates);
    assertEquals(
        2,
        items.size(),
        "a metric and a page sharing an FQN are distinct knowledge items; a repeated chunk of the"
            + " same item still dedupes");
  }

  @Test
  void collectHit_skipsHitsTheCallerCannotViewAndDoesNotRouteThem() {
    UUID hiddenMetricId = UUID.randomUUID();
    UUID visiblePageId = UUID.randomUUID();
    EntityReference orders =
        new EntityReference().withFullyQualifiedName("svc.db.sch.orders").withType("table");
    EntityRepository<?> repository = mock(EntityRepository.class);
    when(repository.findTo(hiddenMetricId, Entity.METRIC, Relationship.APPLIED_TO, null))
        .thenReturn(List.of(orders));
    when(repository.findFrom(visiblePageId, Entity.PAGE, Relationship.HAS, null))
        .thenReturn(List.of(orders));
    AIContextFinder finder =
        new AIContextFinder(null, item -> item.getType() != KnowledgeItem.Type.METRIC);
    Map<String, KnowledgeItem> items = new LinkedHashMap<>();
    Map<String, AIContextFinder.CandidateAsset> candidates = new LinkedHashMap<>();

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(any(String.class))).thenReturn(repository);
      finder.collectHit(
          Map.of(
              "id", hiddenMetricId.toString(),
              "entityType", "metric",
              "fullyQualifiedName", "Finance.Ceiling",
              "name", "Ceiling"),
          items,
          candidates);
      assertTrue(items.isEmpty(), "a hidden hit is not returned");
      assertTrue(candidates.isEmpty(), "a hidden hit routes to no candidate assets");

      finder.collectHit(
          Map.of(
              "id", visiblePageId.toString(),
              "entityType", "page",
              "fullyQualifiedName", "Marketing.Playbook",
              "name", "Playbook"),
          items,
          candidates);
    }

    assertEquals(List.of("page:Marketing.Playbook"), List.copyOf(items.keySet()));
    assertEquals(
        List.of(
            new AIContextFinder.CandidateAsset("svc.db.sch.orders", "table", "Marketing.Playbook")),
        List.copyOf(candidates.values()),
        "a visible hit still routes to an asset a hidden hit also points at");
    verify(repository, never())
        .findTo(hiddenMetricId, Entity.METRIC, Relationship.APPLIED_TO, null);
  }

  @Test
  void renderFound_emitsKnowledgeAndCandidateAssets() {
    AIContextFinder.FoundContext found =
        new AIContextFinder.FoundContext(
            List.of(
                new KnowledgeItem()
                    .withType(KnowledgeItem.Type.GLOSSARY_TERM)
                    .withName("Order")
                    .withDisplayName("Order")
                    .withFullyQualifiedName("Business.Order")
                    .withContent("An order placed by a customer.")),
            List.of(
                new AIContextFinder.CandidateAsset(
                    "svc.db.sch.orders", "table", "Business.Order")));
    String markdown = AIContextMarkdown.renderFound(found);
    assertTrue(markdown.contains("# Relevant Knowledge"), "missing knowledge heading");
    assertTrue(markdown.contains("### Order (Glossary Term)"), "missing labelled term");
    assertTrue(markdown.contains("`Business.Order`"), "missing term fqn");
    assertTrue(markdown.contains("# Candidate Assets"), "missing candidate assets heading");
    assertTrue(
        markdown.contains("- `svc.db.sch.orders` (table) — via `Business.Order`"),
        "missing routed candidate asset");
  }
}
