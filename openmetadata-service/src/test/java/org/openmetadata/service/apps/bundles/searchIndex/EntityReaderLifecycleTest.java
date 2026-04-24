package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.Phaser;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;

class EntityReaderLifecycleTest {

  private ExecutorService producerExecutor;
  private AtomicBoolean stopped;
  private EntityReader reader;

  @BeforeEach
  void setUp() {
    producerExecutor = mock(ExecutorService.class);
    stopped = new AtomicBoolean(false);
    reader = new EntityReader(producerExecutor, stopped, 1, 0);
    when(producerExecutor.submit(any(Runnable.class)))
        .thenAnswer(
            invocation -> {
              ((Runnable) invocation.getArgument(0)).run();
              return mock(Future.class);
            });
  }

  @Test
  void readEntityReturnsZeroWhenNoRecordsExist() {
    Phaser phaser = new Phaser(1);

    int submitted =
        reader.readEntity(
            "table", 0, 50, phaser, (entityType, batch, offset) -> fail("callback should not run"));

    assertEquals(0, submitted);
    assertEquals(1, phaser.getRegisteredParties());
    verifyNoInteractions(producerExecutor);
  }

  @Test
  void readEntityProcessesSingleRegularEntityReaderUntilCursorExhausted() throws Exception {
    Phaser phaser = new Phaser(1);
    List<Integer> offsets = new ArrayList<>();
    ResultList<?> batch = mockResult(List.of("table-1", "table-2"), null, 0);

    try (MockedConstruction<PaginatedEntitiesSource> construction =
        mockConstruction(
            PaginatedEntitiesSource.class,
            (mock, context) ->
                when(mock.readNextKeyset(isNull())).thenReturn((ResultList) batch))) {

      int submitted =
          reader.readEntity(
              "table", 2, 10, phaser, (entityType, result, offset) -> offsets.add(offset));

      assertEquals(1, submitted);
      assertEquals(List.of(0), offsets);
      assertEquals(1, phaser.getRegisteredParties());
      assertEquals(2, construction.constructed().size());
      verify(construction.constructed().get(1)).readNextKeyset(null);
    }
  }

  @Test
  void readEntityUsesTimeSeriesConstructorsAndBoundaryCursorsForParallelReaders() throws Exception {
    Phaser phaser = new Phaser(1);
    String entityType = ReportData.ReportDataType.ENTITY_REPORT_DATA.value();
    AtomicInteger callbackCount = new AtomicInteger();
    List<List<?>> constructorArguments = new ArrayList<>();

    try (MockedConstruction<PaginatedEntityTimeSeriesSource> construction =
        mockConstruction(
            PaginatedEntityTimeSeriesSource.class,
            (mock, context) -> {
              constructorArguments.add(List.copyOf(context.arguments()));
              when(mock.readWithCursor(any()))
                  .thenReturn((ResultList) mockResult(List.of("row"), null, 0));
            })) {

      int submitted =
          reader.readEntity(
              entityType,
              6,
              2,
              phaser,
              (type, result, offset) -> callbackCount.incrementAndGet(),
              100L,
              200L);

      assertEquals(3, submitted);
      assertEquals(3, callbackCount.get());
      assertEquals(3, construction.constructed().size());
      assertEquals(1, phaser.getRegisteredParties());

      assertEquals(List.of(entityType, 2, List.of(), 6, 100L, 200L), constructorArguments.get(0));
      assertEquals(List.of(entityType, 2, List.of(), 6, 100L, 200L), constructorArguments.get(1));
      assertEquals(List.of(entityType, 2, List.of(), 6, 100L, 200L), constructorArguments.get(2));

      verify(construction.constructed().get(0)).readWithCursor(null);
      verify(construction.constructed().get(1)).readWithCursor(RestUtil.encodeCursor("2"));
      verify(construction.constructed().get(2)).readWithCursor(RestUtil.encodeCursor("4"));
    }
  }

  @Test
  void readEntityDeregistersMissingReadersWhenBoundaryDiscoveryReturnsFewerCursors() {
    Phaser phaser = new Phaser(1);
    AtomicInteger constructionCount = new AtomicInteger();

    try (MockedConstruction<PaginatedEntitiesSource> construction =
        mockConstruction(
            PaginatedEntitiesSource.class,
            (mock, context) -> {
              if (constructionCount.getAndIncrement() == 0) {
                when(mock.findBoundaryCursors(anyInt(), anyInt())).thenReturn(List.of());
              } else {
                when(mock.readNextKeyset(any()))
                    .thenReturn((ResultList) mockResult(List.of(), null, 0));
              }
            })) {

      int submitted =
          reader.readEntity(
              "table",
              6,
              2,
              phaser,
              (entityType, batch, offset) -> fail("empty batch should not invoke callback"));

      assertEquals(3, submitted);
      assertEquals(2, construction.constructed().size());
      assertEquals(1, phaser.getRegisteredParties());
      verify(producerExecutor).submit(any(Runnable.class));
    }
  }

  @Test
  void readEntityRestoresPhaserStateWhenSubmissionFails() {
    Phaser phaser = new Phaser(1);
    when(producerExecutor.submit(any(Runnable.class)))
        .thenThrow(new IllegalStateException("submit failed"));

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () ->
                reader.readEntity(
                    "table",
                    2,
                    10,
                    phaser,
                    (entityType, batch, offset) -> fail("callback should not run")));

    assertEquals("submit failed", exception.getMessage());
    assertEquals(1, phaser.getRegisteredParties());
  }

  @Test
  void readEntitySwallowsInterruptedCallbacksAndDeregistersReader() throws Exception {
    Phaser phaser = new Phaser(1);

    try (MockedConstruction<PaginatedEntitiesSource> construction =
        mockConstruction(
            PaginatedEntitiesSource.class,
            (mock, context) ->
                when(mock.readNextKeyset(isNull()))
                    .thenReturn((ResultList) mockResult(List.of("table-1"), null, 0)))) {

      int submitted =
          reader.readEntity(
              "table",
              1,
              10,
              phaser,
              (entityType, batch, offset) -> {
                throw new InterruptedException("stop");
              });

      assertEquals(1, submitted);
      assertEquals(1, phaser.getRegisteredParties());
      assertTrue(Thread.currentThread().isInterrupted());
      Thread.interrupted();
      verify(construction.constructed().get(1)).readNextKeyset(null);
    }
  }

  @Test
  void helperMethodsRespectTimeSeriesAndMinimumReaderRules() {
    assertEquals(
        List.of(),
        EntityReader.getSearchIndexFields(ReportData.ReportDataType.ENTITY_REPORT_DATA.value()));
    assertEquals(List.of("*"), EntityReader.getSearchIndexFields("table"));
    assertEquals(1, EntityReader.calculateNumberOfReaders(10, 0));
    assertEquals(3, EntityReader.calculateNumberOfReaders(11, 5));
  }

  @Test
  void stopAndCloseSetStoppedFlag() {
    reader.stop();
    assertTrue(stopped.get());

    stopped.set(false);
    reader.close();
    assertTrue(stopped.get());
  }

  private ResultList<?> mockResult(List<?> data, String after, Integer warningsCount) {
    ResultList<Object> result = new ResultList<>();
    result.setData(new ArrayList<>(data));
    result.setErrors(null);
    result.setWarningsCount(warningsCount);
    result.setPaging(new Paging().withAfter(after));
    return result;
  }
}
