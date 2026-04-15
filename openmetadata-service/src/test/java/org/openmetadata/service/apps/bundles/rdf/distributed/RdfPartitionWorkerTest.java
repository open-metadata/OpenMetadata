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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.EntityInterface;
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

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(repository);
      when(repository.getCursorAtOffset(any(ListFilter.class), eq(4))).thenReturn("cursor-4");

      assertNull(
          invokePrivate(
              worker,
              "initializeKeysetCursor",
              new Class<?>[] {String.class, long.class},
              "table",
              0L));
      assertEquals(
          "cursor-4",
          invokePrivate(
              worker,
              "initializeKeysetCursor",
              new Class<?>[] {String.class, long.class},
              "table",
              5L));
    }
  }

  @Test
  void initializeKeysetCursorRejectsOffsetsBeyondSupportedRange() {
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                invokePrivate(
                    worker,
                    "initializeKeysetCursor",
                    new Class<?>[] {String.class, long.class},
                    "table",
                    (long) Integer.MAX_VALUE + 2L));

    assertTrue(exception.getMessage().contains("does not support offsets above"));
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
