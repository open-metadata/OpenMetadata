/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
package org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.sources;

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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.mockito.MockedStatic;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.WebAnalyticEventRepository;

/**
 * {@code WebAnalyticsWorkflow} unboxes {@link IndexingError#getFailedCount()} into {@code
 * updateStats(int, int)}, so every read path must report the batch it lost (issue #29245).
 */
class PaginatedWebAnalyticEventDataSourceReadFailureTest {

  private static final int BATCH_SIZE = 7;
  private static final long START_TS = 1_000L;
  private static final long END_TS = 2_000L;
  private static final RuntimeException DB_DOWN = new RuntimeException("connection refused");

  private WebAnalyticEventRepository repository;

  @BeforeEach
  void setUp() {
    repository = mock(WebAnalyticEventRepository.class);
    when(repository.listWebAnalyticEventDataCount(any(), any(), any(), anyBoolean()))
        .thenReturn(100);
  }

  @Test
  void keysetReadFailureReportsTheLostBatch() {
    when(repository.listWebAnalyticEventDataWithKeyset(
            any(), anyInt(), anyLong(), anyLong(), anyLong(), any(), anyInt(), anyBoolean()))
        .thenThrow(DB_DOWN);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entity
          .when(() -> Entity.getEntityRepository(Entity.WEB_ANALYTIC_EVENT))
          .thenReturn(repository);
      PaginatedWebAnalyticEventDataSource source =
          new PaginatedWebAnalyticEventDataSource(BATCH_SIZE, START_TS, END_TS);

      IndexingError error = readFailure(() -> source.readNextKeyset(null));

      assertLostBatch(error);
      source.updateStats(error.getSuccessCount(), error.getFailedCount());
      assertEquals(BATCH_SIZE, source.getStats().getFailedRecords());
    }
  }

  @Test
  void cursorReadFailureReportsTheLostBatch() {
    when(repository.listWebAnalyticEventDataWithOffset(
            any(), any(), anyInt(), any(), any(), anyBoolean(), anyBoolean()))
        .thenThrow(DB_DOWN);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entity
          .when(() -> Entity.getEntityRepository(Entity.WEB_ANALYTIC_EVENT))
          .thenReturn(repository);
      PaginatedWebAnalyticEventDataSource source =
          new PaginatedWebAnalyticEventDataSource(BATCH_SIZE, START_TS, END_TS);

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
}
