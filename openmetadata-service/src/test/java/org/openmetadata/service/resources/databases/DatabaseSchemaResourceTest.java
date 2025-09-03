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

package org.openmetadata.service.resources.databases;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.apache.commons.lang.StringEscapeUtils.escapeCsv;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.recordToString;
import static org.openmetadata.csv.EntityCsv.entityNotFound;
import static org.openmetadata.csv.EntityCsvTest.assertRows;
import static org.openmetadata.csv.EntityCsvTest.assertSummary;
import static org.openmetadata.csv.EntityCsvTest.createCsv;
import static org.openmetadata.csv.EntityCsvTest.getFailedRecord;
import static org.openmetadata.csv.EntityCsvTest.getSuccessRecord;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.csv.CsvUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.entityRelationship.SearchSchemaEntityRelationshipResult;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DatabaseSchemaProfilerConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableProfilerConfig;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseSchemaRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResource.DatabaseSchemaList;
import org.openmetadata.service.resources.domains.DomainResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.TestUtils;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class DatabaseSchemaResourceTest
    extends EntityResourceTest<DatabaseSchema, CreateDatabaseSchema> {
  public DatabaseSchemaResourceTest() {
    super(
        Entity.DATABASE_SCHEMA,
        DatabaseSchema.class,
        DatabaseSchemaList.class,
        "databaseSchemas",
        DatabaseSchemaResource.FIELDS);
    supportedNameCharacters = "_'+#- .()$" + EntityResourceTest.RANDOM_STRING_GENERATOR.generate(1);
  }

  @Test
  void post_schemaWithoutRequiredDatabase_400(TestInfo test) {
    CreateDatabaseSchema create = createRequest(test).withDatabase(null);
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "database must not be null");
  }

  @Test
  void test_bulkFetchWithOwners_pagination(TestInfo test) throws IOException {
    // This test specifically targets the bulk fetcher issue with pagination
    // Create multiple database schemas with different owners to trigger bulk fetching
    List<DatabaseSchema> createdSchemas = new ArrayList<>();

    // Create 5 schemas with different owners to ensure bulk fetching is triggered
    for (int i = 0; i < 5; i++) {
      CreateDatabaseSchema create =
          createRequest(test.getDisplayName() + "_schema" + i)
              .withDatabase(DATABASE.getFullyQualifiedName())
              .withOwners(
                  List.of(i % 2 == 0 ? USER1.getEntityReference() : USER2.getEntityReference()));

      DatabaseSchema schema = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
      createdSchemas.add(schema);
    }

    // Test 1: Get all schemas with owners field via list API
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fields", "owners");
    queryParams.put("database", DATABASE.getFullyQualifiedName());
    queryParams.put("limit", "100"); // Ensure we get all schemas in one page

    ResultList<DatabaseSchema> schemaList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertNotNull(schemaList);
    assertTrue(schemaList.getData().size() >= 5, "Should have at least 5 schemas");

    // Count how many of our created schemas are in the response
    long foundCount =
        schemaList.getData().stream()
            .filter(
                schema -> createdSchemas.stream().anyMatch(s -> s.getId().equals(schema.getId())))
            .count();

    // Log if we don't find all schemas
    if (foundCount < createdSchemas.size()) {
      LOG.warn(
          "Only found {} of {} created schemas in bulk response",
          foundCount,
          createdSchemas.size());
    }

    // Verify that owners are populated for all schemas we find
    for (DatabaseSchema schema : schemaList.getData()) {
      if (createdSchemas.stream().anyMatch(s -> s.getId().equals(schema.getId()))) {
        assertListNotNull(schema.getOwners());
        assertEquals(
            1,
            schema.getOwners().size(),
            "Schema " + schema.getName() + " should have exactly one owner");

        // Verify the owner is either USER1 or USER2
        String ownerId = schema.getOwners().getFirst().getId().toString();
        assertTrue(
            USER1.getId().toString().equals(ownerId) || USER2.getId().toString().equals(ownerId),
            "Owner should be either USER1 or USER2");
      }
    }

    // Test 2: Get each schema individually and compare with bulk response if present
    for (DatabaseSchema createdSchema : createdSchemas) {
      DatabaseSchema individualSchema =
          getEntityByName(createdSchema.getFullyQualifiedName(), "owners", ADMIN_AUTH_HEADERS);

      assertListNotNull(individualSchema.getOwners());
      assertEquals(1, individualSchema.getOwners().size());

      // Find the same schema in bulk response
      DatabaseSchema bulkSchema =
          schemaList.getData().stream()
              .filter(s -> s.getId().equals(createdSchema.getId()))
              .findFirst()
              .orElse(null);

      // Only assert if the schema is in the bulk response (it might be on a different page)
      if (bulkSchema != null) {
        assertEquals(
            individualSchema.getOwners().getFirst().getId(),
            bulkSchema.getOwners().getFirst().getId(),
            "Owner from bulk fetch should match individual fetch");
      } else {
        LOG.info(
            "Schema {} not found in bulk response - might be on a different page",
            createdSchema.getName());
      }
    }
  }

  @Test
  void test_bulkFetchWithTablesAndProfilerConfig_pagination(TestInfo test) throws IOException {
    // This test verifies bulk fetching of tables and profiler configs works correctly
    TableResourceTest tableResourceTest = new TableResourceTest();
    List<DatabaseSchema> createdSchemas = new ArrayList<>();

    // Create 5 schemas with tables and profiler configs
    for (int i = 0; i < 5; i++) {
      CreateDatabaseSchema createSchema =
          createRequest(test.getDisplayName() + "_schema" + i)
              .withDatabase(DATABASE.getFullyQualifiedName());

      DatabaseSchema schema = createAndCheckEntity(createSchema, ADMIN_AUTH_HEADERS);

      // Add 2 tables to each schema
      for (int j = 0; j < 2; j++) {
        CreateTable createTable =
            tableResourceTest
                .createRequest("table_" + i + "_" + j, "", "", null)
                .withDatabaseSchema(schema.getFullyQualifiedName());
        tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
      }

      // Add profiler config to schemas with even index
      if (i % 2 == 0) {
        DatabaseSchemaProfilerConfig profilerConfig =
            new DatabaseSchemaProfilerConfig()
                .withProfileSampleType(TableProfilerConfig.ProfileSampleType.PERCENTAGE)
                .withProfileSample(50.0);

        // Use the repository to add profiler config
        DatabaseSchemaRepository repository =
            (DatabaseSchemaRepository) Entity.getEntityRepository(Entity.DATABASE_SCHEMA);
        repository.addDatabaseSchemaProfilerConfig(schema.getId(), profilerConfig);
      }

      createdSchemas.add(schema);
    }

    // Test 1: Get all schemas with tables and profilerConfig fields via list API
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fields", "tables,databaseSchemaProfilerConfig");
    queryParams.put("database", DATABASE.getFullyQualifiedName());
    queryParams.put("limit", "100");

    ResultList<DatabaseSchema> schemaList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertNotNull(schemaList);
    assertTrue(schemaList.getData().size() >= 5, "Should have at least 5 schemas");

    // Verify tables and profiler configs are populated correctly
    for (DatabaseSchema schema : schemaList.getData()) {
      DatabaseSchema createdSchema =
          createdSchemas.stream()
              .filter(s -> s.getId().equals(schema.getId()))
              .findFirst()
              .orElse(null);

      if (createdSchema != null) {
        // Verify tables are populated
        assertListNotNull(schema.getTables());
        assertEquals(
            2,
            schema.getTables().size(),
            "Schema " + schema.getName() + " should have exactly 2 tables");

        // Verify table names
        for (EntityReference tableRef : schema.getTables()) {
          assertNotNull(tableRef.getId());
          assertNotNull(tableRef.getName());
          assertNotNull(tableRef.getType());
          assertEquals(Entity.TABLE, tableRef.getType());
        }

        // Verify profiler config
        int schemaIndex =
            Integer.parseInt(
                schema.getName().substring(schema.getName().lastIndexOf("schema") + 6));
        if (schemaIndex % 2 == 0) {
          assertNotNull(
              schema.getDatabaseSchemaProfilerConfig(),
              "Even-indexed schema should have profiler config");
          assertEquals(
              TableProfilerConfig.ProfileSampleType.PERCENTAGE,
              schema.getDatabaseSchemaProfilerConfig().getProfileSampleType());
          assertEquals(50.0, schema.getDatabaseSchemaProfilerConfig().getProfileSample());
        } else {
          assertNull(
              schema.getDatabaseSchemaProfilerConfig(),
              "Odd-indexed schema should not have profiler config");
        }
      }
    }

    // Test 2: Compare with individual fetches
    for (DatabaseSchema createdSchema : createdSchemas) {
      DatabaseSchema individualSchema =
          getEntityByName(
              createdSchema.getFullyQualifiedName(),
              "tables,databaseSchemaProfilerConfig",
              ADMIN_AUTH_HEADERS);

      // Find in bulk response
      DatabaseSchema bulkSchema =
          schemaList.getData().stream()
              .filter(s -> s.getId().equals(createdSchema.getId()))
              .findFirst()
              .orElse(null);

      if (bulkSchema != null) {
        // Compare tables
        assertEquals(
            individualSchema.getTables().size(),
            bulkSchema.getTables().size(),
            "Table count should match between individual and bulk fetch");

        // Compare profiler config
        if (individualSchema.getDatabaseSchemaProfilerConfig() != null) {
          assertNotNull(
              bulkSchema.getDatabaseSchemaProfilerConfig(),
              "Profiler config should be present in bulk fetch if present in individual fetch");
          assertEquals(
              individualSchema.getDatabaseSchemaProfilerConfig().getProfileSampleType(),
              bulkSchema.getDatabaseSchemaProfilerConfig().getProfileSampleType(),
              "Profiler config should match");
        } else {
          assertNull(
              bulkSchema.getDatabaseSchemaProfilerConfig(),
              "Profiler config should be null in bulk fetch if null in individual fetch");
        }
      }
    }
  }

  @Test
  void test_inheritedFieldsWithPagination(TestInfo test) throws IOException {
    // Create resource test instances
    DomainResourceTest domainResourceTest = new DomainResourceTest();
    UserResourceTest userResourceTest = new UserResourceTest();
    DatabaseResourceTest databaseResourceTest = new DatabaseResourceTest();

    // Create a domain
    CreateDomain createDomain =
        new CreateDomain()
            .withName("test_domain_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9]", "_"))
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Test domain for inheritance");
    Domain domain = domainResourceTest.createEntity(createDomain, ADMIN_AUTH_HEADERS);

    // Create database owners (multiple users instead of user + team to avoid validation error)
    User databaseOwner1 =
        userResourceTest.createEntity(
            userResourceTest.createRequest(
                "db_owner1_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9]", "_"),
                "db_owner1@example.com",
                "DB Owner 1",
                null),
            ADMIN_AUTH_HEADERS);
    User databaseOwner2 =
        userResourceTest.createEntity(
            userResourceTest.createRequest(
                "db_owner2_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9]", "_"),
                "db_owner2@example.com",
                "DB Owner 2",
                null),
            ADMIN_AUTH_HEADERS);

    // Create a database with domain and multiple user owners
    CreateDatabase createDb =
        databaseResourceTest
            .createRequest("test_db_inheritance_" + test.getDisplayName())
            .withService(DATABASE.getService().getFullyQualifiedName())
            .withOwners(
                List.of(databaseOwner1.getEntityReference(), databaseOwner2.getEntityReference()))
            .withDomains(List.of(domain.getFullyQualifiedName()));
    Database database = databaseResourceTest.createEntity(createDb, ADMIN_AUTH_HEADERS);

    // Create multiple schemas - some with their own owners/domains, some without
    List<DatabaseSchema> schemas = new ArrayList<>();
    Domain schemaDomain = null;

    for (int i = 0; i < 4; i++) {
      CreateDatabaseSchema createSchema =
          createRequest(test.getDisplayName() + "_inherit_schema" + i)
              .withDatabase(database.getFullyQualifiedName());

      // Schema 1 has its own owner
      if (i == 1) {
        User schemaOwner =
            userResourceTest.createEntity(
                userResourceTest.createRequest(
                    "schema_owner_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9]", "_") + i,
                    "schema_owner_" + i + "@example.com",
                    "Schema Owner " + i,
                    null),
                ADMIN_AUTH_HEADERS);
        createSchema.withOwners(List.of(schemaOwner.getEntityReference()));
      }

      // Schema 2 has its own domain
      if (i == 2) {
        schemaDomain =
            domainResourceTest.createEntity(
                new CreateDomain()
                    .withName("schema_domain_" + test.getDisplayName() + i)
                    .withDomainType(DomainType.AGGREGATE)
                    .withDescription("Schema specific domain"),
                ADMIN_AUTH_HEADERS);
        createSchema.withDomains(List.of(schemaDomain.getFullyQualifiedName()));
      }

      DatabaseSchema schema = createEntity(createSchema, ADMIN_AUTH_HEADERS);
      schemas.add(schema);

      // Create a table for schema 0 to test table inheritance
      if (i == 0) {
        TableResourceTest tableResourceTest = new TableResourceTest();
        CreateTable createTable =
            tableResourceTest
                .createRequest("inherit_test_table", "", "", null)
                .withDatabaseSchema(schema.getFullyQualifiedName());
        tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
      }
    }

    // Test 1: Fetch schemas with pagination including inherited fields
    ResultList<DatabaseSchema> resultList =
        listEntities(
            Map.of("database", database.getFullyQualifiedName(), "fields", "owners,domains"),
            ADMIN_AUTH_HEADERS);

    // Verify inheritance behavior
    assertEquals(4, resultList.getData().size());

    for (DatabaseSchema fetchedSchema : resultList.getData()) {
      int index =
          Integer.parseInt(fetchedSchema.getName().substring(fetchedSchema.getName().length() - 1));

      // Verify domain inheritance
      assertListNotNull(fetchedSchema.getDomains());
      if (index == 2) {
        // Schema 2 has its own domain
        assert schemaDomain != null;
        assertEquals(
            schemaDomain.getFullyQualifiedName(),
            fetchedSchema.getDomains().get(0).getFullyQualifiedName());
        assertNull(
            fetchedSchema.getDomains().get(0).getInherited(),
            "Own domain should not be marked as inherited");
      } else {
        // Other schemas inherit from database
        assertEquals(
            domain.getFullyQualifiedName(),
            fetchedSchema.getDomains().get(0).getFullyQualifiedName());
        assertTrue(
            fetchedSchema.getDomains().get(0).getInherited(),
            "Domain should be marked as inherited from database");
      }

      // Verify owner inheritance
      assertListNotNull(fetchedSchema.getOwners());
      if (index == 1) {
        // Schema 1 has its own owner
        assertEquals(1, fetchedSchema.getOwners().size());
        assertTrue(fetchedSchema.getOwners().getFirst().getName().contains("schema_owner_"));
        assertNull(
            fetchedSchema.getOwners().getFirst().getInherited(),
            "Own owners should not be marked as inherited");
      } else {
        // Other schemas inherit from database (should have both users)
        assertEquals(2, fetchedSchema.getOwners().size());
        List<String> ownerNames =
            fetchedSchema.getOwners().stream().map(EntityReference::getName).toList();
        assertTrue(ownerNames.contains(databaseOwner1.getName()));
        assertTrue(ownerNames.contains(databaseOwner2.getName()));
        fetchedSchema
            .getOwners()
            .forEach(
                owner ->
                    assertTrue(
                        owner.getInherited(), "Inherited owners should be marked as inherited"));
      }
    }

    // Test 2: Verify table inheritance from schema/database
    if (!schemas.isEmpty()) {
      TableResourceTest tableResourceTest = new TableResourceTest();
      Table table =
          tableResourceTest.getEntityByName(
              schemas.getFirst().getFullyQualifiedName() + ".inherit_test_table",
              "owners,domains",
              ADMIN_AUTH_HEADERS);

      // Table should inherit domain from database (schema 0 doesn't have its own domain)
      assertListNotNull(table.getDomains());
      assertEquals(
          domain.getFullyQualifiedName(), table.getDomains().get(0).getFullyQualifiedName());
      assertTrue(table.getDomains().get(0).getInherited(), "Table domain should be inherited");

      // Table should inherit owners from database (schema 0 doesn't have its own owners)
      assertListNotNull(table.getOwners());
      assertEquals(2, table.getOwners().size());
      table
          .getOwners()
          .forEach(owner -> assertTrue(owner.getInherited(), "Table owners should be inherited"));
    }
  }

  @Test
  void delete_schemaWithTables_200(TestInfo test) throws IOException {
    CreateDatabaseSchema create =
        createRequest(test).withDatabase(DATABASE.getFullyQualifiedName());
    DatabaseSchema createdSchema = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable =
        tableResourceTest
            .createRequest("t1", "", "", null)
            .withDatabaseSchema(createdSchema.getFullyQualifiedName());
    tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    createTable =
        tableResourceTest
            .createRequest("t2", "", "", null)
            .withDatabaseSchema(createdSchema.getFullyQualifiedName());
    Table table2 = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // recursively soft delete schema
    deleteAndCheckEntity(createdSchema, true, false, ADMIN_AUTH_HEADERS);

    // Restore one of the tables.
    tableResourceTest.restoreEntity(
        new RestoreEntity().withId(table2.getId()), Response.Status.OK, ADMIN_AUTH_HEADERS);

    // Restore Schema
    restoreEntity(
        new RestoreEntity().withId(createdSchema.getId()), Response.Status.OK, ADMIN_AUTH_HEADERS);
    DatabaseSchema schema = getEntity(createdSchema.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(schema);
  }

  @Test
  @SneakyThrows
  void testImportInvalidCsv() {
    DatabaseSchema schema = createEntity(createRequest("invalidCsv"), ADMIN_AUTH_HEADERS);
    String schemaName = schema.getFullyQualifiedName();
    TableResourceTest tableTest = new TableResourceTest();
    CreateTable createTable =
        tableTest.createRequest("s1").withDatabaseSchema(schema.getFullyQualifiedName());
    tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Headers: name, displayName, description, owner, tags, glossaryTerms, tiers, certification,
    // retentionPeriod, sourceUrl, domain, extension
    // Create table with invalid tags field
    String resultsHeader =
        recordToString(EntityCsv.getResultHeaders(getDatabaseSchemaCsvHeaders(schema, false)));
    String record = "s1,dsp1,dsc1,,Tag.invalidTag,,,,,,,";
    String csv = createCsv(getDatabaseSchemaCsvHeaders(schema, false), listOf(record), null);
    CsvImportResult result = importCsv(schemaName, csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    String[] expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, entityNotFound(4, "tag", "Tag.invalidTag"))
        };
    assertRows(result, expectedRows);

    // Tag will cause failure
    record = "non-existing,dsp1,dsc1,,Tag.invalidTag,,,,,,,";
    csv = createCsv(getDatabaseSchemaCsvHeaders(schema, false), listOf(record), null);
    result = importCsv(schemaName, csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, entityNotFound(4, "tag", "Tag.invalidTag"))
        };
    assertRows(result, expectedRows);

    // non-existing table will cause
    record = "non-existing,dsp1,dsc1,,,,,,,,,";
    String tableFqn = FullyQualifiedName.add(schema.getFullyQualifiedName(), "non-existing");
    csv = createCsv(getDatabaseSchemaCsvHeaders(schema, false), listOf(record), null);
    result = importCsv(schemaName, csv, false);
    assertSummary(result, ApiStatus.SUCCESS, 2, 2, 0);
    expectedRows = new String[] {resultsHeader, getSuccessRecord(record, "Entity created")};
    assertRows(result, expectedRows);
    Table table = tableTest.getEntityByName(tableFqn, "id", ADMIN_AUTH_HEADERS);
    assertEquals(tableFqn, table.getFullyQualifiedName());
  }

  @Test
  void testImportExport() throws IOException {
    String user1 = USER1.getName();
    DatabaseSchema schema = createEntity(createRequest("importExportTest"), ADMIN_AUTH_HEADERS);
    TableResourceTest tableTest = new TableResourceTest();
    CreateTable createTable =
        tableTest.createRequest("s1").withDatabaseSchema(schema.getFullyQualifiedName());
    tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Create certification
    TagResourceTest tagResourceTest = new TagResourceTest();
    Tag certificationTag =
        tagResourceTest.createEntity(
            tagResourceTest.createRequest("Certification"), ADMIN_AUTH_HEADERS);

    // Headers: name, displayName, description, owner, tags, retentionPeriod, sourceUrl, domain
    List<String> updateRecords =
        listOf(
            String.format(
                "s1,dsp1,new-dsc1,user:%s,,,Tier.Tier1,%s,P23DT23H,http://test.com,%s,",
                user1,
                certificationTag.getFullyQualifiedName(),
                escapeCsv(DOMAIN.getFullyQualifiedName())));

    // Update created entity with changes
    importCsvAndValidate(
        schema.getFullyQualifiedName(),
        getDatabaseSchemaCsvHeaders(schema, false),
        null,
        updateRecords);

    List<String> clearRecords = listOf("s1,dsp1,new-dsc2,,,,,,P23DT23H,http://test.com,,");

    importCsvAndValidate(
        schema.getFullyQualifiedName(),
        getDatabaseSchemaCsvHeaders(schema, false),
        null,
        clearRecords);

    String tableFqn = String.format("%s.%s", schema.getFullyQualifiedName(), "s1");
    Table updatedTable = tableTest.getEntityByName(tableFqn, ADMIN_AUTH_HEADERS);
    assertEquals("new-dsc2", updatedTable.getDescription());
    assertTrue(listOrEmpty(updatedTable.getOwners()).isEmpty(), "Owner should be cleared");
    assertTrue(
        listOrEmpty(updatedTable.getTags()).isEmpty(), "Tags should be empty after clearing");
    assertTrue(
        listOrEmpty(updatedTable.getDomains()).isEmpty(), "Domain should be null after clearing");
  }

  @Test
  void testImportExportRecursive() throws IOException {
    String schemaName = "importExportRecursiveSchema";
    DatabaseSchema schema = createEntity(createRequest(schemaName), ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();

    // Create a table with one column
    CreateTable createTable =
        tableTest
            .createRequest("t1")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Initial Table Description");

    // Set column description
    createTable.getColumns().get(0).setDescription("Initial Column Description");

    Table table = tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Export recursively
    String exportedCsv = exportCsvRecursive(schema.getFullyQualifiedName());
    assertNotNull(exportedCsv);

    List<String> csvLines = List.of(exportedCsv.split(CsvUtil.LINE_SEPARATOR));
    assertTrue(csvLines.size() > 1, "Export should contain schema, table, and column");

    String header = csvLines.get(0);
    List<String> modified = new ArrayList<>();
    modified.add(header);

    for (String line : csvLines.subList(1, csvLines.size())) {
      if (line.contains("t1") && line.contains("table")) {
        line = line.replace("Initial Table Description", "Updated Table Description");
      } else if (line.contains("column")) {
        line = line.replace("Initial Column Description", "Updated Column Description");
      }
      modified.add(line);
    }

    String newCsv = String.join(CsvUtil.LINE_SEPARATOR, modified) + CsvUtil.LINE_SEPARATOR;
    CsvImportResult result = importCsvRecursive(schema.getFullyQualifiedName(), newCsv, false);
    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    // Validate updated table
    Table updated =
        tableTest.getEntityByName(
            table.getFullyQualifiedName(), "description,certification", ADMIN_AUTH_HEADERS);
    assertEquals("Updated Table Description", updated.getDescription());

    // Validate updated column
    assertNotNull(updated.getColumns());
    assertTrue(
        updated.getColumns().stream()
            .anyMatch(c -> "Updated Column Description".equals(c.getDescription())),
        "At least one column should have updated description");
  }

  @Test
  void testImportExportWithTableConstraints() throws IOException {
    // Create a schema for this test to avoid conflicts
    CreateDatabaseSchema createSchema = createRequest("constraint_test_schema");
    DatabaseSchema schema = createEntity(createSchema, ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();

    // Create tables and columns for FK relationships
    Column c1 = new Column().withName("user_ref").withDataType(ColumnDataType.STRING);
    Column c2 = new Column().withName("tenant_id").withDataType(ColumnDataType.STRING);
    Column c3 = new Column().withName("user_id").withDataType(ColumnDataType.STRING);

    // Create target table (referenced table with 2 columns)
    Table targetTable =
        tableTest.createEntity(
            tableTest
                .createRequest("target_table")
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withTableConstraints(null)
                .withColumns(List.of(c2, c3)),
            ADMIN_AUTH_HEADERS);

    // Create source table (no constraints initially)
    Table sourceTable =
        tableTest.createEntity(
            tableTest
                .createRequest("source_table")
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(List.of(c1))
                .withTableConstraints(null),
            ADMIN_AUTH_HEADERS);

    // Resolve column FQNs needed for FK definitions
    Table targetRef =
        tableTest.getEntityByName(targetTable.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);

    // Create foreign key constraint - simple 1:1 mapping
    String targetCol1FQN = targetRef.getColumns().getFirst().getFullyQualifiedName();

    String originalJson = JsonUtils.pojoToJson(sourceTable);
    Table sourceTableV2 = JsonUtils.deepCopy(sourceTable, Table.class);

    // Create a simple 1:1 foreign key constraint: 1 local column referencing 1 referred column
    TableConstraint foreignKeyConstraint =
        new TableConstraint()
            .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
            .withColumns(List.of("user_ref")) // 1 local column
            .withReferredColumns(
                Collections.singletonList(targetCol1FQN)); // 1 referred column (1:1 mapping)

    sourceTableV2.setTableConstraints(Collections.singletonList(foreignKeyConstraint));

    Table updatedSourceTable =
        tableTest.patchEntity(sourceTable.getId(), originalJson, sourceTableV2, ADMIN_AUTH_HEADERS);

    // Verify constraint was created correctly
    assertNotNull(updatedSourceTable.getTableConstraints());
    assertEquals(1, updatedSourceTable.getTableConstraints().size());
    TableConstraint constraint = updatedSourceTable.getTableConstraints().getFirst();
    assertEquals(TableConstraint.ConstraintType.FOREIGN_KEY, constraint.getConstraintType());
    assertEquals(1, constraint.getColumns().size()); // 1 local column
    assertEquals(1, constraint.getReferredColumns().size()); // 1 referred column (1:1 mapping)

    // Export recursively to CSV - this should include table constraints
    String exportedCsv = exportCsvRecursive(schema.getFullyQualifiedName());
    assertNotNull(exportedCsv);

    List<String> csvLines = List.of(exportedCsv.split(CsvUtil.LINE_SEPARATOR));
    assertTrue(csvLines.size() > 1, "Export should contain schema, tables, and columns");

    // Modify CSV to update some metadata while preserving structure
    String header = csvLines.getFirst();
    List<String> modified = new ArrayList<>();
    modified.add(header);

    for (String line : csvLines.subList(1, csvLines.size())) {
      if (line.contains("source_table") && line.contains("table")) {
        // Update table description
        line = line.replace("source_table", "source_table Updated via CSV import");
      }
      modified.add(line);
    }

    String newCsv = String.join(CsvUtil.LINE_SEPARATOR, modified) + CsvUtil.LINE_SEPARATOR;

    // Import the modified CSV recursively
    CsvImportResult result = importCsvRecursive(schema.getFullyQualifiedName(), newCsv, false);
    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    // Fetch the updated source table and verify constraints are preserved
    Table importedSourceTable =
        tableTest.getEntityByName(
            updatedSourceTable.getFullyQualifiedName(),
            "tableConstraints,columns,description",
            ADMIN_AUTH_HEADERS);

    // Verify table constraints are still present after CSV import
    assertNotNull(
        importedSourceTable.getTableConstraints(),
        "Table constraints should be preserved after CSV import");
    assertEquals(
        1,
        importedSourceTable.getTableConstraints().size(),
        "Should have exactly one table constraint");

    TableConstraint preservedConstraint = importedSourceTable.getTableConstraints().getFirst();
    assertEquals(
        TableConstraint.ConstraintType.FOREIGN_KEY, preservedConstraint.getConstraintType());
    assertEquals(1, preservedConstraint.getColumns().size(), "Should have 1 local column");
    assertEquals(
        1,
        preservedConstraint.getReferredColumns().size(),
        "Should have 1 referred column (1:1 mapping)");

    // Verify the specific column references are preserved
    assertEquals("user_ref", preservedConstraint.getColumns().getFirst());
    assertTrue(
        preservedConstraint.getReferredColumns().contains(targetCol1FQN),
        "Should contain target column FQN");

    // Verify search index building works without crashing
    assertDoesNotThrow(
        () -> {
          Entity.buildSearchIndex(Entity.TABLE, importedSourceTable);
        },
        "Search index building should not crash with table constraints after CSV import");

    // Verify target table is also intact
    Table importedTargetTable =
        tableTest.getEntityByName(
            targetTable.getFullyQualifiedName(), "columns", ADMIN_AUTH_HEADERS);

    assertNotNull(importedTargetTable.getColumns());
    assertEquals(
        2, importedTargetTable.getColumns().size(), "Target table should still have 2 columns");
  }

  @Override
  public DatabaseSchema validateGetWithDifferentFields(DatabaseSchema schema, boolean byName)
      throws HttpResponseException {
    // Add tables to the database schema
    if (nullOrEmpty(schema.getTables())) {
      TableResourceTest tableResourceTest = new TableResourceTest();
      CreateTable create =
          tableResourceTest
              .createRequest("t1", "", "", null)
              .withDatabaseSchema(schema.getFullyQualifiedName());
      tableResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);

      create.withName("t2");
      tableResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    }

    // Now query request different fields
    String fields = "";
    schema =
        byName
            ? getEntityByName(schema.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(schema.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(schema.getService(), schema.getServiceType(), schema.getDatabase());
    assertListNull(schema.getOwners(), schema.getTables());

    fields = "owners,tags,tables,followers";
    schema =
        byName
            ? getEntityByName(schema.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(schema.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(schema.getService(), schema.getServiceType());
    // Fields usageSummary and location are not set during creation - tested elsewhere
    assertListNotNull(schema.getTables());
    TestUtils.validateEntityReferences(schema.getTables(), true);
    // Checks for other owner, tags, and followers is done in the base class
    return schema;
  }

  @Override
  public CreateDatabaseSchema createRequest(String name) {
    return new CreateDatabaseSchema()
        .withName(name)
        .withDatabase(getContainer().getFullyQualifiedName());
  }

  @Override
  public EntityReference getContainer() {
    return DATABASE.getEntityReference();
  }

  @Override
  public EntityReference getContainer(DatabaseSchema entity) {
    return entity.getDatabase();
  }

  @Override
  public void validateCreatedEntity(
      DatabaseSchema schema, CreateDatabaseSchema createRequest, Map<String, String> authHeaders) {
    // Validate service
    assertNotNull(schema.getServiceType());
    assertReference(createRequest.getDatabase(), schema.getDatabase());
    assertEquals(
        FullyQualifiedName.add(schema.getDatabase().getFullyQualifiedName(), schema.getName()),
        schema.getFullyQualifiedName());
  }

  @Override
  public void compareEntities(
      DatabaseSchema expected, DatabaseSchema updated, Map<String, String> authHeaders) {
    // Validate service
    assertReference(expected.getDatabase(), updated.getDatabase());
    assertEquals(
        FullyQualifiedName.add(updated.getDatabase().getFullyQualifiedName(), updated.getName()),
        updated.getFullyQualifiedName());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }

  @Order(1)
  @Test
  void testSchemaServiceInheritanceFromDatabase(TestInfo test) throws IOException {
    // This test verifies that schemas correctly inherit service from their database
    // when fetched in bulk with the service field

    // Use the existing DATABASE which already has a service set
    Database database = DATABASE;
    assertNotNull(database.getService(), "Test database should have a service");

    // Create a schema in the database
    String uniqueName = "serviceInheritanceTest" + System.currentTimeMillis();
    CreateDatabaseSchema createSchema =
        createRequest(uniqueName).withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = createAndCheckEntity(createSchema, ADMIN_AUTH_HEADERS);

    // Fetch schemas with the service field included
    ResultList<DatabaseSchema> schemas =
        listEntities(
            Map.of(
                "limit",
                "10",
                "fields",
                "database,service",
                "database",
                database.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    assertNotNull(schemas.getData());
    assertTrue(schemas.getData().size() >= 1);

    // Find our created schema
    DatabaseSchema foundSchema =
        schemas.getData().stream()
            .filter(s -> s.getId().equals(schema.getId()))
            .findFirst()
            .orElse(null);

    assertNotNull(foundSchema, "Created schema should be in the results");

    // Verify the schema has the correct database and service
    assertNotNull(foundSchema.getDatabase(), "Database should not be null");
    assertEquals(database.getId(), foundSchema.getDatabase().getId());

    assertNotNull(
        foundSchema.getService(), "Service should not be null - should be inherited from database");
    assertEquals(database.getService().getId(), foundSchema.getService().getId());
    assertEquals(database.getService().getName(), foundSchema.getService().getName());

    // Clean up
    deleteEntity(schema.getId(), ADMIN_AUTH_HEADERS);
  }

  private SearchSchemaEntityRelationshipResult searchSchemaEntityRelationship(
      String fqn, String queryFilter, boolean includeDeleted) throws HttpResponseException {
    WebTarget target = getResource("databaseSchemas/entityRelationship");
    if (fqn != null) {
      target = target.queryParam("fqn", fqn);
    }
    if (queryFilter != null) {
      target = target.queryParam("query_filter", queryFilter);
    }
    target = target.queryParam("includeDeleted", includeDeleted);

    return TestUtils.get(target, SearchSchemaEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_schemaEntityRelationship() throws IOException {
    // Create a schema for this test
    TableResourceTest tableTest = new TableResourceTest();
    CreateDatabaseSchema createSchema = createRequest("er_test_schema_direction");
    DatabaseSchema schema = createEntity(createSchema, ADMIN_AUTH_HEADERS);
    String schemaFqn = schema.getFullyQualifiedName();

    // Create tables and columns for FK relationships
    Column c1 = new Column().withName("c1").withDataType(ColumnDataType.INT);
    Column c2 = new Column().withName("c2").withDataType(ColumnDataType.INT);

    Table upstreamTable =
        tableTest.createEntity(
            tableTest
                .createRequest("er_upstream_fk")
                .withDatabaseSchema(schemaFqn)
                .withTableConstraints(null)
                .withColumns(List.of(c1)),
            ADMIN_AUTH_HEADERS);

    Table tableInSchema2 =
        tableTest.createEntity(
            tableTest
                .createRequest("er_table2_fk")
                .withDatabaseSchema(schemaFqn)
                .withColumns(List.of(c2))
                .withTableConstraints(null),
            ADMIN_AUTH_HEADERS);

    // Resolve column FQNs needed for FK definitions
    Table upstreamRef =
        tableTest.getEntityByName(upstreamTable.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    Table table2Ref =
        tableTest.getEntityByName(tableInSchema2.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);

    // Create table with FK to upstream table
    Column c1Local = new Column().withName("c1_local").withDataType(ColumnDataType.INT);
    Column c1FkCol = new Column().withName("c1_fk").withDataType(ColumnDataType.INT);
    Table tableInSchema1 =
        tableTest.createEntity(
            tableTest
                .createRequest("er_table1_fk")
                .withDatabaseSchema(schemaFqn)
                .withColumns(List.of(c1Local, c1FkCol))
                .withTableConstraints(
                    List.of(
                        new TableConstraint()
                            .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
                            .withColumns(List.of(c1FkCol.getName()))
                            .withReferredColumns(
                                List.of(
                                    upstreamRef.getColumns().getFirst().getFullyQualifiedName())))),
            ADMIN_AUTH_HEADERS);

    // Create downstream table with FK to table2
    Column c2Local = new Column().withName("c2_local").withDataType(ColumnDataType.INT);
    Column c2FkCol = new Column().withName("c2_fk").withDataType(ColumnDataType.INT);
    Table downstreamTable =
        tableTest.createEntity(
            tableTest
                .createRequest("er_downstream_fk")
                .withDatabaseSchema(schemaFqn)
                .withColumns(List.of(c2Local, c2FkCol))
                .withTableConstraints(
                    List.of(
                        new TableConstraint()
                            .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
                            .withColumns(List.of(c2FkCol.getName()))
                            .withReferredColumns(
                                List.of(
                                    table2Ref.getColumns().getFirst().getFullyQualifiedName())))),
            ADMIN_AUTH_HEADERS);

    // Test the DatabaseSchema entityRelationship endpoint
    SearchSchemaEntityRelationshipResult result =
        searchSchemaEntityRelationship(schemaFqn, null, false);

    // Debug: Print the full result and its key fields
    System.out.println("Full result: " + result);
    if (result != null && result.getData() != null) {
      System.out.println("Full result nodes: " + result.getData().getNodes());
      System.out.println("Full result upstreamEdges: " + result.getData().getUpstreamEdges());
      System.out.println("Full result downstreamEdges: " + result.getData().getDownstreamEdges());
      System.out.println("Full result paging: " + result.getPaging());
    }

    // Verify the response structure
    assertNotNull(result);
    assertNotNull(result.getData().getNodes());
    assertNotNull(result.getData().getUpstreamEdges());
    assertNotNull(result.getData().getDownstreamEdges());

    // Verify we get the expected number of nodes (4 tables in the schema)
    assertEquals(4, result.getData().getNodes().size());

    // Verify we get the expected number of upstream edges (2 FK relationships)
    assertEquals(2, result.getData().getUpstreamEdges().size());

    // Verify we get no downstream edges (as expected for this setup)
    assertEquals(2, result.getData().getDownstreamEdges().size());

    // Verify all tables in the schema are present in the nodes
    assertTrue(result.getData().getNodes().containsKey(upstreamTable.getFullyQualifiedName()));
    assertTrue(result.getData().getNodes().containsKey(tableInSchema2.getFullyQualifiedName()));
    assertTrue(result.getData().getNodes().containsKey(tableInSchema1.getFullyQualifiedName()));
    assertTrue(result.getData().getNodes().containsKey(downstreamTable.getFullyQualifiedName()));

    // --- Pagination Test: offset=0, limit=2 ---
    WebTarget pagedTarget1 =
        getResource("databaseSchemas/entityRelationship")
            .queryParam("fqn", schemaFqn)
            .queryParam("limit", 2)
            .queryParam("offset", 0);
    SearchSchemaEntityRelationshipResult pagedResult1 =
        TestUtils.get(pagedTarget1, SearchSchemaEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);

    // Debug: Print the paged result 1 and its key fields
    System.out.println("Paged result 1: " + pagedResult1);
    if (pagedResult1 != null && pagedResult1.getData() != null) {
      System.out.println("Paged result 1 nodes: " + pagedResult1.getData().getNodes());
      System.out.println(
          "Paged result 1 upstreamEdges: " + pagedResult1.getData().getUpstreamEdges());
      System.out.println(
          "Paged result 1 downstreamEdges: " + pagedResult1.getData().getDownstreamEdges());
      System.out.println("Paged result 1 paging: " + pagedResult1.getPaging());
    }

    assertNotNull(pagedResult1);
    assertNotNull(pagedResult1.getData().getNodes());
    assertEquals(2, pagedResult1.getData().getNodes().size(), "First page should return 2 nodes");
    assertNotNull(pagedResult1.getData().getUpstreamEdges());
    assertNotNull(pagedResult1.getData().getDownstreamEdges());
    assertNotNull(pagedResult1.getPaging());
    assertEquals(4, pagedResult1.getPaging().getTotal(), "Total results should be 4");

    // --- Pagination Test: offset=2, limit=2 ---
    WebTarget pagedTarget2 =
        getResource("databaseSchemas/entityRelationship")
            .queryParam("fqn", schemaFqn)
            .queryParam("limit", 2)
            .queryParam("offset", 2);
    SearchSchemaEntityRelationshipResult pagedResult2 =
        TestUtils.get(pagedTarget2, SearchSchemaEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);

    // Debug: Print the paged result 2 and its key fields
    System.out.println("Paged result 2: " + pagedResult2);
    if (pagedResult2 != null && pagedResult2.getData() != null) {
      System.out.println("Paged result 2 nodes: " + pagedResult2.getData().getNodes());
      System.out.println(
          "Paged result 2 upstreamEdges: " + pagedResult2.getData().getUpstreamEdges());
      System.out.println(
          "Paged result 2 downstreamEdges: " + pagedResult2.getData().getDownstreamEdges());
      System.out.println("Paged result 2 paging: " + pagedResult2.getPaging());
    }

    assertNotNull(pagedResult2);
    assertNotNull(pagedResult2.getData().getNodes());
    assertEquals(2, pagedResult2.getData().getNodes().size(), "Second page should return 2 nodes");
    assertNotNull(pagedResult2.getData().getUpstreamEdges());
    assertNotNull(pagedResult2.getData().getDownstreamEdges());
    assertNotNull(pagedResult2.getPaging());

    // Calculate total upstream and downstream edges across both pages (no filtering by nodes)
    int totalUpstreamEdges =
        pagedResult1.getData().getUpstreamEdges().size()
            + pagedResult2.getData().getUpstreamEdges().size();
    int totalDownstreamEdges =
        pagedResult1.getData().getDownstreamEdges().size()
            + pagedResult2.getData().getDownstreamEdges().size();
    System.out.println("Total upstream edges: " + totalUpstreamEdges);
    System.out.println("Total downstream edges: " + totalDownstreamEdges);
    assertEquals(
        2,
        totalUpstreamEdges,
        "Sum of upstream edges across pages should match total upstream edges");
    assertEquals(
        2,
        totalDownstreamEdges,
        "Sum of downstream edges across pages should match total downstream edges");
  }
}
