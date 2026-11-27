package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.search.SearchIndexRetryQueue;
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

  /**
   * A recursive soft delete marks each descendant deleted with a bulk update and sends it no soft
   * delete event, so that update removes its chunks.
   */
  @Test
  void anUpdateToDeletedRemovesTheChunks() {
    EntityInterface<?> entity = createMockEntity("table");
    when(entity.getDeleted()).thenReturn(true);

    handler.onEntityUpdated(entity, null, subjectContext);

    verify(vectorIndexService).deleteEntityChunks(entity.getId().toString());
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
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> dispatchers =
        mockStatic(EntityLifecycleEventDispatcher.class)) {
      dispatchers.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      handler.prepareHardDelete(user).run();
    }
    handler.onEntitySoftDeletedOrRestored(user, true, subjectContext);
    handler.invalidateStaleEmbedding(user);

    assertFalse(handler.getSupportedEntityTypes().contains(Entity.USER));
    verify(vectorIndexService, never()).deleteEntityChunks(anyString());
    verify(dispatcher, never()).submitInEntityOrder(any(), anyString(), any());
  }

  /**
   * Every hard delete is prepared, the descendants of a recursive delete included, which get no
   * delete event. The chunks of those with embeddings are deleted together, in entity order, after
   * the delete.
   */
  @Test
  void aHardDeleteDeletesTheChunksOfItsEmbeddedEntitiesTogether() {
    EntityInterface<?> orders = createMockEntity("table");
    EntityInterface<?> ledger = createMockEntity("table");
    EntityInterface<?> user = createMockEntity(Entity.USER);
    List<String> parents = List.of(orders.getId().toString(), ledger.getId().toString());
    when(vectorIndexService.deleteEntitiesChunks(parents)).thenReturn(Map.of());

    try (MockedStatic<EntityLifecycleEventDispatcher> dispatchers = runOrderedWorkInline()) {
      Runnable cleanup = handler.prepareHardDelete(List.of(orders, user, ledger));
      verify(vectorIndexService, never()).deleteEntitiesChunks(any());

      cleanup.run();
    }

    verify(vectorIndexService).deleteEntitiesChunks(parents);
    verify(vectorIndexService, never()).deleteEntityChunks(anyString());
  }

  /** Nothing else retries a live delete, so one the cluster refused goes to the retry queue. */
  @Test
  void aChunkDeleteTheClusterRefusedIsQueuedForTheRetryWorker() {
    EntityInterface<?> orders = createMockEntity("table");
    EntityInterface<?> ledger = createMockEntity("table");
    String ledgerId = ledger.getId().toString();
    IllegalStateException refused = new IllegalStateException("429 after retries");
    when(vectorIndexService.deleteEntitiesChunks(any())).thenReturn(Map.of(ledgerId, refused));

    try (MockedStatic<EntityLifecycleEventDispatcher> dispatchers = runOrderedWorkInline();
        MockedStatic<SearchIndexRetryQueue> queue = mockStatic(SearchIndexRetryQueue.class)) {
      queue
          .when(() -> SearchIndexRetryQueue.failureReason("deleteEntityChunks", refused))
          .thenReturn("deleteEntityChunks: 429 after retries");

      handler.prepareHardDelete(List.of(orders, ledger)).run();

      queue.verify(
          () ->
              SearchIndexRetryQueue.enqueue(
                  ledgerId, "svc.db.schema.t", "table", "deleteEntityChunks: 429 after retries"));
      queue.verify(
          () ->
              SearchIndexRetryQueue.enqueue(
                  eq(orders.getId().toString()), anyString(), anyString(), anyString()),
          never());
    }
  }

  /** A hard delete reaches the handler through its prepare hook; the delete event adds nothing. */
  @Test
  void theDeleteEventIsNotDispatchedToTheHandler() {
    assertFalse(handler.shouldProcess(EventType.ENTITY_DELETED, null));
    assertTrue(handler.shouldProcess(EventType.ENTITY_SOFT_DELETED, null));
    assertTrue(handler.shouldProcess(EventType.ENTITY_UPDATED, null));
  }

  @SuppressWarnings("unchecked")
  private static MockedStatic<EntityLifecycleEventDispatcher> runOrderedWorkInline() {
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);
    doAnswer(
            call -> {
              call.<Consumer<List<EntityReference>>>getArgument(2).accept(call.getArgument(0));
              return null;
            })
        .when(dispatcher)
        .submitInEntityOrder(any(), anyString(), any());
    MockedStatic<EntityLifecycleEventDispatcher> dispatchers =
        mockStatic(EntityLifecycleEventDispatcher.class);
    dispatchers.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
    return dispatchers;
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

  /**
   * The soft delete removed the entity's chunks, so a restore embeds it again. A restored root gets
   * the restore event; a restored descendant gets an update with its deleted flag cleared.
   */
  @Test
  void aRestoreEmbedsTheEntityAgain() {
    EntityInterface<?> restoredRoot = createMockEntity("table");
    EntityInterface<?> restoredDescendant = createMockEntity("table");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      SearchRepository searchRepository = mock(SearchRepository.class);
      IndexMapping indexMapping = mock(IndexMapping.class);
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      entityMock.when(() -> Entity.isVectorEmbeddable(any())).thenReturn(true);
      when(searchRepository.getIndexMapping("table")).thenReturn(indexMapping);
      when(searchRepository.getClusterAlias()).thenReturn("");
      when(indexMapping.getIndexName("")).thenReturn("table_search_index");

      handler.onEntitySoftDeletedOrRestored(restoredRoot, false, subjectContext);
      handler.onEntityUpdated(restoredDescendant, null, subjectContext);

      verify(vectorIndexService).updateEntityEmbeddings(restoredRoot, "table_search_index");
      verify(vectorIndexService).updateEntityEmbeddings(restoredDescendant, "table_search_index");
      verify(vectorIndexService, never()).deleteEntityChunks(anyString());
    }
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
    ref.setFullyQualifiedName("svc.db.schema.t");
    when(entity.getEntityReference()).thenReturn(ref);
    when(entity.getId()).thenReturn(id);
    when(entity.getDeleted()).thenReturn(false);
    return entity;
  }
}
