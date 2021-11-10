/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.databases;

import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateDatabase;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.DatabaseRepository.DatabaseEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.databases.DatabaseResource.DatabaseList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

import javax.ws.rs.client.WebTarget;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class DatabaseResourceTest extends EntityResourceTest<Database> {
  public DatabaseResourceTest() {
    super(Entity.DATABASE, Database.class, DatabaseList.class, "databases",
            DatabaseResource.FIELDS, false, true, false);
  }

  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException, URISyntaxException {
    EntityResourceTest.setup(test);
  }

  @Test
  public void post_databaseWithLongName_400_badRequest(TestInfo test) {
    // Create database with mandatory name field empty
    CreateDatabase create = create(test).withName(TestUtils.LONG_ENTITY_NAME);
    assertResponse(() -> createDatabase(create, adminAuthHeaders()), BAD_REQUEST,
            "[name size must be between 1 and 64]");
  }

  @Test
  public void post_databaseWithoutName_400_badRequest(TestInfo test) {
    // Create database with mandatory name field empty
    CreateDatabase create = create(test).withName("");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDatabase(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_databaseAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreateDatabase create = create(test);
    createDatabase(create, adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDatabase(create, adminAuthHeaders()));
    assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validDatabases_as_admin_200_OK(TestInfo test) throws HttpResponseException {
    // Create team with different optional fields
    CreateDatabase create = create(test);
    createAndCheckEntity(create, adminAuthHeaders());

    create.withName(getDatabaseName(test, 1)).withDescription("description");
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  public void post_databaseFQN_as_admin_200_OK(TestInfo test) throws HttpResponseException {
    // Create team with different optional fields
    CreateDatabase create = create(test);
    create.setService(new EntityReference().withId(SNOWFLAKE_REFERENCE.getId()).withType("databaseService"));
    Database db = createAndCheckEntity(create, adminAuthHeaders());
    String expectedFQN = SNOWFLAKE_REFERENCE.getName()+"."+create.getName();
    assertEquals(expectedFQN, db.getFullyQualifiedName());

  }

  @Test
  public void post_databaseWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_databaseWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_database_as_non_admin_401(TestInfo test) {
    CreateDatabase create = create(test);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDatabase(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_databaseWithoutRequiredService_4xx(TestInfo test) {
    CreateDatabase create = create(test).withService(null);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDatabase(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "service must not be null");
  }

  @Test
  public void post_databaseWithInvalidOwnerType_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */

    CreateDatabase create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDatabase(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  }

  @Test
  public void post_databaseWithNonExistentOwner_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TestUtils.NON_EXISTENT_ENTITY).withType("user");
    CreateDatabase create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDatabase(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_databaseWithDifferentService_200_ok(TestInfo test) throws HttpResponseException {
    EntityReference[] differentServices = {MYSQL_REFERENCE, REDSHIFT_REFERENCE, BIGQUERY_REFERENCE,
            SNOWFLAKE_REFERENCE};

    // Create database for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(create(test).withService(service), adminAuthHeaders());

      // List databases by filtering on service name and ensure right databases are returned in the response
      Map<String, String> queryParams = new HashMap<>(){{put("service", service.getName());}};
      ResultList<Database> list = listEntities(queryParams, adminAuthHeaders());
      for (Database db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
      }
    }
  }

  @Test
  public void get_nonExistentDatabase_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getDatabase(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND,
            entityNotFound(Entity.DATABASE, TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_databaseWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateDatabase create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(SNOWFLAKE_REFERENCE);
    Database database = createAndCheckEntity(create, adminAuthHeaders());
    validateGetWithDifferentFields(database, false);
  }

  @Test
  public void get_databaseByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateDatabase create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(SNOWFLAKE_REFERENCE);
    Database database = createAndCheckEntity(create, adminAuthHeaders());
    validateGetWithDifferentFields(database, true);
  }

  @Test
  public void delete_emptyDatabase_200_ok(TestInfo test) throws HttpResponseException {
    Database database = createDatabase(create(test), adminAuthHeaders());
    deleteDatabase(database.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonEmptyDatabase_4xx() {
    // TODO
  }

  @Test
  public void delete_nonExistentDatabase_404() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteDatabase(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.DATABASE, TestUtils.NON_EXISTENT_ENTITY));
  }

  public static Database createAndCheckDatabase(CreateDatabase create,
                                                Map<String, String> authHeaders) throws HttpResponseException {
    return new DatabaseResourceTest().createAndCheckEntity(create, authHeaders);
  }

  public static Database createDatabase(CreateDatabase create,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("databases"), create, Database.class, authHeaders);
  }

  /** Validate returned fields GET .../databases/{id}?fields="..." or GET .../databases/name/{fqn}?fields="..." */
  private void validateGetWithDifferentFields(Database database, boolean byName) throws HttpResponseException {
    // .../databases?fields=owner
    String fields = "owner";
    database = byName ? getDatabaseByName(database.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getDatabase(database.getId(), fields, adminAuthHeaders());
    assertNotNull(database.getOwner());
    assertNotNull(database.getService()); // We always return the service
    assertNull(database.getTables());

    // .../databases?fields=owner,service
    fields = "owner,service";
    database = byName ? getDatabaseByName(database.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getDatabase(database.getId(), fields, adminAuthHeaders());
    assertNotNull(database.getOwner());
    assertNotNull(database.getService());
    assertNull(database.getTables());

    // .../databases?fields=owner,service,tables
    fields = "owner,service,tables,usageSummary";
    database = byName ? getDatabaseByName(database.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getDatabase(database.getId(), fields, adminAuthHeaders());
    assertNotNull(database.getOwner());
    assertNotNull(database.getService());
    assertNotNull(database.getTables());
    TestUtils.validateEntityReference(database.getTables());
    assertNotNull(database.getUsageSummary());

  }

  public static void getDatabase(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    getDatabase(id, null, authHeaders);
  }

  public static Database getDatabase(UUID id, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("databases/" + id);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, Database.class, authHeaders);
  }

  public static Database getDatabaseByName(String fqn, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("databases/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, Database.class, authHeaders);
  }

  private void deleteDatabase(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(getResource("databases/" + id), authHeaders);

    // Ensure deleted database does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getDatabase(id, authHeaders));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.DATABASE, id));
  }

  public static String getDatabaseName(TestInfo test) {
    return String.format("database_%s", test.getDisplayName());
  }

  public static String getDatabaseName(TestInfo test, int index) {
    return String.format("database%d_%s", index, test.getDisplayName());
  }

  public static CreateDatabase create(TestInfo test) {
    return new CreateDatabase().withName(getDatabaseName(test)).withService(SNOWFLAKE_REFERENCE);
  }

  public static CreateDatabase create(TestInfo test, int index) {
    return new CreateDatabase().withName(getDatabaseName(test, index)).withService(SNOWFLAKE_REFERENCE);
  }

  @Override
  public Object createRequest(TestInfo test, int index, String description, String displayName, EntityReference owner) {
    return create(test, index).withDescription(description).withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(Database createdEntity, Object request, Map<String, String> authHeaders) {
    CreateDatabase createRequest = (CreateDatabase) request;
    validateCommonEntityFields(getEntityInterface(createdEntity), createRequest.getDescription(),
            TestUtils.getPrincipal(authHeaders), createRequest.getOwner());

    // Validate service
    assertService(createRequest.getService(), createdEntity.getService());
  }

  @Override
  public void validateUpdatedEntity(Database updatedEntity, Object request, Map<String, String> authHeaders) {
    validateCreatedEntity(updatedEntity, request, authHeaders);
  }

  @Override
  public void compareEntities(Database expected, Database updated, Map<String, String> authHeaders) {
    validateCommonEntityFields(getEntityInterface(updated), expected.getDescription(),
            TestUtils.getPrincipal(authHeaders), expected.getOwner());
    // Validate service
    assertService(expected.getService(), updated.getService());
  }

  @Override
  public EntityInterface<Database> getEntityInterface(Database entity) {
    return new DatabaseEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
