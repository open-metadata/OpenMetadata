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

package org.openmetadata.catalog.resources.glossary;

import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Map;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateGlossary;
import org.openmetadata.catalog.entity.data.Glossary;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.GlossaryRepository.GlossaryEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.TestUtils;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class GlossaryResourceTest extends EntityResourceTest<Glossary, CreateGlossary> {
  public GlossaryResourceTest() {
    super(
        Entity.GLOSSARY,
        Glossary.class,
        GlossaryResource.GlossaryList.class,
        "glossary",
        GlossaryResource.FIELDS,
        false,
        true,
        true,
        true);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
  }

  @Override
  public CreateGlossary createRequest(String name, String description, String displayName, EntityReference owner) {
    return new CreateGlossary()
        .withName(name)
        .withDescription(description)
        .withDisplayName(displayName)
        .withOwner(owner);
  }

  @Override
  public EntityReference getContainer(CreateGlossary createRequest) {
    return null;
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
  public void post_validGlossary_200_OK(TestInfo test) throws IOException {
    CreateGlossary create = create(test).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  public void post_glossaryWithUserOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), ADMIN_AUTH_HEADERS);
  }

  @Test
  public void post_glossaryWithTeamOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1), ADMIN_AUTH_HEADERS);
  }

  // @Test
  // public void post_glossaryWithInvalidOwnerType_4xx(TestInfo test) {
  //   EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */
  //   CreateGlossary create = create(test).withOwner(owner);
  //   HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
  //           createEntity(create, ADMIN_AUTH_HEADERS));
  //   TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  // }

  @Test
  public void post_glossary_as_non_admin_401(TestInfo test) {
    CreateGlossary create = create(test);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void get_nonExistentGlossary_404_notFound() {
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> getEntity(NON_EXISTENT_ENTITY, ADMIN_AUTH_HEADERS));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.GLOSSARY, NON_EXISTENT_ENTITY));
  }

  @Test
  public void delete_glossary_200_ok(TestInfo test) throws HttpResponseException {
    Glossary glossary = createEntity(create(test), ADMIN_AUTH_HEADERS);
    deleteGlossary(glossary.getId(), ADMIN_AUTH_HEADERS);
  }

  //   @Test
  //   public void delete_glossary_as_non_admin_401(TestInfo test) throws HttpResponseException {
  //     Glossary glossary = createEntity(create(test), ADMIN_AUTH_HEADERS);
  //     HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
  //             deleteGlossary(glossary.getId(), authHeaders("test@open-metadata.org")));
  //     assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  //   }

  @Test
  public void delete_nonExistentGlossary_404() {
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> getEntity(NON_EXISTENT_ENTITY, ADMIN_AUTH_HEADERS));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.GLOSSARY, NON_EXISTENT_ENTITY));
  }

  // @Test
  // public void put_GlossaryCreate_200(TestInfo test) throws HttpResponseException {
  //   // Create a new Glossary with PUT
  //   CreateGlossary request = create(test).withOwner(USER_OWNER1);
  //   updateAndCheckGlossary(null, request.withName(test.getDisplayName()).withDescription(null), CREATED,
  //           ADMIN_AUTH_HEADERS, NO_CHANGE);
  // }

  public static CreateGlossary create(TestInfo test) {
    return create(test, 0);
  }

  public static CreateGlossary create(TestInfo test, int index) {
    return new CreateGlossary().withName(getGlossaryName(test, index));
  }

  /**
   * A method variant to be called form other tests to create a glossary without depending on Database, DatabaseService
   * set up in the {@code setup()} method
   */
  public Glossary createEntity(TestInfo test, int index) throws IOException {
    CreateGlossary create = new CreateGlossary().withName(getGlossaryName(test, index));
    return createEntity(create, ADMIN_AUTH_HEADERS);
  }

  private void deleteGlossary(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(CatalogApplicationTest.getResource("glossary/" + id), authHeaders);

    // Check to make sure database entity does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getEntity(id, authHeaders));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.GLOSSARY, id));
  }

  public static String getGlossaryName(TestInfo test, int index) {
    return String.format("glossary%d_%s", index, test.getDisplayName());
  }

  @Override
  public void validateCreatedEntity(
      Glossary createdEntity, CreateGlossary createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(createdEntity),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());

    // Entity specific validation
    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
    TestUtils.validateEntityReference(createdEntity.getFollowers());
  }

  @Override
  public void validateUpdatedEntity(Glossary updated, CreateGlossary request, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCreatedEntity(updated, request, authHeaders);
  }

  @Override
  public void compareEntities(Glossary expected, Glossary patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(patched),
        expected.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        expected.getOwner());

    // Entity specific validation
    TestUtils.validateTags(expected.getTags(), patched.getTags());
    TestUtils.validateEntityReference(expected.getFollowers());
  }

  @Override
  public GlossaryEntityInterface getEntityInterface(Glossary entity) {
    return new GlossaryEntityInterface(entity);
  }

  @Override
  public void validateGetWithDifferentFields(Glossary entity, boolean byName) throws HttpResponseException {}

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
