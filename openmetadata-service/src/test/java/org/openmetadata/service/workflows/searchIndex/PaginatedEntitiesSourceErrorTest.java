/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.workflows.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * Regression tests for the NPE caused by IndexingError.getFailedCount() returning null when
 * PaginatedEntitiesSource catch blocks omitted .withFailedCount(). DataAssetsWorkflow
 * auto-unboxes the returned Integer to primitive int, causing NPE on every batch read failure.
 */
class PaginatedEntitiesSourceErrorTest {

  private static final int BATCH_SIZE = 100;
  private static final String ENTITY_TYPE = "table";

  @Test
  void readWithCursor_batchReadThrows_indexingErrorHasFailedCount() {
    EntityRepository<?> mockRepo = mock(EntityRepository.class);
    when(mockRepo.listWithOffset(any(), any(), any(), anyInt(), anyString(), anyBoolean(), any(), any()))
        .thenThrow(new RuntimeException("connection reset"));

    try (MockedStatic<Entity> entityStatic = Mockito.mockStatic(Entity.class)) {
      entityStatic.when(() -> Entity.getEntityRepository(ENTITY_TYPE)).thenReturn(mockRepo);
      entityStatic.when(() -> Entity.getOnlySupportedFields(anyString(), any())).thenReturn(List.of());

      PaginatedEntitiesSource source =
          new PaginatedEntitiesSource(ENTITY_TYPE, BATCH_SIZE, List.of(), BATCH_SIZE);

      SearchIndexException ex =
          assertThrows(SearchIndexException.class, () -> source.readWithCursor("0"));

      IndexingError err = ex.getIndexingError();
      assertNotNull(err.getFailedCount(), "failedCount must not be null — unboxing null Integer to int causes NPE");
      assertEquals(BATCH_SIZE, err.getFailedCount());
    }
  }

  @Test
  void readNextKeyset_batchReadThrows_indexingErrorHasFailedCount() {
    EntityRepository<?> mockRepo = mock(EntityRepository.class);
    when(mockRepo.listAfterKeyset(any(), anyInt(), anyString(), anyInt(), anyBoolean(), any()))
        .thenThrow(new RuntimeException("connection reset"));

    try (MockedStatic<Entity> entityStatic = Mockito.mockStatic(Entity.class)) {
      entityStatic.when(() -> Entity.getEntityRepository(ENTITY_TYPE)).thenReturn(mockRepo);
      entityStatic.when(() -> Entity.getOnlySupportedFields(anyString(), any())).thenReturn(List.of());

      PaginatedEntitiesSource source =
          new PaginatedEntitiesSource(ENTITY_TYPE, BATCH_SIZE, List.of(), BATCH_SIZE);

      SearchIndexException ex =
          assertThrows(SearchIndexException.class, () -> source.readNextKeyset("cursor-abc"));

      IndexingError err = ex.getIndexingError();
      assertNotNull(err.getFailedCount(), "failedCount must not be null — unboxing null Integer to int causes NPE");
      assertEquals(BATCH_SIZE, err.getFailedCount());
    }
  }

  @Test
  void indexingError_withoutFailedCount_isNull() {
    IndexingError broken =
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.READER)
            .withSuccessCount(0)
            .withMessage("no failedCount set");

    // Documents the original bug: getFailedCount() returns null,
    // and Integer-to-int unboxing in DataAssetsWorkflow caused the NPE.
    assertNull(
        broken.getFailedCount(),
        "original bug: failedCount is null when withFailedCount() is omitted");
  }
}
