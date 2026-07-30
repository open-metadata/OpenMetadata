/*
 *  Copyright 2026 Collate.
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;

/** Unit tests for {@link AttachedKnowledgeBatch}'s pure helpers. */
class AttachedKnowledgeBatchTest {

  @Test
  void truncated_capsLongContentAndFlagsIt() {
    String longContent = "x".repeat(AttachedKnowledgeBatch.MAX_CONTENT_CHARS + 100);
    KnowledgeItem item =
        new KnowledgeItem()
            .withType(KnowledgeItem.Type.PAGE)
            .withName("Guide")
            .withFullyQualifiedName("Article_1")
            .withContent(longContent);

    KnowledgeItem result = AttachedKnowledgeBatch.truncated(item);

    assertNotSame(item, result, "truncation must not mutate the shared bulk-loaded item");
    assertEquals(
        AttachedKnowledgeBatch.MAX_CONTENT_CHARS + 1, // cap + ellipsis
        result.getContent().length());
    assertTrue(result.getContent().endsWith("…"));
    assertTrue(result.getContentTruncated());
    assertEquals("Article_1", result.getFullyQualifiedName());
  }

  @Test
  void truncated_leavesShortContentUntouched() {
    KnowledgeItem item =
        new KnowledgeItem()
            .withType(KnowledgeItem.Type.METRIC)
            .withName("Revenue")
            .withContent("SUM(amount)");

    KnowledgeItem result = AttachedKnowledgeBatch.truncated(item);

    assertSame(item, result, "short content must pass through without copying");
    assertEquals("SUM(amount)", result.getContent());
    assertFalse(result.getContentTruncated());
  }

  @Test
  void truncated_toleratesNullContent() {
    KnowledgeItem item = new KnowledgeItem().withType(KnowledgeItem.Type.GLOSSARY_TERM);
    assertSame(item, AttachedKnowledgeBatch.truncated(item));
  }

  @Test
  void flattenIds_deduplicatesAcrossAssets() {
    UUID shared = UUID.randomUUID();
    UUID only = UUID.randomUUID();
    Map<String, List<UUID>> idsByAsset =
        Map.of(
            "asset-a", List.of(shared, only),
            "asset-b", List.of(shared));

    List<UUID> flattened = AttachedKnowledgeBatch.flattenIds(idsByAsset);

    assertEquals(2, flattened.size(), "a metric applied to two assets must be loaded once");
    assertTrue(flattened.containsAll(List.of(shared, only)));
  }

  @Test
  void flattenIds_emptyInputYieldsEmptyOutput() {
    assertFalse(AttachedKnowledgeBatch.flattenIds(Map.of()).iterator().hasNext());
  }
}
