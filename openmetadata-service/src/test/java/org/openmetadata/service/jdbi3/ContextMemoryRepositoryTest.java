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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

/**
 * ContextMemory is indexed whatever its {@code shareConfig.visibility}; privacy is enforced at
 * query time by {@link org.openmetadata.service.search.security.ContextMemorySearchVisibility}.
 * Excluding restricted memories at index time hid a user's own PRIVATE memories and the SHARED ones
 * they are a principal of from the search-backed {@code GET /contextCenter/memories} listing, so
 * these tests pin that no visibility is filtered out of the index.
 */
@Execution(ExecutionMode.SAME_THREAD)
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

  @ParameterizedTest
  @EnumSource(MemoryVisibility.class)
  void isSearchIndexable_trueForEveryVisibility(MemoryVisibility visibility) {
    assertTrue(repository.isSearchIndexable(memory(visibility)));
  }

  @Test
  void isSearchIndexable_trueWhenShareConfigMissing() {
    assertTrue(
        repository.isSearchIndexable(
            new ContextMemory().withId(UUID.randomUUID()).withName("mem")));
  }

  @ParameterizedTest
  @EnumSource(MemoryVisibility.class)
  void isVectorEmbeddable_trueForEveryVisibility(MemoryVisibility visibility) {
    assertTrue(repository.isVectorEmbeddable(memory(visibility)));
  }

  @Test
  void isVectorEmbeddable_trueWhenShareConfigMissing() {
    assertTrue(
        repository.isVectorEmbeddable(
            new ContextMemory().withId(UUID.randomUUID()).withName("mem")));
  }

  @Test
  void getReindexFilter_doesNotRestrictByVisibility() {
    assertTrue(repository.getReindexFilter().getQueryParams().isEmpty());
  }

  @Test
  void entityFacade_isSearchIndexable_trueForRestrictedMemories() {
    assertTrue(Entity.isSearchIndexable(memory(MemoryVisibility.ENTITY)));
    assertTrue(Entity.isSearchIndexable(memory(MemoryVisibility.PRIVATE)));
    assertTrue(Entity.isSearchIndexable(memory(MemoryVisibility.SHARED)));
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

  @Test
  void entityFacade_isSearchIndexable_falseForMissingEntityOrReference() {
    assertFalse(Entity.isSearchIndexable(null));
    assertFalse(Entity.isSearchIndexable(mock(EntityInterface.class)));
  }

  @Test
  @SuppressWarnings("unchecked")
  void entityFacade_isSearchIndexable_defaultsTrueWhenOnlyTimeSeriesRepositoryExists()
      throws ReflectiveOperationException {
    String entityType = "testTimeSeries";
    Field repositoriesField = Entity.class.getDeclaredField("ENTITY_TS_REPOSITORY_MAP");
    repositoriesField.setAccessible(true);
    Map<String, EntityTimeSeriesRepository<?>> repositories =
        (Map<String, EntityTimeSeriesRepository<?>>) repositoriesField.get(null);
    repositories.put(entityType, mock(EntityTimeSeriesRepository.class));

    try {
      EntityInterface timeSeriesEntity = mock(EntityInterface.class);
      when(timeSeriesEntity.getEntityReference())
          .thenReturn(new EntityReference().withType(entityType));

      assertTrue(Entity.hasEntityRepository(entityType));
      assertTrue(Entity.isSearchIndexable(timeSeriesEntity));
    } finally {
      repositories.remove(entityType);
    }
  }

  private ContextMemory memory(MemoryVisibility visibility) {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName("mem")
        .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }
}
