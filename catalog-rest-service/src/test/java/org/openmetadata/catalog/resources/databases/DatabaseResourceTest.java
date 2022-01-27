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

package org.openmetadata.catalog.resources.databases;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateDatabase;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.jdbi3.DatabaseRepository.DatabaseEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.databases.DatabaseResource.DatabaseList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class DatabaseResourceTest extends EntityResourceTest<Database> {
  public DatabaseResourceTest() {
    super(
        Entity.DATABASE,
        Database.class,
        DatabaseList.class,
        "databases",
        DatabaseResource.FIELDS,
        false,
        true,
        false,
        true);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
  }

  @Test
  void post_validDatabases_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateDatabase create = create(test);
    createAndCheckEntity(create, adminAuthHeaders());

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  void post_databaseFQN_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateDatabase create = create(test);
    create.setService(new EntityReference().withId(SNOWFLAKE_REFERENCE.getId()).withType("databaseService"));
    Database db = createAndCheckEntity(create, adminAuthHeaders());
    String expectedFQN = SNOWFLAKE_REFERENCE.getName() + "." + create.getName();
    assertEquals(expectedFQN, db.getFullyQualifiedName());
  }

  @Test
  void post_databaseWithUserOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  void post_databaseWithTeamOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1), adminAuthHeaders());
  }

  @Test
  void post_database_as_non_admin_401(TestInfo test) {
    CreateDatabase create = create(test);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createDatabase(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  void post_databaseWithoutRequiredService_4xx(TestInfo test) {
    CreateDatabase create = create(test).withService(null);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createDatabase(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "service must not be null");
  }

  @Test
  void post_databaseWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {
      MYSQL_REFERENCE, REDSHIFT_REFERENCE, BIGQUERY_REFERENCE, SNOWFLAKE_REFERENCE
    };

    // Create database for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(create(test).withService(service), adminAuthHeaders());

      // List databases by filtering on service name and ensure right databases in the response
      Map<String, String> queryParams =
          new HashMap<>() {
            {
              put("service", service.getName());
            }
          };
      ResultList<Database> list = listEntities(queryParams, adminAuthHeaders());
      for (Database db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
      }
    }
  }

  @Test
  void delete_nonEmptyDatabase_4xx() {
    // TODO
  }

  public static Database createDatabase(CreateDatabase create, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.post(getResource("databases"), create, Database.class, authHeaders);
  }

  /** Validate returned fields GET .../databases/{id}?fields="..." or GET .../databases/name/{fqn}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Database database, boolean byName) throws HttpResponseException {
    // .../databases?fields=owner
    String fields = "owner";
    database =
        byName
            ? getEntityByName(database.getFullyQualifiedName(), null, fields, adminAuthHeaders())
            : getEntity(database.getId(), fields, adminAuthHeaders());
    assertListNotNull(database.getOwner(), database.getService(), database.getServiceType());
    assertListNull(database.getTables(), database.getUsageSummary());

    // .../databases?fields=owner,tables,usageSummary
    fields = "owner,tables,usageSummary";
    database =
        byName
            ? getEntityByName(database.getFullyQualifiedName(), null, fields, adminAuthHeaders())
            : getEntity(database.getId(), fields, adminAuthHeaders());
    assertListNotNull(
        database.getOwner(),
        database.getService(),
        database.getServiceType(),
        database.getTables(),
        database.getUsageSummary());
    TestUtils.validateEntityReference(database.getTables());
  }

  public CreateDatabase create(TestInfo test) {
    return create(getEntityName(test));
  }

  private CreateDatabase create(String name) {
    return new CreateDatabase().withName(name).withService(SNOWFLAKE_REFERENCE);
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name).withDescription(description).withOwner(owner);
  }

  @Override
  public EntityReference getContainer(Object createRequest) throws URISyntaxException {
    CreateDatabase createDatabase = (CreateDatabase) createRequest;
    return createDatabase.getService();
  }

  @Override
  public void validateCreatedEntity(Database database, Object request, Map<String, String> authHeaders) {
    CreateDatabase createRequest = (CreateDatabase) request;
    validateCommonEntityFields(
        getEntityInterface(database),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());

    // Validate service
    assertNotNull(database.getServiceType());
    assertService(createRequest.getService(), database.getService());
  }

  @Override
  public void validateUpdatedEntity(Database updatedEntity, Object request, Map<String, String> authHeaders) {
    validateCreatedEntity(updatedEntity, request, authHeaders);
  }

  @Override
  public void compareEntities(Database expected, Database updated, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(updated),
        expected.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        expected.getOwner());
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
