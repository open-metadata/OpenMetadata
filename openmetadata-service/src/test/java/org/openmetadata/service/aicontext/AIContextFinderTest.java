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

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;

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
