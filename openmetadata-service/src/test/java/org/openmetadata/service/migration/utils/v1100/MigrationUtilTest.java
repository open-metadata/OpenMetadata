package org.openmetadata.service.migration.utils.v1100;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Update;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;

class MigrationUtilTest {
  private static final String GLOSSARY_TERM_COUNT_POSTGRES =
      "SELECT COUNT(*) FROM glossary_term_entity "
          + "WHERE json ?? 'status' AND NOT json ?? 'entityStatus'";
  private static final String DATA_CONTRACT_COUNT_POSTGRES =
      "SELECT COUNT(*) FROM data_contract_entity "
          + "WHERE json ?? 'status' AND NOT json ?? 'entityStatus'";
  private static final String GLOSSARY_TERM_COUNT_MY_SQL =
      "SELECT COUNT(*) FROM glossary_term_entity "
          + "WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
          + "AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0";
  private static final String DATA_CONTRACT_COUNT_MY_SQL =
      "SELECT COUNT(*) FROM data_contract_entity "
          + "WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
          + "AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0";
  private static final String STORED_PROCEDURE_INDEX_QUERY =
      "SHOW INDEX FROM stored_procedure_entity WHERE Key_name = :keyName";
  private static final String DROP_STORED_PROCEDURE_INDEX =
      "ALTER TABLE stored_procedure_entity DROP INDEX idx_stored_procedure_entity_deleted_name_id";

  private Handle handle;
  private Update update;

  @BeforeEach
  void setUp() {
    handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    update = mock(Update.class);
    when(handle.createUpdate(anyString())).thenReturn(update);
  }

  @Test
  void migrateEntityStatusForExistingEntitiesUsesPostgresBatchStatements() {
    when(handle.createQuery(GLOSSARY_TERM_COUNT_POSTGRES).mapTo(Integer.class).one())
        .thenReturn(800);
    when(handle.createQuery(DATA_CONTRACT_COUNT_POSTGRES).mapTo(Integer.class).one())
        .thenReturn(800);
    when(update.execute()).thenReturn(500, 300, 500, 300);

    MigrationUtil migrationUtil = new MigrationUtil(handle, ConnectionType.POSTGRES);

    assertDoesNotThrow(migrationUtil::migrateEntityStatusForExistingEntities);

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, times(4)).createUpdate(sqlCaptor.capture());

    List<String> updateSql = sqlCaptor.getAllValues();
    assertEquals(4, updateSql.size());
    assertEquals(2, updateSql.stream().filter(sql -> sql.contains("glossary_term_entity")).count());
    assertEquals(2, updateSql.stream().filter(sql -> sql.contains("data_contract_entity")).count());
    updateSql.forEach(sql -> assertTrue(sql.contains("jsonb_set")));
    updateSql.stream()
        .filter(sql -> sql.contains("data_contract_entity"))
        .forEach(sql -> assertTrue(sql.contains("WHEN t.json->>'status' = 'Active'")));
  }

  @Test
  void migrateEntityStatusForExistingEntitiesUsesMysqlBatchStatements() {
    when(handle.createQuery(GLOSSARY_TERM_COUNT_MY_SQL).mapTo(Integer.class).one()).thenReturn(600);
    when(handle.createQuery(DATA_CONTRACT_COUNT_MY_SQL).mapTo(Integer.class).one()).thenReturn(600);
    when(update.execute()).thenReturn(500, 100, 500, 100);

    MigrationUtil migrationUtil = new MigrationUtil(handle, ConnectionType.MYSQL);

    assertDoesNotThrow(migrationUtil::migrateEntityStatusForExistingEntities);

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, times(4)).createUpdate(sqlCaptor.capture());

    List<String> updateSql = sqlCaptor.getAllValues();
    updateSql.forEach(sql -> assertTrue(sql.contains("JSON_SET(JSON_REMOVE")));
    updateSql.stream()
        .filter(sql -> sql.contains("data_contract_entity"))
        .forEach(
            sql ->
                assertTrue(
                    sql.contains(
                        "WHEN JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.status')) = 'Active'")));
  }

  @Test
  void migrateEntityStatusForExistingEntitiesContinuesAfterGlossaryFailures() {
    when(handle.createQuery(GLOSSARY_TERM_COUNT_POSTGRES).mapTo(Integer.class).one())
        .thenThrow(new IllegalStateException("glossary query failed"));
    when(handle.createQuery(DATA_CONTRACT_COUNT_POSTGRES).mapTo(Integer.class).one()).thenReturn(0);

    MigrationUtil migrationUtil = new MigrationUtil(handle, ConnectionType.POSTGRES);

    assertDoesNotThrow(migrationUtil::migrateEntityStatusForExistingEntities);

    verify(handle, never()).createUpdate(anyString());
    verify(handle.createQuery(DATA_CONTRACT_COUNT_POSTGRES).mapTo(Integer.class)).one();
  }

  @Test
  void cleanupOrphanedDataContractsDeletesMissingEntitiesAndContinuesOnDeleteFailure() {
    DataContractRepository repository = mock(DataContractRepository.class);
    UUID validEntityId = UUID.randomUUID();
    UUID orphanEntityId = UUID.randomUUID();
    UUID orphanDeleteFailureEntityId = UUID.randomUUID();

    DataContract valid =
        contract("service.schema.table.contractA", validEntityId, UUID.randomUUID());
    DataContract orphan =
        contract("service.schema.table.contractB", orphanEntityId, UUID.randomUUID());
    DataContract orphanWithDeleteFailure =
        contract("service.schema.table.contractC", orphanDeleteFailureEntityId, UUID.randomUUID());

    when(repository.getFields("id,entity"))
        .thenReturn(new EntityUtil.Fields(Set.of("id", "entity")));
    when(repository.listAll(any(EntityUtil.Fields.class), any()))
        .thenReturn(List.of(valid, orphan, orphanWithDeleteFailure));
    when(repository.delete(Entity.ADMIN_USER_NAME, orphanWithDeleteFailure.getId(), true, true))
        .thenThrow(new IllegalStateException("cannot delete"));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.DATA_CONTRACT)).thenReturn(repository);
      entity
          .when(
              () -> Entity.getEntityReferenceById(Entity.TABLE, validEntityId, Include.NON_DELETED))
          .thenReturn(new EntityReference().withId(validEntityId).withType(Entity.TABLE));
      entity
          .when(
              () ->
                  Entity.getEntityReferenceById(Entity.TABLE, orphanEntityId, Include.NON_DELETED))
          .thenThrow(EntityNotFoundException.byId(orphanEntityId.toString()));
      entity
          .when(
              () ->
                  Entity.getEntityReferenceById(
                      Entity.TABLE, orphanDeleteFailureEntityId, Include.NON_DELETED))
          .thenThrow(EntityNotFoundException.byId(orphanDeleteFailureEntityId.toString()));
      // A truly missing parent is gone under both NON_DELETED and ALL — the migration must
      // follow up the NON_DELETED miss with an ALL probe before it treats the contract as
      // orphaned, so the ALL lookups here throw too.
      entity
          .when(() -> Entity.getEntityReferenceById(Entity.TABLE, orphanEntityId, Include.ALL))
          .thenThrow(EntityNotFoundException.byId(orphanEntityId.toString()));
      entity
          .when(
              () ->
                  Entity.getEntityReferenceById(
                      Entity.TABLE, orphanDeleteFailureEntityId, Include.ALL))
          .thenThrow(EntityNotFoundException.byId(orphanDeleteFailureEntityId.toString()));

      MigrationUtil migrationUtil = new MigrationUtil(handle, ConnectionType.POSTGRES);
      assertDoesNotThrow(migrationUtil::cleanupOrphanedDataContracts);
    }

    verify(repository, never()).delete(Entity.ADMIN_USER_NAME, valid.getId(), true, true);
    verify(repository).delete(Entity.ADMIN_USER_NAME, orphan.getId(), true, true);
    verify(repository).delete(Entity.ADMIN_USER_NAME, orphanWithDeleteFailure.getId(), true, true);
  }

  /**
   * Regresses the v1.10.0 migration bug: a contract whose parent is merely soft-deleted (trash that
   * can be restored) used to be hard-deleted just like a contract whose parent row was truly gone,
   * because {@link Include#NON_DELETED} throws {@link EntityNotFoundException} for both. The fix
   * re-checks the parent with {@link Include#ALL} and only hard-deletes the contract when the
   * parent row no longer exists at all.
   */
  @Test
  void cleanupOrphanedDataContractsSkipsContractsWhoseParentIsSoftDeleted() {
    DataContractRepository repository = mock(DataContractRepository.class);
    UUID validEntityId = UUID.randomUUID();
    UUID softDeletedParentEntityId = UUID.randomUUID();
    UUID trulyMissingEntityId = UUID.randomUUID();

    DataContract valid =
        contract("service.schema.table.contractValid", validEntityId, UUID.randomUUID());
    DataContract softDeletedParent =
        contract(
            "service.schema.table.contractSoftDeleted",
            softDeletedParentEntityId,
            UUID.randomUUID());
    DataContract trulyMissing =
        contract(
            "service.schema.table.contractTrulyMissing", trulyMissingEntityId, UUID.randomUUID());

    when(repository.getFields("id,entity"))
        .thenReturn(new EntityUtil.Fields(Set.of("id", "entity")));
    when(repository.listAll(any(EntityUtil.Fields.class), any()))
        .thenReturn(List.of(valid, softDeletedParent, trulyMissing));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.DATA_CONTRACT)).thenReturn(repository);
      // Valid parent resolves under NON_DELETED — no further lookup, no delete.
      entity
          .when(
              () -> Entity.getEntityReferenceById(Entity.TABLE, validEntityId, Include.NON_DELETED))
          .thenReturn(new EntityReference().withId(validEntityId).withType(Entity.TABLE));
      // Soft-deleted parent: NON_DELETED throws (the row exists with deleted = true, so it is
      // hidden from NON_DELETED lookups) but ALL succeeds (the row is still present) — the
      // contract must be left intact for the parent restore cascade.
      entity
          .when(
              () ->
                  Entity.getEntityReferenceById(
                      Entity.TABLE, softDeletedParentEntityId, Include.NON_DELETED))
          .thenThrow(EntityNotFoundException.byId(softDeletedParentEntityId.toString()));
      entity
          .when(
              () ->
                  Entity.getEntityReferenceById(
                      Entity.TABLE, softDeletedParentEntityId, Include.ALL))
          .thenReturn(
              new EntityReference().withId(softDeletedParentEntityId).withType(Entity.TABLE));
      // Truly missing parent: both NON_DELETED and ALL throw — hard-delete the contract.
      entity
          .when(
              () ->
                  Entity.getEntityReferenceById(
                      Entity.TABLE, trulyMissingEntityId, Include.NON_DELETED))
          .thenThrow(EntityNotFoundException.byId(trulyMissingEntityId.toString()));
      entity
          .when(
              () -> Entity.getEntityReferenceById(Entity.TABLE, trulyMissingEntityId, Include.ALL))
          .thenThrow(EntityNotFoundException.byId(trulyMissingEntityId.toString()));

      MigrationUtil migrationUtil = new MigrationUtil(handle, ConnectionType.POSTGRES);
      assertDoesNotThrow(migrationUtil::cleanupOrphanedDataContracts);
    }

    // The valid contract is never deleted; the soft-deleted-parent contract is preserved so a
    // later parent restore can bring it back; only the truly-missing parent's contract is
    // hard-deleted, preserving the original cleanup intent for pre-1.9.3 orphans.
    verify(repository, never()).delete(Entity.ADMIN_USER_NAME, valid.getId(), true, true);
    verify(repository, never())
        .delete(Entity.ADMIN_USER_NAME, softDeletedParent.getId(), true, true);
    verify(repository).delete(Entity.ADMIN_USER_NAME, trulyMissing.getId(), true, true);
  }

  @Test
  void cleanupOrphanedDataContractsReturnsEarlyWhenNoContractsExist() {
    DataContractRepository repository = mock(DataContractRepository.class);
    when(repository.getFields("id,entity"))
        .thenReturn(new EntityUtil.Fields(Set.of("id", "entity")));
    when(repository.listAll(any(EntityUtil.Fields.class), any())).thenReturn(List.of());

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.DATA_CONTRACT)).thenReturn(repository);

      MigrationUtil migrationUtil = new MigrationUtil(handle, ConnectionType.POSTGRES);
      assertDoesNotThrow(migrationUtil::cleanupOrphanedDataContracts);
    }

    verify(repository, never()).delete(anyString(), any(UUID.class), eq(true), eq(true));
  }

  @Test
  void removeStoredProcedureIndexDropsMysqlIndexWhenPresent() {
    when(handle
            .createQuery(STORED_PROCEDURE_INDEX_QUERY)
            .bind("keyName", "idx_stored_procedure_entity_deleted_name_id")
            .mapToMap()
            .findFirst())
        .thenReturn(Optional.of(Map.of("Key_name", "idx_stored_procedure_entity_deleted_name_id")));
    when(update.execute()).thenReturn(1);

    MigrationUtil migrationUtil = new MigrationUtil(handle, ConnectionType.MYSQL);
    migrationUtil.removeStoredProcedureIndex();

    verify(handle).createUpdate(DROP_STORED_PROCEDURE_INDEX);
    verify(update).execute();
  }

  @Test
  void removeStoredProcedureIndexSkipsMissingIndexesAndNonMysqlConnections() {
    when(handle
            .createQuery(STORED_PROCEDURE_INDEX_QUERY)
            .bind("keyName", "idx_stored_procedure_entity_deleted_name_id")
            .mapToMap()
            .findFirst())
        .thenReturn(Optional.empty());

    MigrationUtil mysqlMigrationUtil = new MigrationUtil(handle, ConnectionType.MYSQL);
    mysqlMigrationUtil.removeStoredProcedureIndex();

    verify(handle, never()).createUpdate(DROP_STORED_PROCEDURE_INDEX);

    Handle postgresHandle = mock(Handle.class, RETURNS_DEEP_STUBS);
    MigrationUtil postgresMigrationUtil =
        new MigrationUtil(postgresHandle, ConnectionType.POSTGRES);
    postgresMigrationUtil.removeStoredProcedureIndex();

    verify(postgresHandle, never()).createQuery(anyString());
  }

  private static DataContract contract(String fqn, UUID entityId, UUID contractId) {
    return new DataContract()
        .withId(contractId)
        .withFullyQualifiedName(fqn)
        .withEntity(new EntityReference().withType(Entity.TABLE).withId(entityId));
  }
}
