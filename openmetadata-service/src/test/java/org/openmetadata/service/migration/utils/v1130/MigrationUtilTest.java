package org.openmetadata.service.migration.utils.v1130;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Set;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;

class MigrationUtilTest {

  private Handle handleWithUpdateReturning(int rowCount) {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createUpdate(any()).bind(anyString(), anyString()).execute()).thenReturn(rowCount);
    return handle;
  }

  @SuppressWarnings({"rawtypes", "unchecked"})
  private EntityRepository<?> repoWithHashCol(String tableName, String hashCol) {
    EntityDAO dao = mock(EntityDAO.class);
    when(dao.getTableName()).thenReturn(tableName);
    when(dao.getNameHashColumn()).thenReturn(hashCol);
    EntityRepository repo = mock(EntityRepository.class);
    doReturn(dao).when(repo).getDao();
    return repo;
  }

  @Test
  void backfillDoesNothingWhenEntityListIsEmpty() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getEntityList).thenReturn(Set.of());

      assertDoesNotThrow(() -> MigrationUtil.backfillRelationshipFqnHashes(handle));
      verify(handle, never()).createUpdate(any());
    }
  }

  @Test
  void backfillIssuesFromAndToUpdatesForFqnHashEntity() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    EntityRepository<?> repo = repoWithHashCol("table_entity", "fqnHash");

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getEntityList).thenReturn(Set.of("table"));
      entity.when(() -> Entity.getEntityRepository("table")).thenReturn(repo);

      assertDoesNotThrow(() -> MigrationUtil.backfillRelationshipFqnHashes(handle));

      verify(handle).createUpdate(contains("fromFQNHash"));
      verify(handle).createUpdate(contains("toFQNHash"));
    }
  }

  @Test
  void backfillIssuesFromAndToUpdatesForNameHashEntity() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    EntityRepository<?> repo = repoWithHashCol("user_entity", "nameHash");

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getEntityList).thenReturn(Set.of("user"));
      entity.when(() -> Entity.getEntityRepository("user")).thenReturn(repo);

      assertDoesNotThrow(() -> MigrationUtil.backfillRelationshipFqnHashes(handle));

      verify(handle).createUpdate(contains("fromFQNHash"));
      verify(handle).createUpdate(contains("toFQNHash"));
    }
  }

  @Test
  void backfillSkipsEntityTypeWithUnrecognisedHashColumn() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    EntityRepository<?> repo = repoWithHashCol("some_entity", "otherHash");

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getEntityList).thenReturn(Set.of("someEntity"));
      entity.when(() -> Entity.getEntityRepository("someEntity")).thenReturn(repo);

      assertDoesNotThrow(() -> MigrationUtil.backfillRelationshipFqnHashes(handle));

      verify(handle, never()).createUpdate(any());
    }
  }

  @Test
  void backfillSkipsTimeSeriesEntityWhenRepositoryNotFound() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getEntityList).thenReturn(Set.of("testCaseResolutionStatus"));
      entity
          .when(() -> Entity.getEntityRepository("testCaseResolutionStatus"))
          .thenThrow(new RuntimeException("not a regular entity"));

      assertDoesNotThrow(() -> MigrationUtil.backfillRelationshipFqnHashes(handle));

      verify(handle, never()).createUpdate(any());
    }
  }

  @Test
  void backfillContinuesToNextEntityWhenOneEntityUpdateFails() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createUpdate(any()).bind(anyString(), anyString()).execute())
        .thenThrow(new RuntimeException("DB error"));

    EntityRepository<?> tableRepo = repoWithHashCol("table_entity", "fqnHash");
    EntityRepository<?> userRepo = repoWithHashCol("user_entity", "nameHash");

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getEntityList).thenReturn(Set.of("table", "user"));
      entity.when(() -> Entity.getEntityRepository("table")).thenReturn(tableRepo);
      entity.when(() -> Entity.getEntityRepository("user")).thenReturn(userRepo);

      assertDoesNotThrow(() -> MigrationUtil.backfillRelationshipFqnHashes(handle));
    }
  }

  @Test
  void backfillSqlContainsCorrelatedSubqueryWithCast() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    EntityRepository<?> repo = repoWithHashCol("table_entity", "fqnHash");

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getEntityList).thenReturn(Set.of("table"));
      entity.when(() -> Entity.getEntityRepository("table")).thenReturn(repo);

      MigrationUtil.backfillRelationshipFqnHashes(handle);

      verify(handle, times(2)).createUpdate(contains("CAST(t.id AS CHAR(36))"));
      verify(handle, times(2)).createUpdate(contains("CAST(t.fqnHash AS CHAR(768))"));
    }
  }
}
