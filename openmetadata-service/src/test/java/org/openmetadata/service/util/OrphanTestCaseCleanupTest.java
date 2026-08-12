/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 */

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;

class OrphanTestCaseCleanupTest {

  private static final UUID ORPHAN_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
  private static final UUID LIVE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
  private static final String LIVE_TABLE_FQN = "svc.db.schema.live_table";
  private static final String DELETED_TABLE_FQN = "svc.db.schema.deleted_table";

  @Test
  void performCleanup_deletesOnlyOrphans() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.TestCaseDAO testCaseDAO = mock(CollectionDAO.TestCaseDAO.class);
    when(dao.testCaseDAO()).thenReturn(testCaseDAO);
    when(testCaseDAO.getTableName()).thenReturn("test_case");

    String orphanJson = JsonUtils.pojoToJson(testCase(ORPHAN_ID, DELETED_TABLE_FQN));
    String liveJson = JsonUtils.pojoToJson(testCase(LIVE_ID, LIVE_TABLE_FQN));
    when(testCaseDAO.listAfterWithOffset(eq("test_case"), anyInt(), eq(0)))
        .thenReturn(List.of(orphanJson, liveJson));
    // Batch returned 2 rows and 1 was deleted, so the next offset is 2 - 1 = 1.
    when(testCaseDAO.listAfterWithOffset(eq("test_case"), anyInt(), eq(1))).thenReturn(List.of());

    EntityRepository<?> tableRepo = mock(EntityRepository.class);
    when(tableRepo.getByName(any(), eq(DELETED_TABLE_FQN), any(), any(Include.class), anyBoolean()))
        .thenThrow(
            new EntityNotFoundException(
                "Table instance for %s not found".formatted(DELETED_TABLE_FQN)));
    when(tableRepo.getByName(any(), eq(LIVE_TABLE_FQN), any(), any(Include.class), anyBoolean()))
        .thenReturn(null);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(tableRepo);

      OrphanTestCaseCleanup cleanup = new OrphanTestCaseCleanup(dao, false);
      OrphanTestCaseCleanup.OrphanTestCaseResult result = cleanup.performCleanup(100);

      assertEquals(2, result.getTotalScanned());
      assertEquals(1, result.getOrphansFound());
      assertEquals(1, result.getOrphansDeleted());
      assertEquals(0, result.getFailures());

      entityMock.verify(
          () -> Entity.deleteEntity("admin", Entity.TEST_CASE, ORPHAN_ID, true, true), times(1));
      entityMock.verify(
          () ->
              Entity.deleteEntity(
                  any(), eq(Entity.TEST_CASE), eq(LIVE_ID), anyBoolean(), anyBoolean()),
          never());
    }
  }

  @Test
  void performCleanup_dryRun_doesNotDelete() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.TestCaseDAO testCaseDAO = mock(CollectionDAO.TestCaseDAO.class);
    when(dao.testCaseDAO()).thenReturn(testCaseDAO);
    when(testCaseDAO.getTableName()).thenReturn("test_case");

    String orphanJson = JsonUtils.pojoToJson(testCase(ORPHAN_ID, DELETED_TABLE_FQN));
    when(testCaseDAO.listAfterWithOffset(eq("test_case"), anyInt(), eq(0)))
        .thenReturn(List.of(orphanJson));
    when(testCaseDAO.listAfterWithOffset(eq("test_case"), anyInt(), eq(1))).thenReturn(List.of());

    EntityRepository<?> tableRepo = mock(EntityRepository.class);
    when(tableRepo.getByName(any(), eq(DELETED_TABLE_FQN), any(), any(Include.class), anyBoolean()))
        .thenThrow(new EntityNotFoundException("missing"));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(tableRepo);

      OrphanTestCaseCleanup cleanup = new OrphanTestCaseCleanup(dao, true);
      OrphanTestCaseCleanup.OrphanTestCaseResult result = cleanup.performCleanup(100);

      assertEquals(1, result.getTotalScanned());
      assertEquals(1, result.getOrphansFound());
      assertEquals(0, result.getOrphansDeleted());

      entityMock.verify(
          () -> Entity.deleteEntity(any(), any(), any(UUID.class), anyBoolean(), anyBoolean()),
          never());
    }
  }

  @Test
  void performCleanup_unparseableEntityLink_isTreatedAsOrphan() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.TestCaseDAO testCaseDAO = mock(CollectionDAO.TestCaseDAO.class);
    when(dao.testCaseDAO()).thenReturn(testCaseDAO);
    when(testCaseDAO.getTableName()).thenReturn("test_case");

    TestCase brokenCase =
        new TestCase()
            .withId(ORPHAN_ID)
            .withName("broken")
            .withFullyQualifiedName("svc.db.schema.t.broken")
            .withEntityLink("not-an-entity-link");
    when(testCaseDAO.listAfterWithOffset(eq("test_case"), anyInt(), eq(0)))
        .thenReturn(List.of(JsonUtils.pojoToJson(brokenCase)));
    when(testCaseDAO.listAfterWithOffset(eq("test_case"), anyInt(), eq(1))).thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OrphanTestCaseCleanup cleanup = new OrphanTestCaseCleanup(dao, false);
      OrphanTestCaseCleanup.OrphanTestCaseResult result = cleanup.performCleanup(100);

      assertEquals(1, result.getOrphansFound());
      entityMock.verify(
          () -> Entity.deleteEntity("admin", Entity.TEST_CASE, ORPHAN_ID, true, true),
          atLeastOnce());
    }
  }

  @Test
  void performCleanup_skipsSoftDeletedTestCases() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.TestCaseDAO testCaseDAO = mock(CollectionDAO.TestCaseDAO.class);
    when(dao.testCaseDAO()).thenReturn(testCaseDAO);
    when(testCaseDAO.getTableName()).thenReturn("test_case");

    TestCase softDeleted = testCase(ORPHAN_ID, DELETED_TABLE_FQN).withDeleted(true);
    when(testCaseDAO.listAfterWithOffset(eq("test_case"), anyInt(), eq(0)))
        .thenReturn(List.of(JsonUtils.pojoToJson(softDeleted)));
    when(testCaseDAO.listAfterWithOffset(eq("test_case"), anyInt(), eq(1))).thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OrphanTestCaseCleanup cleanup = new OrphanTestCaseCleanup(dao, false);
      OrphanTestCaseCleanup.OrphanTestCaseResult result = cleanup.performCleanup(100);

      assertEquals(1, result.getTotalScanned());
      assertEquals(0, result.getOrphansFound());
      entityMock.verify(
          () -> Entity.deleteEntity(any(), any(), any(UUID.class), anyBoolean(), anyBoolean()),
          never());
    }
  }

  @Test
  void performCleanup_advancesOffsetBySurvivorsToAvoidSkippingShiftedRows() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.TestCaseDAO testCaseDAO = mock(CollectionDAO.TestCaseDAO.class);
    when(dao.testCaseDAO()).thenReturn(testCaseDAO);
    when(testCaseDAO.getTableName()).thenReturn("test_case");

    // First page is full (batchSize = 2) — one orphan, one live row. The orphan will be deleted,
    // shifting subsequent rows back by 1.
    String orphanJson = JsonUtils.pojoToJson(testCase(ORPHAN_ID, DELETED_TABLE_FQN));
    String liveJson = JsonUtils.pojoToJson(testCase(LIVE_ID, LIVE_TABLE_FQN));
    when(testCaseDAO.listAfterWithOffset(eq("test_case"), eq(2), eq(0)))
        .thenReturn(List.of(orphanJson, liveJson));
    // After 1 delete, the next read must start at offset = 2 - 1 = 1, not 2.
    when(testCaseDAO.listAfterWithOffset(eq("test_case"), eq(2), eq(1))).thenReturn(List.of());

    EntityRepository<?> tableRepo = mock(EntityRepository.class);
    when(tableRepo.getByName(any(), eq(DELETED_TABLE_FQN), any(), any(Include.class), anyBoolean()))
        .thenThrow(new EntityNotFoundException("missing"));
    when(tableRepo.getByName(any(), eq(LIVE_TABLE_FQN), any(), any(Include.class), anyBoolean()))
        .thenReturn(null);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(tableRepo);

      OrphanTestCaseCleanup cleanup = new OrphanTestCaseCleanup(dao, false);
      cleanup.performCleanup(2);

      // Hard assertion: the second page read used offset=1, proving we adjusted for the deleted
      // row instead of skipping ahead by the full batchSize.
      Mockito.verify(testCaseDAO).listAfterWithOffset(eq("test_case"), eq(2), eq(1));
      Mockito.verify(testCaseDAO, never()).listAfterWithOffset(eq("test_case"), eq(2), eq(2));
    }
  }

  private TestCase testCase(UUID id, String tableFqn) {
    return new TestCase()
        .withId(id)
        .withName("tc-" + id)
        .withFullyQualifiedName(tableFqn + ".tc-" + id)
        .withEntityLink("<#E::table::%s>".formatted(tableFqn));
  }
}
