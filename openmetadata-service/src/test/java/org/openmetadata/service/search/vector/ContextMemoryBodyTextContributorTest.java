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
package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;

class ContextMemoryBodyTextContributorTest {

  @Test
  void entityType_matchesContextMemoryConstant() {
    assertEquals(Entity.CONTEXT_MEMORY, ContextMemoryBodyTextContributor.INSTANCE.entityType());
  }

  @Test
  void extract_includesAllPopulatedMemoryFields() {
    ContextMemory memory =
        baseMemory()
            .withTitle("Find certified tables")
            .withSummary("Quick guide")
            .withQuestion("How do I find certified tables?")
            .withAnswer("Filter the Explore page by Certification.")
            .withDescription("Detailed notes");

    String body = ContextMemoryBodyTextContributor.extractBodyText(memory);

    assertTrue(body.contains("title: Find certified tables"));
    assertTrue(body.contains("summary: Quick guide"));
    assertTrue(body.contains("question: How do I find certified tables?"));
    assertTrue(body.contains("answer: Filter the Explore page by Certification."));
    assertTrue(body.contains("description: Detailed notes"));
  }

  @Test
  void extract_skipsNullAndBlankFields() {
    ContextMemory memory =
        baseMemory()
            .withTitle(null)
            .withSummary("   ")
            .withQuestion("Q")
            .withAnswer("A")
            .withDescription("");

    String body = ContextMemoryBodyTextContributor.extractBodyText(memory);

    assertEquals("question: Q; answer: A", body);
  }

  @Test
  void extract_returnsEmptyStringWhenAllFieldsBlank() {
    ContextMemory memory = baseMemory().withQuestion("").withAnswer(null);

    String body = ContextMemoryBodyTextContributor.extractBodyText(memory);

    assertEquals("", body);
  }

  @Test
  void extract_returnsNullForNonContextMemoryEntity() {
    Table table = new Table().withId(UUID.randomUUID()).withName("orders");

    String body = ContextMemoryBodyTextContributor.extractBodyText(table);

    assertNull(body);
  }

  @Test
  void register_installsExtractorForContextMemoryEntityType() {
    ContextMemoryBodyTextContributor.INSTANCE.register();
    ContextMemory memory =
        baseMemory().withTitle("t").withSummary("s").withQuestion("q").withAnswer("a");

    String body = VectorDocBuilder.buildBodyText(memory, Entity.CONTEXT_MEMORY);

    assertEquals("title: t; summary: s; question: q; answer: a", body);
  }

  private ContextMemory baseMemory() {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName("test-memory")
        .withFullyQualifiedName("test-memory");
  }
}
