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

package org.openmetadata.catalog.resources.services;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;
import static org.openmetadata.catalog.util.TestUtils.getPrincipal;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.catalog.api.services.DatabaseConnection;
import org.openmetadata.catalog.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.catalog.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.catalog.metadataIngestion.FilterPattern;
import org.openmetadata.catalog.metadataIngestion.SourceConfig;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.services.database.DatabaseServiceResource.DatabaseServiceList;
import org.openmetadata.catalog.resources.services.ingestionpipelines.IngestionPipelineResourceTest;
import org.openmetadata.catalog.services.connections.database.BigQueryConnection;
import org.openmetadata.catalog.services.connections.database.ConnectionArguments;
import org.openmetadata.catalog.services.connections.database.ConnectionOptions;
import org.openmetadata.catalog.services.connections.database.MysqlConnection;
import org.openmetadata.catalog.services.connections.database.RedshiftConnection;
import org.openmetadata.catalog.services.connections.database.SnowflakeConnection;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

@Slf4j
public class DatabaseServiceResourceTest extends EntityResourceTest<DatabaseService, CreateDatabaseService> {
  public DatabaseServiceResourceTest() {
    super(
        Entity.DATABASE_SERVICE,
        DatabaseService.class,
        DatabaseServiceList.class,
        "services/databaseServices",
        "owner");
    this.supportsPatch = false;
    this.supportsAuthorizedMetadataOperations = false;
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
    databaseService = databaseServiceResourceTest.createEntity(createDatabaseService, ADMIN_AUTH_HEADERS);
    REDSHIFT_REFERENCE = databaseService.getEntityReference();

    createDatabaseService
        .withName("bigQueryDB")
        .withServiceType(DatabaseServiceType.BigQuery)
        .withConnection(TestUtils.BIGQUERY_DATABASE_CONNECTION);
    databaseService = databaseServiceResourceTest.createEntity(createDatabaseService, ADMIN_AUTH_HEADERS);
    BIGQUERY_REFERENCE = databaseService.getEntityReference();

    createDatabaseService
        .withName("mysqlDB")
        .withServiceType(DatabaseServiceType.Mysql)
        .withConnection(TestUtils.MYSQL_DATABASE_CONNECTION);
    databaseService = databaseServiceResourceTest.createEntity(createDatabaseService, ADMIN_AUTH_HEADERS);
    MYSQL_REFERENCE = databaseService.getEntityReference();
  }

  @Test
  void post_validDatabaseService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create database service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);
  }

  @Test
  void post_invalidDatabaseServiceNoConnection_4xx(TestInfo test) {
    // No jdbc connection set
    CreateDatabaseService create = createRequest(test).withConnection(null);
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "connection must not be null");
  }

  @Test
  void put_updateDatabaseService_as_admin_2xx(TestInfo test) throws IOException {
    DatabaseService service = createAndCheckEntity(createRequest(test).withDescription(null), ADMIN_AUTH_HEADERS);

    // Update database description and ingestion service that are null
    CreateDatabaseService update = createRequest(test).withDescription("description1");

    ChangeDescription change = getChangeDescription(service.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("description1"));
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
    SnowflakeConnection snowflakeConnection = new SnowflakeConnection().withUsername("test");
    DatabaseConnection databaseConnection = new DatabaseConnection().withConfig(snowflakeConnection);
    update.withConnection(databaseConnection);
    service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    validateDatabaseConnection(databaseConnection, service.getConnection(), service.getServiceType());
    ConnectionArguments connectionArguments =
        new ConnectionArguments()
            .withAdditionalProperty("credentials", "/tmp/creds.json")
            .withAdditionalProperty("client_email", "ingestion-bot@domain.com");
    ConnectionOptions connectionOptions =
        new ConnectionOptions().withAdditionalProperty("key1", "value1").withAdditionalProperty("key2", "value2");
    snowflakeConnection.withConnectionArguments(connectionArguments).withConnectionOptions(connectionOptions);
    update.withConnection(databaseConnection);
    service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    // Get the recently updated entity and verify the changes
    service = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    validateDatabaseConnection(databaseConnection, service.getConnection(), service.getServiceType());
    assertEquals("description1", service.getDescription());
  }

  @Test
  void post_put_invalidConnection_as_admin_4xx(TestInfo test) throws IOException {
    RedshiftConnection redshiftConnection =
        new RedshiftConnection().withHostPort("localhost:3300").withUsername("test");
    DatabaseConnection dbConn = new DatabaseConnection().withConfig(redshiftConnection);
    assertResponseContains(
        () -> createEntity(createRequest(test).withDescription(null).withConnection(dbConn), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "InvalidServiceConnectionException for service [Snowflake] due to [Failed to construct connection instance of Snowflake]");
    DatabaseService service = createAndCheckEntity(createRequest(test).withDescription(null), ADMIN_AUTH_HEADERS);
    // Update database description and ingestion service that are null
    CreateDatabaseService update = createRequest(test).withDescription("description1");

    ChangeDescription change = getChangeDescription(service.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("description1"));
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
    MysqlConnection mysqlConnection = new MysqlConnection().withHostPort("localhost:3300").withUsername("test");
    DatabaseConnection databaseConnection = new DatabaseConnection().withConfig(mysqlConnection);
    update.withConnection(databaseConnection);
    assertResponseContains(
        () -> updateEntity(update, OK, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "InvalidServiceConnectionException for service [Snowflake] due to [Failed to construct connection instance of Snowflake]");
  }

  @Test
  void put_addIngestion_as_admin_2xx(TestInfo test) throws IOException {
    // Create database service without any database connection
    CreateDatabaseService create = createRequest(test);
    DatabaseService service = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    EntityReference serviceRef = service.getEntityReference();
    DatabaseConnection oldDatabaseConnection = create.getConnection();

    SnowflakeConnection snowflakeConnection =
        new SnowflakeConnection().withDatabase("test").withPassword("password").withUsername("username");
    DatabaseConnection databaseConnection = new DatabaseConnection().withConfig(snowflakeConnection);

    // Update database connection to a new connection
    CreateDatabaseService update = createRequest(test).withConnection(databaseConnection);
    ChangeDescription change = getChangeDescription(service.getVersion());
    change
        .getFieldsUpdated()
        .add(
            new FieldChange()
                .withName("connection")
                .withOldValue(oldDatabaseConnection)
                .withNewValue(databaseConnection));
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
    oldDatabaseConnection = service.getConnection();
    oldDatabaseConnection.setConfig(
        JsonUtils.convertValue(oldDatabaseConnection.getConfig(), SnowflakeConnection.class));

    // Update the connection with additional property
    ConnectionArguments connectionArguments =
        new ConnectionArguments()
            .withAdditionalProperty("credentials", "/tmp/creds.json")
            .withAdditionalProperty("client_email", "ingestion-bot@domain.com");
    ConnectionOptions connectionOptions =
        new ConnectionOptions().withAdditionalProperty("key1", "value1").withAdditionalProperty("key2", "value2");
    snowflakeConnection.withConnectionArguments(connectionArguments).withConnectionOptions(connectionOptions);
    databaseConnection.withConfig(snowflakeConnection);
    update.withConnection(databaseConnection);
    change = getChangeDescription(service.getVersion());
    change
        .getFieldsUpdated()
        .add(
            new FieldChange()
                .withName("connection")
                .withOldValue(oldDatabaseConnection)
                .withNewValue(databaseConnection));
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Add ingestion pipeline to the database service
    IngestionPipelineResourceTest ingestionPipelineResourceTest = new IngestionPipelineResourceTest();
    CreateIngestionPipeline createIngestionPipeline =
        ingestionPipelineResourceTest.createRequest(test).withService(serviceRef);

    DatabaseServiceMetadataPipeline databaseServiceMetadataPipeline =
        new DatabaseServiceMetadataPipeline()
            .withMarkDeletedTables(true)
            .withIncludeViews(true)
            .withSchemaFilterPattern(new FilterPattern().withExcludes(List.of("information_schema.*", "test.*")))
            .withTableFilterPattern(new FilterPattern().withIncludes(List.of("sales.*", "users.*")));

    SourceConfig sourceConfig = new SourceConfig().withConfig(databaseServiceMetadataPipeline);
    createIngestionPipeline.withSourceConfig(sourceConfig);
    IngestionPipeline ingestionPipeline =
        ingestionPipelineResourceTest.createEntity(createIngestionPipeline, ADMIN_AUTH_HEADERS);

    DatabaseService updatedService = getEntity(service.getId(), "pipelines", ADMIN_AUTH_HEADERS);
    assertEquals(1, updatedService.getPipelines().size());
    assertReference(ingestionPipeline.getEntityReference(), updatedService.getPipelines().get(0));

    // TODO remove this
    DatabaseConnection expectedDatabaseConnection =
        JsonUtils.convertValue(ingestionPipeline.getSource().getServiceConnection(), DatabaseConnection.class);
    SnowflakeConnection expectedSnowflake =
        JsonUtils.convertValue(expectedDatabaseConnection.getConfig(), SnowflakeConnection.class);
    assertEquals(expectedSnowflake, snowflakeConnection);

    // Delete the database service and ensure ingestion pipeline is deleted
    deleteEntity(updatedService.getId(), true, true, ADMIN_AUTH_HEADERS);
    ingestionPipelineResourceTest.assertEntityDeleted(ingestionPipeline.getId(), true);
  }

  @Override
  public CreateDatabaseService createRequest(
      String name, String description, String displayName, EntityReference owner) {
    return new CreateDatabaseService()
        .withName(name)
        .withServiceType(DatabaseServiceType.Snowflake)
        .withConnection(TestUtils.SNOWFLAKE_DATABASE_CONNECTION)
        .withOwner(owner)
        .withDescription(description);
  }

  @Override
  public void validateCreatedEntity(
      DatabaseService service, CreateDatabaseService createRequest, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        service, createRequest.getDescription(), getPrincipal(authHeaders), createRequest.getOwner());
    assertEquals(createRequest.getName(), service.getName());

    validateDatabaseConnection(createRequest.getConnection(), service.getConnection(), service.getServiceType());
  }

  @Override
  public void compareEntities(DatabaseService expected, DatabaseService updated, Map<String, String> authHeaders) {
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
    TestUtils.assertListNull(service.getOwner());

    fields = "owner";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owner, tags, and followers is done in the base class
    return service;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (fieldName.equals("ingestionSchedule")) {
      Schedule expectedSchedule = (Schedule) expected;
      Schedule actualSchedule = JsonUtils.readValue((String) actual, Schedule.class);
      assertEquals(expectedSchedule, actualSchedule);
    } else if (fieldName.equals("connection")) {
      DatabaseConnection expectedConnection = (DatabaseConnection) expected;
      DatabaseConnection actualConnection = JsonUtils.readValue((String) actual, DatabaseConnection.class);
      actualConnection.setConfig(JsonUtils.convertValue(actualConnection.getConfig(), SnowflakeConnection.class));
      // TODO remove this hardcoding
      validateDatabaseConnection(expectedConnection, actualConnection, DatabaseServiceType.Snowflake);
    } else {
      super.assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void validateDatabaseConnection(
      DatabaseConnection expectedDatabaseConnection,
      DatabaseConnection actualDatabaseConnection,
      DatabaseServiceType databaseServiceType) {
    // Validate Database Connection if available. We nullify when not admin or bot
    if (expectedDatabaseConnection != null) {
      if (databaseServiceType == DatabaseServiceType.Mysql) {
        MysqlConnection expectedMysqlConnection = (MysqlConnection) expectedDatabaseConnection.getConfig();
        MysqlConnection actualMysqlConnection;
        if (actualDatabaseConnection.getConfig() instanceof MysqlConnection) {
          actualMysqlConnection = (MysqlConnection) actualDatabaseConnection.getConfig();
        } else {
          actualMysqlConnection = JsonUtils.convertValue(actualDatabaseConnection.getConfig(), MysqlConnection.class);
        }
        validateMysqlConnection(expectedMysqlConnection, actualMysqlConnection);
      } else if (databaseServiceType == DatabaseServiceType.BigQuery) {
        BigQueryConnection expectedBigQueryConnection = (BigQueryConnection) expectedDatabaseConnection.getConfig();
        BigQueryConnection actualBigQueryConnection;
        if (actualDatabaseConnection.getConfig() instanceof BigQueryConnection) {
          actualBigQueryConnection = (BigQueryConnection) actualDatabaseConnection.getConfig();
        } else {
          actualBigQueryConnection =
              JsonUtils.convertValue(actualDatabaseConnection.getConfig(), BigQueryConnection.class);
        }
        validateBigQueryConnection(expectedBigQueryConnection, actualBigQueryConnection);
      } else if (databaseServiceType == DatabaseServiceType.Redshift) {
        RedshiftConnection expectedRedshiftConnection = (RedshiftConnection) expectedDatabaseConnection.getConfig();
        RedshiftConnection actualRedshiftConnection;
        if (actualDatabaseConnection.getConfig() instanceof RedshiftConnection) {
          actualRedshiftConnection = (RedshiftConnection) actualDatabaseConnection.getConfig();
        } else {
          actualRedshiftConnection =
              JsonUtils.convertValue(actualDatabaseConnection.getConfig(), RedshiftConnection.class);
        }
        validateRedshiftConnection(expectedRedshiftConnection, actualRedshiftConnection);
      } else if (databaseServiceType == DatabaseServiceType.Snowflake) {
        SnowflakeConnection expectedSnowflakeConnection = (SnowflakeConnection) expectedDatabaseConnection.getConfig();
        SnowflakeConnection actualSnowflakeConnection;
        if (actualDatabaseConnection.getConfig() instanceof SnowflakeConnection) {
          actualSnowflakeConnection = (SnowflakeConnection) actualDatabaseConnection.getConfig();
        } else {
          actualSnowflakeConnection =
              JsonUtils.convertValue(actualDatabaseConnection.getConfig(), SnowflakeConnection.class);
        }
        validateSnowflakeConnection(expectedSnowflakeConnection, actualSnowflakeConnection);
      }
    }
  }

  public static void validateMysqlConnection(
      MysqlConnection expectedMysqlConnection, MysqlConnection actualMysqlConnection) {
    assertEquals(expectedMysqlConnection.getDatabase(), actualMysqlConnection.getDatabase());
    assertEquals(expectedMysqlConnection.getHostPort(), actualMysqlConnection.getHostPort());
    assertEquals(expectedMysqlConnection.getUsername(), actualMysqlConnection.getUsername());
    assertEquals(expectedMysqlConnection.getPassword(), actualMysqlConnection.getPassword());
    assertEquals(expectedMysqlConnection.getConnectionOptions(), actualMysqlConnection.getConnectionOptions());
    assertEquals(expectedMysqlConnection.getConnectionArguments(), actualMysqlConnection.getConnectionArguments());
  }

  public static void validateBigQueryConnection(
      BigQueryConnection expectedBigQueryConnection, BigQueryConnection actualBigQueryConnection) {
    assertEquals(expectedBigQueryConnection.getHostPort(), actualBigQueryConnection.getHostPort());
    assertEquals(expectedBigQueryConnection.getCredentials(), actualBigQueryConnection.getCredentials());
    assertEquals(expectedBigQueryConnection.getUsername(), actualBigQueryConnection.getUsername());
    assertEquals(expectedBigQueryConnection.getScheme(), actualBigQueryConnection.getScheme());
    assertEquals(expectedBigQueryConnection.getDatabase(), actualBigQueryConnection.getDatabase());
    assertEquals(
        expectedBigQueryConnection.getConnectionArguments(), actualBigQueryConnection.getConnectionArguments());
    assertEquals(expectedBigQueryConnection.getConnectionOptions(), actualBigQueryConnection.getConnectionOptions());
  }

  public static void validateRedshiftConnection(
      RedshiftConnection expectedRedshiftConnection, RedshiftConnection actualRedshiftConnection) {
    assertEquals(expectedRedshiftConnection.getHostPort(), actualRedshiftConnection.getHostPort());
    assertEquals(expectedRedshiftConnection.getUsername(), actualRedshiftConnection.getUsername());
    assertEquals(expectedRedshiftConnection.getScheme(), actualRedshiftConnection.getScheme());
    assertEquals(expectedRedshiftConnection.getDatabase(), actualRedshiftConnection.getDatabase());
    assertEquals(
        expectedRedshiftConnection.getConnectionArguments(), actualRedshiftConnection.getConnectionArguments());
    assertEquals(expectedRedshiftConnection.getConnectionOptions(), actualRedshiftConnection.getConnectionOptions());
  }

  public static void validateSnowflakeConnection(
      SnowflakeConnection expectedSnowflakeConnection, SnowflakeConnection actualSnowflakeConnection) {
    assertEquals(expectedSnowflakeConnection.getRole(), actualSnowflakeConnection.getRole());
    assertEquals(expectedSnowflakeConnection.getUsername(), actualSnowflakeConnection.getUsername());
    assertEquals(expectedSnowflakeConnection.getScheme(), actualSnowflakeConnection.getScheme());
    assertEquals(expectedSnowflakeConnection.getDatabase(), actualSnowflakeConnection.getDatabase());
    assertEquals(
        expectedSnowflakeConnection.getConnectionArguments(), actualSnowflakeConnection.getConnectionArguments());
    assertEquals(expectedSnowflakeConnection.getConnectionOptions(), actualSnowflakeConnection.getConnectionOptions());
  }
}
