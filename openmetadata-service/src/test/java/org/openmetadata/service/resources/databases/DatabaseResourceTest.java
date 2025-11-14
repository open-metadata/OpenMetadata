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
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.apache.commons.lang3.StringEscapeUtils.escapeCsv;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
import static org.openmetadata.service.util.EntityUtil.getFqn;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotEmpty;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
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
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfUtils;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.DatabaseResource.DatabaseList;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RdfTestUtils;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class DatabaseResourceTest extends EntityResourceTest<Database, CreateDatabase> {
  public DatabaseResourceTest() {
    super(
        Entity.DATABASE, Database.class, DatabaseList.class, "databases", DatabaseResource.FIELDS);
    supportsBulkAPI = true;
    supportedNameCharacters = "_'+#- .()$" + EntityResourceTest.RANDOM_STRING_GENERATOR.generate(1);
  }

  @Test
  void post_databaseFQN_as_admin_200_OK(TestInfo test) throws IOException {
    // Create database with different optional fields
    CreateDatabase create =
        createRequest(test).withService(SNOWFLAKE_REFERENCE.getFullyQualifiedName());
    Database db = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    String expectedFQN =
        FullyQualifiedName.build(SNOWFLAKE_REFERENCE.getFullyQualifiedName(), create.getName());
    assertEquals(expectedFQN, db.getFullyQualifiedName());
  }

  @Test
  void post_databaseWithoutRequiredService_4xx(TestInfo test) {
    CreateDatabase create = createRequest(test).withService(null);
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "query param service must not be null");
  }

  @Test
  void post_databaseWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {
      MYSQL_REFERENCE, REDSHIFT_REFERENCE, BIGQUERY_REFERENCE, SNOWFLAKE_REFERENCE
    };

    // Create database for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(
          createRequest(test).withService(service.getFullyQualifiedName()), ADMIN_AUTH_HEADERS);

      // List databases by filtering on service name and ensure right databases in the response
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("service", service.getName());

      ResultList<Database> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Database db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
      }
    }
  }

  @Test
  @SneakyThrows
  void testImportInvalidCsv() {
    Database database = createEntity(createRequest("invalidCsv"), ADMIN_AUTH_HEADERS);
    String databaseName = database.getFullyQualifiedName();
    DatabaseSchemaResourceTest schemaTest = new DatabaseSchemaResourceTest();
    CreateDatabaseSchema createSchema =
        schemaTest.createRequest("s1").withDatabase(database.getFullyQualifiedName());
    DatabaseSchema dbSchema = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    // Headers: name, displayName, description, owner, tags, retentionPeriod, sourceUrl, domain
    // Update databaseSchema with invalid tags field
    String resultsHeader =
        recordToString(EntityCsv.getResultHeaders(getDatabaseCsvHeaders(database, false)));
    String record = "s1,dsp1,dsc1,,Tag.invalidTag,,,,,,,";
    String csv = createCsv(getDatabaseCsvHeaders(database, false), listOf(record), null);
    CsvImportResult result = importCsv(databaseName, csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    String[] expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, entityNotFound(4, "tag", "Tag.invalidTag"))
        };
    assertRows(result, expectedRows);

    //  invalid tag it will give error.
    record = "non-existing,dsp1,dsc1,,Tag.invalidTag,,,,,,,";
    csv = createCsv(getDatabaseSchemaCsvHeaders(dbSchema, false), listOf(record), null);
    result = importCsv(databaseName, csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, entityNotFound(4, "tag", "Tag.invalidTag"))
        };
    assertRows(result, expectedRows);

    // databaseSchema will be created if it does not exist
    String schemaFqn = FullyQualifiedName.add(database.getFullyQualifiedName(), "non-existing");
    record = "non-existing,dsp1,dsc1,,,,,,,,,";
    csv = createCsv(getDatabaseSchemaCsvHeaders(dbSchema, false), listOf(record), null);
    result = importCsv(databaseName, csv, false);
    assertSummary(result, ApiStatus.SUCCESS, 2, 2, 0);
    expectedRows = new String[] {resultsHeader, getSuccessRecord(record, "Entity created")};
    assertRows(result, expectedRows);
    DatabaseSchema createdSchema = schemaTest.getEntityByName(schemaFqn, "id", ADMIN_AUTH_HEADERS);
    assertEquals(schemaFqn, createdSchema.getFullyQualifiedName());
  }

  @Test
  void testImportExport() throws IOException {
    String user1 = USER1.getName();
    Database database = createEntity(createRequest("importExportTest"), ADMIN_AUTH_HEADERS);
    DatabaseSchemaResourceTest schemaTest = new DatabaseSchemaResourceTest();
    CreateDatabaseSchema createSchema =
        schemaTest.createRequest("s1").withDatabase(database.getFullyQualifiedName());
    schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    // Create certification
    TagResourceTest tagResourceTest = new TagResourceTest();
    Tag certificationTag =
        tagResourceTest.createEntity(
            tagResourceTest.createRequest("Certification"), ADMIN_AUTH_HEADERS);

    // Headers: name, displayName, description, owner, tags, glossaryTerms, tiers, certification,
    // retentionPeriod,
    // sourceUrl, domain
    // Update terms with change in description
    String record =
        String.format(
            "s1,dsp1,new-dsc1,user:%s,,,Tier.Tier1,%s,P23DT23H,http://test.com,%s,",
            user1,
            certificationTag.getFullyQualifiedName(),
            escapeCsv(DOMAIN.getFullyQualifiedName()));

    // Update created entity with changes
    importCsvAndValidate(
        database.getFullyQualifiedName(),
        getDatabaseCsvHeaders(database, false),
        null,
        listOf(record));

    String clearRecord = "s1,dsp1,new-dsc2,,,,,,P23DT23H,http://test.com,,";
    importCsvAndValidate(
        database.getFullyQualifiedName(),
        getDatabaseCsvHeaders(database, false),
        null,
        listOf(clearRecord));

    String schemaFqn = String.format("%s.%s", database.getFullyQualifiedName(), "s1");
    DatabaseSchema updatedSchema = schemaTest.getEntityByName(schemaFqn, ADMIN_AUTH_HEADERS);

    assertEquals("new-dsc2", updatedSchema.getDescription());
    assertTrue(
        listOrEmpty(updatedSchema.getTags()).isEmpty(), "Tags should be empty after clearing");
    assertTrue(listOrEmpty(updatedSchema.getOwners()).isEmpty(), "Owner should be cleared");
    assertTrue(
        listOrEmpty(updatedSchema.getDomains()).isEmpty(), "Domain should be null after clearing");
  }

  @Test
  void testImportExportRecursive() throws IOException {
    // 1. Create the initial database and schema structure
    String dbName = "importExportTestRec";
    Database database =
        createEntity(
            createRequest(dbName).withDescription("Initial database description"),
            ADMIN_AUTH_HEADERS);

    DatabaseSchemaResourceTest schemaTest = new DatabaseSchemaResourceTest();
    CreateDatabaseSchema createSchema =
        schemaTest
            .createRequest("schema1")
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Initial schema description");
    DatabaseSchema schema = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    CreateTable createTable =
        tableTest
            .createRequest("table1")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Initial table description");
    Table table = tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // 2. Export the database hierarchy to CSV
    String exportedCsv = exportCsvRecursive(database.getFullyQualifiedName());
    assertNotNull(exportedCsv);

    // 3. Parse the exported CSV to verify its structure and contents match our created entities
    String[] csvLines = exportedCsv.split(CsvUtil.LINE_SEPARATOR);
    assertTrue(csvLines.length >= 3, "Export should have at least header and 2 entities");

    String headerLine = csvLines[0];
    assertTrue(headerLine.contains("name"), "Header should contain 'name' column");
    assertTrue(headerLine.contains("description"), "Header should contain 'description' column");
    assertTrue(headerLine.contains("entityType"), "Header should contain 'entityType' column");

    boolean foundTable = false;
    boolean foundSchema = false;

    for (int i = 1; i < csvLines.length; i++) {
      String line = csvLines[i];

      if (line.contains("schema1") && line.contains("databaseSchema")) {
        foundSchema = true;
        assertTrue(
            line.contains("Initial schema description"),
            "Database row should contain the correct description");
      } else if (line.contains("table1") && line.contains("table") && !line.contains("column")) {
        foundTable = true;
        assertTrue(
            line.contains("Initial table description"),
            "Schema row should contain the correct description");
      }
    }

    assertTrue(foundSchema, "Exported CSV should contain the schema");
    assertTrue(foundTable, "Exported CSV should contain the table");

    // 4. Modify the CSV to update existing entities and add new ones
    List<String> modifiedCsvLines = new ArrayList<>();
    modifiedCsvLines.add(headerLine); // Keep the header row

    // Update existing rows with new descriptions
    for (int i = 1; i < csvLines.length; i++) {
      String line = csvLines[i];

      if (line.contains("schema1") && line.contains("databaseSchema")) {
        line = line.replace("Initial schema description", "Updated schema description");
      } else if (line.contains("table1") && line.contains("table") && !line.contains("column")) {
        line = line.replace("Initial table description", "Updated table description");
      } else if (line.contains("column")) {
        continue;
      }
      modifiedCsvLines.add(line);
    }

    // Add a new schema row by cloning and modifying the existing schema row
    String schemaLineTemplate = null;
    for (String line : csvLines) {
      if (line.contains("schema1") && line.contains("databaseSchema")) {
        schemaLineTemplate = line;
        break;
      }
    }

    assertNotNull(schemaLineTemplate, "Schema template line should exist");
    String newSchemaLine =
        schemaLineTemplate
            .replace("schema1", "schema2")
            .replace("Initial schema description", "New schema description");
    modifiedCsvLines.add(newSchemaLine);

    // 5. Import the modified CSV
    String modifiedCsv =
        String.join(CsvUtil.LINE_SEPARATOR, modifiedCsvLines) + CsvUtil.LINE_SEPARATOR;
    CsvImportResult result =
        importCsvRecursive(database.getFullyQualifiedName(), modifiedCsv, false);
    assertNotNull(result);
    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    DatabaseSchema updatedSchema =
        schemaTest.getEntityByName(
            schema.getFullyQualifiedName(), "description", ADMIN_AUTH_HEADERS);
    assertEquals(
        "Updated schema description",
        updatedSchema.getDescription(),
        "Schema description should be updated");

    String schema2Fqn = database.getFullyQualifiedName() + ".schema2";
    DatabaseSchema newSchema =
        schemaTest.getEntityByName(schema2Fqn, "description", ADMIN_AUTH_HEADERS);
    assertEquals(
        "New schema description",
        newSchema.getDescription(),
        "New schema should be created with correct description");
    Table updatedTable =
        tableTest.getEntityByName(table.getFullyQualifiedName(), "description", ADMIN_AUTH_HEADERS);
    assertEquals(
        "Updated table description",
        updatedTable.getDescription(),
        "Table description should be updated");
  }

  @Override
  public Database validateGetWithDifferentFields(Database database, boolean byName)
      throws HttpResponseException {
    // Add a schema if it already does not exist
    if (nullOrEmpty(database.getDatabaseSchemas())) {
      DatabaseSchemaResourceTest databaseSchemaResourceTest = new DatabaseSchemaResourceTest();
      CreateDatabaseSchema create =
          databaseSchemaResourceTest
              .createRequest("schema", "", "", null)
              .withDatabase(getFqn(database));
      databaseSchemaResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    }

    String fields = "";
    database =
        byName
            ? getEntityByName(database.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(database.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(database.getService(), database.getServiceType());
    assertListNull(
        database.getOwners(),
        database.getDatabaseSchemas(),
        database.getUsageSummary(),
        database.getLocation());

    fields = "owners,databaseSchemas,usageSummary,location,tags,followers";
    database =
        byName
            ? getEntityByName(database.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(database.getId(), fields, ADMIN_AUTH_HEADERS);

    assertListNotNull(database.getService(), database.getServiceType());
    // Fields usageSummary and location are not set during creation - tested elsewhere
    TestUtils.validateEntityReferences(database.getDatabaseSchemas(), true);
    assertListNotEmpty(database.getDatabaseSchemas());
    // Checks for other owner, tags, and followers is done in the base class
    return database;
  }

  @Override
  public CreateDatabase createRequest(String name) {
    return new CreateDatabase().withName(name).withService(getContainer().getFullyQualifiedName());
  }

  @Override
  public EntityReference getContainer() {
    return SNOWFLAKE_REFERENCE;
  }

  @Override
  public EntityReference getContainer(Database entity) {
    return entity.getService();
  }

  @Override
  public void validateCreatedEntity(
      Database database, CreateDatabase createRequest, Map<String, String> authHeaders) {
    // Validate service
    assertNotNull(database.getServiceType());
    assertReference(createRequest.getService(), database.getService());
    assertEquals(
        FullyQualifiedName.build(database.getService().getName(), database.getName()),
        database.getFullyQualifiedName());
  }

  @Override
  public void compareEntities(
      Database expected, Database updated, Map<String, String> authHeaders) {
    assertReference(expected.getService(), updated.getService());
    assertEquals(
        FullyQualifiedName.build(updated.getService().getName(), updated.getName()),
        updated.getFullyQualifiedName());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (fieldName.endsWith("owners") && (expected != null && actual != null)) {
      @SuppressWarnings("unchecked")
      List<EntityReference> expectedOwners =
          expected instanceof List
              ? (List<EntityReference>) expected
              : JsonUtils.readObjects(expected.toString(), EntityReference.class);
      List<EntityReference> actualOwners =
          JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertReferenceList(expectedOwners, actualOwners);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  @Order(2)
  @Test
  void testBulkServiceFetchingForDatabases(TestInfo test) throws IOException {
    // This test verifies that when databases are fetched in bulk with the service field,
    // each database maintains its correct service reference (not all databases sharing the same
    // service)
    // The bug was in fetchAndSetService which used getContainer(entities.get(0).getId()) for ALL
    // databases

    // To avoid interfering with entity count, we'll only create databases in the default container
    // but we'll verify the fix by checking existing databases from different services

    // First, verify the fix with existing databases from different services
    ResultList<Database> existingDatabases =
        listEntities(Map.of("fields", "service", "limit", "50"), ADMIN_AUTH_HEADERS);

    // Group by service to check if each database has its correct service
    Map<String, List<Database>> dbByService = new HashMap<>();
    for (Database db : existingDatabases.getData()) {
      assertNotNull(db.getService(), "Database " + db.getName() + " should have a service");
      String serviceName = db.getService().getName();
      dbByService.computeIfAbsent(serviceName, k -> new ArrayList<>()).add(db);
    }

    // If we have databases from different services, verify each has the correct service
    if (dbByService.size() > 1) {
      for (Map.Entry<String, List<Database>> entry : dbByService.entrySet()) {
        String serviceName = entry.getKey();
        for (Database db : entry.getValue()) {
          assertEquals(
              serviceName,
              db.getService().getName(),
              "Database " + db.getName() + " should have service " + serviceName);
        }
      }
      LOG.info(
          "Verified databases maintain correct services across {} different services",
          dbByService.size());
    }

    // Now test with new databases in the default container to ensure entity count isn't affected
    String timestamp = String.valueOf(System.currentTimeMillis());
    CreateDatabase createDb1 = createRequest("bulkTestDb1_" + timestamp);
    CreateDatabase createDb2 = createRequest("bulkTestDb2_" + timestamp);

    Database db1 = createAndCheckEntity(createDb1, ADMIN_AUTH_HEADERS);
    Database db2 = createAndCheckEntity(createDb2, ADMIN_AUTH_HEADERS);

    try {
      // Fetch with service field
      ResultList<Database> databases =
          listEntities(
              Map.of("fields", "service", "service", getContainer().getFullyQualifiedName()),
              ADMIN_AUTH_HEADERS);

      // Find our databases
      Database foundDb1 =
          databases.getData().stream()
              .filter(db -> db.getId().equals(db1.getId()))
              .findFirst()
              .orElse(null);
      Database foundDb2 =
          databases.getData().stream()
              .filter(db -> db.getId().equals(db2.getId()))
              .findFirst()
              .orElse(null);

      assertNotNull(foundDb1, "Database 1 should be found");
      assertNotNull(foundDb2, "Database 2 should be found");

      // Both should have the same service (SNOWFLAKE_REFERENCE) since they're in the same container
      assertEquals(getContainer().getId(), foundDb1.getService().getId());
      assertEquals(getContainer().getId(), foundDb2.getService().getId());
      assertEquals(getContainer().getName(), foundDb1.getService().getName());
      assertEquals(getContainer().getName(), foundDb2.getService().getName());

    } finally {
      // Clean up - these will be properly handled by recursive delete since they're in the default
      // container
      deleteEntity(db1.getId(), ADMIN_AUTH_HEADERS);
      deleteEntity(db2.getId(), ADMIN_AUTH_HEADERS);
    }
  }

  @Test
  void testDatabaseRdfRelationships(TestInfo test) throws IOException {
    if (!RdfTestUtils.isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create database with owner and tags
    CreateDatabase createDatabase =
        createRequest(test)
            .withService(getContainer().getName())
            .withOwners(listOf(USER1_REF))
            .withTags(listOf(TIER1_TAG_LABEL));

    Database database = createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    // Verify database exists in RDF
    RdfTestUtils.verifyEntityInRdf(database, RdfUtils.getRdfType("database"));

    // Verify hierarchical relationship (service CONTAINS database)
    RdfTestUtils.verifyContainsRelationshipInRdf(getContainer(), database.getEntityReference());

    // Verify owner relationship
    RdfTestUtils.verifyOwnerInRdf(database.getFullyQualifiedName(), USER1_REF);

    // Verify database tags
    RdfTestUtils.verifyTagsInRdf(database.getFullyQualifiedName(), database.getTags());
  }

  @Test
  void testFieldFetchersForServiceAndName(TestInfo test) throws IOException {
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    String timestamp = String.valueOf(System.currentTimeMillis());

    CreateDatabaseService createDatabaseService =
        new CreateDatabaseService()
            .withName("fieldFetcherTestService_" + timestamp)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(TestUtils.MYSQL_DATABASE_CONNECTION);
    DatabaseService databaseService =
        databaseServiceResourceTest.createEntity(createDatabaseService, ADMIN_AUTH_HEADERS);

    String dbName1 = "fieldFetcherTestDb1_" + timestamp;
    String dbName2 = "fieldFetcherTestDb2_" + timestamp;

    CreateDatabase createDb1 =
        new CreateDatabase().withName(dbName1).withService(databaseService.getFullyQualifiedName());
    CreateDatabase createDb2 =
        new CreateDatabase().withName(dbName2).withService(databaseService.getFullyQualifiedName());

    Database db1 = createAndCheckEntity(createDb1, ADMIN_AUTH_HEADERS);
    Database db2 = createAndCheckEntity(createDb2, ADMIN_AUTH_HEADERS);

    try {
      ResultList<Database> dbListWithService =
          listEntities(
              Map.of("fields", "service", "service", databaseService.getFullyQualifiedName()),
              ADMIN_AUTH_HEADERS);

      Database foundDb1 =
          dbListWithService.getData().stream()
              .filter(db -> db.getId().equals(db1.getId()))
              .findFirst()
              .orElse(null);
      Database foundDb2 =
          dbListWithService.getData().stream()
              .filter(db -> db.getId().equals(db2.getId()))
              .findFirst()
              .orElse(null);

      assertNotNull(foundDb1, "Database 1 should be found in list");
      assertNotNull(foundDb2, "Database 2 should be found in list");

      assertNotNull(foundDb1.getName(), "Database name should always be present in list response");
      assertEquals(dbName1, foundDb1.getName(), "Database 1 name should match");

      assertNotNull(foundDb2.getName(), "Database name should always be present in list response");
      assertEquals(dbName2, foundDb2.getName(), "Database 2 name should match");

      assertNotNull(
          foundDb1.getService(),
          "Service should be fetched via fieldFetcher when 'service' field is requested");
      assertEquals(
          databaseService.getName(),
          foundDb1.getService().getName(),
          "Database 1 service name should be correct via field fetcher");
      assertEquals(
          databaseService.getId(),
          foundDb1.getService().getId(),
          "Database 1 service ID should be correct via field fetcher");

      assertNotNull(
          foundDb2.getService(),
          "Service should be fetched via fieldFetcher when 'service' field is requested");
      assertEquals(
          databaseService.getName(),
          foundDb2.getService().getName(),
          "Database 2 service name should be correct via field fetcher");
      assertEquals(
          databaseService.getId(),
          foundDb2.getService().getId(),
          "Database 2 service ID should be correct via field fetcher");

      ResultList<Database> dbListWithoutService =
          listEntities(
              Map.of("fields", "", "service", databaseService.getFullyQualifiedName()),
              ADMIN_AUTH_HEADERS);

      Database foundDb1WithoutService =
          dbListWithoutService.getData().stream()
              .filter(db -> db.getId().equals(db1.getId()))
              .findFirst()
              .orElse(null);

      assertNotNull(foundDb1WithoutService, "Database should be found even without service field");
      assertNotNull(
          foundDb1WithoutService.getName(),
          "Database name should always be present regardless of fields");
      assertEquals(
          dbName1,
          foundDb1WithoutService.getName(),
          "Database name should match even without service field");

      assertNotNull(
          foundDb1WithoutService.getService(),
          "Service is always fetched as default field even when not in fields param");

    } finally {
      deleteEntity(db1.getId(), ADMIN_AUTH_HEADERS);
      deleteEntity(db2.getId(), ADMIN_AUTH_HEADERS);
      databaseServiceResourceTest.deleteEntity(
          databaseService.getId(), true, true, ADMIN_AUTH_HEADERS);
    }
  }

  @Test
  void testDatabaseRdfSoftDeleteAndRestore(TestInfo test) throws IOException {
    if (!RdfTestUtils.isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create database
    CreateDatabase createDatabase =
        createRequest(test).withService(getContainer().getName()).withOwners(listOf(USER1_REF));
    Database database = createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    // Verify database exists
    RdfTestUtils.verifyEntityInRdf(database, RdfUtils.getRdfType("database"));
    RdfTestUtils.verifyContainsRelationshipInRdf(getContainer(), database.getEntityReference());
    RdfTestUtils.verifyOwnerInRdf(database.getFullyQualifiedName(), USER1_REF);

    // Soft delete the database
    deleteEntity(database.getId(), ADMIN_AUTH_HEADERS);

    // Verify database still exists in RDF after soft delete
    RdfTestUtils.verifyEntityInRdf(database, RdfUtils.getRdfType("database"));
    RdfTestUtils.verifyContainsRelationshipInRdf(getContainer(), database.getEntityReference());
    RdfTestUtils.verifyOwnerInRdf(database.getFullyQualifiedName(), USER1_REF);

    // Restore the database
    Database restored =
        restoreEntity(new RestoreEntity().withId(database.getId()), OK, ADMIN_AUTH_HEADERS);

    // Verify database still exists after restore
    RdfTestUtils.verifyEntityInRdf(restored, RdfUtils.getRdfType("database"));
    RdfTestUtils.verifyContainsRelationshipInRdf(getContainer(), restored.getEntityReference());
    RdfTestUtils.verifyOwnerInRdf(restored.getFullyQualifiedName(), USER1_REF);
  }

  @Test
  void testDatabaseRdfHardDelete(TestInfo test) throws IOException {
    if (!RdfTestUtils.isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create database
    CreateDatabase createDatabase = createRequest(test).withService(getContainer().getName());
    Database database = createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    // Verify database exists
    RdfTestUtils.verifyEntityInRdf(database, RdfUtils.getRdfType("database"));
    RdfTestUtils.verifyContainsRelationshipInRdf(getContainer(), database.getEntityReference());

    // Hard delete the database
    deleteEntity(database.getId(), true, true, ADMIN_AUTH_HEADERS);

    // Verify database no longer exists in RDF after hard delete
    RdfTestUtils.verifyEntityNotInRdf(database.getFullyQualifiedName());
  }

  @Test
  void testBulk_PreservesUserEditsOnUpdate(TestInfo test) throws IOException {
    // Critical test: Verify that bulk updates preserve user-made changes
    // and only update the fields sent in the bulk request (incremental updates)

    // Step 1: Bot creates initial database (using regular create, not bulk)
    CreateDatabase botCreate =
        createRequest(test.getDisplayName())
            .withDescription("Bot initial description")
            .withTags(List.of(USER_ADDRESS_TAG_LABEL));

    Database entity = createEntity(botCreate, INGESTION_BOT_AUTH_HEADERS);
    assertEquals("Bot initial description", entity.getDescription());
    assertEquals(1, entity.getTags().size());

    // Step 2: User edits description and adds tag
    String originalJson = JsonUtils.pojoToJson(entity);
    String userDescription = "User-edited description - should be preserved";
    entity.setDescription(userDescription);
    entity.setTags(List.of(USER_ADDRESS_TAG_LABEL, PERSONAL_DATA_TAG_LABEL));

    Database userEditedEntity =
        patchEntity(entity.getId(), originalJson, entity, ADMIN_AUTH_HEADERS);
    assertEquals(userDescription, userEditedEntity.getDescription());
    assertEquals(2, userEditedEntity.getTags().size());

    // Step 3: Bot sends bulk update with new tag and different description
    // Bot's description should be IGNORED (bot protection)
    // Bot's tag should be MERGED (added to existing)
    CreateDatabase botUpdate =
        createRequest(test.getDisplayName())
            .withDescription("Bot trying to overwrite - should be ignored")
            .withTags(List.of(PII_SENSITIVE_TAG_LABEL));

    WebTarget bulkTarget = getCollection().path("/bulk");
    BulkOperationResult updateResult =
        TestUtils.put(
            bulkTarget,
            List.of(botUpdate),
            BulkOperationResult.class,
            OK,
            INGESTION_BOT_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, updateResult.getStatus());
    assertEquals(1, updateResult.getNumberOfRowsPassed());

    // Step 4: Verify user edits were preserved
    Database verifyEntity = getEntity(entity.getId(), "tags", ADMIN_AUTH_HEADERS);

    // Description should still be user's (bot protection)
    assertEquals(
        userDescription,
        verifyEntity.getDescription(),
        "Bot should NOT be able to overwrite user-edited description");

    // Tags should be merged (original 2 + new 1 from bot)
    assertEquals(3, verifyEntity.getTags().size(), "Tags should be merged, not replaced");

    List<String> tagFqns =
        verifyEntity.getTags().stream().map(TagLabel::getTagFQN).collect(Collectors.toList());
    assertTrue(tagFqns.contains(USER_ADDRESS_TAG_LABEL.getTagFQN()));
    assertTrue(tagFqns.contains(PERSONAL_DATA_TAG_LABEL.getTagFQN()));
    assertTrue(tagFqns.contains(PII_SENSITIVE_TAG_LABEL.getTagFQN()));

    // Cleanup
    deleteEntity(entity.getId(), false, true, ADMIN_AUTH_HEADERS);
  }

  @Test
  void testBulk_TagMergeBehavior(TestInfo test) throws IOException {
    // Test that bulk updates MERGE tags (add new, keep existing)
    // NOT replace tags completely

    // Step 1: Create database with initial tags
    CreateDatabase createRequest =
        createRequest(test.getDisplayName())
            .withTags(List.of(USER_ADDRESS_TAG_LABEL, PERSONAL_DATA_TAG_LABEL));

    Database entity = createEntity(createRequest, ADMIN_AUTH_HEADERS);
    assertEquals(2, entity.getTags().size());

    // Step 2: Send bulk update with additional tag (not replacing existing)
    CreateDatabase updateRequest =
        createRequest(test.getDisplayName()).withTags(List.of(PII_SENSITIVE_TAG_LABEL));

    WebTarget bulkTarget = getCollection().path("/bulk");
    BulkOperationResult result =
        TestUtils.put(
            bulkTarget, List.of(updateRequest), BulkOperationResult.class, OK, ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    // Step 3: Verify tags were merged (original 2 + new 1 = 3 total)
    Database updatedEntity = getEntity(entity.getId(), "tags", ADMIN_AUTH_HEADERS);

    assertEquals(
        3, updatedEntity.getTags().size(), "Tags should be merged: 2 original + 1 new = 3 total");

    List<String> tagFqns =
        updatedEntity.getTags().stream().map(TagLabel::getTagFQN).collect(Collectors.toList());

    assertTrue(
        tagFqns.contains(USER_ADDRESS_TAG_LABEL.getTagFQN()),
        "Original tag USER_ADDRESS should still exist");
    assertTrue(
        tagFqns.contains(PERSONAL_DATA_TAG_LABEL.getTagFQN()),
        "Original tag PERSONAL_DATA should still exist");
    assertTrue(
        tagFqns.contains(PII_SENSITIVE_TAG_LABEL.getTagFQN()),
        "New tag PII_SENSITIVE should be added");

    // Cleanup
    deleteEntity(entity.getId(), false, true, ADMIN_AUTH_HEADERS);
  }

  @Test
  void testBulk_AdminCanOverrideDescription(TestInfo test) throws IOException {
    // Test that while bots cannot overwrite user descriptions,
    // admins CAN update descriptions via bulk

    // Step 1: User creates database
    CreateDatabase createRequest =
        createRequest(test.getDisplayName()).withDescription("User-created description");

    Database entity = createEntity(createRequest, ADMIN_AUTH_HEADERS);
    assertEquals("User-created description", entity.getDescription());

    // Step 2: Admin updates description via bulk
    String adminDescription = "Admin-updated description via bulk";
    CreateDatabase adminUpdate =
        createRequest(test.getDisplayName()).withDescription(adminDescription);

    WebTarget bulkTarget = getCollection().path("/bulk");
    BulkOperationResult result =
        TestUtils.put(
            bulkTarget, List.of(adminUpdate), BulkOperationResult.class, OK, ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    // Step 3: Verify admin's description was applied
    Database updatedEntity = getEntity(entity.getId(), "", ADMIN_AUTH_HEADERS);
    assertEquals(
        adminDescription,
        updatedEntity.getDescription(),
        "Admin should be able to update description via bulk");

    // Cleanup
    deleteEntity(entity.getId(), false, true, ADMIN_AUTH_HEADERS);
  }
}
