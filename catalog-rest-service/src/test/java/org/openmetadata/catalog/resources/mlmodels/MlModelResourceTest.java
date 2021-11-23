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

package org.openmetadata.catalog.resources.mlmodels;

import org.apache.http.client.HttpResponseException;
import org.apache.logging.log4j.core.util.JsonUtils;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateDashboard;
import org.openmetadata.catalog.api.data.CreateMlModel;
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.api.services.CreateDashboardService;
import org.openmetadata.catalog.api.services.CreateDashboardService.DashboardServiceType;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.data.MlModel;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.jdbi3.MlModelRepository;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.ColumnConstraint;
import org.openmetadata.catalog.type.FeatureSourceDataType;
import org.openmetadata.catalog.type.MlFeature;
import org.openmetadata.catalog.type.MlFeatureDataType;
import org.openmetadata.catalog.type.MlFeatureSource;
import org.openmetadata.catalog.type.MlHyperParameter;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.DashboardRepository.DashboardEntityInterface;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepository.DashboardServiceEntityInterface;
import org.openmetadata.catalog.resources.dashboards.DashboardResourceTest;
import org.openmetadata.catalog.resources.mlmodels.MlModelResource.MlModelList;
import org.openmetadata.catalog.resources.services.DashboardServiceResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TableConstraint;
import org.openmetadata.catalog.type.TableType;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Function;

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
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.ENTITY_ALREADY_EXISTS;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class MlModelResourceTest extends EntityResourceTest<MlModel> {
  private static final Logger LOG = LoggerFactory.getLogger(MlModelResourceTest.class);
  public static User USER1;
  public static EntityReference USER_OWNER1;
  public static Team TEAM1;
  public static EntityReference TEAM_OWNER1;
  public static String ALGORITHM = "regression";
  public static EntityReference SUPERSET_REFERENCE;
  public static Dashboard DASHBOARD;
  public static EntityReference DASHBOARD_REFERENCE;
  public static List<MlFeature> ML_FEATURES = Arrays.asList(
          new MlFeature()
                  .withName("age")
                  .withDataType(MlFeatureDataType.Numerical)
                  .withFeatureSources(
                          Collections.singletonList(
                                  new MlFeatureSource()
                                          .withName("age")
                                          .withDataType(FeatureSourceDataType.INTEGER)
                                          .withFullyQualifiedName("my_service.my_db.my_table.age")
                          )
                  ),
          new MlFeature()
                  .withName("persona")
                  .withDataType(MlFeatureDataType.Categorical)
                  .withFeatureSources(
                          Arrays.asList(
                                  new MlFeatureSource()
                                          .withName("age")
                                          .withDataType(FeatureSourceDataType.INTEGER)
                                          .withFullyQualifiedName("my_service.my_db.my_table.age"),
                                  new MlFeatureSource()
                                          .withName("education")
                                          .withDataType(FeatureSourceDataType.STRING)
                                          .withFullyQualifiedName("my_api.education")
                          )
                  )
          .withFeatureAlgorithm("PCA")
  );
  public static List<MlHyperParameter> ML_HYPERPARAMS = Arrays.asList(
          new MlHyperParameter().withName("regularisation").withValue("0.5"),
          new MlHyperParameter().withName("random").withValue("hello")
  );

  public MlModelResourceTest() {
    super(Entity.MLMODEL, MlModel.class, MlModelList.class, "mlmodels", MlModelResource.FIELDS, true,
            true, true);
  }


  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException {
    USER1 = UserResourceTest.createUser(UserResourceTest.create(test), authHeaders("test@open-metadata.org"));
    USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType("user");

    TEAM1 = TeamResourceTest.createTeam(TeamResourceTest.create(test), adminAuthHeaders());
    TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType("team");

    CreateDashboardService createService = new CreateDashboardService().withName("superset")
            .withServiceType(DashboardServiceType.Superset).withDashboardUrl(TestUtils.DASHBOARD_URL);

    DashboardService service = DashboardServiceResourceTest.createService(createService, adminAuthHeaders());
    SUPERSET_REFERENCE = new DashboardServiceEntityInterface(service).getEntityReference();

    DASHBOARD = DashboardResourceTest.createDashboard(
            DashboardResourceTest.create(test).withService(SUPERSET_REFERENCE), adminAuthHeaders()
    );
    DASHBOARD_REFERENCE = new DashboardEntityInterface(DASHBOARD).getEntityReference();
  }

  @Test
  public void post_MlModelWithLongName_400_badRequest(TestInfo test) {
    // Create model with mandatory name field empty
    CreateMlModel create = create(test).withName(TestUtils.LONG_ENTITY_NAME);
    assertResponse(() -> createMlModel(create, adminAuthHeaders()), BAD_REQUEST,
            "[name size must be between 1 and 64]");
  }

  @Test
  public void post_MlModelWithoutName_400_badRequest(TestInfo test) {
    // Create Model with mandatory name field empty
    CreateMlModel create = create(test).withName("");
    assertResponse(() -> createMlModel(create, adminAuthHeaders()), BAD_REQUEST,
            "[name size must be between 1 and 64]");
  }

  @Test
  public void post_MlModelAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreateMlModel create = create(test);
    createMlModel(create, adminAuthHeaders());
    assertResponse(() -> createMlModel(create, adminAuthHeaders()), CONFLICT, ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validMlModels_as_admin_200_OK(TestInfo test) throws HttpResponseException {
    // Create valid model
    CreateMlModel create = create(test);
    createAndCheckModel(create, adminAuthHeaders());

    create.withName(getModelName(test, 1)).withDescription("description");
    createAndCheckModel(create, adminAuthHeaders());
  }

  @Test
  public void post_MlModelWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckModel(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_MlModelWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckModel(create(test).withOwner(TEAM_OWNER1).withDisplayName("Model1"), adminAuthHeaders());
  }

  @Test
  public void post_MlModelWithDashboard_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckModel(create(test), DASHBOARD_REFERENCE, adminAuthHeaders());
  }

  @Test
  public void post_MlModel_as_non_admin_401(TestInfo test) {
    CreateMlModel create = create(test);
    assertResponse(() -> createMlModel(create, authHeaders("test@open-metadata.org")), FORBIDDEN,
            "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_MlModelWithInvalidOwnerType_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */
    CreateMlModel create = create(test).withOwner(owner);

    assertResponse(() -> createMlModel(create, adminAuthHeaders()), BAD_REQUEST, "type must not be null");
  }

  @Test
  public void post_MlModelWithNonExistentOwner_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TestUtils.NON_EXISTENT_ENTITY).withType("user");
    CreateMlModel create = create(test).withOwner(owner);

    assertResponse(() -> createMlModel(create, adminAuthHeaders()), NOT_FOUND,
            entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
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
      createMlModel(create(test, i), adminAuthHeaders());
    }

    // List all Models
    MlModelList allModels = listModels(null, 1000000, null,
            null, adminAuthHeaders());
    int totalRecords = allModels.getData().size();
    printModels(allModels);

    // List limit number Models at a time at various offsets and ensure right results are returned
    for (int limit = 1; limit < maxModels; limit++) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllModels = 0;
      MlModelList forwardPage;
      MlModelList backwardPage;
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

  private void printModels(MlModelList list) {
    list.getData().forEach(Model -> LOG.info("DB {}", Model.getFullyQualifiedName()));
    LOG.info("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  @Test
  public void put_ModelUpdateWithNoChange_200(TestInfo test) throws HttpResponseException {
    // Create a Model with POST
    CreateMlModel request = create(test).withOwner(USER_OWNER1);
    MlModel model = createAndCheckModel(request, adminAuthHeaders());

    // Update Model two times successfully with PUT requests
    model = updateAndCheckModel(model, request, OK, adminAuthHeaders(), NO_CHANGE);
    updateAndCheckModel(model, request, OK, adminAuthHeaders(), NO_CHANGE);
  }

  @Test
  public void put_ModelCreate_200(TestInfo test) throws HttpResponseException {
    // Create a new Model with PUT
    CreateMlModel request = create(test).withOwner(USER_OWNER1);
    updateAndCheckModel(null, request.withName(test.getDisplayName()).withDescription(null), CREATED,
            adminAuthHeaders(), NO_CHANGE);
  }

  @Test
  public void put_ModelCreate_as_owner_200(TestInfo test) throws HttpResponseException {
    // Create a new Model with put
    CreateMlModel request = create(test).withOwner(USER_OWNER1);
    // Add model as admin
    MlModel model = createAndCheckModel(request, adminAuthHeaders());
    // Update the table as Owner
    updateAndCheckModel(model, request.withDescription("new"), OK, authHeaders(USER1.getEmail()), MINOR_UPDATE);
  }

  @Test
  public void put_ModelNullDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreateMlModel request = create(test).withDescription(null);
    MlModel model = createAndCheckModel(request, adminAuthHeaders());

    // Update null description with a new description
    MlModel db = updateAndCheckModel(model, request.withDisplayName("model1").
            withDescription("newDescription"), OK, adminAuthHeaders(), MINOR_UPDATE);
    assertEquals("model1", db.getDisplayName()); // Move this check to validate method
  }

  @Test
  public void put_ModelEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    // Create table with empty description
    CreateMlModel request = create(test).withDescription("");
    MlModel model = createAndCheckModel(request, adminAuthHeaders());

    // Update empty description with a new description
    updateAndCheckModel(model, request.withDescription("newDescription"), OK, adminAuthHeaders(), MINOR_UPDATE);
  }

  @Test
  public void put_ModelNonEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreateMlModel request = create(test).withDescription("description");
    createAndCheckModel(request, adminAuthHeaders());

    // Updating description is ignored when backend already has description
    MlModel db = updateModel(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("description", db.getDescription());
  }

  @Test
  public void put_ModelUpdateOwner_200(TestInfo test) throws HttpResponseException {
    CreateMlModel request = create(test).withDescription("");
    MlModel model = createAndCheckModel(request, adminAuthHeaders());

    // Change ownership from USER_OWNER1 to TEAM_OWNER1
    model = updateAndCheckModel(model, request.withOwner(TEAM_OWNER1), OK, adminAuthHeaders(), MINOR_UPDATE);

    // Remove ownership
    model = updateAndCheckModel(model, request.withOwner(null), OK, adminAuthHeaders(), MINOR_UPDATE);
    assertNull(model.getOwner());
  }

  @Test
  public void put_ModelUpdateAlgorithm_200(TestInfo test) throws HttpResponseException {
    CreateMlModel request = create(test).withDescription("");
    MlModel model = createAndCheckModel(request, adminAuthHeaders());
    updateAndCheckModel(model, request.withAlgorithm("SVM"), OK, adminAuthHeaders(), MINOR_UPDATE);
  }

  @Test
  public void put_ModelUpdateDashboard_200(TestInfo test) throws HttpResponseException {
    CreateMlModel request = create(test).withDescription("");
    MlModel model = createAndCheckModel(request, adminAuthHeaders());
    updateAndCheckModel(model, request.withDashboard(DASHBOARD_REFERENCE), OK, adminAuthHeaders(), MINOR_UPDATE);
  }

  @Test
  public void get_nonExistentModel_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getModel(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND,
            entityNotFound(Entity.MLMODEL, TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_ModelWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateMlModel create = create(test).withDescription("description")
            .withOwner(USER_OWNER1).withDashboard(DASHBOARD_REFERENCE);
    MlModel model = createAndCheckModel(create, adminAuthHeaders());
    validateGetWithDifferentFields(model, false);
  }

  @Test
  public void get_ModelByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateMlModel create = create(test).withDescription("description")
            .withOwner(USER_OWNER1).withDashboard(DASHBOARD_REFERENCE);
    MlModel model = createAndCheckModel(create, adminAuthHeaders());
    validateGetWithDifferentFields(model, true);
  }

  @Test
  public void delete_emptyModel_200_ok(TestInfo test) throws HttpResponseException {
    MlModel model = createMlModel(create(test), adminAuthHeaders());
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
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.MLMODEL, TestUtils.NON_EXISTENT_ENTITY));
  }

  public static MlModel createAndCheckModel(CreateMlModel create,
                                          Map<String, String> authHeaders) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    MlModel model = createMlModel(create, authHeaders);
    validateModel(model, create.getDisplayName(), create.getDescription(), create.getOwner(), updatedBy);
    return getAndValidate(model.getId(), create, authHeaders, updatedBy);
  }

  public static MlModel createAndCheckModel(CreateMlModel create, EntityReference dashboard,
                                          Map<String, String> authHeaders) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    create.withDashboard(dashboard);
    MlModel model = createMlModel(create, authHeaders);
    assertEquals(0.1, model.getVersion());
    validateModel(model, create.getDescription(), create.getOwner(), create.getTags(), updatedBy);
    return getAndValidate(model.getId(), create, authHeaders, updatedBy);
  }

  public static MlModel updateAndCheckModel(MlModel before, CreateMlModel create, Status status,
                                          Map<String, String> authHeaders, UpdateType updateType)
          throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    MlModel updatedModel = updateModel(create, status, authHeaders);
    validateModel(updatedModel, create.getDescription(), create.getOwner(), updatedBy);
    if (before == null) {
      assertEquals(0.1, updatedModel.getVersion()); // First version created
    } else {
      TestUtils.validateUpdate(before.getVersion(), updatedModel.getVersion(), updateType);
    }

    return getAndValidate(updatedModel.getId(), create, authHeaders, updatedBy);
  }

  // Make sure in GET operations the returned Model has all the required information passed during creation
  public static MlModel getAndValidate(UUID modelId,
                                     CreateMlModel create,
                                     Map<String, String> authHeaders,
                                     String expectedUpdatedBy) throws HttpResponseException {
    // GET the newly created Model by ID and validate
    MlModel model = getModel(modelId, "owner", authHeaders);
    validateModel(model, create.getDescription(), create.getOwner(), expectedUpdatedBy);

    // GET the newly created Model by name and validate
    String fqn = model.getFullyQualifiedName();
    model = getModelByName(fqn, "owner", authHeaders);
    return validateModel(model, create.getDescription(), create.getOwner(), expectedUpdatedBy);
  }

  public static MlModel updateModel(CreateMlModel create,
                                  Status status,
                                  Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.put(getResource("mlmodels"),
            create, MlModel.class, status, authHeaders);
  }

  public static MlModel createMlModel(CreateMlModel create,
                                      Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("mlmodels"), create, MlModel.class, authHeaders);
  }

  /** Validate returned fields GET .../models/{id}?fields="..." or GET .../models/name/{fqn}?fields="..." */
  private void validateGetWithDifferentFields(MlModel model, boolean byName) throws HttpResponseException {
    // .../models?fields=owner
    String fields = "owner";
    model = byName ? getModelByName(model.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getModel(model.getId(), fields, adminAuthHeaders());
    assertNotNull(model.getOwner());
    assertNotNull(model.getAlgorithm()); // Provided as default field
    assertNull(model.getDashboard());

    // .../models?fields=mlFeatures,mlHyperParameters
    fields = "mlFeatures,mlHyperParameters";
    model = byName ? getModelByName(model.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getModel(model.getId(), fields, adminAuthHeaders());
    assertNotNull(model.getAlgorithm()); // Provided as default field
    assertNotNull(model.getMlFeatures());
    assertNotNull(model.getMlHyperParameters());
    assertNull(model.getDashboard());

    // .../models?fields=owner,algorithm
    fields = "owner,algorithm";
    model = byName ? getModelByName(model.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getModel(model.getId(), fields, adminAuthHeaders());
    assertNotNull(model.getOwner());
    assertNotNull(model.getAlgorithm());
    assertNull(model.getDashboard());

    // .../models?fields=owner,algorithm, dashboard
    fields = "owner,algorithm,dashboard";
    model = byName ? getModelByName(model.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getModel(model.getId(), fields, adminAuthHeaders());
    assertNotNull(model.getOwner());
    assertNotNull(model.getAlgorithm());
    assertNotNull(model.getDashboard());
    TestUtils.validateEntityReference(model.getDashboard());
  }

  public static void getModel(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    getModel(id, null, authHeaders);
  }

  public static MlModel getModel(UUID id, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("mlmodels/" + id);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, MlModel.class, authHeaders);
  }

  public static MlModel getModelByName(String fqn, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("mlmodels/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, MlModel.class, authHeaders);
  }

  private void deleteModel(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(getResource("mlmodels/" + id), authHeaders);

    assertResponse(() -> getModel(id, authHeaders), NOT_FOUND, entityNotFound(Entity.MLMODEL, id));
  }

  public static String getModelName(TestInfo test) {
    return String.format("mlmodel_%s", test.getDisplayName());
  }

  public static String getModelName(TestInfo test, int index) {
    return String.format("mlmodel%d_%s", index, test.getDisplayName());
  }

  public static CreateMlModel create(TestInfo test) {
    return new CreateMlModel().withName(getModelName(test)).withAlgorithm(ALGORITHM)
            .withMlFeatures(ML_FEATURES).withMlHyperParameters(ML_HYPERPARAMS);
  }

  public static CreateMlModel create(TestInfo test, int index) {
    return new CreateMlModel().withName(getModelName(test, index)).withAlgorithm(ALGORITHM)
            .withMlFeatures(ML_FEATURES).withMlHyperParameters(ML_HYPERPARAMS);
  }

  @Override
  public Object createRequest(TestInfo test, int index, String description, String displayName, EntityReference owner) {
    return create(test, index).withDescription(description).withDisplayName(displayName).withOwner(owner);
  }

  @Override
  public void validateUpdatedEntity(MlModel mlmodel, Object request, Map<String, String> authHeaders) throws HttpResponseException {
    validateCreatedEntity(mlmodel, request, authHeaders);
  }

  @Override
  public void compareEntities(MlModel expected, MlModel updated, Map<String, String> authHeaders) {
  }

  @Override
  public EntityInterface<MlModel> getEntityInterface(MlModel entity) {
    return new MlModelRepository.MlModelEntityInterface(entity);
  }

  BiConsumer<MlFeature, MlFeature> assertMlFeature = (MlFeature expected, MlFeature actual) -> {
    assertNotNull(actual.getFullyQualifiedName());
    assertEquals(actual.getName(), expected.getName());
    assertEquals(actual.getDescription(), expected.getDescription());
    assertEquals(actual.getFeatureAlgorithm(), expected.getFeatureAlgorithm());
    assertEquals(actual.getDataType(), expected.getDataType());
    assertEquals(actual.getFeatureSources(), expected.getFeatureSources());
  };

  BiConsumer<MlHyperParameter, MlHyperParameter> assertMlHyerParam = (MlHyperParameter expected, MlHyperParameter actual) -> {
    assertEquals(actual.getName(), expected.getName());
    assertEquals(actual.getDescription(), expected.getDescription());
    assertEquals(actual.getValue(), expected.getValue());
  };

  @Override
  public void validateCreatedEntity(MlModel createdEntity, Object request, Map<String, String> authHeaders) throws HttpResponseException {
    CreateMlModel createRequest = (CreateMlModel) request;
    validateCommonEntityFields(getEntityInterface(createdEntity), createRequest.getDescription(),
            TestUtils.getPrincipal(authHeaders), createRequest.getOwner());

    assertEquals(createRequest.getAlgorithm(), createdEntity.getAlgorithm());
    assertEquals(createRequest.getDashboard(), createdEntity.getDashboard());
    assertListProperty(createRequest.getMlFeatures(), createdEntity.getMlFeatures(), assertMlFeature);
    assertListProperty(createRequest.getMlHyperParameters(), createdEntity.getMlHyperParameters(), assertMlHyerParam);

    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
    TestUtils.validateEntityReference(createdEntity.getFollowers());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.contains("mlFeatures") && !fieldName.endsWith("tags") && !fieldName.endsWith("description")) {
      List<MlFeature> expectedFeatures = (List<MlFeature>) expected;
      List<MlFeature> actualFeatures = JsonUtils.readObjects(actual.toString(), MlFeature.class);
      assertEquals(expectedFeatures, actualFeatures);
    } else if (fieldName.contains("mlHyperParameters") && !fieldName.endsWith("tags") && !fieldName.endsWith("description")) {
      List<MlHyperParameter> expectedConstraints = (List<MlHyperParameter>) expected;
      List<MlHyperParameter> actualConstraints = JsonUtils.readObjects(actual.toString(), MlHyperParameter.class);
      assertEquals(expectedConstraints, actualConstraints);
    } else if (fieldName.endsWith("algorithm")) {
      String expectedAlgorithm = (String) expected;
      String actualAlgorithm = actual.toString();
      assertEquals(expectedAlgorithm, actualAlgorithm);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

}
