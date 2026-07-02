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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

/**
 * The ContextMemory search-visibility rule lives entirely in {@link ContextMemoryRepository}: only
 * org-wide ({@link MemoryVisibility#ENTITY}) memories are indexed. {@link
 * ContextMemoryRepository#isSearchIndexable} gates the live create/update path and {@link
 * ContextMemoryRepository#getReindexFilter} carries the same rule into the bulk reindex as a DB
 * query. These tests pin both halves across every visibility state.
 */
class ContextMemoryRepositoryTest {

  private ContextMemoryRepository repository;

  @BeforeEach
  void setUp() {
    CollectionDAO daoCollection = mock(CollectionDAO.class);
    when(daoCollection.contextMemoryDAO()).thenReturn(mock(CollectionDAO.ContextMemoryDAO.class));
    when(daoCollection.relationshipDAO())
        .thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    Entity.setCollectionDAO(daoCollection);
    repository = new ContextMemoryRepository();
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void isSearchIndexable_trueForEntityVisibility() {
    assertTrue(repository.isSearchIndexable(memory(MemoryVisibility.ENTITY)));
  }

  @Test
  void isSearchIndexable_falseForPrivate() {
    assertFalse(repository.isSearchIndexable(memory(MemoryVisibility.PRIVATE)));
  }

  @Test
  void isSearchIndexable_falseForShared() {
    assertFalse(repository.isSearchIndexable(memory(MemoryVisibility.SHARED)));
  }

  @Test
  void isSearchIndexable_falseWhenShareConfigMissing() {
    assertFalse(
        repository.isSearchIndexable(
            new ContextMemory().withId(UUID.randomUUID()).withName("mem")));
  }

  @Test
  void getReindexFilter_restrictsToEntityVisibility() {
    assertEquals(
        MemoryVisibility.ENTITY.value(),
        repository
            .getReindexFilter()
            .getQueryParams()
            .get(ListFilter.MEMORY_SEARCH_VISIBILITY_PARAM));
  }

  @Test
  void entityFacade_isSearchIndexable_dispatchesToRepository() {
    assertTrue(Entity.isSearchIndexable(memory(MemoryVisibility.ENTITY)));
    assertFalse(Entity.isSearchIndexable(memory(MemoryVisibility.PRIVATE)));
  }

  @Test
  void entityFacade_isSearchIndexable_defaultsTrueForTypeWithoutRepository() {
    // A type with no registered repository (index-only / time-series sub-entities such as
    // pipelineStatus) must default to indexable instead of throwing EntityNotFoundException, so the
    // live index paths keep working for it.
    EntityInterface repoLess = mock(EntityInterface.class);
    when(repoLess.getEntityReference())
        .thenReturn(new EntityReference().withType("typeWithoutRepository"));

    assertTrue(Entity.isSearchIndexable(repoLess));
  }

  private ContextMemory memory(MemoryVisibility visibility) {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName("mem")
        .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }
}
