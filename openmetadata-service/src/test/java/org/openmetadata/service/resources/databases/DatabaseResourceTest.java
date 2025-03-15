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

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
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
import static org.openmetadata.service.util.TestUtils.assertListNotEmpty;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.csv.CsvUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseRepository;
import org.openmetadata.service.jdbi3.DatabaseRepository.DatabaseCsv;
import org.openmetadata.service.jdbi3.DatabaseSchemaRepository;
import org.openmetadata.service.jdbi3.DatabaseSchemaRepository.DatabaseSchemaCsv;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.DatabaseResource.DatabaseList;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class DatabaseResourceTest extends EntityResourceTest<Database, CreateDatabase> {
  public DatabaseResourceTest() {
    super(
        Entity.DATABASE, Database.class, DatabaseList.class, "databases", DatabaseResource.FIELDS);
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
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "service must not be null");
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
    schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    // Headers: name, displayName, description, owner, tags, retentionPeriod, sourceUrl, domain
    // Update databaseSchema with invalid tags field
    String resultsHeader = recordToString(EntityCsv.getResultHeaders(DatabaseCsv.HEADERS));
    String record = "s1,dsp1,dsc1,,Tag.invalidTag,,,,,,";
    String csv = createCsv(DatabaseCsv.HEADERS, listOf(record), null);
    CsvImportResult result = importCsv(databaseName, csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    String[] expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, entityNotFound(4, "tag", "Tag.invalidTag"))
        };
    assertRows(result, expectedRows);

    //  invalid tag it will give error.
    record = "non-existing,dsp1,dsc1,,Tag.invalidTag,,,,,,";
    csv = createCsv(DatabaseSchemaCsv.HEADERS, listOf(record), null);
    result = importCsv(databaseName, csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, entityNotFound(4, "tag", "Tag.invalidTag"))
        };
    assertRows(result, expectedRows);

    // databaseSchema will be created if it does not exist
    String schemaFqn = FullyQualifiedName.add(database.getFullyQualifiedName(), "non-existing");
    record = "non-existing,dsp1,dsc1,,,,,,,,";
    csv = createCsv(DatabaseSchemaCsv.HEADERS, listOf(record), null);
    result = importCsv(databaseName, csv, false);
    assertSummary(result, ApiStatus.SUCCESS, 2, 2, 0);
    expectedRows = new String[] {resultsHeader, getSuccessRecord(record, "Entity created")};
    assertRows(result, expectedRows);
    DatabaseSchema createdSchema = schemaTest.getEntityByName(schemaFqn, "id", ADMIN_AUTH_HEADERS);
    assertEquals(schemaFqn, createdSchema.getFullyQualifiedName());
  }

  @Test
  void testImportExport() throws IOException {
    // 1. Create the initial database and schema structure
    String dbName = "importExportTest";
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

    // 2. Export the database hierarchy to CSV
    String exportedCsv = exportCsv(database.getFullyQualifiedName());
    assertNotNull(exportedCsv);

    // 3. Parse the exported CSV to verify its structure and contents match our created entities
    String[] csvLines = exportedCsv.split(CsvUtil.LINE_SEPARATOR);
    assertTrue(csvLines.length >= 3, "Export should have at least header and 2 entities");

    String headerLine = csvLines[0];
    assertTrue(headerLine.contains("name"), "Header should contain 'name' column");
    assertTrue(headerLine.contains("description"), "Header should contain 'description' column");
    assertTrue(headerLine.contains("entityType"), "Header should contain 'entityType' column");

    boolean foundDatabase = false;
    boolean foundSchema = false;

    for (int i = 1; i < csvLines.length; i++) {
      String line = csvLines[i];

      if (line.contains(dbName) && line.contains("database")) {
        foundDatabase = true;
        assertTrue(
            line.contains("Initial database description"),
            "Database row should contain the correct description");
      } else if (line.contains("schema1") && line.contains("database_schema")) {
        foundSchema = true;
        assertTrue(
            line.contains("Initial schema description"),
            "Schema row should contain the correct description");
      }
    }

    assertTrue(foundDatabase, "Exported CSV should contain the database");
    assertTrue(foundSchema, "Exported CSV should contain the schema");

    // 4. Modify the CSV to update existing entities and add new ones
    List<String> modifiedCsvLines = new ArrayList<>();
    modifiedCsvLines.add(headerLine); // Keep the header row

    // Update existing rows with new descriptions
    for (int i = 1; i < csvLines.length; i++) {
      String line = csvLines[i];

      if (line.contains(dbName) && line.contains("database")) {
        line = line.replace("Initial database description", "Updated database description");
      } else if (line.contains("schema1") && line.contains("database_schema")) {
        line = line.replace("Initial schema description", "Updated schema description");
      }

      modifiedCsvLines.add(line);
    }

    // Add a new schema row by cloning and modifying the existing schema row
    String schemaLineTemplate = null;
    for (String line : csvLines) {
      if (line.contains("schema1") && line.contains("database_schema")) {
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
    CsvImportResult result = importCsv(database.getFullyQualifiedName(), modifiedCsv, false);
    assertNotNull(result);
    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    // 6. Verify the changes by fetching the updated entities
    Database updatedDb = getEntity(database.getId(), "description", ADMIN_AUTH_HEADERS);
    assertEquals(
        "Updated database description",
        updatedDb.getDescription(),
        "Database description should be updated");

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

    fields = "owners,databaseSchemas,usageSummary,location,tags";
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
      assertOwners(expectedOwners, actualOwners);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  @Test
  void testDatabaseExportImport(TestInfo test) throws IOException {
    // Create a database with a schema, table and stored procedure to test export
    String dbName = getEntityName(test);
    Database database = createEntity(createRequest(dbName), ADMIN_AUTH_HEADERS);
    UUID databaseId = database.getId();

    DatabaseSchemaResourceTest schemaResourceTest = new DatabaseSchemaResourceTest();
    String schemaName = "schema_" + getEntityName(test);
    CreateDatabaseSchema createSchema =
        schemaResourceTest.createRequest(schemaName).withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = schemaResourceTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);
    // Now export the database to CSV
    DatabaseRepository databaseRepository =
        (DatabaseRepository) Entity.getEntityRepository(Entity.DATABASE);
    String user = "test-user";
    String csv = databaseRepository.exportToCsv(database.getFullyQualifiedName(), user);

    // Parse CSV and verify it contains the expected entityType and fullyQualifiedName fields
    CSVParser parser = CSVParser.parse(new StringReader(csv), CSVFormat.DEFAULT.withHeader());
    List<CSVRecord> records = parser.getRecords();

    // CSV should have schema record
    boolean containsSchema = false;
    boolean hasEntityTypeField = false;
    boolean hasFQNField = false;

    for (CSVRecord record : records) {
      Map<String, String> recordMap = record.toMap();
      if (recordMap.containsKey("entityType") && recordMap.containsKey("fullyQualifiedName")) {
        hasEntityTypeField = true;
        hasFQNField = true;

        // Check if schema from our test is in the export
        if (Entity.DATABASE_SCHEMA.equals(recordMap.get("entityType"))
            && recordMap.get("name").equals(schemaName)) {
          containsSchema = true;
        }
      }
    }

    assertTrue(hasEntityTypeField, "CSV should contain entityType field");
    assertTrue(hasFQNField, "CSV should contain fullyQualifiedName field");
    assertTrue(containsSchema, "CSV should contain the created schema");

    // Import the CSV back (dry run)
    CsvImportResult result =
        databaseRepository.importFromCsv(database.getFullyQualifiedName(), csv, true, user);
    assertNotNull(result);

    // Test schema level export/import
    String schemaFQN =
        getEntity(databaseId, ADMIN_AUTH_HEADERS).getFullyQualifiedName() + "." + schemaName;
    DatabaseSchemaRepository schemaRepository =
        (DatabaseSchemaRepository) Entity.getEntityRepository(Entity.DATABASE_SCHEMA);

    String schemaCsv = schemaRepository.exportToCsv(schemaFQN, user);

    // Parse CSV and verify it contains the expected entityType and fullyQualifiedName fields
    CSVParser schemaParser =
        CSVParser.parse(new StringReader(schemaCsv), CSVFormat.DEFAULT.withHeader());
    List<CSVRecord> schemaRecords = schemaParser.getRecords();

    hasEntityTypeField = false;
    hasFQNField = false;

    for (CSVRecord record : schemaRecords) {
      Map<String, String> recordMap = record.toMap();
      if (recordMap.containsKey("entityType") && recordMap.containsKey("fullyQualifiedName")) {
        hasEntityTypeField = true;
        hasFQNField = true;
      }
    }

    assertTrue(hasEntityTypeField, "Schema CSV should contain entityType field");
    assertTrue(hasFQNField, "Schema CSV should contain fullyQualifiedName field");

    // Import the CSV back (dry run)
    CsvImportResult schemaResult = schemaRepository.importFromCsv(schemaFQN, schemaCsv, true, user);
    assertNotNull(schemaResult);
  }
}
