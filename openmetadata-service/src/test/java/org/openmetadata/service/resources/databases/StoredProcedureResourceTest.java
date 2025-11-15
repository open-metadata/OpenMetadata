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
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.*;
import org.openmetadata.schema.api.data.*;
import org.openmetadata.schema.entity.data.*;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.*;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
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
    supportsBulkAPI = true;
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

  @Test
  void testBulk_PreservesUserEditsOnUpdate(TestInfo test) throws IOException {
    // Critical test: Verify that bulk updates preserve user-made changes
    // and only update the fields sent in the bulk request (incremental updates)

    // Step 1: Bot creates initial storedprocedure (using regular create, not bulk)
    CreateStoredProcedure botCreate =
        createRequest(test.getDisplayName())
            .withDescription("Bot initial description")
            .withTags(List.of(USER_ADDRESS_TAG_LABEL));

    StoredProcedure entity = createEntity(botCreate, INGESTION_BOT_AUTH_HEADERS);
    assertEquals("Bot initial description", entity.getDescription());
    assertEquals(1, entity.getTags().size());

    // Step 2: User edits description and adds tag
    String originalJson = JsonUtils.pojoToJson(entity);
    String userDescription = "User-edited description - should be preserved";
    entity.setDescription(userDescription);
    entity.setTags(List.of(USER_ADDRESS_TAG_LABEL, PERSONAL_DATA_TAG_LABEL));

    StoredProcedure userEditedEntity =
        patchEntity(entity.getId(), originalJson, entity, ADMIN_AUTH_HEADERS);
    assertEquals(userDescription, userEditedEntity.getDescription());
    assertEquals(2, userEditedEntity.getTags().size());

    // Step 3: Bot sends bulk update with new tag and different description
    // Bot's description should be IGNORED (bot protection)
    // Bot's tag should be MERGED (added to existing)
    CreateStoredProcedure botUpdate =
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
    StoredProcedure verifyEntity = getEntity(entity.getId(), "tags", ADMIN_AUTH_HEADERS);

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

    // Step 1: Create storedprocedure with initial tags
    CreateStoredProcedure createRequest =
        createRequest(test.getDisplayName())
            .withTags(List.of(USER_ADDRESS_TAG_LABEL, PERSONAL_DATA_TAG_LABEL));

    StoredProcedure entity = createEntity(createRequest, ADMIN_AUTH_HEADERS);
    assertEquals(2, entity.getTags().size());

    // Step 2: Send bulk update with additional tag (not replacing existing)
    CreateStoredProcedure updateRequest =
        createRequest(test.getDisplayName()).withTags(List.of(PII_SENSITIVE_TAG_LABEL));

    WebTarget bulkTarget = getCollection().path("/bulk");
    BulkOperationResult result =
        TestUtils.put(
            bulkTarget, List.of(updateRequest), BulkOperationResult.class, OK, ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    // Step 3: Verify tags were merged (original 2 + new 1 = 3 total)
    StoredProcedure updatedEntity = getEntity(entity.getId(), "tags", ADMIN_AUTH_HEADERS);

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

    // Step 1: User creates storedprocedure
    CreateStoredProcedure createRequest =
        createRequest(test.getDisplayName()).withDescription("User-created description");

    StoredProcedure entity = createEntity(createRequest, ADMIN_AUTH_HEADERS);
    assertEquals("User-created description", entity.getDescription());

    // Step 2: Admin updates description via bulk
    String adminDescription = "Admin-updated description via bulk";
    CreateStoredProcedure adminUpdate =
        createRequest(test.getDisplayName()).withDescription(adminDescription);

    WebTarget bulkTarget = getCollection().path("/bulk");
    BulkOperationResult result =
        TestUtils.put(
            bulkTarget, List.of(adminUpdate), BulkOperationResult.class, OK, ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    // Step 3: Verify admin's description was applied
    StoredProcedure updatedEntity = getEntity(entity.getId(), "", ADMIN_AUTH_HEADERS);
    assertEquals(
        adminDescription,
        updatedEntity.getDescription(),
        "Admin should be able to update description via bulk");

    // Cleanup
    deleteEntity(entity.getId(), false, true, ADMIN_AUTH_HEADERS);
  }
}
