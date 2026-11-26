package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class VectorEmbeddingHandlerTest {
  private VectorIndexService vectorIndexService;
  private VectorEmbeddingHandler handler;
  private SubjectContext subjectContext;

  @BeforeEach
  void setUp() {
    vectorIndexService = mock(VectorIndexService.class);
    handler = new VectorEmbeddingHandler(vectorIndexService);
    subjectContext = mock(SubjectContext.class);
  }

  @Test
  void testHandlerName() {
    assert handler.getHandlerName().equals("VectorEmbeddingHandler");
  }

  @Test
  void testPriority() {
    assert handler.getPriority() == 200;
  }

  @Test
  void testIsAsync() {
    assert handler.isAsync();
  }

  @Test
  void testOnEntityCreatedForSupportedType() {
    EntityInterface<?> entity = createMockEntity("table");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      SearchRepository searchRepository = mock(SearchRepository.class);
      IndexMapping indexMapping = mock(IndexMapping.class);
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      entityMock.when(() -> Entity.isVectorEmbeddable(entity)).thenReturn(true);
      when(searchRepository.getIndexMapping("table")).thenReturn(indexMapping);
      when(searchRepository.getClusterAlias()).thenReturn("");
      when(indexMapping.getIndexName("")).thenReturn("table_search_index");

      handler.onEntityCreated(entity, subjectContext);

      verify(vectorIndexService).updateEntityEmbeddings(any(), anyString());
    }
  }

  @Test
  void testOnEntityCreatedForUnsupportedType() {
    EntityInterface<?> entity = createMockEntity("unsupportedType");

    handler.onEntityCreated(entity, subjectContext);

    verify(vectorIndexService, never()).updateEntityEmbeddings(any(), anyString());
  }

  @Test
  void testOnEntityUpdatedCallsUpdate() {
    EntityInterface<?> entity = createMockEntity("table");
    when(entity.getDeleted()).thenReturn(false);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      SearchRepository searchRepository = mock(SearchRepository.class);
      IndexMapping indexMapping = mock(IndexMapping.class);
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      entityMock.when(() -> Entity.isVectorEmbeddable(entity)).thenReturn(true);
      when(searchRepository.getIndexMapping("table")).thenReturn(indexMapping);
      when(searchRepository.getClusterAlias()).thenReturn("");
      when(indexMapping.getIndexName("")).thenReturn("table_search_index");

      handler.onEntityUpdated(entity, null, subjectContext);

      verify(vectorIndexService).updateEntityEmbeddings(any(), anyString());
    }
  }

  @Test
  void testOnEntityUpdatedDropsChunksAndEmbeddingForNonEmbeddableEntity() {
    EntityInterface<?> entity = createMockEntity("contextMemory");
    SearchRepository searchRepository = mock(SearchRepository.class);
    IndexMapping indexMapping = mock(IndexMapping.class);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.isVectorEmbeddable(entity)).thenReturn(false);
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      when(searchRepository.getIndexMapping("contextMemory")).thenReturn(indexMapping);
      when(searchRepository.getClusterAlias()).thenReturn("");
      when(indexMapping.getIndexName("")).thenReturn("context_memory_search_index");

      handler.onEntityUpdated(entity, null, subjectContext);

      verify(vectorIndexService).deleteEntityChunks(entity.getId().toString());
      // The entity doc keeps its embedding across partial merges, so it has to be cleared
      // explicitly or a memory flipped to Private stays matchable by kNN.
      verify(vectorIndexService)
          .clearEntityEmbedding("context_memory_search_index", entity.getId().toString());
      verify(vectorIndexService, never()).updateEntityEmbeddings(any(), anyString());
    }
  }

  @Test
  void aReferenceRefreshKeepsAnAlreadyCurrentEmbedding() {
    EntityInterface<?> entity = createMockEntity(Entity.TABLE);
    float[] embedding = new float[] {1};
    Map<String, Object> stored = new HashMap<>();
    stored.put("embedding", embedding);
    doAnswer(
            call -> {
              stored.clear();
              return null;
            })
        .when(vectorIndexService)
        .clearEntityEmbedding(anyString(), anyString());
    SearchRepository search = mock(SearchRepository.class);
    IndexMapping mapping = mock(IndexMapping.class);

    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(Entity::getSearchRepository).thenReturn(search);
      entities.when(() -> Entity.isVectorEmbeddable(entity)).thenReturn(true);
      when(search.getIndexMapping(Entity.TABLE)).thenReturn(mapping);
      when(search.getClusterAlias()).thenReturn("");
      when(mapping.getIndexName("")).thenReturn("table_search_index");
      String fingerprint = VectorDocBuilder.computeFingerprintForEntity(entity);
      when(vectorIndexService.getExistingFingerprint(
              "table_search_index", entity.getId().toString()))
          .thenReturn(fingerprint);

      handler.invalidateStaleEmbedding(entity);
    }

    assertSame(embedding, stored.get("embedding"));
  }

  @Test
  void testOnEntityUpdatedSkipsDeleted() {
    EntityInterface<?> entity = createMockEntity("table");
    when(entity.getDeleted()).thenReturn(true);

    handler.onEntityUpdated(entity, null, subjectContext);

    verify(vectorIndexService, never()).updateEntityEmbeddings(any(), anyString());
  }

  @Test
  void testOnEntityUpdatedHandlesNull() {
    handler.onEntityUpdated(null, null, subjectContext);

    verify(vectorIndexService, never()).updateEntityEmbeddings(any(), anyString());
  }

  /** A type with no embeddings has no chunks, so none of its lifecycle events sends a delete. */
  @Test
  void aTypeWithoutEmbeddingsSendsNoChunkDelete() {
    EntityInterface<?> user = createMockEntity(Entity.USER);

    handler.onEntityDeleted(user, subjectContext);
    handler.onEntitySoftDeletedOrRestored(user, true, subjectContext);
    handler.invalidateStaleEmbedding(user);

    assertFalse(handler.getSupportedEntityTypes().contains(Entity.USER));
    verify(vectorIndexService, never()).deleteEntityChunks(anyString());
  }

  @Test
  void testOnEntityDeletedIsNoOp() {
    EntityInterface<?> entity = createMockEntity("table");

    handler.onEntityDeleted(entity, subjectContext);

    verify(vectorIndexService, never()).updateEntityEmbeddings(any(), anyString());
  }

  @Test
  void testOnEntitySoftDeletedIsNoOp() {
    EntityInterface<?> entity = createMockEntity("table");

    handler.onEntitySoftDeletedOrRestored(entity, true, subjectContext);

    verify(vectorIndexService, never()).updateEntityEmbeddings(any(), anyString());
  }

  @Test
  void testOnEntityRestoredIsNoOp() {
    EntityInterface<?> entity = createMockEntity("table");

    handler.onEntitySoftDeletedOrRestored(entity, false, subjectContext);

    verify(vectorIndexService, never()).updateEntityEmbeddings(any(), anyString());
  }

  @Test
  void testOnEntitySoftDeletedOrRestoredHandlesNull() {
    handler.onEntitySoftDeletedOrRestored(null, true, subjectContext);

    verify(vectorIndexService, never()).updateEntityEmbeddings(any(), anyString());
  }

  private EntityInterface<?> createMockEntity(String entityType) {
    EntityInterface<?> entity = mock(EntityInterface.class);
    UUID id = UUID.randomUUID();
    EntityReference ref = new EntityReference();
    ref.setType(entityType);
    ref.setId(id);
    when(entity.getEntityReference()).thenReturn(ref);
    when(entity.getId()).thenReturn(id);
    when(entity.getDeleted()).thenReturn(false);
    return entity;
  }
}
