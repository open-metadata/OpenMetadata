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
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipObject;

class OrphanTestCaseRelationshipCleanupTest {

  private static final String TABLE = "test_case";
  private static final int CONTAINS = Relationship.CONTAINS.ordinal();
  private static final UUID TC_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
  private static final UUID SUITE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
  private static final UUID DEF_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

  @Test
  void missingTestDefinition_isDeleted() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO = stubTestCaseBatch(dao);

    // No testDefinition relationship for the test case; it does have a live executable suite.
    when(relationshipDAO.findFromBatch(
            anyList(), eq(CONTAINS), eq(Entity.TEST_DEFINITION), eq(Entity.TEST_CASE)))
        .thenReturn(List.of());
    when(relationshipDAO.findFromBatch(
            anyList(), eq(CONTAINS), eq(Entity.TEST_SUITE), eq(Entity.TEST_CASE)))
        .thenReturn(List.of(rel(SUITE_ID, TC_ID)));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntity(Entity.TEST_SUITE, SUITE_ID, "", Include.ALL))
          .thenReturn(basicSuite(true));

      OrphanTestCaseRelationshipCleanup.Result result =
          new OrphanTestCaseRelationshipCleanup(dao, false).performCleanup(100);

      assertEquals(1, result.getTotalScanned());
      assertEquals(1, result.getMissingTestDefinitionDeleted());
      assertEquals(0, result.getMissingExecutableSuiteDeleted());
      assertEquals(0, result.getFailures());
      entityMock.verify(
          () -> Entity.deleteEntity("admin", Entity.TEST_CASE, TC_ID, true, true), times(1));
    }
  }

  @Test
  void missingExecutableSuite_noSuiteRelationship_isDeleted() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO = stubTestCaseBatch(dao);

    when(relationshipDAO.findFromBatch(
            anyList(), eq(CONTAINS), eq(Entity.TEST_DEFINITION), eq(Entity.TEST_CASE)))
        .thenReturn(List.of(rel(DEF_ID, TC_ID)));
    when(relationshipDAO.findFromBatch(
            anyList(), eq(CONTAINS), eq(Entity.TEST_SUITE), eq(Entity.TEST_CASE)))
        .thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OrphanTestCaseRelationshipCleanup.Result result =
          new OrphanTestCaseRelationshipCleanup(dao, false).performCleanup(100);

      assertEquals(0, result.getMissingTestDefinitionDeleted());
      assertEquals(1, result.getMissingExecutableSuiteDeleted());
      entityMock.verify(
          () -> Entity.deleteEntity("admin", Entity.TEST_CASE, TC_ID, true, true), times(1));
    }
  }

  @Test
  void missingExecutableSuite_onlyNonBasicSuite_isDeleted() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO = stubTestCaseBatch(dao);

    when(relationshipDAO.findFromBatch(
            anyList(), eq(CONTAINS), eq(Entity.TEST_DEFINITION), eq(Entity.TEST_CASE)))
        .thenReturn(List.of(rel(DEF_ID, TC_ID)));
    // Linked to a suite, but it is a logical (non-basic) suite — no executable suite.
    when(relationshipDAO.findFromBatch(
            anyList(), eq(CONTAINS), eq(Entity.TEST_SUITE), eq(Entity.TEST_CASE)))
        .thenReturn(List.of(rel(SUITE_ID, TC_ID)));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntity(Entity.TEST_SUITE, SUITE_ID, "", Include.ALL))
          .thenReturn(basicSuite(false));

      OrphanTestCaseRelationshipCleanup.Result result =
          new OrphanTestCaseRelationshipCleanup(dao, false).performCleanup(100);

      assertEquals(1, result.getMissingExecutableSuiteDeleted());
      entityMock.verify(
          () -> Entity.deleteEntity("admin", Entity.TEST_CASE, TC_ID, true, true), times(1));
    }
  }

  @Test
  void healthyTestCase_isNotDeleted() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO = stubTestCaseBatch(dao);

    when(relationshipDAO.findFromBatch(
            anyList(), eq(CONTAINS), eq(Entity.TEST_DEFINITION), eq(Entity.TEST_CASE)))
        .thenReturn(List.of(rel(DEF_ID, TC_ID)));
    when(relationshipDAO.findFromBatch(
            anyList(), eq(CONTAINS), eq(Entity.TEST_SUITE), eq(Entity.TEST_CASE)))
        .thenReturn(List.of(rel(SUITE_ID, TC_ID)));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntity(Entity.TEST_SUITE, SUITE_ID, "", Include.ALL))
          .thenReturn(basicSuite(true));

      OrphanTestCaseRelationshipCleanup.Result result =
          new OrphanTestCaseRelationshipCleanup(dao, false).performCleanup(100);

      assertEquals(1, result.getTotalScanned());
      assertEquals(0, result.getMissingTestDefinitionDeleted());
      assertEquals(0, result.getMissingExecutableSuiteDeleted());
      entityMock.verify(
          () -> Entity.deleteEntity(any(), any(), any(UUID.class), anyBoolean(), anyBoolean()),
          never());
    }
  }

  @Test
  void dryRun_detectsButDoesNotDelete() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO = stubTestCaseBatch(dao);

    when(relationshipDAO.findFromBatch(
            anyList(), eq(CONTAINS), eq(Entity.TEST_DEFINITION), eq(Entity.TEST_CASE)))
        .thenReturn(List.of());
    when(relationshipDAO.findFromBatch(
            anyList(), eq(CONTAINS), eq(Entity.TEST_SUITE), eq(Entity.TEST_CASE)))
        .thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OrphanTestCaseRelationshipCleanup.Result result =
          new OrphanTestCaseRelationshipCleanup(dao, true).performCleanup(100);

      assertEquals(1, result.getMissingTestDefinitionDeleted());
      entityMock.verify(
          () -> Entity.deleteEntity(any(), any(), any(UUID.class), anyBoolean(), anyBoolean()),
          never());
    }
  }

  private CollectionDAO.EntityRelationshipDAO stubTestCaseBatch(CollectionDAO dao) {
    CollectionDAO.TestCaseDAO testCaseDAO = mock(CollectionDAO.TestCaseDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.testCaseDAO()).thenReturn(testCaseDAO);
    when(dao.relationshipDAO()).thenReturn(relationshipDAO);
    when(testCaseDAO.getTableName()).thenReturn(TABLE);
    when(testCaseDAO.listAfterWithOffset(eq(TABLE), anyInt(), eq(0)))
        .thenReturn(List.of(JsonUtils.pojoToJson(testCase(TC_ID))));
    return relationshipDAO;
  }

  private static EntityRelationshipObject rel(UUID fromId, UUID toId) {
    return EntityRelationshipObject.builder()
        .fromId(fromId.toString())
        .toId(toId.toString())
        .build();
  }

  private static TestSuite basicSuite(boolean basic) {
    return new TestSuite().withId(SUITE_ID).withName("suite").withBasic(basic);
  }

  private static TestCase testCase(UUID id) {
    return new TestCase()
        .withId(id)
        .withName("tc-" + id)
        .withFullyQualifiedName("svc.db.schema.t.tc-" + id)
        .withEntityLink("<#E::table::svc.db.schema.t>");
  }
}
