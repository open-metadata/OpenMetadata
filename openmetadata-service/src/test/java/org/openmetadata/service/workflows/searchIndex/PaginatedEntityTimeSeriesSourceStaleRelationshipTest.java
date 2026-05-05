/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
package org.openmetadata.service.workflows.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.SearchRepository;

/**
 * Validates that {@link PaginatedEntityTimeSeriesSource} treats stale-relationship errors raised by
 * {@code EntityRepository.ensureSingleRelationship} (the message from {@code
 * CatalogExceptionMessage.entityRelationshipNotFound}) as warnings rather than fatal failures.
 *
 * <p>This is the production scenario from issue #27417: orphaned {@code testCaseResolutionStatus}
 * rows whose parentOf {@code entity_relationship} row is missing should not fail an entire reindex
 * batch.
 */
class PaginatedEntityTimeSeriesSourceStaleRelationshipTest {

  private static final String ENTITY_TYPE = Entity.TEST_CASE_RESOLUTION_STATUS;
  private static final int BATCH_SIZE = 5;

  private static final String STALE_RELATIONSHIP_MESSAGE =
      "Entity type testCaseResolutionStatus 7c5c3c4d-3a82-4d8c-9c4a-3e2c9b9b0d5b "
          + "does not have expected relationship parentOf to/from entity type testCase";

  private static final String REAL_DB_ERROR_MESSAGE =
      "JsonProcessingException: Unrecognized field 'foo' (class TestCaseResolutionStatus)";

  @Test
  void readClassifiesStaleRelationshipErrorsAsWarnings() throws Exception {
    EntityTimeSeriesRepository<TestCaseResolutionStatus> repository = mockRepository();
    ResultList<TestCaseResolutionStatus> mockedResult =
        resultWith(
            List.of(makeRecord("ok-1"), makeRecord("ok-2")),
            List.of(error("orphan-1", STALE_RELATIONSHIP_MESSAGE)));

    when(repository.listWithOffset(any(), any(ListFilter.class), anyInt(), anyBoolean()))
        .thenReturn(mockedResult);

    try (MockedStatic<Entity> entityMock =
        mockStatic(Entity.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      stubEntityRepositoryLookups(entityMock, repository);

      PaginatedEntityTimeSeriesSource source =
          new PaginatedEntityTimeSeriesSource(ENTITY_TYPE, BATCH_SIZE, List.of(), 3);

      ResultList<? extends EntityTimeSeriesInterface> result = source.readNext(null);

      assertNotNull(result);
      assertEquals(2, result.getData().size());
      assertTrue(
          result.getErrors().isEmpty(),
          () -> "stale-relationship errors should be filtered out, got " + result.getErrors());
      assertEquals(1, result.getWarningsCount());
      assertEquals(2, source.getStats().getSuccessRecords());
      assertEquals(0, source.getStats().getFailedRecords());
      assertEquals(1, source.getStats().getWarningRecords());
    }
  }

  @Test
  void readKeepsRealErrorsAsFailuresEvenWhenWarningsArePresent() throws Exception {
    EntityTimeSeriesRepository<TestCaseResolutionStatus> repository = mockRepository();
    ResultList<TestCaseResolutionStatus> mockedResult =
        resultWith(
            List.of(makeRecord("ok-1")),
            List.of(
                error("orphan-1", STALE_RELATIONSHIP_MESSAGE),
                error("broken-1", REAL_DB_ERROR_MESSAGE),
                error("orphan-2", STALE_RELATIONSHIP_MESSAGE)));

    when(repository.listWithOffset(any(), any(ListFilter.class), anyInt(), anyBoolean()))
        .thenReturn(mockedResult);

    try (MockedStatic<Entity> entityMock =
        mockStatic(Entity.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      stubEntityRepositoryLookups(entityMock, repository);

      PaginatedEntityTimeSeriesSource source =
          new PaginatedEntityTimeSeriesSource(ENTITY_TYPE, BATCH_SIZE, List.of(), 4);

      ResultList<? extends EntityTimeSeriesInterface> result = source.readNext(null);

      assertNotNull(result);
      assertEquals(1, result.getData().size());
      assertEquals(1, result.getErrors().size());
      assertEquals("broken-1", result.getErrors().get(0).getEntity());
      assertEquals(2, result.getWarningsCount());
      assertEquals(1, source.getStats().getSuccessRecords());
      assertEquals(1, source.getStats().getFailedRecords());
      assertEquals(2, source.getStats().getWarningRecords());
    }
  }

  @Test
  void readWithCursorFiltersStaleRelationshipErrors() throws Exception {
    EntityTimeSeriesRepository<TestCaseResolutionStatus> repository = mockRepository();
    ResultList<TestCaseResolutionStatus> mockedResult =
        resultWith(
            List.of(makeRecord("ok-1")), List.of(error("orphan-1", STALE_RELATIONSHIP_MESSAGE)));

    when(repository.listWithOffset(any(), any(ListFilter.class), anyInt(), anyBoolean()))
        .thenReturn(mockedResult);

    try (MockedStatic<Entity> entityMock =
        mockStatic(Entity.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      stubEntityRepositoryLookups(entityMock, repository);

      PaginatedEntityTimeSeriesSource source =
          new PaginatedEntityTimeSeriesSource(ENTITY_TYPE, BATCH_SIZE, List.of(), 2);

      ResultList<? extends EntityTimeSeriesInterface> result = source.readWithCursor("0");

      assertNotNull(result);
      assertEquals(1, result.getData().size());
      assertTrue(result.getErrors().isEmpty());
      assertEquals(1, result.getWarningsCount());
      assertEquals(1, source.getStats().getSuccessRecords());
      assertEquals(0, source.getStats().getFailedRecords());
      assertEquals(1, source.getStats().getWarningRecords());
    }
  }

  @Test
  void readPropagatesNonReaderExceptionsAsSearchIndexException() {
    EntityTimeSeriesRepository<TestCaseResolutionStatus> repository = mockRepository();
    when(repository.listWithOffset(any(), any(ListFilter.class), anyInt(), anyBoolean()))
        .thenThrow(new RuntimeException("connection refused"));

    try (MockedStatic<Entity> entityMock =
        mockStatic(Entity.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      stubEntityRepositoryLookups(entityMock, repository);

      PaginatedEntityTimeSeriesSource source =
          new PaginatedEntityTimeSeriesSource(ENTITY_TYPE, BATCH_SIZE, List.of(), 1);

      org.junit.jupiter.api.Assertions.assertThrows(
          SearchIndexException.class, () -> source.readNext(null));
    }
  }

  @SuppressWarnings("unchecked")
  private EntityTimeSeriesRepository<TestCaseResolutionStatus> mockRepository() {
    return (EntityTimeSeriesRepository<TestCaseResolutionStatus>)
        mock(EntityTimeSeriesRepository.class);
  }

  private void stubEntityRepositoryLookups(
      MockedStatic<Entity> entityMock,
      EntityTimeSeriesRepository<TestCaseResolutionStatus> repository) {
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getDataInsightReports()).thenReturn(List.of());
    entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
    entityMock
        .when(() -> Entity.getEntityTimeSeriesRepository(ENTITY_TYPE))
        .thenReturn((EntityTimeSeriesRepository) repository);
  }

  private static TestCaseResolutionStatus makeRecord(String name) {
    return new TestCaseResolutionStatus()
        .withId(UUID.randomUUID())
        .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.New)
        .withStateId(UUID.randomUUID())
        .withTimestamp(System.currentTimeMillis());
  }

  private static EntityError error(String entity, String message) {
    return new EntityError().withEntity(entity).withMessage(message);
  }

  private static ResultList<TestCaseResolutionStatus> resultWith(
      List<TestCaseResolutionStatus> data, List<EntityError> errors) {
    return new ResultList<>(
        new ArrayList<>(data), new ArrayList<>(errors), null, null, data.size());
  }
}
