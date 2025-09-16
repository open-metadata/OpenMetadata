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

import static jakarta.ws.rs.core.Response.Status.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.Entity.*;
import static org.openmetadata.service.exception.CatalogExceptionMessage.*;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.*;

import java.io.IOException;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.*;
import org.openmetadata.schema.api.data.*;
import org.openmetadata.schema.entity.data.*;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.*;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.util.*;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class StoredProcedureResourceTest
    extends EntityResourceTest<StoredProcedure, CreateStoredProcedure> {
  public StoredProcedureResourceTest() {
    super(
        STORED_PROCEDURE,
        StoredProcedure.class,
        StoredProcedureResource.StoredProcedureList.class,
        "storedProcedures",
        StoredProcedureResource.FIELDS);
    supportedNameCharacters = "_'+#- .()$" + EntityResourceTest.RANDOM_STRING_GENERATOR.generate(1);
    supportsSearchIndex = true;
  }

  @Test
  void post_storedProcedureWithInvalidDatabase_404(TestInfo test) {
    CreateStoredProcedure create = createRequest(test).withDatabaseSchema("nonExistentSchema");
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.DATABASE_SCHEMA, "nonExistentSchema"));
  }

  @Test
  void put_storedProcedureCode_200(TestInfo test) throws IOException {
    CreateStoredProcedure createStoredProcedure = createRequest(test);
    String query =
        """
                    sales_vw
                    create view sales_vw as
                    select * from public.sales
                    union all
                    select * from spectrum.sales
                    with no schema binding;
                    """;
    createStoredProcedure.setStoredProcedureCode(
        new StoredProcedureCode().withCode(query).withLanguage(StoredProcedureLanguage.SQL));
    StoredProcedure storedProcedure =
        createAndCheckEntity(createStoredProcedure, ADMIN_AUTH_HEADERS);
    storedProcedure = getEntity(storedProcedure.getId(), "", ADMIN_AUTH_HEADERS);
    assertEquals(storedProcedure.getStoredProcedureCode().getCode(), query);
  }

  @Test
  void patch_storedProcedureCode_200(TestInfo test) throws IOException {
    CreateStoredProcedure createStoredProcedure = createRequest(test);
    String query =
        """
                    sales_vw
                    create view sales_vw as
                    select * from public.sales
                    union all
                    select * from spectrum.sales
                    with no schema binding;
                    """;
    createStoredProcedure.setStoredProcedureCode(
        new StoredProcedureCode().withLanguage(StoredProcedureLanguage.SQL));
    StoredProcedure storedProcedure =
        createAndCheckEntity(createStoredProcedure, ADMIN_AUTH_HEADERS);
    String storedProcedureJson = JsonUtils.pojoToJson(storedProcedure);
    storedProcedure.setStoredProcedureCode(
        new StoredProcedureCode().withLanguage(StoredProcedureLanguage.SQL).withCode(query));
    StoredProcedure storedProcedure1 =
        patchEntity(
            storedProcedure.getId(), storedProcedureJson, storedProcedure, ADMIN_AUTH_HEADERS);
    compareEntities(storedProcedure, storedProcedure1, ADMIN_AUTH_HEADERS);
    getEntity(storedProcedure.getId(), "", ADMIN_AUTH_HEADERS);
  }

  @Test
  void testInheritedPermissionFromParent(TestInfo test) throws IOException {
    // Create a database schema with owner data consumer
    DatabaseSchemaResourceTest schemaTest = new DatabaseSchemaResourceTest();
    CreateDatabaseSchema createDatabaseSchema =
        schemaTest
            .createRequest(getEntityName(test))
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()));
    DatabaseSchema schema = schemaTest.createEntity(createDatabaseSchema, ADMIN_AUTH_HEADERS);

    // Data consumer as an owner of the database schema can create stored procedure under it
    createEntity(
        createRequest("storedProcedure").withDatabaseSchema(schema.getFullyQualifiedName()),
        authHeaders(DATA_CONSUMER.getName()));
  }

  @Test
  void patch_usingFqn_storedProcedureCode_200(TestInfo test) throws IOException {
    CreateStoredProcedure createStoredProcedure = createRequest(test);
    String query =
        """
                        sales_vw
                        create view sales_vw as
                        select * from public.sales
                        union all
                        select * from spectrum.sales
                        with no schema binding;
                        """;
    createStoredProcedure.setStoredProcedureCode(
        new StoredProcedureCode().withLanguage(StoredProcedureLanguage.SQL));
    StoredProcedure storedProcedure =
        createAndCheckEntity(createStoredProcedure, ADMIN_AUTH_HEADERS);
    String storedProcedureJson = JsonUtils.pojoToJson(storedProcedure);
    storedProcedure.setStoredProcedureCode(
        new StoredProcedureCode().withLanguage(StoredProcedureLanguage.SQL).withCode(query));
    StoredProcedure storedProcedure1 =
        patchEntityUsingFqn(
            storedProcedure.getFullyQualifiedName(),
            storedProcedureJson,
            storedProcedure,
            ADMIN_AUTH_HEADERS);
    compareEntities(storedProcedure, storedProcedure1, ADMIN_AUTH_HEADERS);
    getEntity(storedProcedure.getId(), "", ADMIN_AUTH_HEADERS);
  }

  @Override
  public StoredProcedure validateGetWithDifferentFields(
      StoredProcedure storedProcedure, boolean byName) throws HttpResponseException {
    storedProcedure =
        byName
            ? getEntityByName(storedProcedure.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(storedProcedure.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNotNull(
        storedProcedure.getService(),
        storedProcedure.getServiceType(),
        storedProcedure.getDatabase(),
        storedProcedure.getDatabaseSchema(),
        storedProcedure.getStoredProcedureCode());
    assertListNull(storedProcedure.getOwners(), storedProcedure.getFollowers());
    assertTrue(storedProcedure.getTags().isEmpty());

    String fields = "owners,tags,followers";
    storedProcedure =
        byName
            ? getEntityByName(storedProcedure.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(storedProcedure.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(
        storedProcedure.getService(),
        storedProcedure.getServiceType(),
        storedProcedure.getDatabaseSchema(),
        storedProcedure.getDatabase());
    return storedProcedure;
  }

  /**
   * A method variant to be called form other tests to create a table without depending on Database, DatabaseService set
   * up in the {@code setup()} method
   */
  public StoredProcedure createEntity(TestInfo test, int index) throws IOException {
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    DatabaseService service =
        databaseServiceResourceTest.createEntity(
            databaseServiceResourceTest.createRequest(test), ADMIN_AUTH_HEADERS);
    DatabaseResourceTest databaseResourceTest = new DatabaseResourceTest();
    Database database =
        databaseResourceTest.createAndCheckEntity(
            databaseResourceTest.createRequest(test).withService(service.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    CreateStoredProcedure create = createRequest(test, index);
    return createEntity(create, ADMIN_AUTH_HEADERS).withDatabase(database.getEntityReference());
  }

  @Override
  public CreateStoredProcedure createRequest(String name) {
    StoredProcedureCode storedProcedureCode =
        new StoredProcedureCode()
            .withCode(
                """
                            CREATE OR REPLACE PROCEDURE output_message(message VARCHAR)
                            RETURNS VARCHAR NOT NULL
                            LANGUAGE SQL
                            AS
                            BEGIN
                              RETURN message;
                            END;""")
            .withLanguage(StoredProcedureLanguage.SQL);
    return new CreateStoredProcedure()
        .withName(name)
        .withDatabaseSchema(getContainer().getFullyQualifiedName())
        .withStoredProcedureCode(storedProcedureCode);
  }

  @Override
  public EntityReference getContainer() {
    return DATABASE_SCHEMA.getEntityReference();
  }

  @Override
  public EntityReference getContainer(StoredProcedure entity) {
    return entity.getDatabaseSchema();
  }

  @Override
  public void validateCreatedEntity(
      StoredProcedure createdEntity,
      CreateStoredProcedure createRequest,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    // Entity specific validation
    assertReference(createRequest.getDatabaseSchema(), createdEntity.getDatabaseSchema());
    validateEntityReference(createdEntity.getDatabase());
    validateEntityReference(createdEntity.getService());
    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
    TestUtils.validateEntityReferences(createdEntity.getFollowers());
    assertListNotNull(createdEntity.getService(), createdEntity.getServiceType());
    assertEquals(createdEntity.getStoredProcedureCode(), createRequest.getStoredProcedureCode());
    assertEquals(
        FullyQualifiedName.add(
            createdEntity.getDatabaseSchema().getFullyQualifiedName(), createdEntity.getName()),
        createdEntity.getFullyQualifiedName());
  }

  @Override
  public void compareEntities(
      StoredProcedure expected, StoredProcedure patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Entity specific validation
    validateDatabase(expected.getDatabase(), patched.getDatabase());
    TestUtils.validateTags(expected.getTags(), patched.getTags());
    TestUtils.validateEntityReferences(expected.getFollowers());
    assertEquals(expected.getStoredProcedureCode(), patched.getStoredProcedureCode());
    assertEquals(
        FullyQualifiedName.add(
            patched.getDatabaseSchema().getFullyQualifiedName(), patched.getName()),
        patched.getFullyQualifiedName());
  }

  private void validateDatabase(EntityReference expectedDatabase, EntityReference database) {
    TestUtils.validateEntityReference(database);
    assertEquals(expectedDatabase.getId(), database.getId());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.startsWith("storedProcedureCode")) {
      StoredProcedureCode expectedCode = (StoredProcedureCode) expected;
      StoredProcedureCode actualCode = (StoredProcedureCode) actual;
      assertEquals(expectedCode, actualCode);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
