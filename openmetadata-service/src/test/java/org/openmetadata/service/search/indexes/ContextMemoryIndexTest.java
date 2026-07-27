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

package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class ContextMemoryIndexTest {

  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void setUp() {
    SearchRepository mockSearchRepo =
        Mockito.mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
  }

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
  }

  @Test
  void buildSearchIndexDoc_populatesMemorySpecificFields() {
    ContextMemory memory =
        baseMemory()
            .withTitle("Find certified tables")
            .withSummary("Quick guide on Certification filtering")
            .withMemoryType(ContextMemoryType.FAQ)
            .withMemoryScope(ContextMemoryScope.USER_GLOBAL)
            .withStatus(ContextMemoryStatus.ACTIVE)
            .withPinned(true)
            .withSourceType(ContextMemorySourceType.CHAT_PROMOTION)
            .withUsageCount(7)
            .withLastUsedAt(1_700_000_000_000L);

    ContextMemoryIndex index = new ContextMemoryIndex(memory);
    Map<String, Object> doc = index.buildSearchIndexDocInternal(new HashMap<>());

    assertEquals("Find certified tables", doc.get("title"));
    assertEquals("Quick guide on Certification filtering", doc.get("summary"));
    assertEquals("How do I find certified tables?", doc.get("question"));
    assertEquals("Filter the Explore page by the Certification tag.", doc.get("answer"));
    assertEquals(ContextMemoryType.FAQ.value(), doc.get("memoryType"));
    assertEquals(ContextMemoryScope.USER_GLOBAL.value(), doc.get("memoryScope"));
    assertEquals(ContextMemoryStatus.ACTIVE.value(), doc.get("status"));
    assertEquals(true, doc.get("pinned"));
    assertEquals(ContextMemorySourceType.CHAT_PROMOTION.value(), doc.get("sourceType"));
    assertEquals(7, doc.get("usageCount"));
    assertEquals(1_700_000_000_000L, doc.get("lastUsedAt"));
  }

  @Test
  void buildSearchIndexDoc_nullPinnedDefaultsToFalse() {
    Map<String, Object> doc =
        new ContextMemoryIndex(baseMemory()).buildSearchIndexDocInternal(new HashMap<>());

    assertEquals(false, doc.get("pinned"));
  }

  @Test
  void buildSearchIndexDoc_convertsSourceUuidsToStrings() {
    UUID conversationId = UUID.randomUUID();
    UUID humanMessageId = UUID.randomUUID();
    UUID assistantMessageId = UUID.randomUUID();
    ContextMemory memory =
        baseMemory()
            .withSourceConversation(conversationId)
            .withSourceHumanMessage(humanMessageId)
            .withSourceAssistantMessage(assistantMessageId);

    Map<String, Object> doc =
        new ContextMemoryIndex(memory).buildSearchIndexDocInternal(new HashMap<>());

    assertEquals(conversationId.toString(), doc.get("sourceConversation"));
    assertEquals(humanMessageId.toString(), doc.get("sourceHumanMessage"));
    assertEquals(assistantMessageId.toString(), doc.get("sourceAssistantMessage"));
  }

  @Test
  void buildSearchIndexDoc_nullSourceFieldsResolveToNull() {
    Map<String, Object> doc =
        new ContextMemoryIndex(baseMemory()).buildSearchIndexDocInternal(new HashMap<>());

    assertNull(doc.get("sourceConversation"));
    assertNull(doc.get("sourceHumanMessage"));
    assertNull(doc.get("sourceAssistantMessage"));
  }

  @Test
  void buildSearchIndexDoc_nullUsageCountDefaultsToZero() {
    ContextMemory memory = baseMemory().withUsageCount(null);
    Map<String, Object> doc =
        new ContextMemoryIndex(memory).buildSearchIndexDocInternal(new HashMap<>());

    assertEquals(0, doc.get("usageCount"));
  }

  @Test
  void buildSearchIndexDoc_flattensShareConfig() {
    UUID userId = UUID.randomUUID();
    EntityReference principal = new EntityReference().withId(userId).withType(Entity.USER);
    MemoryShareConfig shareConfig =
        new MemoryShareConfig()
            .withVisibility(MemoryVisibility.SHARED)
            .withSharedWith(List.of(new MemorySharedPrincipal().withPrincipal(principal)));
    ContextMemory memory = baseMemory().withShareConfig(shareConfig);

    Map<String, Object> doc =
        new ContextMemoryIndex(memory).buildSearchIndexDocInternal(new HashMap<>());

    assertEquals(MemoryVisibility.SHARED.value(), doc.get("visibility"));
    @SuppressWarnings("unchecked")
    List<String> sharedWithIds = (List<String>) doc.get("sharedWithIds");
    assertEquals(List.of(userId.toString()), sharedWithIds);
  }

  @Test
  void buildSearchIndexDoc_nullEntriesInSharedWithAreSkippedNotThrown() {
    UUID userId = UUID.randomUUID();
    EntityReference principal = new EntityReference().withId(userId).withType(Entity.USER);
    List<MemorySharedPrincipal> sharedWith = new ArrayList<>();
    sharedWith.add(null);
    sharedWith.add(new MemorySharedPrincipal());
    sharedWith.add(new MemorySharedPrincipal().withPrincipal(new EntityReference()));
    sharedWith.add(new MemorySharedPrincipal().withPrincipal(principal));
    MemoryShareConfig shareConfig =
        new MemoryShareConfig().withVisibility(MemoryVisibility.SHARED).withSharedWith(sharedWith);
    ContextMemory memory = baseMemory().withShareConfig(shareConfig);

    Map<String, Object> doc =
        new ContextMemoryIndex(memory).buildSearchIndexDocInternal(new HashMap<>());

    @SuppressWarnings("unchecked")
    List<String> sharedWithIds = (List<String>) doc.get("sharedWithIds");
    assertEquals(List.of(userId.toString()), sharedWithIds);
  }

  @Test
  void buildSearchIndexDoc_nullShareConfigYieldsEmptySharedWith() {
    Map<String, Object> doc =
        new ContextMemoryIndex(baseMemory()).buildSearchIndexDocInternal(new HashMap<>());

    assertNull(doc.get("visibility"));
    @SuppressWarnings("unchecked")
    List<String> sharedWithIds = (List<String>) doc.get("sharedWithIds");
    assertTrue(sharedWithIds.isEmpty());
  }

  @Test
  void buildSearchIndexDoc_populatesEntityReferencesWithDisplayName() {
    EntityReference primaryEntity =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE).withName("orders");
    EntityReference relatedEntity =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.TABLE)
            .withName("customers")
            .withDisplayName("Customers Dim");
    EntityReference rootMemory =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.CONTEXT_MEMORY)
            .withName("root-mem");
    EntityReference parentMemory =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.CONTEXT_MEMORY)
            .withName("parent-mem")
            .withDisplayName("Parent Memory");

    ContextMemory memory =
        baseMemory()
            .withPrimaryEntity(primaryEntity)
            .withRelatedEntities(List.of(relatedEntity))
            .withRootMemory(rootMemory)
            .withParentMemory(parentMemory);

    Map<String, Object> doc =
        new ContextMemoryIndex(memory).buildSearchIndexDocInternal(new HashMap<>());

    EntityReference docPrimary = (EntityReference) doc.get("primaryEntity");
    assertNotNull(docPrimary);
    assertEquals("orders", docPrimary.getDisplayName());

    @SuppressWarnings("unchecked")
    List<EntityReference> docRelated = (List<EntityReference>) doc.get("relatedEntities");
    assertEquals(1, docRelated.size());
    assertEquals("Customers Dim", docRelated.get(0).getDisplayName());

    EntityReference docRoot = (EntityReference) doc.get("rootMemory");
    assertEquals("root-mem", docRoot.getDisplayName());

    EntityReference docParent = (EntityReference) doc.get("parentMemory");
    assertEquals("Parent Memory", docParent.getDisplayName());
  }

  @Test
  void buildSearchIndexDoc_nullEntityReferencesAreSafe() {
    Map<String, Object> doc =
        new ContextMemoryIndex(baseMemory()).buildSearchIndexDocInternal(new HashMap<>());

    assertNull(doc.get("primaryEntity"));
    assertNull(doc.get("rootMemory"));
    assertNull(doc.get("parentMemory"));
    @SuppressWarnings("unchecked")
    List<EntityReference> related = (List<EntityReference>) doc.get("relatedEntities");
    assertTrue(related.isEmpty());
  }

  @Test
  void entityTypeName_matchesContextMemoryConstant() {
    assertEquals(Entity.CONTEXT_MEMORY, new ContextMemoryIndex(baseMemory()).getEntityTypeName());
  }

  @Test
  void requiredReindexFields_includeTagsFromTaggableIndex() {
    ContextMemoryIndex index = new ContextMemoryIndex(baseMemory());

    assertTrue(index.getRequiredReindexFields().contains("tags"));
    assertTrue(index.getRequiredReindexFields().contains("owners"));
  }

  private ContextMemory baseMemory() {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName("test-memory")
        .withFullyQualifiedName("test-memory")
        .withQuestion("How do I find certified tables?")
        .withAnswer("Filter the Explore page by the Certification tag.");
  }
}
