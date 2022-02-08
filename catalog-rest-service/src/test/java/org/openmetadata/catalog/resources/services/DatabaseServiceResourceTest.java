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

import static java.util.Arrays.asList;
import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.Entity.helper;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.getPrincipal;

import io.dropwizard.db.DataSourceFactory;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.operations.pipelines.CreateAirflowPipeline;
import org.openmetadata.catalog.api.operations.pipelines.PipelineConfig;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.fernet.Fernet;
import org.openmetadata.catalog.jdbi3.DatabaseServiceRepository.DatabaseServiceEntityInterface;
import org.openmetadata.catalog.operations.pipelines.AirflowPipeline;
import org.openmetadata.catalog.operations.pipelines.DatabaseServiceMetadataPipeline;
import org.openmetadata.catalog.operations.pipelines.FilterPattern;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.operations.AirflowPipelineResourceTest;
import org.openmetadata.catalog.resources.services.database.DatabaseServiceResource.DatabaseServiceList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ConnectionArguments;
import org.openmetadata.catalog.type.ConnectionOptions;
import org.openmetadata.catalog.type.DatabaseConnection;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TablesInitializer;
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
        "owner",
        false,
        true,
        false,
        false);
    this.supportsPatch = false;
  }

  @Test
  void post_validDatabaseService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create database service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);
  }

  @Test
  void post_invalidDatabaseServiceNoJdbc_4xx(TestInfo test) {
    // No jdbc connection set
    CreateDatabaseService create = createRequest(test).withDatabaseConnection(null);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "databaseConnection must not be null");
  }

  @Test
  void put_updateDatabaseService_as_admin_2xx(TestInfo test) throws IOException {
    DatabaseService service = createAndCheckEntity(createRequest(test).withDescription(null), ADMIN_AUTH_HEADERS);

    // Update database description and ingestion service that are null
    CreateDatabaseService update = createRequest(test).withDescription("description1");

    ChangeDescription change = getChangeDescription(service.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("description1"));
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
    DatabaseConnection databaseConnection =
        new DatabaseConnection()
            .withDatabase("test")
            .withHostPort("host:9000")
            .withPassword("password")
            .withUsername("username");
    update.withDatabaseConnection(databaseConnection);
    service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    assertEquals(databaseConnection, service.getDatabaseConnection());
    ConnectionArguments connectionArguments =
        new ConnectionArguments()
            .withAdditionalProperty("credentials", "/tmp/creds.json")
            .withAdditionalProperty("client_email", "ingestion-bot@domain.com");
    ConnectionOptions connectionOptions =
        new ConnectionOptions().withAdditionalProperty("key1", "value1").withAdditionalProperty("key2", "value2");
    databaseConnection.withConnectionArguments(connectionArguments).withConnectionOptions(connectionOptions);
    update.withDatabaseConnection(databaseConnection);
    service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    assertEquals(databaseConnection, service.getDatabaseConnection());
  }

  @Test
  void put_addIngestion_as_admin_2xx(TestInfo test) throws IOException, ParseException {
    DatabaseService service = createAndCheckEntity(createRequest(test).withDescription(null), ADMIN_AUTH_HEADERS);

    // Update database description and ingestion service that are null
    CreateDatabaseService update = createRequest(test).withDescription("description1");

    ChangeDescription change = getChangeDescription(service.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("description1"));
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
    DatabaseConnection databaseConnection =
        new DatabaseConnection()
            .withDatabase("test")
            .withHostPort("host:9000")
            .withPassword("password")
            .withUsername("username");
    update.withDatabaseConnection(databaseConnection);
    service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    assertEquals(databaseConnection, service.getDatabaseConnection());
    ConnectionArguments connectionArguments =
        new ConnectionArguments()
            .withAdditionalProperty("credentials", "/tmp/creds.json")
            .withAdditionalProperty("client_email", "ingestion-bot@domain.com");
    ConnectionOptions connectionOptions =
        new ConnectionOptions().withAdditionalProperty("key1", "value1").withAdditionalProperty("key2", "value2");
    databaseConnection.withConnectionArguments(connectionArguments).withConnectionOptions(connectionOptions);
    update.withDatabaseConnection(databaseConnection);
    service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    assertEquals(databaseConnection, service.getDatabaseConnection());

    AirflowPipelineResourceTest airflowPipelineResourceTest = new AirflowPipelineResourceTest();
    CreateAirflowPipeline createAirflowPipeline =
        airflowPipelineResourceTest.createRequest(test).withService(helper(service).toEntityReference());

    DatabaseServiceMetadataPipeline databaseServiceMetadataPipeline =
        new DatabaseServiceMetadataPipeline()
            .withMarkDeletedTables(true)
            .withIncludeViews(true)
            .withSchemaFilterPattern(new FilterPattern().withExcludes(asList("information_schema.*", "test.*")))
            .withTableFilterPattern(new FilterPattern().withIncludes(asList("sales.*", "users.*")));
    PipelineConfig pipelineConfig =
        new PipelineConfig()
            .withSchema(PipelineConfig.Schema.DATABASE_SERVICE_METADATA_PIPELINE)
            .withConfig(databaseServiceMetadataPipeline);
    createAirflowPipeline.withPipelineConfig(pipelineConfig);
    AirflowPipeline airflowPipeline =
        airflowPipelineResourceTest.createEntity(createAirflowPipeline, ADMIN_AUTH_HEADERS);
    DatabaseService updatedService = getEntity(service.getId(), "airflowPipeline", ADMIN_AUTH_HEADERS);
    assertEquals(1, updatedService.getAirflowPipelines().size());
    EntityReference expectedPipeline = updatedService.getAirflowPipelines().get(0);
    assertEquals(airflowPipeline.getId(), expectedPipeline.getId());
    assertEquals(airflowPipeline.getFullyQualifiedName(), expectedPipeline.getName());
  }

  @Test
  void fernet_createDatabaseService(TestInfo test) throws IOException {
    Fernet.getInstance().setFernetKey(FERNET_KEY_1);

    DatabaseConnection databaseConnection =
        new DatabaseConnection()
            .withDatabase("test")
            .withHostPort("host:9000")
            .withPassword("password")
            .withUsername("username");
    createAndCheckEntity(createRequest(test, 0).withDatabaseConnection(databaseConnection), ADMIN_AUTH_HEADERS);
    Fernet.getInstance().setFernetKey(FERNET_KEY_1 + ",old_key_not_to_be_used");
    createAndCheckEntity(createRequest(test, 1).withDatabaseConnection(databaseConnection), ADMIN_AUTH_HEADERS);
  }

  @Test
  void fernet_rotateDatabaseService(TestInfo test) throws IOException, GeneralSecurityException, ParseException {
    DatabaseConnection databaseConnection =
        new DatabaseConnection()
            .withDatabase("test")
            .withHostPort("host:9000")
            .withPassword("password")
            .withUsername("username");
    int i = 0;
    List<String> keys = asList(null, FERNET_KEY_1, FERNET_KEY_2);
    List<DatabaseService> services = new ArrayList<>();
    for (String key : keys) {
      Fernet.getInstance().setFernetKey(key);
      services.add(
          createAndCheckEntity(createRequest(test, i).withDatabaseConnection(databaseConnection), ADMIN_AUTH_HEADERS));
      i++;
    }
    Fernet.getInstance().setFernetKey(FERNET_KEY_2 + "," + FERNET_KEY_1);
    DataSourceFactory dataSourceFactory = APP.getConfiguration().getDataSourceFactory();
    TablesInitializer.rotate(dataSourceFactory);
    Fernet.getInstance().setFernetKey(FERNET_KEY_2);
    for (DatabaseService service : services) {
      DatabaseService rotated = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
      assertEquals(databaseConnection, rotated.getDatabaseConnection());
    }
  }

  @Test
  void fernet_removeDatabaseConnection(TestInfo test) throws IOException {
    DatabaseConnection databaseConnection =
        new DatabaseConnection()
            .withDatabase("test")
            .withHostPort("host:9000")
            .withPassword("password")
            .withUsername("username");
    DatabaseService service =
        createAndCheckEntity(createRequest(test).withDatabaseConnection(databaseConnection), ADMIN_AUTH_HEADERS);
    CreateDatabaseService update = createRequest(test).withDescription("description1");
    updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    update.withDescription("description2");
    updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    EntityHistory history = getVersionList(service.getId(), TEST_AUTH_HEADERS);
    for (Object version : history.getVersions()) {
      DatabaseService databaseService = JsonUtils.readValue((String) version, entityClass);
      assertNull(databaseService.getDatabaseConnection());
      databaseService = getVersion(databaseService.getId(), databaseService.getVersion(), TEST_AUTH_HEADERS);
      assertNull(databaseService.getDatabaseConnection());
    }
  }

  private void validatePassword(String fernetKey, String expected, String tokenized) {
    Fernet fernet = new Fernet(fernetKey);
    assertEquals(expected, fernet.decrypt(tokenized));
  }

  @Override
  public CreateDatabaseService createRequest(
      String name, String description, String displayName, EntityReference owner) {
    return new CreateDatabaseService()
        .withName(name)
        .withServiceType(DatabaseServiceType.Snowflake)
        .withDatabaseConnection(TestUtils.DATABASE_CONNECTION)
        .withOwner(owner)
        .withDescription(description);
  }

  @Override
  public void validateCreatedEntity(
      DatabaseService service, CreateDatabaseService createRequest, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(service),
        createRequest.getDescription(),
        getPrincipal(authHeaders),
        createRequest.getOwner());
    assertEquals(createRequest.getName(), service.getName());

    // Validate Database Connection if available. We nullify when not admin or bot
    if (service.getDatabaseConnection() != null) {
      assertEquals(createRequest.getDatabaseConnection(), service.getDatabaseConnection());
    }
  }

  @Override
  public void validateUpdatedEntity(
      DatabaseService service, CreateDatabaseService request, Map<String, String> authHeaders) {
    validateCreatedEntity(service, request, authHeaders);
  }

  @Override
  public void compareEntities(DatabaseService expected, DatabaseService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public EntityInterface<DatabaseService> getEntityInterface(DatabaseService entity) {
    return new DatabaseServiceEntityInterface(entity);
  }

  /**
   * Validate returned fields GET .../databaseServices/{id}?fields="..." or GET
   * .../databaseServices/name/{fqn}?fields="..."
   */
  @Override
  public void validateGetWithDifferentFields(DatabaseService service, boolean byName) throws HttpResponseException {
    String fields = "owner";
    service =
        byName
            ? getEntityByName(service.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNotNull(
        service.getHref(),
        service.getOwner(),
        service.getVersion(),
        service.getUpdatedBy(),
        service.getServiceType(),
        service.getDatabaseConnection(),
        service.getUpdatedAt());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (fieldName.equals("ingestionSchedule")) {
      Schedule expectedSchedule = (Schedule) expected;
      Schedule actualSchedule = JsonUtils.readValue((String) actual, Schedule.class);
      assertEquals(expectedSchedule, actualSchedule);
    } else {
      super.assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
