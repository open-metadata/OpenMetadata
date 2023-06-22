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

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
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
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Schedule;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.database.DatabaseServiceResource.DatabaseServiceList;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResourceTest;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.service.util.TestUtils.UpdateType;

@Slf4j
public class DatabaseServiceResourceTest extends EntityResourceTest<DatabaseService, CreateDatabaseService> {
  public DatabaseServiceResourceTest() {
    super(
        Entity.DATABASE_SERVICE,
        DatabaseService.class,
        DatabaseServiceList.class,
        "services/databaseServices",
        "owner,tags");
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
    fieldAdded(change, "description", "description1");
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
    SnowflakeConnection snowflakeConnection = new SnowflakeConnection().withUsername("test").withPassword("test12");
    DatabaseConnection databaseConnection = new DatabaseConnection().withConfig(snowflakeConnection);
    update.withConnection(databaseConnection);
    service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    validateDatabaseConnection(databaseConnection, service.getConnection(), service.getServiceType(), true);
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
    validateDatabaseConnection(databaseConnection, service.getConnection(), service.getServiceType(), true);
    assertEquals("description1", service.getDescription());
    // non admin/bot user, password fields must be masked
    DatabaseService newService = getEntity(service.getId(), "*", TEST_AUTH_HEADERS);
    assertEquals(newService.getName(), service.getName());
    validateDatabaseConnection(databaseConnection, newService.getConnection(), newService.getServiceType(), true);
    snowflakeConnection.setPassword("test123");
    databaseConnection.setConfig(snowflakeConnection);
    update.withConnection(databaseConnection);
    service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    // bot user, password fields must be unmasked.
    service = getEntity(service.getId(), INGESTION_BOT_AUTH_HEADERS);
    validateDatabaseConnection(databaseConnection, service.getConnection(), service.getServiceType(), false);
  }

  @Test
  void post_put_invalidConnection_as_admin_4xx(TestInfo test) throws IOException {
    RedshiftConnection redshiftConnection =
        new RedshiftConnection().withHostPort("localhost:3300").withUsername("test");
    DatabaseConnection dbConn = new DatabaseConnection().withConfig(redshiftConnection);
    assertResponseContains(
        () -> createEntity(createRequest(test).withDescription(null).withConnection(dbConn), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "InvalidServiceConnectionException for service [Snowflake] due to [Failed to encrypt connection instance of Snowflake]");
    DatabaseService service = createAndCheckEntity(createRequest(test).withDescription(null), ADMIN_AUTH_HEADERS);
    // Update database description and ingestion service that are null
    CreateDatabaseService update = createRequest(test).withDescription("description1");

    ChangeDescription change = getChangeDescription(service.getVersion());
    fieldAdded(change, "description", "description1");
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
    MysqlConnection mysqlConnection = new MysqlConnection().withHostPort("localhost:3300").withUsername("test");
    DatabaseConnection databaseConnection = new DatabaseConnection().withConfig(mysqlConnection);
    update.withConnection(databaseConnection);
    assertResponseContains(
        () -> updateEntity(update, OK, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "InvalidServiceConnectionException for service [Snowflake] due to [Failed to unmask connection instance of Snowflake].");
  }

  @Test
  void put_addIngestion_as_admin_2xx(TestInfo test) throws IOException {
    // Create database service without any database connection
    CreateDatabaseService create = createRequest(test);
    DatabaseService service = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    DatabaseConnection oldDatabaseConnection = create.getConnection();

    SnowflakeConnection snowflakeConnection =
        new SnowflakeConnection().withDatabase("test").withPassword("password").withUsername("username");
    DatabaseConnection databaseConnection = new DatabaseConnection().withConfig(snowflakeConnection);

    // Update database connection to a new connection
    CreateDatabaseService update = createRequest(test).withConnection(databaseConnection);
    ChangeDescription change = getChangeDescription(service.getVersion());
    fieldUpdated(change, "connection", oldDatabaseConnection, databaseConnection);
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
    fieldUpdated(change, "connection", oldDatabaseConnection, databaseConnection);
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Add ingestion pipeline to the database service
    IngestionPipelineResourceTest ingestionPipelineResourceTest = new IngestionPipelineResourceTest();
    CreateIngestionPipeline createIngestionPipeline =
        ingestionPipelineResourceTest.createRequest(test).withService(service.getEntityReference());

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
    assertEquals(updatedService.getTestConnectionResult().getStatus(), TestConnectionResultStatus.SUCCESSFUL);
    assertEquals(updatedService.getConnection(), service.getConnection());
    // Check that the stored data is also correct
    DatabaseService stored = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(stored.getTestConnectionResult());
    assertEquals(stored.getTestConnectionResult().getStatus(), TestConnectionResultStatus.SUCCESSFUL);
    assertEquals(stored.getConnection(), service.getConnection());
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
      DatabaseService service, CreateDatabaseService createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), service.getName());
    boolean maskPasswords = !INGESTION_BOT_AUTH_HEADERS.equals(authHeaders);
    validateDatabaseConnection(
        createRequest.getConnection(), service.getConnection(), service.getServiceType(), maskPasswords);
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

    fields = "owner,tags";
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
      assertTrue(((String) actual).contains("-encrypted-value"));
    } else {
      super.assertCommonFieldChange(fieldName, expected, actual);
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
        MysqlConnection expectedMysqlConnection = (MysqlConnection) expectedDatabaseConnection.getConfig();
        MysqlConnection actualMysqlConnection;
        if (actualDatabaseConnection.getConfig() instanceof MysqlConnection) {
          actualMysqlConnection = (MysqlConnection) actualDatabaseConnection.getConfig();
        } else {
          actualMysqlConnection = JsonUtils.convertValue(actualDatabaseConnection.getConfig(), MysqlConnection.class);
        }
        validateMysqlConnection(expectedMysqlConnection, actualMysqlConnection, maskedPasswords);
      } else if (databaseServiceType == DatabaseServiceType.BigQuery) {
        BigQueryConnection expectedBigQueryConnection = (BigQueryConnection) expectedDatabaseConnection.getConfig();
        BigQueryConnection actualBigQueryConnection;
        if (actualDatabaseConnection.getConfig() instanceof BigQueryConnection) {
          actualBigQueryConnection = (BigQueryConnection) actualDatabaseConnection.getConfig();
        } else {
          actualBigQueryConnection =
              JsonUtils.convertValue(actualDatabaseConnection.getConfig(), BigQueryConnection.class);
        }
        validateBigQueryConnection(expectedBigQueryConnection, actualBigQueryConnection, maskedPasswords);
      } else if (databaseServiceType == DatabaseServiceType.Redshift) {
        RedshiftConnection expectedRedshiftConnection = (RedshiftConnection) expectedDatabaseConnection.getConfig();
        RedshiftConnection actualRedshiftConnection;
        if (actualDatabaseConnection.getConfig() instanceof RedshiftConnection) {
          actualRedshiftConnection = (RedshiftConnection) actualDatabaseConnection.getConfig();
        } else {
          actualRedshiftConnection =
              JsonUtils.convertValue(actualDatabaseConnection.getConfig(), RedshiftConnection.class);
        }
        validateRedshiftConnection(expectedRedshiftConnection, actualRedshiftConnection, maskedPasswords);
      } else if (databaseServiceType == DatabaseServiceType.Snowflake) {
        SnowflakeConnection expectedSnowflakeConnection = (SnowflakeConnection) expectedDatabaseConnection.getConfig();
        SnowflakeConnection actualSnowflakeConnection;
        if (actualDatabaseConnection.getConfig() instanceof SnowflakeConnection) {
          actualSnowflakeConnection = (SnowflakeConnection) actualDatabaseConnection.getConfig();
        } else {
          actualSnowflakeConnection =
              JsonUtils.convertValue(actualDatabaseConnection.getConfig(), SnowflakeConnection.class);
        }
        validateSnowflakeConnection(expectedSnowflakeConnection, actualSnowflakeConnection, maskedPasswords);
      }
    }
  }

  public static void validateMysqlConnection(
      MysqlConnection expectedMysqlConnection, MysqlConnection actualMysqlConnection, boolean maskedPasswords) {
    assertEquals(expectedMysqlConnection.getDatabaseSchema(), actualMysqlConnection.getDatabaseSchema());
    assertEquals(expectedMysqlConnection.getHostPort(), actualMysqlConnection.getHostPort());
    assertEquals(expectedMysqlConnection.getUsername(), actualMysqlConnection.getUsername());
    assertEquals(expectedMysqlConnection.getConnectionOptions(), actualMysqlConnection.getConnectionOptions());
    assertEquals(expectedMysqlConnection.getConnectionArguments(), actualMysqlConnection.getConnectionArguments());
    if (maskedPasswords) {
      assertEquals(
          JsonUtils.convertValue(actualMysqlConnection.getAuthType(), basicAuth.class).getPassword(),
          PasswordEntityMasker.PASSWORD_MASK);
    } else {
      assertEquals(
          JsonUtils.convertValue(expectedMysqlConnection.getAuthType(), basicAuth.class).getPassword(),
          JsonUtils.convertValue(actualMysqlConnection.getAuthType(), basicAuth.class).getPassword());
    }
  }

  public static void validateBigQueryConnection(
      BigQueryConnection expectedBigQueryConnection,
      BigQueryConnection actualBigQueryConnection,
      boolean maskedPasswords) {
    assertEquals(expectedBigQueryConnection.getHostPort(), actualBigQueryConnection.getHostPort());
    assertEquals(expectedBigQueryConnection.getCredentials(), actualBigQueryConnection.getCredentials());
    assertEquals(expectedBigQueryConnection.getScheme(), actualBigQueryConnection.getScheme());
    assertEquals(
        expectedBigQueryConnection.getConnectionArguments(), actualBigQueryConnection.getConnectionArguments());
    assertEquals(expectedBigQueryConnection.getConnectionOptions(), actualBigQueryConnection.getConnectionOptions());
    if (!maskedPasswords) {
      assertEquals(expectedBigQueryConnection.getCredentials(), actualBigQueryConnection.getCredentials());
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
        expectedRedshiftConnection.getConnectionArguments(), actualRedshiftConnection.getConnectionArguments());
    assertEquals(expectedRedshiftConnection.getConnectionOptions(), actualRedshiftConnection.getConnectionOptions());
    if (maskedPasswords) {
      assertEquals(actualRedshiftConnection.getPassword(), PasswordEntityMasker.PASSWORD_MASK);
    } else {
      assertEquals(expectedRedshiftConnection.getPassword(), actualRedshiftConnection.getPassword());
    }
  }

  public static void validateSnowflakeConnection(
      SnowflakeConnection expectedSnowflakeConnection,
      SnowflakeConnection actualSnowflakeConnection,
      boolean maskedPasswords) {
    assertEquals(expectedSnowflakeConnection.getRole(), actualSnowflakeConnection.getRole());
    assertEquals(expectedSnowflakeConnection.getUsername(), actualSnowflakeConnection.getUsername());
    assertEquals(expectedSnowflakeConnection.getScheme(), actualSnowflakeConnection.getScheme());
    assertEquals(expectedSnowflakeConnection.getDatabase(), actualSnowflakeConnection.getDatabase());
    assertEquals(
        expectedSnowflakeConnection.getConnectionArguments(), actualSnowflakeConnection.getConnectionArguments());
    assertEquals(expectedSnowflakeConnection.getConnectionOptions(), actualSnowflakeConnection.getConnectionOptions());
    if (maskedPasswords) {
      assertEquals(actualSnowflakeConnection.getPassword(), PasswordEntityMasker.PASSWORD_MASK);
    } else {
      assertEquals(expectedSnowflakeConnection.getPassword(), actualSnowflakeConnection.getPassword());
    }
  }
}
