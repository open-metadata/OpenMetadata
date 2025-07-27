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

package org.openmetadata.service.resources.mlmodels;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MAJOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiConsumer;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FeatureSourceDataType;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureDataType;
import org.openmetadata.schema.type.MlFeatureSource;
import org.openmetadata.schema.type.MlHyperParameter;
import org.openmetadata.schema.type.MlStore;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.dashboards.DashboardResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.mlmodels.MlModelResource.MlModelList;
import org.openmetadata.service.resources.services.MlModelServiceResourceTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MlModelResourceTest extends EntityResourceTest<MlModel, CreateMlModel> {

  public static final String ALGORITHM = "regression";
  public static Dashboard DASHBOARD;
  public static EntityReference DASHBOARD_REFERENCE;
  public static Table TABLE;
  public static EntityReference TABLE_REFERENCE;

  public static final URI SERVER = URI.create("http://localhost.com/mlModel");
  public static final MlStore ML_STORE =
      new MlStore()
          .withStorage(URI.create("s3://my-bucket.com/mlModel").toString())
          .withImageRepository(URI.create("https://12345.dkr.ecr.region.amazonaws.com").toString());

  public static final List<MlFeature> ML_FEATURES =
      Arrays.asList(
          new MlFeature()
              .withTags(null)
              .withName("age")
              .withDataType(MlFeatureDataType.Numerical)
              .withFeatureSources(
                  Collections.singletonList(
                      new MlFeatureSource()
                          .withName("age")
                          .withDataType(FeatureSourceDataType.INTEGER))),
          new MlFeature()
              .withTags(null)
              .withName("persona")
              .withDataType(MlFeatureDataType.Categorical)
              .withFeatureSources(
                  Arrays.asList(
                      new MlFeatureSource()
                          .withName("age")
                          .withDataType(FeatureSourceDataType.INTEGER),
                      new MlFeatureSource()
                          .withName("education")
                          .withDataType(FeatureSourceDataType.STRING)))
              .withFeatureAlgorithm("PCA"));
  public static final List<MlHyperParameter> ML_HYPERPARAMS =
      Arrays.asList(
          new MlHyperParameter().withName("regularisation").withValue("0.5"),
          new MlHyperParameter().withName("random").withValue("hello"));

  public MlModelResourceTest() {
    super(Entity.MLMODEL, MlModel.class, MlModelList.class, "mlmodels", MlModelResource.FIELDS);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);

    DashboardResourceTest dashboardResourceTest = new DashboardResourceTest();
    DASHBOARD =
        dashboardResourceTest.createEntity(
            dashboardResourceTest.createRequest(test).withCharts(null), ADMIN_AUTH_HEADERS);
    DASHBOARD_REFERENCE = DASHBOARD.getEntityReference();

    CreateTable createTable =
        new CreateTable()
            .withName("myTable")
            .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
            .withColumns(COLUMNS);

    TableResourceTest tableResourceTest = new TableResourceTest();
    TABLE = tableResourceTest.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);
    TABLE_REFERENCE = TABLE.getEntityReference();

    // Add data source to ML_FEATURES to validate lineage
    ML_FEATURES.get(0).getFeatureSources().get(0).withDataSource(TABLE_REFERENCE);
  }

  @Test
  void post_validMlModels_as_admin_200_OK(TestInfo test) throws IOException {
    // Create valid model
    CreateMlModel create = createRequest(test);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_MlModelWithoutFeatures_200_ok(TestInfo test) throws IOException {
    CreateMlModel create = createRequest(test).withAlgorithm(ALGORITHM);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_MlModelWithDashboard_200_ok(TestInfo test) throws IOException {
    CreateMlModel create = createRequest(test).withDashboard(DASHBOARD.getFullyQualifiedName());
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_MlModelWitMlStore_200_ok(TestInfo test) throws IOException {
    CreateMlModel create = createRequest(test).withMlStore(ML_STORE);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_MlModelWitServer_200_ok(TestInfo test) throws IOException {
    CreateMlModel create = createRequest(test).withServer(SERVER);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_MlModelUpdateWithNoChange_200(TestInfo test) throws IOException {
    // Create a Model with POST
    CreateMlModel request = createRequest(test).withOwners(List.of(USER1_REF));
    MlModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(model, NO_CHANGE);

    // Update Model two times successfully with PUT requests
    updateAndCheckEntity(request, Status.OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);
  }

  @Test
  void put_MlModelUpdateAlgorithm_200(TestInfo test) throws IOException {
    CreateMlModel request = createRequest(test);
    MlModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(model, MAJOR_UPDATE);
    fieldUpdated(change, "algorithm", "regression", "SVM");
    updateAndCheckEntity(
        request.withAlgorithm("SVM"), Status.OK, ADMIN_AUTH_HEADERS, MAJOR_UPDATE, change);
  }

  @Test
  void put_MlModelAddDashboard_200(TestInfo test) throws IOException {
    CreateMlModel request = createRequest(test).withDashboard(null);
    MlModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(model, MINOR_UPDATE);
    fieldAdded(change, "dashboard", DASHBOARD_REFERENCE);
    updateAndCheckEntity(
        request.withDashboard(DASHBOARD.getFullyQualifiedName()),
        Status.OK,
        ADMIN_AUTH_HEADERS,
        MINOR_UPDATE,
        change);
  }

  @Test
  void put_MlModelAddInvalidDashboard_200(TestInfo test) {
    CreateMlModel request = createRequest(test);
    assertResponse(
        () -> createEntity(request.withDashboard("invalidDashboard"), ADMIN_AUTH_HEADERS),
        Status.NOT_FOUND,
        String.format("dashboard instance for %s not found", "invalidDashboard"));
  }

  @Test
  void put_MlModelAddServer_200(TestInfo test) throws IOException {
    CreateMlModel request = createRequest(test);
    MlModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(model, MAJOR_UPDATE);
    fieldAdded(change, "server", SERVER);
    updateAndCheckEntity(
        request.withServer(SERVER), Status.OK, ADMIN_AUTH_HEADERS, MAJOR_UPDATE, change);
  }

  @Test
  void put_MlModelUpdateServer_200(TestInfo test) throws IOException {
    CreateMlModel request = createRequest(test).withServer(SERVER);
    MlModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(model, MAJOR_UPDATE);
    URI newServer = URI.create("http://localhost.com/mlModel/v2");
    fieldUpdated(change, "server", SERVER, newServer);
    updateAndCheckEntity(
        request.withServer(newServer), Status.OK, ADMIN_AUTH_HEADERS, MAJOR_UPDATE, change);
  }

  @Test
  void put_MlModelAddMlStore_200(TestInfo test) throws IOException {
    CreateMlModel request = createRequest(test);
    MlModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(model, MINOR_UPDATE);
    fieldAdded(change, "mlStore", ML_STORE);
    updateAndCheckEntity(
        request.withMlStore(ML_STORE), Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_MlModelAddMlFeatures_200(TestInfo test) throws IOException {
    CreateMlModel request =
        new CreateMlModel()
            .withName(getEntityName(test))
            .withAlgorithm(ALGORITHM)
            .withService(MLFLOW_REFERENCE.getName());
    MlModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(model, MINOR_UPDATE);
    fieldAdded(change, "mlFeatures", ML_FEATURES);
    updateAndCheckEntity(
        request.withMlFeatures(ML_FEATURES), Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_MlModelUpdateMlFeatures_200(TestInfo test) throws IOException {
    CreateMlModel request = createRequest(test);
    MlModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    //
    // Add new ML features from previously empty
    //
    MlFeature newMlFeature =
        new MlFeature().withName("color").withDataType(MlFeatureDataType.Categorical);
    List<MlFeature> newFeatures = Collections.singletonList(newMlFeature);

    ChangeDescription change = getChangeDescription(model, MINOR_UPDATE);
    fieldAdded(change, "mlFeatures", newFeatures);
    fieldDeleted(change, "mlFeatures", ML_FEATURES);
    updateAndCheckEntity(
        request.withMlFeatures(newFeatures), Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_MlModelWithDataSource_200(TestInfo test) throws IOException {
    CreateMlModel request = createRequest(test);
    MlModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    MlFeature newMlFeature =
        new MlFeature()
            .withName("color")
            .withDataType(MlFeatureDataType.Categorical)
            .withFeatureSources(
                Collections.singletonList(
                    new MlFeatureSource()
                        .withName("age")
                        .withDataType(FeatureSourceDataType.INTEGER)
                        .withDataSource(TABLE_REFERENCE)));
    List<MlFeature> newFeatures = Collections.singletonList(newMlFeature);

    ChangeDescription change = getChangeDescription(model, MINOR_UPDATE);
    fieldAdded(change, "mlFeatures", newFeatures);
    fieldDeleted(change, "mlFeatures", ML_FEATURES);
    updateAndCheckEntity(
        request.withMlFeatures(newFeatures), Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_MlModelWithInvalidDataSource_400(TestInfo test) {
    CreateMlModel request = createRequest(test);

    // Create a made up table reference by picking up a random UUID
    EntityReference invalid_table =
        new EntityReference().withId(UUID.randomUUID()).withType("table");

    MlFeature newMlFeature =
        new MlFeature()
            .withName("color")
            .withDataType(MlFeatureDataType.Categorical)
            .withFeatureSources(
                Collections.singletonList(
                    new MlFeatureSource()
                        .withName("age")
                        .withDataType(FeatureSourceDataType.INTEGER)
                        .withDataSource(invalid_table)));
    List<MlFeature> newFeatures = Collections.singletonList(newMlFeature);

    assertResponse(
        () -> createEntity(request.withMlFeatures(newFeatures), ADMIN_AUTH_HEADERS),
        Status.NOT_FOUND,
        String.format("table instance for %s not found", invalid_table.getId()));
  }

  @Test
  void put_MlModelAddMlHyperParams_200(TestInfo test) throws IOException {
    CreateMlModel request =
        new CreateMlModel()
            .withName(getEntityName(test))
            .withAlgorithm(ALGORITHM)
            .withService(MLFLOW_REFERENCE.getName());
    MlModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(model, MINOR_UPDATE);
    fieldAdded(change, "mlHyperParameters", ML_HYPERPARAMS);
    updateAndCheckEntity(
        request.withMlHyperParameters(ML_HYPERPARAMS),
        Status.OK,
        ADMIN_AUTH_HEADERS,
        MINOR_UPDATE,
        change);
  }

  @Test
  void put_MlModelAddTarget_200(TestInfo test) throws IOException {
    CreateMlModel request = createRequest(test);
    MlModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(model, MAJOR_UPDATE);
    fieldAdded(change, "target", "myTarget");
    updateAndCheckEntity(
        request.withTarget("myTarget"), Status.OK, ADMIN_AUTH_HEADERS, MAJOR_UPDATE, change);
  }

  @Test
  void put_MlModelUpdateTarget_200(TestInfo test) throws IOException {
    CreateMlModel request = createRequest(test).withTarget("origTarget");
    MlModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    ChangeDescription change = getChangeDescription(model, MAJOR_UPDATE);
    fieldUpdated(change, "target", "origTarget", "newTarget");
    updateAndCheckEntity(
        request.withTarget("newTarget"), Status.OK, ADMIN_AUTH_HEADERS, MAJOR_UPDATE, change);
  }

  @Test
  void test_mutuallyExclusiveTags(TestInfo testInfo) {
    CreateMlModel create =
        createRequest(testInfo).withTags(List.of(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));
    List<MlFeature> mlFeatureList =
        Arrays.asList(
            new MlFeature()
                .withTags(null)
                .withName("age")
                .withDataType(MlFeatureDataType.Numerical)
                .withFeatureSources(
                    Collections.singletonList(
                        new MlFeatureSource()
                            .withName("age")
                            .withDataType(FeatureSourceDataType.INTEGER))),
            new MlFeature()
                .withTags(null)
                .withName("persona")
                .withDataType(MlFeatureDataType.Categorical)
                .withFeatureSources(
                    Arrays.asList(
                        new MlFeatureSource()
                            .withName("age")
                            .withDataType(FeatureSourceDataType.INTEGER),
                        new MlFeatureSource()
                            .withName("education")
                            .withDataType(FeatureSourceDataType.STRING)))
                .withFeatureAlgorithm("PCA"));
    // Apply mutually exclusive tags to a MlModel feature
    CreateMlModel createMlModel = createRequest(testInfo, 1);
    for (MlFeature mlFeature : mlFeatureList) {
      mlFeature.withTags(listOf(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    }
    createMlModel.setMlFeatures(mlFeatureList);
    assertResponse(
        () -> createEntity(createMlModel, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));
  }

  @Test
  void test_inheritDomain(TestInfo test) throws IOException {
    // When domain is not set for an ML Model, carry it forward from the ML Model Service
    MlModelServiceResourceTest serviceTest = new MlModelServiceResourceTest();
    CreateMlModelService createService =
        serviceTest.createRequest(test).withDomains(List.of(DOMAIN.getFullyQualifiedName()));
    MlModelService service = serviceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create a ML Model without domain and ensure it inherits domain from the parent
    CreateMlModel create = createRequest("model").withService(service.getFullyQualifiedName());
    assertSingleDomainInheritance(create, DOMAIN.getEntityReference());
  }

  @Test
  void testInheritedPermissionFromParent(TestInfo test) throws IOException {
    // Create a MlModel service with owner data consumer
    MlModelServiceResourceTest serviceTest = new MlModelServiceResourceTest();
    CreateMlModelService createMlModelService =
        serviceTest
            .createRequest(getEntityName(test))
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()));
    MlModelService service = serviceTest.createEntity(createMlModelService, ADMIN_AUTH_HEADERS);

    // Data consumer as an owner of the service can create MlModel under it
    createEntity(
        createRequest("MlModel").withService(service.getFullyQualifiedName()),
        authHeaders(DATA_CONSUMER.getName()));
  }

  @Override
  public MlModel validateGetWithDifferentFields(MlModel model, boolean byName)
      throws HttpResponseException {
    // .../models?fields=owner
    String fields = "";
    model =
        byName
            ? getEntityByName(model.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(model.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(
        model.getOwners(),
        model.getDashboard(),
        model.getFollowers(),
        model.getTags(),
        model.getUsageSummary());

    // .../models?fields=mlFeatures,mlHyperParameters
    fields = "owners,followers,tags,usageSummary";
    model =
        byName
            ? getEntityByName(model.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(model.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(model.getUsageSummary());
    // Checks for other owners, tags, and followers is done in the base class
    return model;
  }

  @Override
  public CreateMlModel createRequest(String name) {
    return new CreateMlModel()
        .withName(name)
        .withAlgorithm(ALGORITHM)
        .withMlFeatures(ML_FEATURES)
        .withMlHyperParameters(ML_HYPERPARAMS)
        .withService(MLFLOW_REFERENCE.getFullyQualifiedName());
  }

  @Override
  public void compareEntities(MlModel expected, MlModel updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Entity specific validations
    assertEquals(expected.getAlgorithm(), updated.getAlgorithm());
    assertEquals(expected.getDashboard(), updated.getDashboard());
    assertListProperty(expected.getMlFeatures(), updated.getMlFeatures(), assertMlFeature);
    assertListProperty(
        expected.getMlHyperParameters(), updated.getMlHyperParameters(), assertMlHyperParam);

    // assertListProperty on MlFeatures already validates size, so we can directly iterate on
    // sources
    validateMlFeatureSources(expected.getMlFeatures(), updated.getMlFeatures());

    TestUtils.validateTags(expected.getTags(), updated.getTags());
    TestUtils.validateEntityReferences(updated.getFollowers());
  }

  final BiConsumer<MlFeature, MlFeature> assertMlFeature =
      (MlFeature expected, MlFeature actual) -> {
        // FQN gets created on-the-fly based on the test name. Just check that it is not null
        assertNotNull(actual.getFullyQualifiedName());
        assertEquals(actual.getName(), expected.getName());
        assertEquals(actual.getDescription(), expected.getDescription());
        assertEquals(actual.getFeatureAlgorithm(), expected.getFeatureAlgorithm());
        assertEquals(actual.getDataType(), expected.getDataType());
      };

  final BiConsumer<MlHyperParameter, MlHyperParameter> assertMlHyperParam =
      (MlHyperParameter expected, MlHyperParameter actual) -> {
        assertEquals(actual.getName(), expected.getName());
        assertEquals(actual.getDescription(), expected.getDescription());
        assertEquals(actual.getValue(), expected.getValue());
      };

  final BiConsumer<MlFeatureSource, MlFeatureSource> assertMlFeatureSource =
      (MlFeatureSource expected, MlFeatureSource actual) -> {
        // FQN gets created on-the-fly based on the test name. Just check that it is not null
        assertNotNull(actual.getFullyQualifiedName());
        assertEquals(actual.getName(), expected.getName());
        assertEquals(actual.getDescription(), expected.getDescription());
        assertEquals(actual.getDataType(), expected.getDataType());
        assertEquals(actual.getDataSource(), expected.getDataSource());
      };

  private void validateMlFeatureSources(List<MlFeature> expected, List<MlFeature> actual) {
    if (expected == actual) {
      return;
    }

    for (int i = 0; i < expected.size(); i++) {
      assertListProperty(
          expected.get(i).getFeatureSources(),
          actual.get(i).getFeatureSources(),
          assertMlFeatureSource);
    }
  }

  @Override
  public void validateCreatedEntity(
      MlModel createdEntity, CreateMlModel createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(createRequest.getAlgorithm(), createdEntity.getAlgorithm());
    assertReference(createRequest.getDashboard(), createdEntity.getDashboard());
    assertListProperty(
        createRequest.getMlFeatures(), createdEntity.getMlFeatures(), assertMlFeature);
    assertListProperty(
        createRequest.getMlHyperParameters(),
        createdEntity.getMlHyperParameters(),
        assertMlHyperParam);

    // assertListProperty on MlFeatures already validates size, so we can directly iterate on
    // sources
    validateMlFeatureSources(createRequest.getMlFeatures(), createdEntity.getMlFeatures());

    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
    TestUtils.validateEntityReferences(createdEntity.getFollowers());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.contains("mlFeatures")) {
      @SuppressWarnings("unchecked")
      List<MlFeature> expectedFeatures = (List<MlFeature>) expected;
      List<MlFeature> actualFeatures = JsonUtils.readObjects(actual.toString(), MlFeature.class);
      assertListProperty(expectedFeatures, actualFeatures, assertMlFeature);
    } else if (fieldName.contains("mlHyperParameters")) {
      @SuppressWarnings("unchecked")
      List<MlHyperParameter> expectedConstraints = (List<MlHyperParameter>) expected;
      List<MlHyperParameter> actualConstraints =
          JsonUtils.readObjects(actual.toString(), MlHyperParameter.class);
      assertListProperty(expectedConstraints, actualConstraints, assertMlHyperParam);
    } else if (fieldName.contains("algorithm")) {
      String expectedAlgorithm = (String) expected;
      String actualAlgorithm = actual.toString();
      assertEquals(expectedAlgorithm, actualAlgorithm);
    } else if (fieldName.contains("dashboard")) {
      assertEntityReferenceFieldChange(expected, actual);
    } else if (fieldName.contains("server")) {
      URI expectedServer = (URI) expected;
      URI actualServer = URI.create(actual.toString());
      assertEquals(expectedServer, actualServer);
    } else if (fieldName.contains("mlStore")) {
      MlStore expectedMlStore = (MlStore) expected;
      MlStore actualMlStore = JsonUtils.readValue(actual.toString(), MlStore.class);
      assertEquals(expectedMlStore, actualMlStore);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
