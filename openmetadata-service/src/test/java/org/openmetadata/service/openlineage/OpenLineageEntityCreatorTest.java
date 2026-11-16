/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.openlineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.openlineage.DatasetFacets;
import org.openmetadata.schema.api.lineage.openlineage.SchemaFacet;
import org.openmetadata.schema.api.lineage.openlineage.SchemaField;
import org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.openlineage.OpenLineageEntityCreator.CreateAuthorization;
import org.openmetadata.service.openlineage.OpenLineageEntityCreator.TableLocation;
import org.openmetadata.service.resources.databases.DatabaseMapper;
import org.openmetadata.service.resources.databases.DatabaseSchemaMapper;
import org.openmetadata.service.resources.databases.TableMapper;
import org.openmetadata.service.security.AuthorizationException;

/**
 * Verifies the {@link OpenLineageEntityCreator} rollback guarantee: any failure after a write —
 * not just {@link AuthorizationException}, {@code LimitsException} or {@link
 * IllegalArgumentException} — takes back what was already created, so no empty shell is left
 * behind. Also verifies that an empty/blank schema is rejected before any write.
 */
class OpenLineageEntityCreatorTest {

  private static final String SERVICE = "svc";
  private static final String DATABASE = "mydb";
  private static final String SCHEMA = "public";
  private static final String TABLE = "orders";
  private static final String CREATED_BY = "user";
  private static final String SERVICE_FQN = SERVICE;
  private static final String DATABASE_FQN = SERVICE_FQN + "." + DATABASE;
  private static final String SCHEMA_FQN = DATABASE_FQN + "." + SCHEMA;
  private static final String TABLE_FQN = SCHEMA_FQN + "." + TABLE;

  private static DatasetFacets schemaFacets() {
    return new DatasetFacets()
        .withSchema(
            new SchemaFacet()
                .withFields(List.of(new SchemaField().withName("id").withType("BIGINT"))));
  }

  /** An authorization that allows every create. */
  private static final CreateAuthorization ALLOW_ALL = (entityType, entity) -> {};

  private static DatabaseService mockService(EntityReference serviceRef) {
    DatabaseService service = mock(DatabaseService.class);
    when(service.getEntityReference()).thenReturn(serviceRef);
    return service;
  }

  private static EntityReference ref(String fqn) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withName(fqn)
        .withFullyQualifiedName(fqn);
  }

  @SuppressWarnings("unchecked")
  private static EntityRepository<DatabaseService> stubServiceRepo(
      MockedStatic<Entity> mockedEntity, DatabaseService service) {
    EntityRepository<DatabaseService> serviceRepo = mock(EntityRepository.class);
    mockedEntity
        .when(() -> Entity.getEntityRepository(Entity.DATABASE_SERVICE))
        .thenReturn(serviceRepo);
    when(serviceRepo.findByNameOrNull(eq(SERVICE_FQN), eq(Include.NON_DELETED)))
        .thenReturn(service);
    return serviceRepo;
  }

  /**
   * Stubs the per-entity repositories so that nothing pre-exists (every {@code findByNameOrNull}
   * returns null) and {@code create} returns freshly built entities carrying ids and FQNs that the
   * creator uses to build the next-level FQN.
   */
  @SuppressWarnings("unchecked")
  private static Repos stubCreatingRepos(MockedStatic<Entity> mockedEntity, UUID dbId) {
    EntityRepository<Database> dbRepo = mock(EntityRepository.class);
    EntityRepository<DatabaseSchema> schemaRepo = mock(EntityRepository.class);
    EntityRepository<Table> tableRepo = mock(EntityRepository.class);
    when(dbRepo.getEntityType()).thenReturn(Entity.DATABASE);
    when(schemaRepo.getEntityType()).thenReturn(Entity.DATABASE_SCHEMA);
    when(tableRepo.getEntityType()).thenReturn(Entity.TABLE);
    mockedEntity.when(() -> Entity.getEntityRepository(Entity.DATABASE)).thenReturn(dbRepo);
    mockedEntity
        .when(() -> Entity.getEntityRepository(Entity.DATABASE_SCHEMA))
        .thenReturn(schemaRepo);
    mockedEntity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(tableRepo);

    when(dbRepo.findByNameOrNull(anyString(), eq(Include.ALL))).thenReturn(null);
    when(schemaRepo.findByNameOrNull(anyString(), eq(Include.ALL))).thenReturn(null);
    when(tableRepo.findByNameOrNull(anyString(), eq(Include.ALL))).thenReturn(null);

    Database database =
        new Database().withId(dbId).withName(DATABASE).withFullyQualifiedName(DATABASE_FQN);
    when(dbRepo.create(eq(null), any(Database.class))).thenReturn(database);
    DatabaseSchema schema =
        new DatabaseSchema()
            .withId(UUID.randomUUID())
            .withName(SCHEMA)
            .withFullyQualifiedName(SCHEMA_FQN);
    when(schemaRepo.create(eq(null), any(DatabaseSchema.class))).thenReturn(schema);
    Table table =
        new Table().withId(UUID.randomUUID()).withName(TABLE).withFullyQualifiedName(TABLE_FQN);
    when(tableRepo.create(eq(null), any(Table.class))).thenReturn(table);

    return new Repos(dbRepo, schemaRepo, tableRepo, database, schema, table);
  }

  private record Repos(
      EntityRepository<Database> dbRepo,
      EntityRepository<DatabaseSchema> schemaRepo,
      EntityRepository<Table> tableRepo,
      Database database,
      DatabaseSchema schema,
      Table table) {}

  // ====================================================================================
  // Empty/blank schema is rejected before any write (#MISSING_SCHEMA)
  // ====================================================================================

  @Test
  void createTable_emptySchema_reportsMissingSchemaBeforeAnyWrite() {
    EntityReference serviceRef = ref(SERVICE_FQN);
    DatabaseService service = mockService(serviceRef);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      EntityRepository<DatabaseService> serviceRepo = stubServiceRepo(mockedEntity, service);
      @SuppressWarnings("unchecked")
      EntityRepository<Database> dbRepo = mock(EntityRepository.class);
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.DATABASE)).thenReturn(dbRepo);

      OpenLineageEntityCreator creator = new OpenLineageEntityCreator(ALLOW_ALL);
      OpenLineageResolution result =
          creator.createTable(
              new TableLocation(SERVICE, DATABASE, "", TABLE), schemaFacets(), CREATED_BY);

      OpenLineageResolution.Unresolved unresolved =
          assertInstanceOf(OpenLineageResolution.Unresolved.class, result);
      assertEquals(UnresolvedReason.MISSING_SCHEMA, unresolved.reason());
      verify(dbRepo, never()).create(any(), any());
      verify(dbRepo, never()).delete(anyString(), any(), anyBoolean(), anyBoolean());
      verify(serviceRepo, never()).create(any(), any());
    }
  }

  @Test
  void createTable_nullSchema_reportsMissingSchema() {
    EntityReference serviceRef = ref(SERVICE_FQN);
    DatabaseService service = mockService(serviceRef);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubServiceRepo(mockedEntity, service);

      OpenLineageEntityCreator creator = new OpenLineageEntityCreator(ALLOW_ALL);
      OpenLineageResolution result =
          creator.createTable(
              new TableLocation(SERVICE, DATABASE, null, TABLE), schemaFacets(), CREATED_BY);

      assertInstanceOf(OpenLineageResolution.Unresolved.class, result);
      assertEquals(
          UnresolvedReason.MISSING_SCHEMA, ((OpenLineageResolution.Unresolved) result).reason());
    }
  }

  // ====================================================================================
  // Any RuntimeException after a write triggers rollback (the core bug fix)
  // ====================================================================================

  @Test
  void createTable_schemaCreateThrowsRuntimeException_rollsBackDatabase() {
    UUID dbId = UUID.randomUUID();
    EntityReference serviceRef = ref(SERVICE_FQN);
    DatabaseService service = mockService(serviceRef);
    CreateAuthorization auth =
        (entityType, entity) -> {
          if (Entity.DATABASE_SCHEMA.equals(entityType)) {
            throw new RuntimeException("concurrent schema lock");
          }
        };

    try (MockedConstruction<DatabaseMapper> ignoredDb =
            mockConstruction(
                DatabaseMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabase.class), anyString()))
                        .thenReturn(
                            new Database()
                                .withId(dbId)
                                .withName(DATABASE)
                                .withFullyQualifiedName(DATABASE_FQN)));
        MockedConstruction<DatabaseSchemaMapper> ignoredSchema =
            mockConstruction(
                DatabaseSchemaMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabaseSchema.class), anyString()))
                        .thenReturn(
                            new DatabaseSchema()
                                .withName(SCHEMA)
                                .withFullyQualifiedName(SCHEMA_FQN)));
        MockedConstruction<TableMapper> ignoredTable = mockConstruction(TableMapper.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubServiceRepo(mockedEntity, service);
      Repos repos = stubCreatingRepos(mockedEntity, dbId);

      OpenLineageEntityCreator creator = new OpenLineageEntityCreator(auth);
      OpenLineageResolution result =
          creator.createTable(
              new TableLocation(SERVICE, DATABASE, SCHEMA, TABLE), schemaFacets(), CREATED_BY);

      OpenLineageResolution.Unresolved unresolved =
          assertInstanceOf(OpenLineageResolution.Unresolved.class, result);
      assertEquals(UnresolvedReason.INVALID_ENTITY, unresolved.reason());
      assertEquals("concurrent schema lock", unresolved.message());
      // The committed Database must be taken back so no empty shell is left behind.
      verify(repos.dbRepo).delete(eq(CREATED_BY), eq(dbId), eq(false), eq(true));
      // The schema itself was never committed (authorize threw before create).
      verify(repos.schemaRepo, never()).create(any(), any());
      verify(repos.tableRepo, never()).create(any(), any());
    }
  }

  @Test
  void createTable_repositoryCreateThrowsRuntimeException_rollsBackDatabase() {
    // Simulates an EntityLockedException thrown by repository.create after the Database is
    // committed — a WebServiceException (RuntimeException) the old catch clause missed.
    UUID dbId = UUID.randomUUID();
    EntityReference serviceRef = ref(SERVICE_FQN);
    DatabaseService service = mockService(serviceRef);

    try (MockedConstruction<DatabaseMapper> ignoredDb =
            mockConstruction(
                DatabaseMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabase.class), anyString()))
                        .thenReturn(
                            new Database()
                                .withId(dbId)
                                .withName(DATABASE)
                                .withFullyQualifiedName(DATABASE_FQN)));
        MockedConstruction<DatabaseSchemaMapper> ignoredSchema =
            mockConstruction(
                DatabaseSchemaMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabaseSchema.class), anyString()))
                        .thenReturn(
                            new DatabaseSchema()
                                .withName(SCHEMA)
                                .withFullyQualifiedName(SCHEMA_FQN)));
        MockedConstruction<TableMapper> ignoredTable = mockConstruction(TableMapper.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubServiceRepo(mockedEntity, service);
      Repos repos = stubCreatingRepos(mockedEntity, dbId);
      when(repos.schemaRepo.create(eq(null), any(DatabaseSchema.class)))
          .thenThrow(new RuntimeException("entity locked"));

      OpenLineageEntityCreator creator = new OpenLineageEntityCreator(ALLOW_ALL);
      OpenLineageResolution result =
          creator.createTable(
              new TableLocation(SERVICE, DATABASE, SCHEMA, TABLE), schemaFacets(), CREATED_BY);

      OpenLineageResolution.Unresolved unresolved =
          assertInstanceOf(OpenLineageResolution.Unresolved.class, result);
      assertEquals(UnresolvedReason.INVALID_ENTITY, unresolved.reason());
      verify(repos.dbRepo).delete(eq(CREATED_BY), eq(dbId), eq(false), eq(true));
    }
  }

  @Test
  void createTable_entityNotFoundExceptionAfterDatabase_rollsBackDatabase() {
    // EntityNotFoundException extends WebServiceException extends RuntimeException — not an
    // IllegalArgumentException, so the old catch clause missed it and orphaned the Database.
    UUID dbId = UUID.randomUUID();
    EntityReference serviceRef = ref(SERVICE_FQN);
    DatabaseService service = mockService(serviceRef);

    try (MockedConstruction<DatabaseMapper> ignoredDb =
            mockConstruction(
                DatabaseMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabase.class), anyString()))
                        .thenReturn(
                            new Database()
                                .withId(dbId)
                                .withName(DATABASE)
                                .withFullyQualifiedName(DATABASE_FQN)));
        MockedConstruction<DatabaseSchemaMapper> ignoredSchema =
            mockConstruction(
                DatabaseSchemaMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabaseSchema.class), anyString()))
                        .thenReturn(
                            new DatabaseSchema()
                                .withName(SCHEMA)
                                .withFullyQualifiedName(SCHEMA_FQN)));
        MockedConstruction<TableMapper> ignoredTable = mockConstruction(TableMapper.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubServiceRepo(mockedEntity, service);
      Repos repos = stubCreatingRepos(mockedEntity, dbId);
      when(repos.schemaRepo.findByNameOrNull(eq(SCHEMA_FQN), eq(Include.ALL)))
          .thenThrow(EntityNotFoundException.byName(SCHEMA_FQN));

      OpenLineageEntityCreator creator = new OpenLineageEntityCreator(ALLOW_ALL);
      OpenLineageResolution result =
          creator.createTable(
              new TableLocation(SERVICE, DATABASE, SCHEMA, TABLE), schemaFacets(), CREATED_BY);

      assertInstanceOf(OpenLineageResolution.Unresolved.class, result);
      assertEquals(
          UnresolvedReason.INVALID_ENTITY, ((OpenLineageResolution.Unresolved) result).reason());
      verify(repos.dbRepo).delete(eq(CREATED_BY), eq(dbId), eq(false), eq(true));
    }
  }

  @Test
  void createTable_tableCreateThrowsRuntimeException_rollsBackDatabaseAndSchema() {
    UUID dbId = UUID.randomUUID();
    UUID schemaId = UUID.randomUUID();
    EntityReference serviceRef = ref(SERVICE_FQN);
    DatabaseService service = mockService(serviceRef);

    try (MockedConstruction<DatabaseMapper> ignoredDb =
            mockConstruction(
                DatabaseMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabase.class), anyString()))
                        .thenReturn(
                            new Database()
                                .withId(dbId)
                                .withName(DATABASE)
                                .withFullyQualifiedName(DATABASE_FQN)));
        MockedConstruction<DatabaseSchemaMapper> ignoredSchema =
            mockConstruction(
                DatabaseSchemaMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabaseSchema.class), anyString()))
                        .thenReturn(
                            new DatabaseSchema()
                                .withId(schemaId)
                                .withName(SCHEMA)
                                .withFullyQualifiedName(SCHEMA_FQN)));
        MockedConstruction<TableMapper> ignoredTable =
            mockConstruction(
                TableMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateTable.class), anyString()))
                        .thenReturn(
                            new Table().withName(TABLE).withFullyQualifiedName(TABLE_FQN)));
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubServiceRepo(mockedEntity, service);
      Repos repos = stubCreatingRepos(mockedEntity, dbId);
      DatabaseSchema schema =
          new DatabaseSchema().withId(schemaId).withName(SCHEMA).withFullyQualifiedName(SCHEMA_FQN);
      when(repos.schemaRepo.create(eq(null), any(DatabaseSchema.class))).thenReturn(schema);
      when(repos.tableRepo.create(eq(null), any(Table.class)))
          .thenThrow(new RuntimeException("table creation failed"));

      OpenLineageEntityCreator creator = new OpenLineageEntityCreator(ALLOW_ALL);
      OpenLineageResolution result =
          creator.createTable(
              new TableLocation(SERVICE, DATABASE, SCHEMA, TABLE), schemaFacets(), CREATED_BY);

      assertInstanceOf(OpenLineageResolution.Unresolved.class, result);
      assertEquals(
          UnresolvedReason.INVALID_ENTITY, ((OpenLineageResolution.Unresolved) result).reason());
      // Newest first: the schema the run created is taken back, then the database.
      verify(repos.schemaRepo).delete(eq(CREATED_BY), eq(schemaId), eq(false), eq(true));
      verify(repos.dbRepo).delete(eq(CREATED_BY), eq(dbId), eq(false), eq(true));
    }
  }

  // ====================================================================================
  // Pre-existing catch arms still behave (no regression)
  // ====================================================================================

  @Test
  void createTable_authorizationException_rollsBackDatabase_returnsCreateNotAllowed() {
    UUID dbId = UUID.randomUUID();
    EntityReference serviceRef = ref(SERVICE_FQN);
    DatabaseService service = mockService(serviceRef);
    CreateAuthorization auth =
        (entityType, entity) -> {
          if (Entity.DATABASE_SCHEMA.equals(entityType)) {
            throw new AuthorizationException("not allowed");
          }
        };

    try (MockedConstruction<DatabaseMapper> ignoredDb =
            mockConstruction(
                DatabaseMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabase.class), anyString()))
                        .thenReturn(
                            new Database()
                                .withId(dbId)
                                .withName(DATABASE)
                                .withFullyQualifiedName(DATABASE_FQN)));
        MockedConstruction<DatabaseSchemaMapper> ignoredSchema =
            mockConstruction(
                DatabaseSchemaMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabaseSchema.class), anyString()))
                        .thenReturn(
                            new DatabaseSchema()
                                .withName(SCHEMA)
                                .withFullyQualifiedName(SCHEMA_FQN)));
        MockedConstruction<TableMapper> ignoredTable = mockConstruction(TableMapper.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubServiceRepo(mockedEntity, service);
      Repos repos = stubCreatingRepos(mockedEntity, dbId);

      OpenLineageEntityCreator creator = new OpenLineageEntityCreator(auth);
      OpenLineageResolution result =
          creator.createTable(
              new TableLocation(SERVICE, DATABASE, SCHEMA, TABLE), schemaFacets(), CREATED_BY);

      OpenLineageResolution.Unresolved unresolved =
          assertInstanceOf(OpenLineageResolution.Unresolved.class, result);
      assertEquals(UnresolvedReason.CREATE_NOT_ALLOWED, unresolved.reason());
      verify(repos.dbRepo).delete(eq(CREATED_BY), eq(dbId), eq(false), eq(true));
    }
  }

  @Test
  void createTable_illegalArgumentException_rollsBack_returnsInvalidEntity() {
    UUID dbId = UUID.randomUUID();
    EntityReference serviceRef = ref(SERVICE_FQN);
    DatabaseService service = mockService(serviceRef);
    // A schema name that the FQN validator rejects produces an IllegalArgumentException.
    CreateAuthorization auth =
        (entityType, entity) -> {
          if (Entity.DATABASE_SCHEMA.equals(entityType)) {
            throw new IllegalArgumentException("invalid schema name");
          }
        };

    try (MockedConstruction<DatabaseMapper> ignoredDb =
            mockConstruction(
                DatabaseMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabase.class), anyString()))
                        .thenReturn(
                            new Database()
                                .withId(dbId)
                                .withName(DATABASE)
                                .withFullyQualifiedName(DATABASE_FQN)));
        MockedConstruction<DatabaseSchemaMapper> ignoredSchema =
            mockConstruction(
                DatabaseSchemaMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabaseSchema.class), anyString()))
                        .thenReturn(
                            new DatabaseSchema()
                                .withName(SCHEMA)
                                .withFullyQualifiedName(SCHEMA_FQN)));
        MockedConstruction<TableMapper> ignoredTable = mockConstruction(TableMapper.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubServiceRepo(mockedEntity, service);
      Repos repos = stubCreatingRepos(mockedEntity, dbId);

      OpenLineageEntityCreator creator = new OpenLineageEntityCreator(auth);
      OpenLineageResolution result =
          creator.createTable(
              new TableLocation(SERVICE, DATABASE, SCHEMA, TABLE), schemaFacets(), CREATED_BY);

      OpenLineageResolution.Unresolved unresolved =
          assertInstanceOf(OpenLineageResolution.Unresolved.class, result);
      assertEquals(UnresolvedReason.INVALID_ENTITY, unresolved.reason());
      assertEquals("invalid schema name", unresolved.message());
      verify(repos.dbRepo).delete(eq(CREATED_BY), eq(dbId), eq(false), eq(true));
    }
  }

  // ====================================================================================
  // Nothing pre-existing: the happy path leaves nothing to roll back (no regression)
  // ====================================================================================

  @Test
  void createTable_allLevelsCreated_resolvesAndDoesNotRollBack() {
    UUID dbId = UUID.randomUUID();
    UUID schemaId = UUID.randomUUID();
    UUID tableId = UUID.randomUUID();
    EntityReference serviceRef = ref(SERVICE_FQN);
    DatabaseService service = mockService(serviceRef);

    try (MockedConstruction<DatabaseMapper> ignoredDb =
            mockConstruction(
                DatabaseMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabase.class), anyString()))
                        .thenReturn(
                            new Database()
                                .withId(dbId)
                                .withName(DATABASE)
                                .withFullyQualifiedName(DATABASE_FQN)));
        MockedConstruction<DatabaseSchemaMapper> ignoredSchema =
            mockConstruction(
                DatabaseSchemaMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabaseSchema.class), anyString()))
                        .thenReturn(
                            new DatabaseSchema()
                                .withId(schemaId)
                                .withName(SCHEMA)
                                .withFullyQualifiedName(SCHEMA_FQN)));
        MockedConstruction<TableMapper> ignoredTable =
            mockConstruction(
                TableMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateTable.class), anyString()))
                        .thenReturn(
                            new Table()
                                .withId(tableId)
                                .withName(TABLE)
                                .withFullyQualifiedName(TABLE_FQN)));
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubServiceRepo(mockedEntity, service);
      Repos repos = stubCreatingRepos(mockedEntity, dbId);

      OpenLineageEntityCreator creator = new OpenLineageEntityCreator(ALLOW_ALL);
      OpenLineageResolution result =
          creator.createTable(
              new TableLocation(SERVICE, DATABASE, SCHEMA, TABLE), schemaFacets(), CREATED_BY);

      OpenLineageResolution.Resolved resolved =
          assertInstanceOf(OpenLineageResolution.Resolved.class, result);
      assertEquals(TABLE_FQN, resolved.entity().getFullyQualifiedName());
      verify(repos.dbRepo, never()).delete(anyString(), any(), anyBoolean(), anyBoolean());
      verify(repos.schemaRepo, never()).delete(anyString(), any(), anyBoolean(), anyBoolean());
      verify(repos.tableRepo, never()).delete(anyString(), any(), anyBoolean(), anyBoolean());
    }
  }

  // ====================================================================================
  // withoutCaller: an anonymous (no-caller) event can create nothing
  // ====================================================================================

  @Test
  void withoutCaller_createTable_reportsCreateNotAllowedAndRollsBack() {
    UUID dbId = UUID.randomUUID();
    EntityReference serviceRef = ref(SERVICE_FQN);
    DatabaseService service = mockService(serviceRef);

    try (MockedConstruction<DatabaseMapper> ignoredDb =
            mockConstruction(
                DatabaseMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabase.class), anyString()))
                        .thenReturn(
                            new Database()
                                .withId(dbId)
                                .withName(DATABASE)
                                .withFullyQualifiedName(DATABASE_FQN)));
        MockedConstruction<DatabaseSchemaMapper> ignoredSchema =
            mockConstruction(
                DatabaseSchemaMapper.class,
                (mockMapper, ctx) ->
                    when(mockMapper.createToEntity(any(CreateDatabaseSchema.class), anyString()))
                        .thenReturn(
                            new DatabaseSchema()
                                .withName(SCHEMA)
                                .withFullyQualifiedName(SCHEMA_FQN)));
        MockedConstruction<TableMapper> ignoredTable = mockConstruction(TableMapper.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubServiceRepo(mockedEntity, service);
      Repos repos = stubCreatingRepos(mockedEntity, dbId);

      OpenLineageEntityCreator creator = OpenLineageEntityCreator.withoutCaller();
      OpenLineageResolution result =
          creator.createTable(
              new TableLocation(SERVICE, DATABASE, SCHEMA, TABLE), schemaFacets(), CREATED_BY);

      // The very first create (the database) is refused, and there is nothing to roll back yet.
      OpenLineageResolution.Unresolved unresolved =
          assertInstanceOf(OpenLineageResolution.Unresolved.class, result);
      assertEquals(UnresolvedReason.CREATE_NOT_ALLOWED, unresolved.reason());
      verify(repos.dbRepo, never()).create(any(), any());
      verify(repos.dbRepo, never()).delete(anyString(), any(), anyBoolean(), anyBoolean());
    }
  }
}
