/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
package org.openmetadata.service.workflows.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.mockito.MockedStatic;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.search.SearchRepository;

/**
 * A failed page read must report how many records it lost. The Data Insights workflows unbox
 * {@link IndexingError#getFailedCount()} into {@code updateStats(int, int)}, so a null count turns
 * a recoverable reader failure into an NPE that aborts the whole run (issue #29245).
 */
class PaginatedSourceReadFailureTest {

  private static final int BATCH_SIZE = 7;
  private static final RuntimeException DB_DOWN = new RuntimeException("connection refused");

  @Test
  void entitiesKeysetReadFailureReportsTheLostBatch() {
    EntityRepository<?> repository = mock(EntityRepository.class);
    when(repository.listAfterKeyset(any(), anyInt(), any(), any(), anyInt(), anyBoolean(), any()))
        .thenThrow(DB_DOWN);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      PaginatedEntitiesSource source =
          new PaginatedEntitiesSource(Entity.TABLE, BATCH_SIZE, List.of(), 100);

      IndexingError error = readFailure(() -> source.readNextKeyset(null));

      assertLostBatch(error);
      source.updateStats(error.getSuccessCount(), error.getFailedCount());
      assertEquals(BATCH_SIZE, source.getStats().getFailedRecords());
    }
  }

  @Test
  void entitiesCursorReadFailureReportsTheLostBatch() {
    EntityRepository<?> repository = mock(EntityRepository.class);
    when(repository.getDao()).thenReturn(mock(EntityDAO.class));
    when(repository.listWithOffset(any(), any(), any(), any(), any(), anyBoolean(), any(), any()))
        .thenThrow(DB_DOWN);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      PaginatedEntitiesSource source =
          new PaginatedEntitiesSource(Entity.TABLE, BATCH_SIZE, List.of(), 100);

      IndexingError error = readFailure(() -> source.readWithCursor("0"));

      assertLostBatch(error);
      source.updateStats(error.getSuccessCount(), error.getFailedCount());
      assertEquals(BATCH_SIZE, source.getStats().getFailedRecords());
    }
  }

  @Test
  void timeSeriesKeysetReadFailureReportsTheLostBatch() {
    EntityTimeSeriesRepository<?> repository = mock(EntityTimeSeriesRepository.class);
    when(repository.listAfterKeyset(
            any(), anyInt(), any(), any(), anyLong(), any(), anyInt(), anyBoolean()))
        .thenThrow(DB_DOWN);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      stubTimeSeriesRepository(entity, repository);
      PaginatedEntityTimeSeriesSource source =
          new PaginatedEntityTimeSeriesSource(
              Entity.TEST_CASE_RESOLUTION_STATUS, BATCH_SIZE, List.of(), 100);

      IndexingError error = readFailure(() -> source.readNextKeyset(null));

      assertLostBatch(error);
      source.updateStats(error.getSuccessCount(), error.getFailedCount());
      assertEquals(BATCH_SIZE, source.getStats().getFailedRecords());
    }
  }

  @Test
  void timeSeriesCursorReadFailureReportsTheLostBatch() {
    EntityTimeSeriesRepository<?> repository = mock(EntityTimeSeriesRepository.class);
    when(repository.listWithOffset(any(), any(), anyInt(), anyBoolean())).thenThrow(DB_DOWN);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      stubTimeSeriesRepository(entity, repository);
      PaginatedEntityTimeSeriesSource source =
          new PaginatedEntityTimeSeriesSource(
              Entity.TEST_CASE_RESOLUTION_STATUS, BATCH_SIZE, List.of(), 100);

      IndexingError error = readFailure(() -> source.readWithCursor("0"));

      assertLostBatch(error);
      source.updateStats(error.getSuccessCount(), error.getFailedCount());
      assertEquals(BATCH_SIZE, source.getStats().getFailedRecords());
    }
  }

  private static IndexingError readFailure(Executable read) {
    return assertThrows(SearchIndexException.class, read).getIndexingError();
  }

  private static void assertLostBatch(IndexingError error) {
    assertTrue(error.getStackTrace().contains(DB_DOWN.toString()), error.getStackTrace());
    assertEquals(IndexingError.ErrorSource.READER, error.getErrorSource());
    assertEquals(BATCH_SIZE, error.getSubmittedCount());
    assertEquals(0, error.getSuccessCount());
    assertEquals(BATCH_SIZE, error.getFailedCount());
  }

  @SuppressWarnings({"rawtypes", "unchecked"})
  private static void stubTimeSeriesRepository(
      MockedStatic<Entity> entity, EntityTimeSeriesRepository<?> repository) {
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getDataInsightReports()).thenReturn(List.of());
    entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
    entity
        .when(() -> Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESOLUTION_STATUS))
        .thenReturn((EntityTimeSeriesRepository) repository);
  }
}
