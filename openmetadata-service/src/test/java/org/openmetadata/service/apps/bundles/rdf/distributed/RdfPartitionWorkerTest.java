package org.openmetadata.service.apps.bundles.rdf.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.rdf.RdfBatchProcessor;
import org.openmetadata.service.apps.bundles.rdf.sink.RdfBulkSink;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;

@ExtendWith(MockitoExtension.class)
class RdfPartitionWorkerTest {

  @Mock private DistributedRdfIndexCoordinator coordinator;
  @Mock private RdfBatchProcessor batchProcessor;
  @Mock private RdfBulkSink sink;

  private RdfPartitionWorker worker;

  @org.junit.jupiter.api.BeforeAll
  static void initializeJena() {
    // The worker resolves indexing fields through RdfPropertyMapper, whose static
    // initializer pulls in Jena's vocabularies. Letting that happen lazily inside a
    // mockStatic scope breaks Jena's own subsystem initialization, so warm it up first.
    org.apache.jena.sys.JenaSystem.init();
  }

  @BeforeEach
  void setUp() {
    worker = new RdfPartitionWorker(coordinator, sink, batchProcessor, 100);
  }

  @Test
  void initializeKeysetCursorHandlesRepositoryBackedEntities() throws Exception {
    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);
    RdfIndexPartition partition =
        RdfIndexPartition.builder().jobId(java.util.UUID.randomUUID()).entityType("table").build();

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(repository);
      when(repository.getCursorAtOffset(any(ListFilter.class), eq(4))).thenReturn("cursor-4");

      assertNull(
          invokePrivate(
              worker,
              "initializeKeysetCursor",
              new Class<?>[] {RdfIndexPartition.class, String.class, long.class},
              partition,
              "table",
              0L));
      assertEquals(
          "cursor-4",
          invokePrivate(
              worker,
              "initializeKeysetCursor",
              new Class<?>[] {RdfIndexPartition.class, String.class, long.class},
              partition,
              "table",
              5L));
    }
  }

  @Test
  void initializeKeysetCursorRejectsOffsetsBeyondSupportedRange() {
    RdfIndexPartition partition =
        RdfIndexPartition.builder().jobId(java.util.UUID.randomUUID()).entityType("table").build();
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                invokePrivate(
                    worker,
                    "initializeKeysetCursor",
                    new Class<?>[] {RdfIndexPartition.class, String.class, long.class},
                    partition,
                    "table",
                    (long) Integer.MAX_VALUE + 2L));

    assertTrue(exception.getMessage().contains("does not support offsets above"));
  }

  @Test
  void logReaderFailuresPrefersDroppedFailureOverRecoverable() throws Exception {
    EntityInterface table = mock(EntityInterface.class);
    when(table.getId()).thenReturn(UUID.randomUUID());
    when(table.getFullyQualifiedName()).thenReturn("svc.db.schema.tbl");
    // Recoverable (has entity) listed FIRST, unrecoverable drop listed second: the dropped
    // message must win so lastError describes a genuine drop, not a re-indexed warning.
    EntityError recoverable =
        new EntityError().withMessage("Entity type chart not found").withEntity(table);
    EntityError dropped = new EntityError().withMessage("Failed to deserialize entity: boom");

    String representative =
        (String)
            invokePrivate(
                worker,
                "logReaderFailures",
                new Class<?>[] {String.class, List.class},
                "table",
                List.of(recoverable, dropped));

    assertEquals("Failed to deserialize entity: boom", representative);
  }

  @Test
  void logReaderFailuresFallsBackToFirstMessageWhenNoDropAndLastMessageNull() throws Exception {
    EntityInterface a = mock(EntityInterface.class);
    EntityInterface b = mock(EntityInterface.class);
    // Both recoverable (no drops); the LAST one has a null message. The representative must be the
    // first non-null message, not null — otherwise lastError is blanked out for the whole batch.
    EntityError withMessage =
        new EntityError().withMessage("field resolution failed").withEntity(a);
    EntityError nullMessage = new EntityError().withEntity(b);

    String representative =
        (String)
            invokePrivate(
                worker,
                "logReaderFailures",
                new Class<?>[] {String.class, List.class},
                "table",
                List.of(withMessage, nullMessage));

    assertEquals("field resolution failed", representative);
  }

  @Test
  void logReaderFailuresReturnsNullForEmptyBatch() throws Exception {
    assertNull(
        invokePrivate(
            worker,
            "logReaderFailures",
            new Class<?>[] {String.class, List.class},
            "table",
            List.of()));
  }

  @Test
  void describeFailedEntityAttributesIdAndFqn() throws Exception {
    EntityInterface table = mock(EntityInterface.class);
    UUID id = UUID.randomUUID();
    when(table.getId()).thenReturn(id);
    when(table.getFullyQualifiedName()).thenReturn("svc.db.schema.tbl");

    assertEquals(
        id + " (svc.db.schema.tbl)",
        invokeStaticPrivate(
            "describeFailedEntity",
            new Class<?>[] {EntityError.class},
            new EntityError().withMessage("boom").withEntity(table)));
  }

  @Test
  void describeFailedEntityHandlesMissingEntity() throws Exception {
    assertEquals(
        "<unknown>",
        invokeStaticPrivate(
            "describeFailedEntity",
            new Class<?>[] {EntityError.class},
            new EntityError().withMessage("Failed to deserialize entity: boom")));
  }

  @Test
  @SuppressWarnings("unchecked")
  void recoverableEntitiesReturnsOnlyDeserializedEntities() throws Exception {
    EntityInterface dataModel = mock(EntityInterface.class);
    EntityError fieldFailure =
        new EntityError().withMessage("field resolution failed").withEntity(dataModel);
    EntityError deserFailure = new EntityError().withMessage("Failed to deserialize entity: boom");

    List<EntityInterface> recoverable =
        (List<EntityInterface>)
            invokeStaticPrivate(
                "recoverableEntities",
                new Class<?>[] {List.class},
                List.of(fieldFailure, deserFailure));

    assertEquals(1, recoverable.size());
    assertEquals(dataModel, recoverable.get(0));
  }

  private Object invokeStaticPrivate(String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = RdfPartitionWorker.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(null, args);
  }

  private Object invokePrivate(
      RdfPartitionWorker target, String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = RdfPartitionWorker.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    try {
      return method.invoke(target, args);
    } catch (InvocationTargetException e) {
      if (e.getCause() instanceof Exception exception) {
        throw exception;
      }
      if (e.getCause() instanceof Error error) {
        throw error;
      }
      throw e;
    }
  }

  /** Registry stub: the worker resolves its field list through Entity.getEntityRepository. */
  private MockedStatic<Entity> stubEntityRegistry() {
    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);
    org.mockito.Mockito.lenient()
        .when(repository.getAllowedFieldsCopy())
        .thenReturn(new java.util.HashSet<>(List.of("name", "description")));
    MockedStatic<Entity> entityMock = mockStatic(Entity.class);
    entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(repository);
    return entityMock;
  }

  /** The cursor the worker actually persisted (flushTimingProgress writes a copy). */
  private long persistedCursor() {
    org.mockito.ArgumentCaptor<RdfIndexPartition> captor =
        org.mockito.ArgumentCaptor.forClass(RdfIndexPartition.class);
    org.mockito.Mockito.verify(coordinator, org.mockito.Mockito.atLeastOnce())
        .updatePartitionProgress(captor.capture());
    return captor.getValue().getCursor();
  }

  private static ResultList<EntityInterface> page(List<EntityInterface> data, String after) {
    return new ResultList<>(data, null, after, data.size());
  }

  private static List<EntityInterface> entities(int count) {
    List<EntityInterface> data = new java.util.ArrayList<>();
    for (int i = 0; i < count; i++) {
      data.add(mock(EntityInterface.class));
    }
    return data;
  }

  private static RdfIndexPartition partition(long rangeEnd) {
    return RdfIndexPartition.builder()
        .id(UUID.randomUUID())
        .jobId(UUID.randomUUID())
        .entityType("table")
        .rangeStart(0)
        .rangeEnd(rangeEnd)
        .cursor(0)
        .build();
  }

  private static java.util.concurrent.CompletableFuture<RdfBatchProcessor.BatchProcessingResult>
      ack(int success, int failed) {
    return java.util.concurrent.CompletableFuture.completedFuture(
        new RdfBatchProcessor.BatchProcessingResult(success, failed));
  }

  @Test
  void processPartitionCountsAckedBatchesAndPersistsTheAckedCursor() throws Exception {
    RdfIndexPartition partition = partition(2);
    when(sink.submit(eq("table"), any())).thenReturn(ack(2, 0));

    try (MockedStatic<Entity> registry = stubEntityRegistry();
        var sources =
            org.mockito.Mockito.mockConstruction(
                org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource.class,
                (source, ctx) ->
                    org.mockito.Mockito.doReturn(page(entities(2), null))
                        .when(source)
                        .readNextKeyset(any()))) {
      RdfPartitionWorker.PartitionResult result = worker.processPartition(partition);

      assertEquals(2, result.processedCount());
      assertEquals(2, result.successCount());
      assertEquals(0, result.failedCount());
      assertTrue(!result.stopped());
      assertEquals(1, sources.constructed().size());
    }
    // The persisted cursor is the acked offset, so a resume never skips unwritten rows.
    assertEquals(2L, persistedCursor());
  }

  @Test
  void aBatchTheSinkSkippedWhileStoppingDoesNotAdvanceTheCursor() throws Exception {
    RdfIndexPartition partition = partition(2);
    // The sink reports a skipped batch as zero counts once the run starts stopping.
    // Reproduce that ordering: the batch is submitted, then the stop lands.
    when(sink.submit(eq("table"), any()))
        .thenAnswer(
            invocation -> {
              worker.stop();
              return ack(0, 0);
            });

    try (MockedStatic<Entity> registry = stubEntityRegistry();
        var ignored =
            org.mockito.Mockito.mockConstruction(
                org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource.class,
                (source, ctx) ->
                    org.mockito.Mockito.doReturn(page(entities(2), null))
                        .when(source)
                        .readNextKeyset(any()))) {
      RdfPartitionWorker.PartitionResult result = worker.processPartition(partition);

      assertTrue(result.stopped(), "a stop-skipped batch must end the partition as stopped");
      assertEquals(0, result.successCount());
    }
    // Cursor stays at the range start: those entities were never written, so a
    // resume has to re-read them rather than skip them.
    assertEquals(0L, persistedCursor());
  }

  @Test
  void aFailedAckIsCountedAsFailedRatherThanLost() throws Exception {
    RdfIndexPartition partition = partition(3);
    java.util.concurrent.CompletableFuture<RdfBatchProcessor.BatchProcessingResult> failed =
        new java.util.concurrent.CompletableFuture<>();
    failed.completeExceptionally(new IllegalStateException("sink write rejected"));
    when(sink.submit(eq("table"), any())).thenReturn(failed);

    try (MockedStatic<Entity> registry = stubEntityRegistry();
        var ignored =
            org.mockito.Mockito.mockConstruction(
                org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource.class,
                (source, ctx) ->
                    org.mockito.Mockito.doReturn(page(entities(3), null))
                        .when(source)
                        .readNextKeyset(any()))) {
      RdfPartitionWorker.PartitionResult result = worker.processPartition(partition);

      assertEquals(3, result.failedCount(), "every entity in a rejected batch is a failure");
      assertEquals(0, result.successCount());
      assertTrue(result.hasAnyFailure());
    }
  }

  @Test
  void anEmptyFirstReadCompletesWithoutSubmittingAnything() throws Exception {
    RdfIndexPartition partition = partition(10);

    try (MockedStatic<Entity> registry = stubEntityRegistry();
        var ignored =
            org.mockito.Mockito.mockConstruction(
                org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource.class,
                (source, ctx) ->
                    org.mockito.Mockito.doReturn(page(List.of(), null))
                        .when(source)
                        .readNextKeyset(any()))) {
      RdfPartitionWorker.PartitionResult result = worker.processPartition(partition);

      assertEquals(0, result.processedCount());
      assertTrue(!result.stopped());
    }
    org.mockito.Mockito.verify(sink, org.mockito.Mockito.never()).submit(any(), any());
  }
}
