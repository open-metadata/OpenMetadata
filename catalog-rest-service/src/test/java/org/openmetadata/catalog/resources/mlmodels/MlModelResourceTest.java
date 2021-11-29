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
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateMlModel;
import org.openmetadata.catalog.api.services.CreateDashboardService;
import org.openmetadata.catalog.api.services.CreateDashboardService.DashboardServiceType;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.data.MlModel;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.MlModelRepository;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.FeatureSourceDataType;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.MlFeature;
import org.openmetadata.catalog.type.MlFeatureDataType;
import org.openmetadata.catalog.type.MlFeatureSource;
import org.openmetadata.catalog.type.MlHyperParameter;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.jdbi3.DashboardRepository.DashboardEntityInterface;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepository.DashboardServiceEntityInterface;
import org.openmetadata.catalog.resources.dashboards.DashboardResourceTest;
import org.openmetadata.catalog.resources.mlmodels.MlModelResource.MlModelList;
import org.openmetadata.catalog.resources.services.DashboardServiceResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.JsonUtils;

import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiConsumer;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.ENTITY_ALREADY_EXISTS;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MlModelResourceTest extends EntityResourceTest<MlModel> {

  public static EntityReference SUPERSET_REFERENCE;
  public static String ALGORITHM = "regression";
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
                          )
                  ),
          new MlFeature()
                  .withName("persona")
                  .withDataType(MlFeatureDataType.Categorical)
                  .withFeatureSources(
                          Arrays.asList(
                                  new MlFeatureSource()
                                          .withName("age")
                                          .withDataType(FeatureSourceDataType.INTEGER),
                                  new MlFeatureSource()
                                          .withName("education")
                                          .withDataType(FeatureSourceDataType.STRING)
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
  public static void setup(TestInfo test) throws IOException, URISyntaxException {

    EntityResourceTest.setup(test);

    CreateDashboardService createService = new CreateDashboardService().withName("superset")
            .withServiceType(DashboardServiceType.Superset).withDashboardUrl(TestUtils.DASHBOARD_URL);

    DashboardService service = new DashboardServiceResourceTest().createEntity(createService, adminAuthHeaders());
    SUPERSET_REFERENCE = new DashboardServiceEntityInterface(service).getEntityReference();

    DASHBOARD = DashboardResourceTest.createDashboard(
            DashboardResourceTest.create(test).withService(SUPERSET_REFERENCE), adminAuthHeaders()
    );
    DASHBOARD_REFERENCE = new DashboardEntityInterface(DASHBOARD).getEntityReference();
  }

  public static MlModel createMlModel(CreateMlModel create,
                                      Map<String, String> authHeaders) throws HttpResponseException {
    return new MlModelResourceTest().createEntity(create, authHeaders);
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
  public void post_validMlModels_as_admin_200_OK(TestInfo test) throws IOException {
    // Create valid model
    CreateMlModel create = create(test);
    createAndCheckEntity(create, adminAuthHeaders());

    create.withName(getModelName(test, 1)).withDescription("description");
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  public void post_MlModelWithUserOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_MlModelWithTeamOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1).withDisplayName("Model1"), adminAuthHeaders());
  }

  @Test public void post_MlModelWithoutFeatures_200_ok(TestInfo test) throws IOException {
    CreateMlModel create = new CreateMlModel().withName(getModelName(test, 0)).withAlgorithm(ALGORITHM);
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  public void post_MlModelWithDashboard_200_ok(TestInfo test) throws IOException {
    CreateMlModel create = create(test).withDashboard(DASHBOARD_REFERENCE);
    createAndCheckEntity(create, adminAuthHeaders());
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

    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  }

  @Test
  public void post_MlModelWithNonExistentOwner_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TestUtils.NON_EXISTENT_ENTITY).withType("user");
    CreateMlModel create = create(test).withOwner(owner);

    assertResponse(() -> createMlModel(create, adminAuthHeaders()), NOT_FOUND,
            entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void put_MlModelUpdateWithNoChange_200(TestInfo test) throws IOException {
    // Create a Model with POST
    CreateMlModel request = create(test).withOwner(USER_OWNER1);
    MlModel model = createAndCheckEntity(request, adminAuthHeaders());
    ChangeDescription change = getChangeDescription(model.getVersion());

    // Update Model two times successfully with PUT requests
    updateAndCheckEntity(request, Status.OK, adminAuthHeaders(), NO_CHANGE, change);
  }

  @Test
  public void put_MlModelUpdateAlgorithm_200(TestInfo test) throws IOException {
    CreateMlModel request = create(test);
    MlModel model = createAndCheckEntity(request, adminAuthHeaders());
    ChangeDescription change = getChangeDescription(model.getVersion());
    change.getFieldsUpdated().add(
            new FieldChange().withName("algorithm").withNewValue("SVM").withOldValue("regression")
    );

    updateAndCheckEntity(request.withAlgorithm("SVM"), Status.OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void put_MlModelAddDashboard_200(TestInfo test) throws IOException {
    CreateMlModel request = create(test);
    MlModel model = createAndCheckEntity(request, adminAuthHeaders());
    ChangeDescription change = getChangeDescription(model.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("dashboard").withNewValue(DASHBOARD_REFERENCE));

    updateAndCheckEntity(
            request.withDashboard(DASHBOARD_REFERENCE), Status.OK, adminAuthHeaders(), MINOR_UPDATE, change
    );
  }

  @Test
  public void get_nonExistentMlModel_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getModel(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    // TODO: issue-1415
    assertResponse(exception, NOT_FOUND,
            entityNotFound("mlModel", TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_MlModelWithDifferentFields_200_OK(TestInfo test) throws IOException {
    // aqui no tenim HREF al dashboard
    CreateMlModel create = create(test).withDescription("description")
            .withOwner(USER_OWNER1).withDashboard(DASHBOARD_REFERENCE);
    MlModel model = createAndCheckEntity(create, adminAuthHeaders());
    validateGetWithDifferentFields(model, false);
  }

  @Test
  public void get_MlModelByNameWithDifferentFields_200_OK(TestInfo test) throws IOException {
    CreateMlModel create = create(test).withDescription("description")
            .withOwner(USER_OWNER1).withDashboard(DASHBOARD_REFERENCE);
    MlModel model = createAndCheckEntity(create, adminAuthHeaders());
    validateGetWithDifferentFields(model, true);
  }

  @Test
  public void delete_MlModel_200_ok(TestInfo test) throws HttpResponseException {
    MlModel model = createMlModel(create(test), adminAuthHeaders());
    deleteModel(model.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonExistentModel_404() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteModel(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    // TODO: issue-1415
    assertResponse(exception, NOT_FOUND, entityNotFound("mlModel", TestUtils.NON_EXISTENT_ENTITY));
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

    // Check to make sure database does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getModel(id, authHeaders));
    // TODO: issue-1415 instead of mlModel, use Entity.MLMODEL
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("mlModel", id));
  }

  public static String getModelName(TestInfo test, int index) {
    return String.format("mlmodel%d_%s", index, test.getDisplayName());
  }

  public static CreateMlModel create(TestInfo test) {
    return create(test, 0);
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
  public void validateUpdatedEntity(MlModel mlModel, Object request, Map<String, String> authHeaders)
          throws HttpResponseException {
    validateCreatedEntity(mlModel, request, authHeaders);
  }

  @Override
  public void compareEntities(MlModel expected, MlModel updated, Map<String, String> authHeaders)
          throws HttpResponseException {
    validateCommonEntityFields(getEntityInterface(updated), expected.getDescription(),
            TestUtils.getPrincipal(authHeaders), expected.getOwner());

    // Entity specific validations
    assertEquals(expected.getAlgorithm(), updated.getAlgorithm());
    assertEquals(expected.getDashboard(), updated.getDashboard());
    assertListProperty(expected.getMlFeatures(), updated.getMlFeatures(), assertMlFeature);
    assertListProperty(expected.getMlHyperParameters(), updated.getMlHyperParameters(), assertMlHyperParam);

    // assertListProperty on MlFeatures already validates size, so we can directly iterate on sources
    validateMlFeatureSources(expected.getMlFeatures(), updated.getMlFeatures());

    TestUtils.validateTags(expected.getTags(), updated.getTags());
    TestUtils.validateEntityReference(updated.getFollowers());
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
  };

  BiConsumer<MlHyperParameter, MlHyperParameter> assertMlHyperParam =
          (MlHyperParameter expected, MlHyperParameter actual) -> {
        assertEquals(actual.getName(), expected.getName());
        assertEquals(actual.getDescription(), expected.getDescription());
        assertEquals(actual.getValue(), expected.getValue());
      };

  BiConsumer<MlFeatureSource, MlFeatureSource> assertMlFeatureSource =
          (MlFeatureSource expected, MlFeatureSource actual) -> {
        assertNotNull(actual.getFullyQualifiedName());
        assertEquals(actual.getName(), expected.getName());
        assertEquals(actual.getDescription(), expected.getDescription());
        assertEquals(actual.getDataType(), expected.getDataType());
      };

  private void validateMlFeatureSources(List<MlFeature> expected, List<MlFeature> actual)
          throws HttpResponseException {
    if (expected == null && actual == null) {
      return;
    }

    for (int i = 0; i < expected.size(); i++) {
      assertListProperty(expected.get(i).getFeatureSources(), actual.get(i).getFeatureSources(), assertMlFeatureSource);
    }

  }

  @Override
  public void validateCreatedEntity(MlModel createdEntity, Object request, Map<String, String> authHeaders)
          throws HttpResponseException {
    CreateMlModel createRequest = (CreateMlModel) request;
    validateCommonEntityFields(getEntityInterface(createdEntity), createRequest.getDescription(),
            TestUtils.getPrincipal(authHeaders), createRequest.getOwner());

    // Entity specific validations
    assertEquals(createRequest.getAlgorithm(), createdEntity.getAlgorithm());
    assertEquals(createRequest.getDashboard(), createdEntity.getDashboard());
    assertListProperty(createRequest.getMlFeatures(), createdEntity.getMlFeatures(), assertMlFeature);
    assertListProperty(createRequest.getMlHyperParameters(), createdEntity.getMlHyperParameters(), assertMlHyperParam);

    // assertListProperty on MlFeatures already validates size, so we can directly iterate on sources
    validateMlFeatureSources(createRequest.getMlFeatures(), createdEntity.getMlFeatures());

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
    } else if (fieldName.contains("mlHyperParameters") && !fieldName.endsWith("tags")
            && !fieldName.endsWith("description")) {
      List<MlHyperParameter> expectedConstraints = (List<MlHyperParameter>) expected;
      List<MlHyperParameter> actualConstraints = JsonUtils.readObjects(actual.toString(), MlHyperParameter.class);
      assertEquals(expectedConstraints, actualConstraints);
    } else if (fieldName.endsWith("algorithm")) {
      String expectedAlgorithm = (String) expected;
      String actualAlgorithm = actual.toString();
      assertEquals(expectedAlgorithm, actualAlgorithm);
    } else if (fieldName.endsWith("dashboard")) {
      EntityReference expectedDashboard = (EntityReference) expected;
      EntityReference actualDashboard = JsonUtils.readValue(actual.toString(), EntityReference.class);
      assertEquals(expectedDashboard, actualDashboard);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

}
