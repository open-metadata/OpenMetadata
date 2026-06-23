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
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.rdf.RdfBatchProcessor;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;

@ExtendWith(MockitoExtension.class)
class RdfPartitionWorkerTest {

  @Mock private DistributedRdfIndexCoordinator coordinator;
  @Mock private RdfBatchProcessor batchProcessor;

  private RdfPartitionWorker worker;

  @BeforeEach
  void setUp() {
    worker = new RdfPartitionWorker(coordinator, batchProcessor, 100);
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
  void logReaderFailuresReturnsRepresentativeMessageForNonEmptyBatch() throws Exception {
    EntityInterface table = mock(EntityInterface.class);
    UUID id = UUID.randomUUID();
    when(table.getId()).thenReturn(id);
    when(table.getFullyQualifiedName()).thenReturn("svc.db.schema.tbl");
    EntityError withEntity =
        new EntityError().withMessage("Entity type chart not found").withEntity(table);
    EntityError withoutEntity = new EntityError().withMessage("Failed to deserialize entity: boom");

    String representative =
        (String)
            invokePrivate(
                worker,
                "logReaderFailures",
                new Class<?>[] {String.class, List.class},
                "table",
                List.of(withEntity, withoutEntity));

    assertEquals("Failed to deserialize entity: boom", representative);
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
}
