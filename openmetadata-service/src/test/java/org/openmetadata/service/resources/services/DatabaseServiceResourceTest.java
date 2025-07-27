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

package org.openmetadata.service.resources.services;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.apache.commons.lang.StringEscapeUtils.escapeCsv;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.csv.CsvUtil.recordToString;
import static org.openmetadata.csv.EntityCsv.entityNotFound;
import static org.openmetadata.csv.EntityCsvTest.assertRows;
import static org.openmetadata.csv.EntityCsvTest.assertSummary;
import static org.openmetadata.csv.EntityCsvTest.createCsv;
import static org.openmetadata.csv.EntityCsvTest.getFailedRecord;
import static org.openmetadata.csv.EntityCsvTest.getSuccessRecord;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidEnumValue;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.csv.CsvUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.FilterPattern;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.services.connections.database.BigQueryConnection;
import org.openmetadata.schema.services.connections.database.ConnectionArguments;
import org.openmetadata.schema.services.connections.database.ConnectionOptions;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.RedshiftConnection;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Schedule;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.services.database.DatabaseServiceResource;
import org.openmetadata.service.resources.services.database.DatabaseServiceResource.DatabaseServiceList;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class DatabaseServiceResourceTest
    extends ServiceResourceTest<DatabaseService, CreateDatabaseService> {
  public DatabaseServiceResourceTest() {
    super(
        Entity.DATABASE_SERVICE,
        DatabaseService.class,
        DatabaseServiceList.class,
        "services/databaseServices",
        DatabaseServiceResource.FIELDS);
    this.supportsPatch = false;
  }

  public void setupDatabaseServices(TestInfo test) throws HttpResponseException {
    // Create snowflake database service
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    CreateDatabaseService createDatabaseService =
        databaseServiceResourceTest
            .createRequest(test, 1)
            .withServiceType(DatabaseServiceType.Snowflake)
            .withConnection(TestUtils.SNOWFLAKE_DATABASE_CONNECTION);
    DatabaseService databaseService =
        new DatabaseServiceResourceTest().createEntity(createDatabaseService, ADMIN_AUTH_HEADERS);
    SNOWFLAKE_REFERENCE = databaseService.getEntityReference();

    createDatabaseService
        .withName("redshiftDB")
        .withServiceType(DatabaseServiceType.Redshift)
        .withConnection(TestUtils.REDSHIFT_DATABASE_CONNECTION);
    databaseService =
        databaseServiceResourceTest.createEntity(createDatabaseService, ADMIN_AUTH_HEADERS);
    REDSHIFT_REFERENCE = databaseService.getEntityReference();

    createDatabaseService
        .withName("bigQueryDB")
        .withServiceType(DatabaseServiceType.BigQuery)
        .withConnection(TestUtils.BIGQUERY_DATABASE_CONNECTION);
    databaseService =
        databaseServiceResourceTest.createEntity(createDatabaseService, ADMIN_AUTH_HEADERS);
    BIGQUERY_REFERENCE = databaseService.getEntityReference();

    createDatabaseService
        .withName("mysqlDB")
        .withServiceType(DatabaseServiceType.Mysql)
        .withConnection(TestUtils.MYSQL_DATABASE_CONNECTION);
    databaseService =
        databaseServiceResourceTest.createEntity(createDatabaseService, ADMIN_AUTH_HEADERS);
    MYSQL_REFERENCE = databaseService.getEntityReference();
  }

  @Test
  void post_validDatabaseService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create database service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);

    // We can create the service without connection
    createAndCheckEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_updateDatabaseService_as_admin_2xx(TestInfo test) throws IOException {
    DatabaseService service =
        createAndCheckEntity(createRequest(test).withDescription(null), ADMIN_AUTH_HEADERS);

    // Update database description and ingestion service that are null
    CreateDatabaseService update =
        createRequest(test).withDescription("description1").withName(service.getName());

    ChangeDescription change = getChangeDescription(service, MINOR_UPDATE);
    fieldAdded(change, "description", "description1");
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    SnowflakeConnection snowflakeConnection =
        new SnowflakeConnection().withUsername("test").withPassword("test12");
    DatabaseConnection databaseConnection =
        new DatabaseConnection().withConfig(snowflakeConnection);
    update.withConnection(databaseConnection);
    service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    validateDatabaseConnection(
        databaseConnection, service.getConnection(), service.getServiceType(), true);
    ConnectionArguments connectionArguments =
        new ConnectionArguments()
            .withAdditionalProperty("credentials", "/tmp/creds.json")
            .withAdditionalProperty("client_email", "ingestion-bot@domain.com");
    ConnectionOptions connectionOptions =
        new ConnectionOptions()
            .withAdditionalProperty("key1", "value1")
            .withAdditionalProperty("key2", "value2");
    snowflakeConnection
        .withConnectionArguments(connectionArguments)
        .withConnectionOptions(connectionOptions);
    update.withConnection(databaseConnection);
    service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    // Get the recently updated entity and verify the changes
    service = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    validateDatabaseConnection(
        databaseConnection, service.getConnection(), service.getServiceType(), true);
    assertEquals("description1", service.getDescription());
    // non admin/bot user, password fields must be masked
    DatabaseService newService = getEntity(service.getId(), "*", TEST_AUTH_HEADERS);
    assertEquals(newService.getName(), service.getName());
    validateDatabaseConnection(
        databaseConnection, newService.getConnection(), newService.getServiceType(), true);
    snowflakeConnection.setPassword("test123");
    databaseConnection.setConfig(snowflakeConnection);
    update.withConnection(databaseConnection);
    service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    // bot user, password fields must be unmasked.
    service = getEntity(service.getId(), INGESTION_BOT_AUTH_HEADERS);
    validateDatabaseConnection(
        databaseConnection, service.getConnection(), service.getServiceType(), false);
  }

  @Test
  void post_put_invalidConnection_as_admin_4xx(TestInfo test) throws IOException {
    RedshiftConnection redshiftConnection =
        new RedshiftConnection().withHostPort("localhost:3300").withUsername("test");
    DatabaseConnection dbConn = new DatabaseConnection().withConfig(redshiftConnection);
    CreateDatabaseService create = createRequest(test).withConnection(dbConn);
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        String.format(
            "Failed to convert [%s] to type [Snowflake]. Review the connection.",
            create.getName()));
    DatabaseService service =
        createAndCheckEntity(createRequest(test).withDescription(null), ADMIN_AUTH_HEADERS);
    // Update database description and ingestion service that are null
    CreateDatabaseService update =
        createRequest(test).withDescription("description1").withName(service.getName());

    ChangeDescription change = getChangeDescription(service, MINOR_UPDATE);
    fieldAdded(change, "description", "description1");
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    MysqlConnection mysqlConnection =
        new MysqlConnection().withHostPort("localhost:3300").withUsername("test");
    DatabaseConnection databaseConnection = new DatabaseConnection().withConfig(mysqlConnection);
    update.withConnection(databaseConnection);
    assertResponseContains(
        () -> updateEntity(update, OK, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Failed to load the connection of type [Snowflake]. Did migrations run properly?");
  }

  @Test
  void put_addIngestion_as_admin_2xx(TestInfo test) throws IOException {
    // Create database service without any database connection
    CreateDatabaseService create = createRequest(test);
    DatabaseService service = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    DatabaseConnection oldDatabaseConnection = create.getConnection();

    SnowflakeConnection snowflakeConnection =
        new SnowflakeConnection()
            .withDatabase("test")
            .withPassword("password")
            .withUsername("username");
    DatabaseConnection databaseConnection =
        new DatabaseConnection().withConfig(snowflakeConnection);

    // Update database connection to a new connection
    CreateDatabaseService update =
        createRequest(test).withConnection(databaseConnection).withName(service.getName());
    ChangeDescription change = getChangeDescription(service, MINOR_UPDATE);
    fieldUpdated(change, "connection", oldDatabaseConnection, databaseConnection);
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    oldDatabaseConnection = service.getConnection();
    oldDatabaseConnection.setConfig(
        JsonUtils.convertValue(oldDatabaseConnection.getConfig(), SnowflakeConnection.class));

    // Update the connection with additional property
    ConnectionArguments connectionArguments =
        new ConnectionArguments()
            .withAdditionalProperty("credentials", "/tmp/creds.json")
            .withAdditionalProperty("client_email", "ingestion-bot@domain.com");
    ConnectionOptions connectionOptions =
        new ConnectionOptions()
            .withAdditionalProperty("key1", "value1")
            .withAdditionalProperty("key2", "value2");
    snowflakeConnection
        .withConnectionArguments(connectionArguments)
        .withConnectionOptions(connectionOptions);
    databaseConnection.withConfig(snowflakeConnection);
    update.withConnection(databaseConnection);
    change = getChangeDescription(service, MINOR_UPDATE);
    fieldUpdated(change, "connection", oldDatabaseConnection, databaseConnection);
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add ingestion pipeline to the database service
    IngestionPipelineResourceTest ingestionPipelineResourceTest =
        new IngestionPipelineResourceTest();
    CreateIngestionPipeline createIngestionPipeline =
        ingestionPipelineResourceTest.createRequest(test).withService(service.getEntityReference());

    DatabaseServiceMetadataPipeline databaseServiceMetadataPipeline =
        new DatabaseServiceMetadataPipeline()
            .withMarkDeletedTables(true)
            .withIncludeViews(true)
            .withSchemaFilterPattern(
                new FilterPattern().withExcludes(List.of("information_schema.*", "test.*")))
            .withTableFilterPattern(
                new FilterPattern().withIncludes(List.of("sales.*", "users.*")));

    SourceConfig sourceConfig = new SourceConfig().withConfig(databaseServiceMetadataPipeline);
    createIngestionPipeline.withSourceConfig(sourceConfig);
    IngestionPipeline ingestionPipeline =
        ingestionPipelineResourceTest.createEntity(createIngestionPipeline, ADMIN_AUTH_HEADERS);

    DatabaseService updatedService = getEntity(service.getId(), "pipelines", ADMIN_AUTH_HEADERS);
    assertEquals(1, updatedService.getPipelines().size());
    assertReference(ingestionPipeline.getEntityReference(), updatedService.getPipelines().get(0));

    // Delete the database service and ensure ingestion pipeline is deleted
    deleteEntity(updatedService.getId(), true, true, ADMIN_AUTH_HEADERS);
    ingestionPipelineResourceTest.assertEntityDeleted(ingestionPipeline.getId(), true);
  }

  @Test
  void put_testConnectionResult_200(TestInfo test) throws IOException {
    DatabaseService service = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // By default, we have no result logged in
    assertNull(service.getTestConnectionResult());
    DatabaseService updatedService =
        putTestConnectionResult(service.getId(), TEST_CONNECTION_RESULT, ADMIN_AUTH_HEADERS);
    // Validate that the data got properly stored
    assertNotNull(updatedService.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL,
        updatedService.getTestConnectionResult().getStatus());
    assertEquals(updatedService.getConnection(), service.getConnection());
    // Check that the stored data is also correct
    DatabaseService stored = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(stored.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL, stored.getTestConnectionResult().getStatus());
    assertEquals(stored.getConnection(), service.getConnection());
  }

  @Test
  void get_listDatabaseServicesWithInvalidEnumValue_400() {
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("include", "invalid-enum-value");

    assertResponse(
        () -> listEntities(queryParams, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        invalidEnumValue(Include.class, "include"));

    assertResponse(
        () -> listEntities(queryParams, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        invalidEnumValue(Include.class));
  }

  @Test
  @SneakyThrows
  void testImportInvalidCsv() {
    DatabaseService service = createEntity(createRequest("invalidCsv"), ADMIN_AUTH_HEADERS);
    String serviceName = service.getFullyQualifiedName();
    DatabaseResourceTest databaseTest = new DatabaseResourceTest();
    CreateDatabase createDatabase = databaseTest.createRequest("s1").withService(serviceName);
    databaseTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    // Headers: name, displayName, description, owner, tags, glossaryTerms, tiers, domain, extension
    // Update database with invalid tags field
    String resultsHeader =
        recordToString(EntityCsv.getResultHeaders(getDatabaseServiceCsvHeaders(service, false)));
    String record = "d1,dsp1,dsc1,,Tag.invalidTag,,,,,";
    String csv = createCsv(getDatabaseServiceCsvHeaders(service, false), listOf(record), null);
    CsvImportResult result = importCsv(serviceName, csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    String[] expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, entityNotFound(4, "tag", "Tag.invalidTag"))
        };
    assertRows(result, expectedRows);

    //  invalid tag it will give error.
    record = "non-existing,dsp1,dsc1,,Tag.invalidTag,,,,,";
    csv = createCsv(getDatabaseServiceCsvHeaders(service, false), listOf(record), null);
    result = importCsv(serviceName, csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, entityNotFound(4, "tag", "Tag.invalidTag"))
        };
    assertRows(result, expectedRows);

    // database will be created if it does not exist
    String databaseFqn = FullyQualifiedName.add(serviceName, "non-existing");
    record = "non-existing,dsp1,dsc1,,,,,,,";
    csv = createCsv(getDatabaseServiceCsvHeaders(service, false), listOf(record), null);
    result = importCsv(serviceName, csv, false);
    assertSummary(result, ApiStatus.SUCCESS, 2, 2, 0);
    expectedRows = new String[] {resultsHeader, getSuccessRecord(record, "Entity created")};
    assertRows(result, expectedRows);
    Database createdDatabase = databaseTest.getEntityByName(databaseFqn, "id", ADMIN_AUTH_HEADERS);
    assertEquals(databaseFqn, createdDatabase.getFullyQualifiedName());
  }

  @Test
  void testImportExport() throws IOException {
    String user1 = USER1.getName();
    DatabaseService service = createEntity(createRequest("importExportTest"), ADMIN_AUTH_HEADERS);
    DatabaseResourceTest databaseTest = new DatabaseResourceTest();
    CreateDatabase createDatabase =
        databaseTest.createRequest("d1").withService(service.getFullyQualifiedName());
    databaseTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    // Create certification
    TagResourceTest tagResourceTest = new TagResourceTest();

    // Headers: name, displayName, description, owner, tags, glossaryTerms, tiers,
    // certification,domain, extension
    // Update terms with change in description
    String record =
        String.format(
            "d1,dsp1,new-dsc1,user:%s,,,Tier.Tier1,,%s,",
            user1, escapeCsv(DOMAIN.getFullyQualifiedName()));

    // Update created entity with changes
    importCsvAndValidate(
        service.getFullyQualifiedName(),
        getDatabaseServiceCsvHeaders(service, false),
        null,
        listOf(record));

    String clearRecord = "d1,dsp1,new-dsc2,,,,,,,";

    importCsvAndValidate(
        service.getFullyQualifiedName(),
        getDatabaseServiceCsvHeaders(service, false),
        null,
        listOf(clearRecord));

    String databaseFqn = String.format("%s.%s", service.getFullyQualifiedName(), "d1");
    Database updatedDb = databaseTest.getEntityByName(databaseFqn, ADMIN_AUTH_HEADERS);

    assertEquals("new-dsc2", updatedDb.getDescription());
    assertTrue(listOrEmpty(updatedDb.getOwners()).isEmpty(), "Owner should be cleared");
    assertTrue(listOrEmpty(updatedDb.getTags()).isEmpty(), "Tags should be empty after clearing");
    assertTrue(
        listOrEmpty(updatedDb.getDomains()).isEmpty(), "Domain should be null after clearing");
  }

  @Test
  void testImportExportRecursive() throws IOException {
    String serviceName = "importExportRecursiveService";

    // Step 1: Create the Database Service
    DatabaseService service = createEntity(createRequest(serviceName), ADMIN_AUTH_HEADERS);

    // Step 2: Create a Database under the Service
    DatabaseResourceTest dbTest = new DatabaseResourceTest();
    CreateDatabase createDatabase =
        dbTest.createRequest("db1").withService(service.getFullyQualifiedName());
    Database database = dbTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    // Step 3: Create a Schema under the Database
    DatabaseSchemaResourceTest schemaTest = new DatabaseSchemaResourceTest();
    CreateDatabaseSchema createSchema =
        schemaTest
            .createRequest("schema1")
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Initial schema description");
    DatabaseSchema schema = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    // Step 4: Create a Table with a Column
    TableResourceTest tableTest = new TableResourceTest();
    CreateTable createTable =
        tableTest
            .createRequest("table1")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Initial table description");
    createTable.getColumns().get(0).setDescription("Initial column description");
    Table table = tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Step 5: Export recursively
    String exportedCsv = exportCsvRecursive(service.getFullyQualifiedName());
    assertNotNull(exportedCsv);

    List<String> lines = List.of(exportedCsv.split(CsvUtil.LINE_SEPARATOR));
    assertTrue(lines.size() > 3, "Export should include database, schema, table, and column");

    String header = lines.get(0);
    List<String> modified = new ArrayList<>();
    modified.add(header);

    for (String line : lines.subList(1, lines.size())) {
      if (line.contains("schema1") && line.contains("databaseSchema")) {
        line = line.replace("Initial schema description", "Updated schema description");
      } else if (line.contains("table1") && line.contains("table") && !line.contains("column")) {
        line = line.replace("Initial table description", "Updated table description");
      } else if (line.contains("column")) {
        line = line.replace("Initial column description", "Updated column description");
      }
      modified.add(line);
    }

    String modifiedCsv = String.join(CsvUtil.LINE_SEPARATOR, modified) + CsvUtil.LINE_SEPARATOR;

    // Step 6: Import updated CSV
    CsvImportResult result =
        importCsvRecursive(service.getFullyQualifiedName(), modifiedCsv, false);
    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    // Step 7: Validate all updated descriptions
    DatabaseSchema updatedSchema =
        schemaTest.getEntityByName(
            schema.getFullyQualifiedName(), "description", ADMIN_AUTH_HEADERS);
    assertEquals("Updated schema description", updatedSchema.getDescription());

    Table updatedTable =
        tableTest.getEntityByName(table.getFullyQualifiedName(), "description", ADMIN_AUTH_HEADERS);
    assertEquals("Updated table description", updatedTable.getDescription());

    assertNotNull(updatedTable.getColumns());
    assertTrue(
        updatedTable.getColumns().stream()
            .anyMatch(c -> "Updated column description".equals(c.getDescription())),
        "At least one column should have updated description");
  }

  public DatabaseService putTestConnectionResult(
      UUID serviceId, TestConnectionResult testConnectionResult, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(serviceId).path("/testConnectionResult");
    return TestUtils.put(target, testConnectionResult, DatabaseService.class, OK, authHeaders);
  }

  @Override
  public CreateDatabaseService createRequest(String name) {
    return new CreateDatabaseService()
        .withName(name)
        .withServiceType(DatabaseServiceType.Snowflake)
        .withConnection(TestUtils.SNOWFLAKE_DATABASE_CONNECTION);
  }

  @Override
  public void validateCreatedEntity(
      DatabaseService service,
      CreateDatabaseService createRequest,
      Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), service.getName());
    boolean maskPasswords = !INGESTION_BOT_AUTH_HEADERS.equals(authHeaders);
    validateDatabaseConnection(
        createRequest.getConnection(),
        service.getConnection(),
        service.getServiceType(),
        maskPasswords);
  }

  @Override
  public void compareEntities(
      DatabaseService expected, DatabaseService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public DatabaseService validateGetWithDifferentFields(DatabaseService service, boolean byName)
      throws HttpResponseException {
    String fields = "";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNull(service.getOwners());

    fields = "owners,tags,followers";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owners, tags, and followers is done in the base class
    return service;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("ingestionSchedule")) {
      Schedule expectedSchedule = (Schedule) expected;
      Schedule actualSchedule = JsonUtils.readValue((String) actual, Schedule.class);
      assertEquals(expectedSchedule, actualSchedule);
    } else if (fieldName.equals("connection")) {
      assertTrue(((String) actual).contains("-encrypted-value"));
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void validateDatabaseConnection(
      DatabaseConnection expectedDatabaseConnection,
      DatabaseConnection actualDatabaseConnection,
      DatabaseServiceType databaseServiceType,
      boolean maskedPasswords) {
    // Validate Database Connection if available. We nullify when not admin or bot
    if (expectedDatabaseConnection != null && actualDatabaseConnection != null) {
      if (databaseServiceType == DatabaseServiceType.Mysql) {
        MysqlConnection expectedMysqlConnection =
            (MysqlConnection) expectedDatabaseConnection.getConfig();
        MysqlConnection actualMysqlConnection;
        if (actualDatabaseConnection.getConfig() instanceof MysqlConnection) {
          actualMysqlConnection = (MysqlConnection) actualDatabaseConnection.getConfig();
        } else {
          actualMysqlConnection =
              JsonUtils.convertValue(actualDatabaseConnection.getConfig(), MysqlConnection.class);
        }
        validateMysqlConnection(expectedMysqlConnection, actualMysqlConnection, maskedPasswords);
      } else if (databaseServiceType == DatabaseServiceType.BigQuery) {
        BigQueryConnection expectedBigQueryConnection =
            (BigQueryConnection) expectedDatabaseConnection.getConfig();
        BigQueryConnection actualBigQueryConnection;
        if (actualDatabaseConnection.getConfig() instanceof BigQueryConnection) {
          actualBigQueryConnection = (BigQueryConnection) actualDatabaseConnection.getConfig();
        } else {
          actualBigQueryConnection =
              JsonUtils.convertValue(
                  actualDatabaseConnection.getConfig(), BigQueryConnection.class);
        }
        validateBigQueryConnection(
            expectedBigQueryConnection, actualBigQueryConnection, maskedPasswords);
      } else if (databaseServiceType == DatabaseServiceType.Redshift) {
        RedshiftConnection expectedRedshiftConnection =
            (RedshiftConnection) expectedDatabaseConnection.getConfig();
        RedshiftConnection actualRedshiftConnection;
        if (actualDatabaseConnection.getConfig() instanceof RedshiftConnection) {
          actualRedshiftConnection = (RedshiftConnection) actualDatabaseConnection.getConfig();
        } else {
          actualRedshiftConnection =
              JsonUtils.convertValue(
                  actualDatabaseConnection.getConfig(), RedshiftConnection.class);
        }
        validateRedshiftConnection(
            expectedRedshiftConnection, actualRedshiftConnection, maskedPasswords);
      } else if (databaseServiceType == DatabaseServiceType.Snowflake) {
        SnowflakeConnection expectedSnowflakeConnection =
            (SnowflakeConnection) expectedDatabaseConnection.getConfig();
        SnowflakeConnection actualSnowflakeConnection;
        if (actualDatabaseConnection.getConfig() instanceof SnowflakeConnection) {
          actualSnowflakeConnection = (SnowflakeConnection) actualDatabaseConnection.getConfig();
        } else {
          actualSnowflakeConnection =
              JsonUtils.convertValue(
                  actualDatabaseConnection.getConfig(), SnowflakeConnection.class);
        }
        validateSnowflakeConnection(
            expectedSnowflakeConnection, actualSnowflakeConnection, maskedPasswords);
      }
    }
  }

  public static void validateMysqlConnection(
      MysqlConnection expectedMysqlConnection,
      MysqlConnection actualMysqlConnection,
      boolean maskedPasswords) {
    assertEquals(
        expectedMysqlConnection.getDatabaseSchema(), actualMysqlConnection.getDatabaseSchema());
    assertEquals(expectedMysqlConnection.getHostPort(), actualMysqlConnection.getHostPort());
    assertEquals(expectedMysqlConnection.getUsername(), actualMysqlConnection.getUsername());
    assertEquals(
        expectedMysqlConnection.getConnectionOptions(),
        actualMysqlConnection.getConnectionOptions());
    assertEquals(
        expectedMysqlConnection.getConnectionArguments(),
        actualMysqlConnection.getConnectionArguments());
    if (maskedPasswords) {
      assertEquals(
          PasswordEntityMasker.PASSWORD_MASK,
          JsonUtils.convertValue(actualMysqlConnection.getAuthType(), basicAuth.class)
              .getPassword());
    } else {
      assertEquals(
          JsonUtils.convertValue(expectedMysqlConnection.getAuthType(), basicAuth.class)
              .getPassword(),
          JsonUtils.convertValue(actualMysqlConnection.getAuthType(), basicAuth.class)
              .getPassword());
    }
  }

  public static void validateBigQueryConnection(
      BigQueryConnection expectedBigQueryConnection,
      BigQueryConnection actualBigQueryConnection,
      boolean maskedPasswords) {
    assertEquals(expectedBigQueryConnection.getHostPort(), actualBigQueryConnection.getHostPort());
    assertEquals(
        expectedBigQueryConnection.getCredentials(), actualBigQueryConnection.getCredentials());
    assertEquals(expectedBigQueryConnection.getScheme(), actualBigQueryConnection.getScheme());
    assertEquals(
        expectedBigQueryConnection.getConnectionArguments(),
        actualBigQueryConnection.getConnectionArguments());
    assertEquals(
        expectedBigQueryConnection.getConnectionOptions(),
        actualBigQueryConnection.getConnectionOptions());
    if (!maskedPasswords) {
      assertEquals(
          expectedBigQueryConnection.getCredentials(), actualBigQueryConnection.getCredentials());
    }
  }

  public static void validateRedshiftConnection(
      RedshiftConnection expectedRedshiftConnection,
      RedshiftConnection actualRedshiftConnection,
      boolean maskedPasswords) {
    assertEquals(expectedRedshiftConnection.getHostPort(), actualRedshiftConnection.getHostPort());
    assertEquals(expectedRedshiftConnection.getUsername(), actualRedshiftConnection.getUsername());
    assertEquals(expectedRedshiftConnection.getScheme(), actualRedshiftConnection.getScheme());
    assertEquals(expectedRedshiftConnection.getDatabase(), actualRedshiftConnection.getDatabase());
    assertEquals(
        expectedRedshiftConnection.getConnectionArguments(),
        actualRedshiftConnection.getConnectionArguments());
    assertEquals(
        expectedRedshiftConnection.getConnectionOptions(),
        actualRedshiftConnection.getConnectionOptions());
    if (maskedPasswords) {
      assertEquals(PasswordEntityMasker.PASSWORD_MASK, actualRedshiftConnection.getPassword());
    } else {
      assertEquals(
          expectedRedshiftConnection.getPassword(), actualRedshiftConnection.getPassword());
    }
  }

  public static void validateSnowflakeConnection(
      SnowflakeConnection expectedSnowflakeConnection,
      SnowflakeConnection actualSnowflakeConnection,
      boolean maskedPasswords) {
    assertEquals(expectedSnowflakeConnection.getRole(), actualSnowflakeConnection.getRole());
    assertEquals(
        expectedSnowflakeConnection.getUsername(), actualSnowflakeConnection.getUsername());
    assertEquals(expectedSnowflakeConnection.getScheme(), actualSnowflakeConnection.getScheme());
    assertEquals(
        expectedSnowflakeConnection.getDatabase(), actualSnowflakeConnection.getDatabase());
    assertEquals(
        expectedSnowflakeConnection.getConnectionArguments(),
        actualSnowflakeConnection.getConnectionArguments());
    assertEquals(
        expectedSnowflakeConnection.getConnectionOptions(),
        actualSnowflakeConnection.getConnectionOptions());
    if (maskedPasswords) {
      assertEquals(PasswordEntityMasker.PASSWORD_MASK, actualSnowflakeConnection.getPassword());
    } else {
      assertEquals(
          expectedSnowflakeConnection.getPassword(), actualSnowflakeConnection.getPassword());
    }
  }
}
