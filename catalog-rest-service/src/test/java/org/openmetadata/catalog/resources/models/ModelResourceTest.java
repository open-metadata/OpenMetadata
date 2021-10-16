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

package org.openmetadata.catalog.resources.models;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateModel;
import org.openmetadata.catalog.api.services.CreateDashboardService;
import org.openmetadata.catalog.api.services.CreateDashboardService.DashboardServiceType;
import org.openmetadata.catalog.entity.data.Model;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.models.ModelResource.ModelList;
import org.openmetadata.catalog.resources.services.DashboardServiceResourceTest;
import org.openmetadata.catalog.resources.dashboards.DashboardResourceTest;
import org.openmetadata.catalog.resources.tags.TagResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.common.utils.JsonSchemaUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.readOnlyAttribute;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class ModelResourceTest extends CatalogApplicationTest {
  private static final Logger LOG = LoggerFactory.getLogger(ModelResourceTest.class);
  public static User USER1;
  public static EntityReference USER_OWNER1;
  public static Team TEAM1;
  public static EntityReference TEAM_OWNER1;
  public static String ALGORITHM = "regression";
  public static EntityReference SUPERSET_REFERENCE;
  public static Dashboard DASHBOARD;
  public static EntityReference DASHBOARD_REFERENCE;
  public static final TagLabel TIER_1 = new TagLabel().withTagFQN("Tier.Tier1");
  public static final TagLabel USER_ADDRESS_TAG_LABEL = new TagLabel().withTagFQN("User.Address");


  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException {
    USER1 = UserResourceTest.createUser(UserResourceTest.create(test), authHeaders("test@open-metadata.org"));
    USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType("user");

    TEAM1 = TeamResourceTest.createTeam(TeamResourceTest.create(test), adminAuthHeaders());
    TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType("team");

    CreateDashboardService createService = new CreateDashboardService().withName("superset")
            .withServiceType(DashboardServiceType.Superset).withDashboardUrl(TestUtils.DASHBOARD_URL);

    DashboardService service = DashboardServiceResourceTest.createService(createService, adminAuthHeaders());
    SUPERSET_REFERENCE = EntityUtil.getEntityReference(service);

    DASHBOARD = DashboardResourceTest.createDashboard(
            DashboardResourceTest.create(test).withService(SUPERSET_REFERENCE), adminAuthHeaders()
    );
    DASHBOARD_REFERENCE = EntityUtil.getEntityReference(DASHBOARD);

  }

  @Test
  public void post_modelWithLongName_400_badRequest(TestInfo test) {
    // Create model with mandatory name field empty
    CreateModel create = create(test).withName(TestUtils.LONG_ENTITY_NAME);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createModel(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_ModelWithoutName_400_badRequest(TestInfo test) {
    // Create Model with mandatory name field empty
    CreateModel create = create(test).withName("");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createModel(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_ModelAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreateModel create = create(test);
    createModel(create, adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createModel(create, adminAuthHeaders()));
    assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validModels_as_admin_200_OK(TestInfo test) throws HttpResponseException {
    // Create valid model
    CreateModel create = create(test);
    createAndCheckModel(create, adminAuthHeaders());

    create.withName(getModelName(test, 1)).withDescription("description");
    createAndCheckModel(create, adminAuthHeaders());
  }

  @Test
  public void post_ModelWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckModel(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_ModelWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckModel(create(test).withOwner(TEAM_OWNER1).withDisplayName("Model1"), adminAuthHeaders());
  }

  @Test
  public void post_ModelWithDashboard_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckModel(create(test), DASHBOARD_REFERENCE, adminAuthHeaders());
  }

  @Test
  public void post_Model_as_non_admin_401(TestInfo test) {
    CreateModel create = create(test);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createModel(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_ModelWithInvalidOwnerType_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */

    CreateModel create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createModel(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  }

  @Test
  public void post_ModelWithNonExistentOwner_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TestUtils.NON_EXISTENT_ENTITY).withType("user");
    CreateModel create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createModel(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_ModelListWithInvalidLimitOffset_4xx() {
    // Limit must be >= 1 and <= 1000,000
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listModels(null, -1, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listModels(null, 0, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listModels(null, 1000001, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  public void get_ModelListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listModels(null, 1, "", "", adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Only one of before or after query parameter allowed");
  }

  @Test
  public void get_ModelListWithValidLimitOffset_4xx(TestInfo test) throws HttpResponseException {
    // Create a large number of Models
    int maxModels = 40;
    for (int i = 0; i < maxModels; i++) {
      createModel(create(test, i), adminAuthHeaders());
    }

    // List all Models
    ModelList allModels = listModels(null, 1000000, null,
            null, adminAuthHeaders());
    int totalRecords = allModels.getData().size();
    printModels(allModels);

    // List limit number Models at a time at various offsets and ensure right results are returned
    for (int limit = 1; limit < maxModels; limit++) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllModels = 0;
      ModelList forwardPage;
      ModelList backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        LOG.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
        forwardPage = listModels(null, limit, null, after, adminAuthHeaders());
        printModels(forwardPage);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allModels.getData(), forwardPage, limit, indexInAllModels);

        if (pageCount == 0) {  // CASE 0 - First page is being returned. There is no before cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = listModels(null, limit, before, null, adminAuthHeaders());
          assertEntityPagination(allModels.getData(), backwardPage, limit, (indexInAllModels - limit));
        }

        indexInAllModels += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllModels = totalRecords - limit - forwardPage.getData().size();
      do {
        LOG.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
        forwardPage = listModels(null, limit, before, null, adminAuthHeaders());
        printModels(forwardPage);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allModels.getData(), forwardPage, limit, indexInAllModels);
        pageCount++;
        indexInAllModels -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  private void printModels(ModelList list) {
    list.getData().forEach(Model -> LOG.info("DB {}", Model.getFullyQualifiedName()));
    LOG.info("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  @Test
  public void put_ModelUpdateWithNoChange_200(TestInfo test) throws HttpResponseException {
    // Create a Model with POST
    CreateModel request = create(test).withOwner(USER_OWNER1);
    createAndCheckModel(request, adminAuthHeaders());

    // Update Model two times successfully with PUT requests
    updateAndCheckModel(request, OK, adminAuthHeaders());
    updateAndCheckModel(request, OK, adminAuthHeaders());
  }

  @Test
  public void put_ModelCreate_200(TestInfo test) throws HttpResponseException {
    // Create a new Model with put
    CreateModel request = create(test).withOwner(USER_OWNER1);
    updateAndCheckModel(request.withName(test.getDisplayName()).withDescription(null), CREATED, adminAuthHeaders());
  }

  @Test
  public void put_ModelCreate_as_owner_200(TestInfo test) throws HttpResponseException {
    // Create a new Model with put
    CreateModel request = create(test).withOwner(USER_OWNER1);
    // Add Owner as admin
    createAndCheckModel(request, adminAuthHeaders());
    //Update the table as Owner
    updateAndCheckModel(request.withName(test.getDisplayName()).withDescription(null),
            CREATED, authHeaders(USER1.getEmail()));
  }

  @Test
  public void put_ModelNullDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreateModel request = create(test).withDescription(null);
    createAndCheckModel(request, adminAuthHeaders());

    // Update null description with a new description
    Model db = updateAndCheckModel(request.withDisplayName("model1").
            withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("newDescription", db.getDescription());
    assertEquals("model1", db.getDisplayName());
  }

  @Test
  public void put_ModelEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    // Create table with empty description
    CreateModel request = create(test).withDescription("");
    createAndCheckModel(request, adminAuthHeaders());

    // Update empty description with a new description
    Model db = updateAndCheckModel(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("newDescription", db.getDescription());
  }

  @Test
  public void put_ModelNonEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreateModel request = create(test).withDescription("description");
    createAndCheckModel(request, adminAuthHeaders());

    // Updating description is ignored when backend already has description
    Model db = updateModel(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("description", db.getDescription());
  }

  @Test
  public void put_ModelUpdateOwner_200(TestInfo test) throws HttpResponseException {
    CreateModel request = create(test).withDescription("");
    createAndCheckModel(request, adminAuthHeaders());

    // Change ownership from USER_OWNER1 to TEAM_OWNER1
    updateAndCheckModel(request.withOwner(TEAM_OWNER1), OK, adminAuthHeaders());

    // Remove ownership
    Model db = updateAndCheckModel(request.withOwner(null), OK, adminAuthHeaders());
    assertNull(db.getOwner());
  }

  @Test
  public void put_ModelUpdateAlgorithm_200(TestInfo test) throws HttpResponseException {
    CreateModel request = create(test).withDescription("");
    createAndCheckModel(request, adminAuthHeaders());

    updateAndCheckModel(request.withAlgorithm("SVM"), OK, adminAuthHeaders());
  }

  @Test
  public void put_ModelUpdateDashboard_200(TestInfo test) throws HttpResponseException {
    CreateModel request = create(test).withDescription("");
    createAndCheckModel(request, adminAuthHeaders());

    updateAndCheckModel(request.withDashboard(DASHBOARD_REFERENCE), OK, adminAuthHeaders());
  }

  @Test
  public void get_nonExistentModel_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getModel(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND,
            entityNotFound(Entity.MODEL, TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_ModelWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateModel create = create(test).withDescription("description")
            .withOwner(USER_OWNER1).withDashboard(DASHBOARD_REFERENCE);
    Model model = createAndCheckModel(create, adminAuthHeaders());
    validateGetWithDifferentFields(model, false);
  }

  @Test
  public void get_ModelByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateModel create = create(test).withDescription("description")
            .withOwner(USER_OWNER1).withDashboard(DASHBOARD_REFERENCE);
    Model model = createAndCheckModel(create, adminAuthHeaders());
    validateGetWithDifferentFields(model, true);
  }

  @Test
  public void patch_ModelAttributes_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create Model without description, owner
    Model model = createModel(create(test), adminAuthHeaders());
    assertNull(model.getDescription());
    assertNull(model.getOwner());

    model = getModel(model.getId(), "owner,usageSummary", adminAuthHeaders());
    List<TagLabel> modelTags = singletonList(TIER_1);

    // Add description, owner when previously they were null
    model = patchModelAttributesAndCheck(model, "description",
            TEAM_OWNER1, modelTags, adminAuthHeaders());
    model.setOwner(TEAM_OWNER1); // Get rid of href and name returned in the response for owner
    modelTags = singletonList(USER_ADDRESS_TAG_LABEL);
    // Replace description, tier, owner
    model = patchModelAttributesAndCheck(model, "description1",
            USER_OWNER1, modelTags, adminAuthHeaders());
    model.setOwner(USER_OWNER1); // Get rid of href and name returned in the response for owner

    // Remove description, tier, owner
    patchModelAttributesAndCheck(model, null, null, modelTags, adminAuthHeaders());
  }

  @Test
  public void patch_ModelIDChange_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure Model ID can't be changed using patch
    Model model = createModel(create(test), adminAuthHeaders());
    UUID modelId = model.getId();
    String modelJson = JsonUtils.pojoToJson(model);
    model.setId(UUID.randomUUID());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            patchModel(modelId, modelJson, model, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.MODEL, "id"));

    // ID can't be deleted
    model.setId(null);
    exception = assertThrows(HttpResponseException.class, () ->
            patchModel(modelId, modelJson, model, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.MODEL, "id"));
  }

  @Test
  public void patch_ModelNameChange_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure Model name can't be changed using patch
    Model model = createModel(create(test), adminAuthHeaders());
    String modelJson = JsonUtils.pojoToJson(model);
    model.setName("newName");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            patchModel(modelJson, model, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.MODEL, "name"));

    // Name can't be removed
    model.setName(null);
    exception = assertThrows(HttpResponseException.class, () ->
            patchModel(modelJson, model, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.MODEL, "name"));
  }

  @Test
  public void delete_emptyModel_200_ok(TestInfo test) throws HttpResponseException {
    Model model = createModel(create(test), adminAuthHeaders());
    deleteModel(model.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonEmptyModel_4xx() {
    // TODO
  }

  @Test
  public void delete_nonExistentModel_404() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteModel(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.MODEL, TestUtils.NON_EXISTENT_ENTITY));
  }

  public static Model createAndCheckModel(CreateModel create,
                                          Map<String, String> authHeaders) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    Model model = createModel(create, authHeaders);
    validateModel(model, create.getDisplayName(), create.getDescription(), create.getOwner(), updatedBy);
    return getAndValidate(model.getId(), create, authHeaders, updatedBy);
  }

  public static Model createAndCheckModel(CreateModel create, EntityReference dashboard,
                                          Map<String, String> authHeaders) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    create.withDashboard(dashboard);
    Model model = createModel(create, authHeaders);
    assertEquals(0.1, model.getVersion());
    validateModel(model, create.getDescription(), create.getOwner(), create.getTags(), updatedBy);
    return getAndValidate(model.getId(), create, authHeaders, updatedBy);
  }

  public static Model updateAndCheckModel(CreateModel create,
                                          Status status,
                                          Map<String, String> authHeaders) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    Model updatedModel = updateModel(create, status, authHeaders);
    validateModel(updatedModel, create.getDescription(), create.getOwner(), updatedBy);

    return getAndValidate(updatedModel.getId(), create, authHeaders, updatedBy);
  }

  // Make sure in GET operations the returned Model has all the required information passed during creation
  public static Model getAndValidate(UUID modelId,
                                     CreateModel create,
                                     Map<String, String> authHeaders,
                                     String expectedUpdatedBy) throws HttpResponseException {
    // GET the newly created Model by ID and validate
    Model model = getModel(modelId, "owner", authHeaders);
    validateModel(model, create.getDescription(), create.getOwner(), expectedUpdatedBy);

    // GET the newly created Model by name and validate
    String fqn = model.getFullyQualifiedName();
    model = getModelByName(fqn, "owner", authHeaders);
    return validateModel(model, create.getDescription(), create.getOwner(), expectedUpdatedBy);
  }

  public static Model updateModel(CreateModel create,
                                  Status status,
                                  Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.put(getResource("models"),
            create, Model.class, status, authHeaders);
  }

  public static Model createModel(CreateModel create,
                                          Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("models"), create, Model.class, authHeaders);
  }

  /** Validate returned fields GET .../models/{id}?fields="..." or GET .../models/name/{fqn}?fields="..." */
  private void validateGetWithDifferentFields(Model model, boolean byName) throws HttpResponseException {
    // .../models?fields=owner
    String fields = "owner";
    model = byName ? getModelByName(model.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getModel(model.getId(), fields, adminAuthHeaders());
    assertNotNull(model.getOwner());
    assertNotNull(model.getAlgorithm());
    assertNotNull(model.getDashboard());

    // .../models?fields=owner,algorithm
    fields = "owner,algorithm";
    model = byName ? getModelByName(model.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getModel(model.getId(), fields, adminAuthHeaders());
    assertNotNull(model.getOwner());
    assertNotNull(model.getAlgorithm());
    assertNotNull(model.getDashboard());

    // .../models?fields=owner,algorithm, dashboard
    fields = "owner,algorithm,dashboard";
    model = byName ? getModelByName(model.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getModel(model.getId(), fields, adminAuthHeaders());
    assertNotNull(model.getOwner());
    assertNotNull(model.getAlgorithm());
    assertNotNull(model.getDashboard());
    TestUtils.validateEntityReference(model.getDashboard());

  }

  private static Model validateModel(Model model, String expectedDisplayName,
                                     String expectedDescription,
                                     EntityReference expectedOwner,
                                     String expectedUpdatedBy) {
    Model newModel = validateModel(model, expectedDescription, expectedOwner, expectedUpdatedBy);
    assertEquals(expectedDisplayName, newModel.getDisplayName());
    return newModel;
  }
  private static Model validateModel(Model model, String expectedDescription,
                                     EntityReference expectedOwner, String expectedUpdatedBy) {
    assertNotNull(model.getId());
    assertNotNull(model.getHref());
    assertNotNull(model.getAlgorithm());
    assertEquals(expectedDescription, model.getDescription());
    assertEquals(expectedUpdatedBy, model.getUpdatedBy());

    // Validate owner
    if (expectedOwner != null) {
      TestUtils.validateEntityReference(model.getOwner());
      assertEquals(expectedOwner.getId(), model.getOwner().getId());
      assertEquals(expectedOwner.getType(), model.getOwner().getType());
      assertNotNull(model.getOwner().getHref());
    }

    return model;
  }

  private static Model validateModel(Model model, String expectedDescription,
                                     EntityReference expectedOwner,
                                     List<TagLabel> expectedTags,
                                     String expectedUpdatedBy) throws HttpResponseException {
    assertNotNull(model.getId());
    assertNotNull(model.getHref());
    assertEquals(expectedDescription, model.getDescription());
    assertEquals(expectedUpdatedBy, model.getUpdatedBy());

    // Validate owner
    if (expectedOwner != null) {
      TestUtils.validateEntityReference(model.getOwner());
      assertEquals(expectedOwner.getId(), model.getOwner().getId());
      assertEquals(expectedOwner.getType(), model.getOwner().getType());
      assertNotNull(model.getOwner().getHref());
    }

    validateTags(expectedTags, model.getTags());
    return model;
  }

  private static void validateTags(List<TagLabel> expectedList, List<TagLabel> actualList)
          throws HttpResponseException {
    if (expectedList == null) {
      return;
    }
    // When tags from the expected list is added to an entity, the derived tags for those tags are automatically added
    // So add to the expectedList, the derived tags before validating the tags
    List<TagLabel> updatedExpectedList = new ArrayList<>(expectedList);
    for (TagLabel expected : expectedList) {
      List<TagLabel> derived = EntityUtil.getDerivedTags(expected, TagResourceTest.getTag(expected.getTagFQN(),
              adminAuthHeaders()));
      updatedExpectedList.addAll(derived);
    }
    updatedExpectedList = updatedExpectedList.stream().distinct().collect(Collectors.toList());

    assertTrue(actualList.containsAll(updatedExpectedList));
    assertTrue(updatedExpectedList.containsAll(actualList));
  }

  private Model patchModelAttributesAndCheck(Model model, String newDescription,
                                                 EntityReference newOwner, List<TagLabel> tags,
                                                 Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    String modelJson = JsonUtils.pojoToJson(model);

    // Update the table attributes
    model.setDescription(newDescription);
    model.setOwner(newOwner);
    model.setTags(tags);

    // Validate information returned in patch response has the updates
    Model updatedModel = patchModel(modelJson, model, authHeaders);
    validateModel(updatedModel, model.getDescription(), newOwner, tags, updatedBy);

    // GET the table and Validate information returned
    Model getModel = getModel(model.getId(), "owner,tags", authHeaders);
    validateModel(getModel, model.getDescription(), newOwner, tags, updatedBy);
    return updatedModel;
  }

  private Model patchModel(UUID modelId, String originalJson, Model updatedModel,
                                   Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String updatedModelJson = JsonUtils.pojoToJson(updatedModel);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updatedModelJson);
    return TestUtils.patch(getResource("models/" + modelId), patch, Model.class, authHeaders);
  }

  private Model patchModel(String originalJson,
                           Model updatedModel,
                           Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    return patchModel(updatedModel.getId(), originalJson, updatedModel, authHeaders);
  }

  public static void getModel(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    getModel(id, null, authHeaders);
  }

  public static Model getModel(UUID id, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("models/" + id);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, Model.class, authHeaders);
  }

  public static Model getModelByName(String fqn, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("models/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, Model.class, authHeaders);
  }

  public static ModelList listModels(String fields, Integer limitParam,
                                         String before, String after, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("models");
    target = fields != null ? target.queryParam("fields", fields): target;
    target = limitParam != null ? target.queryParam("limit", limitParam): target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, ModelList.class, authHeaders);
  }

  private void deleteModel(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(getResource("models/" + id), authHeaders);

    // Ensure deleted Model does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getModel(id, authHeaders));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.MODEL, id));
  }

  public static String getModelName(TestInfo test) {
    return String.format("model_%s", test.getDisplayName());
  }

  public static String getModelName(TestInfo test, int index) {
    return String.format("model%d_%s", index, test.getDisplayName());
  }

  public static CreateModel create(TestInfo test) {
    return new CreateModel().withName(getModelName(test)).withAlgorithm(ALGORITHM);
  }

  public static CreateModel create(TestInfo test, int index) {
    return new CreateModel().withName(getModelName(test, index)).withAlgorithm(ALGORITHM);
  }

}
