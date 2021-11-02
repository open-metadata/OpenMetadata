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

package org.openmetadata.catalog.resources.thesauruses;

import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateThesaurus;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.Thesaurus;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.ThesaurusRepository.ThesaurusEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.tags.TagResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static java.util.Collections.singletonList;
import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.UpdateType;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MAJOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.userAuthHeaders;


@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ThesaurusResourceTest extends EntityResourceTest<Thesaurus> {
  private static final Logger LOG = LoggerFactory.getLogger(ThesaurusResourceTest.class);
  //public static Database DATABASE;

  public ThesaurusResourceTest() {
    super(Entity.THESAURUS, Thesaurus.class, ThesaurusResource.ThesaurusList.class, "thesauruses", ThesaurusResource.FIELDS,
            true, true, true);
  }

  @BeforeAll
  public static void setup(TestInfo test) throws IOException, URISyntaxException {
    EntityResourceTest.setup(test);
  }

  public static Thesaurus createThesaurus(TestInfo test, int i) throws IOException {
    return new ThesaurusResourceTest().createEntity(test, i);
  }

  public static Thesaurus create(CreateThesaurus createThesaurus, Map<String, String> adminAuthHeaders)
          throws HttpResponseException {
    return new ThesaurusResourceTest().createEntity(createThesaurus, adminAuthHeaders);
  }

  public static Thesaurus createAndCheckThesaurus(CreateThesaurus createThesaurus, Map<String, String> adminAuthHeaders)
          throws IOException {
    return new ThesaurusResourceTest().createAndCheckEntity(createThesaurus, adminAuthHeaders);
  }

  public static Thesaurus updateAndCheckThesaurus(Thesaurus before, CreateThesaurus create, Status status,
                                          Map<String, String> authHeaders, UpdateType updateType)
          throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    Thesaurus updatedThesaurus = updateThesaurus(create, status, authHeaders);
    //validateThesaurus(updatedThesaurus, create.getDescription(), create.getOwner(), updatedBy);
    if (before == null) {
      assertEquals(0.1, updatedThesaurus.getVersion()); // First version created
    } else {
      TestUtils.validateUpdate(before.getVersion(), updatedThesaurus.getVersion(), updateType);
    }

    //return getAndValidate(updatedThesaurus.getId(), create, authHeaders, updatedBy);
    return updatedThesaurus;
  }

  // TODO: Entity tests
  
  // @Test
  // public void patch_entityAttributes_200_ok()
  // {}

  // @Test
  // public void put_entityCreate_200()
  // {}

  // @Test
  // public void put_entityCreate_as_owner_200()
  // {}

  // @Test
  // public void put_entityEmptyDescriptionUpdate_200()
  // {}

  // @Test
  // public void put_entityNullDescriptionUpdate_200()
  // {}

  // @Test
  // public void put_entityUpdateOwner_200()
  // {}
  
  // @Test
  // public void put_entityUpdateWithNoChange_200()
  // {}

  @Test
  public void post_thesaurusWithLongName_400_badRequest(TestInfo test) {
    CreateThesaurus create = create(test).withName(TestUtils.LONG_ENTITY_NAME);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_thesaurusWithoutName_400_badRequest(TestInfo test) {
    // Create thesaurus with mandatory name field empty
    CreateThesaurus create = create(test).withName("");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_thesaurusAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreateThesaurus create = create(test);
    createEntity(create, adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create, adminAuthHeaders()));
    assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validThesauruses_200_OK(TestInfo test) throws IOException {
    CreateThesaurus create = create(test).withDescription("description");
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  public void post_thesaurusWithUserOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_thesaurusWithTeamOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1), adminAuthHeaders());
  }

  // @Test
  // public void post_thesaurusWithInvalidOwnerType_4xx(TestInfo test) {
  //   EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */
  //   CreateThesaurus create = create(test).withOwner(owner);
  //   HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
  //           createEntity(create, adminAuthHeaders()));
  //   TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  // }

  @Test
  public void post_thesaurusWithNonExistentOwner_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(NON_EXISTENT_ENTITY).withType("user");
    CreateThesaurus create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_thesaurus_as_non_admin_401(TestInfo test) {
    CreateThesaurus create = create(test);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createEntity(create,
            authHeaders("test@open-metadata.org")));
      assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void get_nonExistentThesaurus_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getThesaurus(NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.THESAURUS, NON_EXISTENT_ENTITY));
  }

  @Test
  public void delete_thesaurus_200_ok(TestInfo test) throws HttpResponseException {
    Thesaurus thesaurus = createEntity(create(test), adminAuthHeaders());
    deleteThesaurus(thesaurus.getId(), adminAuthHeaders());
  }

//   @Test
//   public void delete_thesaurus_as_non_admin_401(TestInfo test) throws HttpResponseException {
//     Thesaurus thesaurus = createEntity(create(test), adminAuthHeaders());
//     HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
//             deleteThesaurus(thesaurus.getId(), authHeaders("test@open-metadata.org")));
//     assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
//   }

  @Test
  public void delete_nonExistentThesaurus_404() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getThesaurus(NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.THESAURUS, NON_EXISTENT_ENTITY));
  }

  // @Test
  // public void put_ThesaurusCreate_200(TestInfo test) throws HttpResponseException {
  //   // Create a new Thesaurus with PUT
  //   CreateThesaurus request = create(test).withOwner(USER_OWNER1);
  //   updateAndCheckThesaurus(null, request.withName(test.getDisplayName()).withDescription(null), CREATED,
  //           adminAuthHeaders(), NO_CHANGE);
  // }

  public static Thesaurus getThesaurus(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    return getThesaurus(id, null, authHeaders);
  }

  public static Thesaurus getThesaurus(UUID id, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("thesauruses/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Thesaurus.class, authHeaders);
  }

  public static Thesaurus getThesaurusByName(String fqn, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("thesauruses/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Thesaurus.class, authHeaders);
  }

  public static CreateThesaurus create(TestInfo test) {
    return create(test, 0);
  }

  public static CreateThesaurus create(TestInfo test, int index) {
    return new CreateThesaurus().withName(getThesaurusName(test, index));
  }

  public static Thesaurus updateThesaurus(CreateThesaurus create,
                                  Status status,
                                  Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.put(getResource("thesauruses"),
            create, Thesaurus.class, status, authHeaders);
  }

  /**
   * A method variant to be called form other tests to create a thesaurus without depending on Database, DatabaseService
   * set up in the {@code setup()} method
   */
  public Thesaurus createEntity(TestInfo test, int index) throws IOException {
    CreateThesaurus create = new CreateThesaurus().withName(getThesaurusName(test, index));
    return createEntity(create, adminAuthHeaders());
  }


  private void deleteThesaurus(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(CatalogApplicationTest.getResource("thesauruses/" + id), authHeaders);

    // Check to make sure database entity does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getThesaurus(id, authHeaders));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.THESAURUS, id));
  }

  public static String getThesaurusName(TestInfo test, int index) {
    return String.format("thesaurus%d_%s", index, test.getDisplayName());
  }

  @Override
  public Object createRequest(TestInfo test, int index, String description, String displayName, EntityReference owner) {
    return create(test, index).withDescription(description).withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(Thesaurus createdEntity, Object request, Map<String, String> authHeaders)
          throws HttpResponseException {
    CreateThesaurus createRequest = (CreateThesaurus) request;
    validateCommonEntityFields(getEntityInterface(createdEntity), createRequest.getDescription(),
            TestUtils.getPrincipal(authHeaders), createRequest.getOwner());

    // Entity specific validation
    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
    TestUtils.validateEntityReference(createdEntity.getFollowers());
  }

  @Override
  public void validateUpdatedEntity(Thesaurus updated, Object request, Map<String, String> authHeaders)
          throws HttpResponseException {
    validateCreatedEntity(updated, request, authHeaders);
  }

  @Override
  public void compareEntities(Thesaurus expected, Thesaurus patched, Map<String, String> authHeaders)
          throws HttpResponseException {
    validateCommonEntityFields(getEntityInterface(patched), expected.getDescription(),
            TestUtils.getPrincipal(authHeaders), expected.getOwner());

    // Entity specific validation
    TestUtils.validateTags(expected.getTags(), patched.getTags());
    TestUtils.validateEntityReference(expected.getFollowers());
  }

  private static int getTagUsageCount(String tagFQN, Map<String, String> authHeaders) throws HttpResponseException {
    return TagResourceTest.getTag(tagFQN, "usageCount", authHeaders).getUsageCount();
  }

  private static int getTagCategoryUsageCount(String name, Map<String, String> authHeaders)
          throws HttpResponseException {
    return TagResourceTest.getCategory(name, "usageCount", authHeaders).getUsageCount();
  }

  @Override
  public ThesaurusEntityInterface getEntityInterface(Thesaurus entity) {
    return new ThesaurusEntityInterface(entity);
  }

  private void validateDatabase(UUID expectedDatabaseId, EntityReference database) {
    TestUtils.validateEntityReference(database);
    assertEquals(expectedDatabaseId, database.getId());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
