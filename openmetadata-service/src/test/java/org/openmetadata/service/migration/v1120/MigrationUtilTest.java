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

package org.openmetadata.service.migration.v1120;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.migration.utils.v1120.MigrationUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.TestUtils;

/**
 * Tests for the v1.12.0 migration that fixes FQN hash for entities whose service name contains
 * dots.
 *
 * <p>The bug was in repository code that used service.getName() instead of
 * service.getFullyQualifiedName() when building child entity FQNs. For services with dots in their
 * names (e.g., "my.service"), this resulted in incorrect FQNs:
 *
 * <ul>
 *   <li>Incorrect: my.service.database (service name used directly without quotes)
 *   <li>Correct: "my.service".database (service FQN with quotes used)
 * </ul>
 *
 * <p>This test simulates the bug by directly inserting entities with bad FQNs into the database,
 * then verifies that the migration correctly fixes them.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MigrationUtilTest extends OpenMetadataApplicationTest {

  private CollectionDAO collectionDAO;

  private DatabaseService serviceWithDots;
  private String databaseName;
  private String schemaName;
  private String tableName;

  private UUID databaseId;
  private UUID schemaId;
  private UUID tableId;

  // Bad FQNs (as if created with buggy service.getName() code)
  private String badDatabaseFqn;
  private String badSchemaFqn;
  private String badTableFqn;

  // Expected correct FQNs (using service.getFullyQualifiedName())
  private String expectedDatabaseFqn;
  private String expectedSchemaFqn;
  private String expectedTableFqn;

  @BeforeAll
  public void setup(TestInfo test) throws IOException {
    collectionDAO = Entity.getCollectionDAO();

    // Create a database service with dots in its name
    String serviceName = "test.service.with.dots." + UUID.randomUUID().toString().substring(0, 8);
    CreateDatabaseService createService =
        new CreateDatabaseService()
            .withName(serviceName)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(TestUtils.MYSQL_DATABASE_CONNECTION);

    serviceWithDots =
        TestUtils.post(
            getResource("services/databaseServices"),
            createService,
            DatabaseService.class,
            ADMIN_AUTH_HEADERS);

    // Verify service FQN contains quotes due to dots
    assertTrue(
        serviceWithDots.getFullyQualifiedName().contains("\""),
        "Service FQN should contain quotes: " + serviceWithDots.getFullyQualifiedName());

    // Generate unique names for test entities
    databaseName = "testdb" + UUID.randomUUID().toString().substring(0, 8);
    schemaName = "testschema" + UUID.randomUUID().toString().substring(0, 8);
    tableName = "testtable" + UUID.randomUUID().toString().substring(0, 8);

    // Compute the BAD FQNs (using service.getName() - the buggy behavior)
    // This is what entities would have if created with the buggy code
    badDatabaseFqn = serviceWithDots.getName() + "." + databaseName;
    badSchemaFqn = badDatabaseFqn + "." + schemaName;
    badTableFqn = badSchemaFqn + "." + tableName;

    // Compute the CORRECT FQNs (using service.getFullyQualifiedName())
    expectedDatabaseFqn =
        FullyQualifiedName.add(serviceWithDots.getFullyQualifiedName(), databaseName);
    expectedSchemaFqn = FullyQualifiedName.add(expectedDatabaseFqn, schemaName);
    expectedTableFqn = FullyQualifiedName.add(expectedSchemaFqn, tableName);
  }

  @Test
  @Order(1)
  void testInsertEntitiesWithBadFqn() {
    // Simulate the bug by inserting entities with bad FQNs directly into the database.
    // This mimics what would have happened if entities were created with the buggy code
    // that used service.getName() instead of service.getFullyQualifiedName()

    databaseId = UUID.randomUUID();
    schemaId = UUID.randomUUID();
    tableId = UUID.randomUUID();

    try (Handle handle = jdbi.open()) {
      // Insert database with bad FQN
      // Note: id, name, updatedAt, updatedBy, deleted are GENERATED columns derived from json
      // We only need to insert json and fqnHash
      String databaseJson =
          String.format(
              "{\"id\":\"%s\",\"name\":\"%s\",\"fullyQualifiedName\":\"%s\","
                  + "\"service\":{\"id\":\"%s\",\"type\":\"databaseService\"},"
                  + "\"serviceType\":\"Mysql\",\"version\":0.1,\"updatedAt\":%d,\"updatedBy\":\"admin\","
                  + "\"deleted\":false}",
              databaseId,
              databaseName,
              badDatabaseFqn,
              serviceWithDots.getId(),
              System.currentTimeMillis());

      handle.execute(
          String.format(
              "INSERT INTO database_entity (json, fqnHash) VALUES ('%s', '%s')",
              databaseJson, FullyQualifiedName.buildHash(badDatabaseFqn)));

      // Insert relationship: service -> database
      handle.execute(
          String.format(
              "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) "
                  + "VALUES ('%s', '%s', '%s', '%s', %d)",
              serviceWithDots.getId(),
              databaseId,
              Entity.DATABASE_SERVICE,
              Entity.DATABASE,
              0)); // CONTAINS relationship

      // Insert schema with bad FQN
      String schemaJson =
          String.format(
              "{\"id\":\"%s\",\"name\":\"%s\",\"fullyQualifiedName\":\"%s\","
                  + "\"database\":{\"id\":\"%s\",\"type\":\"database\"},"
                  + "\"service\":{\"id\":\"%s\",\"type\":\"databaseService\"},"
                  + "\"serviceType\":\"Mysql\",\"version\":0.1,\"updatedAt\":%d,\"updatedBy\":\"admin\","
                  + "\"deleted\":false}",
              schemaId,
              schemaName,
              badSchemaFqn,
              databaseId,
              serviceWithDots.getId(),
              System.currentTimeMillis());

      handle.execute(
          String.format(
              "INSERT INTO database_schema_entity (json, fqnHash) VALUES ('%s', '%s')",
              schemaJson, FullyQualifiedName.buildHash(badSchemaFqn)));

      // Insert relationship: database -> schema
      handle.execute(
          String.format(
              "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) "
                  + "VALUES ('%s', '%s', '%s', '%s', %d)",
              databaseId, schemaId, Entity.DATABASE, Entity.DATABASE_SCHEMA, 0));

      // Insert table with bad FQN
      String tableJson =
          String.format(
              "{\"id\":\"%s\",\"name\":\"%s\",\"fullyQualifiedName\":\"%s\","
                  + "\"columns\":[{\"name\":\"id\",\"dataType\":\"INT\",\"fullyQualifiedName\":\"%s.id\"}],"
                  + "\"databaseSchema\":{\"id\":\"%s\",\"type\":\"databaseSchema\"},"
                  + "\"database\":{\"id\":\"%s\",\"type\":\"database\"},"
                  + "\"service\":{\"id\":\"%s\",\"type\":\"databaseService\"},"
                  + "\"serviceType\":\"Mysql\",\"tableType\":\"Regular\","
                  + "\"version\":0.1,\"updatedAt\":%d,\"updatedBy\":\"admin\",\"deleted\":false}",
              tableId,
              tableName,
              badTableFqn,
              badTableFqn,
              schemaId,
              databaseId,
              serviceWithDots.getId(),
              System.currentTimeMillis());

      handle.execute(
          String.format(
              "INSERT INTO table_entity (json, fqnHash) VALUES ('%s', '%s')",
              tableJson, FullyQualifiedName.buildHash(badTableFqn)));

      // Insert relationship: schema -> table
      handle.execute(
          String.format(
              "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) "
                  + "VALUES ('%s', '%s', '%s', '%s', %d)",
              schemaId, tableId, Entity.DATABASE_SCHEMA, Entity.TABLE, 0));
    }

    // Verify entities were inserted with bad FQNs (no quotes in FQN)
    Database insertedDatabase = collectionDAO.databaseDAO().findEntityById(databaseId);
    assertEquals(badDatabaseFqn, insertedDatabase.getFullyQualifiedName());
    assertFalse(
        insertedDatabase.getFullyQualifiedName().contains("\""),
        "Bad FQN should NOT contain quotes: " + insertedDatabase.getFullyQualifiedName());

    DatabaseSchema insertedSchema = collectionDAO.databaseSchemaDAO().findEntityById(schemaId);
    assertEquals(badSchemaFqn, insertedSchema.getFullyQualifiedName());
    assertFalse(
        insertedSchema.getFullyQualifiedName().contains("\""),
        "Bad FQN should NOT contain quotes: " + insertedSchema.getFullyQualifiedName());

    Table insertedTable = collectionDAO.tableDAO().findEntityById(tableId);
    assertEquals(badTableFqn, insertedTable.getFullyQualifiedName());
    assertFalse(
        insertedTable.getFullyQualifiedName().contains("\""),
        "Bad FQN should NOT contain quotes: " + insertedTable.getFullyQualifiedName());
  }

  @Test
  @Order(2)
  void testMigrationFixesBadFqns() {
    // Run the migration to fix the bad FQNs
    try (Handle handle = jdbi.open()) {
      // Fix in order: Database -> Schema -> Table (parent before child)
      MigrationUtil.fixDatabaseFqnHash(handle, collectionDAO);
      MigrationUtil.fixDatabaseSchemaFqnHash(handle, collectionDAO);
      MigrationUtil.fixTableFqnHash(handle, collectionDAO);
    }

    // Verify FQNs are now correct (with quotes)
    Database fixedDatabase = collectionDAO.databaseDAO().findEntityById(databaseId);
    assertEquals(
        expectedDatabaseFqn, fixedDatabase.getFullyQualifiedName(), "Database FQN should be fixed");
    assertTrue(
        fixedDatabase.getFullyQualifiedName().contains("\""),
        "Fixed Database FQN should contain quotes: " + fixedDatabase.getFullyQualifiedName());

    DatabaseSchema fixedSchema = collectionDAO.databaseSchemaDAO().findEntityById(schemaId);
    assertEquals(
        expectedSchemaFqn, fixedSchema.getFullyQualifiedName(), "Schema FQN should be fixed");
    assertTrue(
        fixedSchema.getFullyQualifiedName().contains("\""),
        "Fixed Schema FQN should contain quotes: " + fixedSchema.getFullyQualifiedName());

    Table fixedTable = collectionDAO.tableDAO().findEntityById(tableId);
    assertEquals(expectedTableFqn, fixedTable.getFullyQualifiedName(), "Table FQN should be fixed");
    assertTrue(
        fixedTable.getFullyQualifiedName().contains("\""),
        "Fixed Table FQN should contain quotes: " + fixedTable.getFullyQualifiedName());

    // Also verify column FQN was fixed
    assertEquals(
        expectedTableFqn + ".id",
        fixedTable.getColumns().get(0).getFullyQualifiedName(),
        "Column FQN should be fixed");
  }

  @Test
  @Order(3)
  void testMigrationIsIdempotent() {
    // Get current FQNs after first migration
    Database beforeDatabase = collectionDAO.databaseDAO().findEntityById(databaseId);
    DatabaseSchema beforeSchema = collectionDAO.databaseSchemaDAO().findEntityById(schemaId);
    Table beforeTable = collectionDAO.tableDAO().findEntityById(tableId);

    // Run migration again - should not change anything
    try (Handle handle = jdbi.open()) {
      MigrationUtil.fixDatabaseFqnHash(handle, collectionDAO);
      MigrationUtil.fixDatabaseSchemaFqnHash(handle, collectionDAO);
      MigrationUtil.fixTableFqnHash(handle, collectionDAO);
    }

    // Verify FQNs haven't changed
    Database afterDatabase = collectionDAO.databaseDAO().findEntityById(databaseId);
    DatabaseSchema afterSchema = collectionDAO.databaseSchemaDAO().findEntityById(schemaId);
    Table afterTable = collectionDAO.tableDAO().findEntityById(tableId);

    assertEquals(
        beforeDatabase.getFullyQualifiedName(),
        afterDatabase.getFullyQualifiedName(),
        "Database FQN should not change on re-run");
    assertEquals(
        beforeSchema.getFullyQualifiedName(),
        afterSchema.getFullyQualifiedName(),
        "Schema FQN should not change on re-run");
    assertEquals(
        beforeTable.getFullyQualifiedName(),
        afterTable.getFullyQualifiedName(),
        "Table FQN should not change on re-run");
  }

  @Test
  @Order(4)
  void testMigrationSkipsServicesWithoutDots() throws IOException {
    // Create a service without dots in its name
    String normalServiceName = "normalservice" + UUID.randomUUID().toString().substring(0, 8);
    CreateDatabaseService createService =
        new CreateDatabaseService()
            .withName(normalServiceName)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(TestUtils.MYSQL_DATABASE_CONNECTION);

    DatabaseService normalService =
        TestUtils.post(
            getResource("services/databaseServices"),
            createService,
            DatabaseService.class,
            ADMIN_AUTH_HEADERS);

    // Create a database under this normal service (using API, which has fixed code)
    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("normaldb" + UUID.randomUUID().toString().substring(0, 8))
            .withService(normalService.getFullyQualifiedName());
    Database normalDatabase =
        TestUtils.post(
            getResource("databases"), createDatabase, Database.class, ADMIN_AUTH_HEADERS);

    String originalFqn = normalDatabase.getFullyQualifiedName();

    // Run migration
    try (Handle handle = jdbi.open()) {
      MigrationUtil.fixDatabaseFqnHash(handle, collectionDAO);
    }

    // Verify FQN hasn't changed (no dots in service name, so migration skips it)
    Database afterMigration = collectionDAO.databaseDAO().findEntityById(normalDatabase.getId());
    assertEquals(
        originalFqn,
        afterMigration.getFullyQualifiedName(),
        "Database under service without dots should not be modified");
  }
}
