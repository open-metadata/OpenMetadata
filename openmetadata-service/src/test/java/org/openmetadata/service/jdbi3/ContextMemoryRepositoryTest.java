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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
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
  private CollectionDAO daoCollection;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;

  @BeforeEach
  void setUp() {
    daoCollection = mock(CollectionDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(daoCollection.contextMemoryDAO()).thenReturn(mock(CollectionDAO.ContextMemoryDAO.class));
    when(daoCollection.relationshipDAO()).thenReturn(relationshipDAO);
    Entity.setCollectionDAO(daoCollection);
    Entity.setEntityRelationshipRepository(new EntityRelationshipRepository(daoCollection));
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

  /**
   * A reused {@link ContextMemory} can legitimately carry more than one {@code MENTIONED_IN} source
   * edge, while its {@code sourceEntity}/{@code sourceFile} fields are singular {@link
   * EntityReference} projections over that multi-edge set. Both read paths must therefore apply
   * the *same* tiebreak, otherwise the plain JDBI list (and the reconciler's {@code applyDerived}
   * write fed by {@code listExtractedMemories}) can report -- and write -- a different source than
   * the detail GET, deleting a {@code MENTIONED_IN} edge during reconciliation.
   *
   * <p>The single {@code getSourceEntity} path (detail GET, update write-back) inherits the {@code
   * EntityUtil.compareEntityReference} (entity-name) sort from {@code
   * EntityRelationshipRepository.getEntityReferences} and returns the name-first source. This test
   * stubs the bulk {@code findFromBatch} rows in non-name (DB arrival) order and asserts the bulk
   * {@code batchFetchSources} path now returns the same name-first source instead of the first DB
   * row, so list vs detail agree and the reconciler's diff is empty.
   */
  @Test
  void batchFetchSources_picksNameFirstSourceLikeSinglePath() throws ReflectiveOperationException {
    UUID memoryId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    UUID alphaId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    UUID betaId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    ContextMemory memory = new ContextMemory().withId(memoryId).withName("reused-memory");
    EntityReference alphaSource =
        new EntityReference().withId(alphaId).withType(Entity.CONTEXT_FILE).withName("Alpha");
    EntityReference betaSource =
        new EntityReference().withId(betaId).withType(Entity.CONTEXT_FILE).withName("Beta");

    // Single-path records: findFrom returns both source rows; EntityRelationshipRepository
    // resolves and name-sorts them, so getSourceEntity returns "Alpha".
    List<CollectionDAO.EntityRelationshipRecord> singleRecords =
        List.of(
            CollectionDAO.EntityRelationshipRecord.builder()
                .id(alphaId)
                .type(Entity.CONTEXT_FILE)
                .build(),
            CollectionDAO.EntityRelationshipRecord.builder()
                .id(betaId)
                .type(Entity.CONTEXT_FILE)
                .build());
    // Bulk-path rows deliberately in non-name (DB arrival) order, with Beta first: this is the
    // order that made the old putIfAbsent bulk path disagree with the name-sorted single path.
    List<CollectionDAO.EntityRelationshipObject> bulkRecords =
        List.of(
            CollectionDAO.EntityRelationshipObject.builder()
                .fromId(betaId.toString())
                .toId(memoryId.toString())
                .fromEntity(Entity.CONTEXT_FILE)
                .toEntity(Entity.CONTEXT_MEMORY)
                .build(),
            CollectionDAO.EntityRelationshipObject.builder()
                .fromId(alphaId.toString())
                .toId(memoryId.toString())
                .fromEntity(Entity.CONTEXT_FILE)
                .toEntity(Entity.CONTEXT_MEMORY)
                .build());

    when(relationshipDAO.findFrom(
            eq(memoryId), eq(Entity.CONTEXT_MEMORY), eq(Relationship.MENTIONED_IN.ordinal())))
        .thenReturn(singleRecords);
    when(relationshipDAO.findFromBatch(
            anyList(), eq(Relationship.MENTIONED_IN.ordinal()), eq(Include.NON_DELETED)))
        .thenReturn(bulkRecords);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entityMock.when(() -> Entity.hasEntityRepository(eq(Entity.CONTEXT_FILE))).thenReturn(true);
      entityMock
          .when(
              () ->
                  Entity.getEntityReferencesByIds(
                      eq(Entity.CONTEXT_FILE), anyList(), any(Include.class)))
          .thenReturn(List.of(alphaSource, betaSource));

      Method getSourceEntity =
          ContextMemoryRepository.class.getDeclaredMethod("getSourceEntity", ContextMemory.class);
      getSourceEntity.setAccessible(true);
      EntityReference single = (EntityReference) getSourceEntity.invoke(repository, memory);

      Method batchFetchSources =
          ContextMemoryRepository.class.getDeclaredMethod("batchFetchSources", List.class);
      batchFetchSources.setAccessible(true);
      Map<UUID, EntityReference> bulk =
          (Map<UUID, EntityReference>) batchFetchSources.invoke(repository, List.of(memory));

      assertEquals(alphaId, single.getId(), "single path must pick the name-first source (Alpha)");
      assertTrue(bulk.containsKey(memoryId), "bulk path must resolve a source for the memory");
      assertEquals(
          alphaId,
          bulk.get(memoryId).getId(),
          "bulk path must pick the name-first source, matching the single path");
      assertEquals(
          single.getId(),
          bulk.get(memoryId).getId(),
          "list (bulk) and detail (single) must agree on sourceEntity id");
    }
  }

  private ContextMemory memory(MemoryVisibility visibility) {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName("mem")
        .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }
}
