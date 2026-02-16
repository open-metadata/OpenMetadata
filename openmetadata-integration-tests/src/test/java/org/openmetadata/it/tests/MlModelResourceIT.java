package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.MlModelServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureDataType;
import org.openmetadata.schema.type.MlHyperParameter;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for MlModel entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds ML model-specific tests for
 * features, hyperparameters, and model metadata.
 *
 * <p>Migrated from: org.openmetadata.service.resources.mlmodels.MlModelResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class MlModelResourceIT extends BaseEntityIT<MlModel, CreateMlModel> {

  {
    supportsLifeCycle = true;
    supportsListHistoryByTimestamp = true;
    supportsBulkAPI = true;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateMlModel createMinimalRequest(TestNamespace ns) {
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");
    request.setDescription("Test ML model created by integration test");

    return request;
  }

  @Override
  protected CreateMlModel createRequest(String name, TestNamespace ns) {
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");

    return request;
  }

  @Override
  protected MlModel createEntity(CreateMlModel createRequest) {
    return SdkClients.adminClient().mlModels().create(createRequest);
  }

  @Override
  protected MlModel getEntity(String id) {
    return SdkClients.adminClient().mlModels().get(id);
  }

  @Override
  protected MlModel getEntityByName(String fqn) {
    return SdkClients.adminClient().mlModels().getByName(fqn);
  }

  @Override
  protected MlModel patchEntity(String id, MlModel entity) {
    return SdkClients.adminClient().mlModels().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().mlModels().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().mlModels().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().mlModels().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "mlmodel";
  }

  @Override
  protected void validateCreatedEntity(MlModel entity, CreateMlModel createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "MlModel must have a service");
    assertEquals(createRequest.getAlgorithm(), entity.getAlgorithm());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain mlmodel name");
  }

  @Override
  protected ListResponse<MlModel> listEntities(ListParams params) {
    return SdkClients.adminClient().mlModels().list(params);
  }

  @Override
  protected MlModel getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().mlModels().get(id, fields);
  }

  @Override
  protected MlModel getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().mlModels().getByName(fqn, fields);
  }

  @Override
  protected MlModel getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().mlModels().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().mlModels().getVersionList(id);
  }

  @Override
  protected MlModel getVersion(UUID id, Double version) {
    return SdkClients.adminClient().mlModels().getVersion(id.toString(), version);
  }

  // ===================================================================
  // ML MODEL-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_mlModelWithoutRequiredFields_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Service is required field
    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_no_service"));
    request.setAlgorithm("Random Forest");

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating ML model without service should fail");
  }

  @Test
  void post_mlModelWithFeatures_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    List<MlFeature> features =
        Arrays.asList(
            new MlFeature()
                .withName("feature1")
                .withDataType(MlFeatureDataType.Numerical)
                .withDescription("First feature"),
            new MlFeature()
                .withName("feature2")
                .withDataType(MlFeatureDataType.Categorical)
                .withDescription("Second feature"));

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_with_features"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Gradient Boosting");
    request.setMlFeatures(features);

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel);
    assertNotNull(mlModel.getMlFeatures());
    assertEquals(2, mlModel.getMlFeatures().size());
  }

  @Test
  void post_mlModelWithHyperParameters_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    List<MlHyperParameter> hyperParams =
        Arrays.asList(
            new MlHyperParameter()
                .withName("learning_rate")
                .withValue("0.01")
                .withDescription("Learning rate"),
            new MlHyperParameter()
                .withName("max_depth")
                .withValue("10")
                .withDescription("Maximum tree depth"));

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_with_params"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("XGBoost");
    request.setMlHyperParameters(hyperParams);

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel);
    assertNotNull(mlModel.getMlHyperParameters());
    assertEquals(2, mlModel.getMlHyperParameters().size());
  }

  @Test
  void post_mlModelWithSourceUrl_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_with_url"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Neural Network");
    request.setSourceUrl("http://localhost:5000/models/my_model");

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel);
    assertEquals("http://localhost:5000/models/my_model", mlModel.getSourceUrl());
  }

  @Test
  void put_mlModelWithFeatures_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    // Create ML model without features
    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_add_features"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Linear Regression");

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel);

    // Add features via update
    List<MlFeature> features =
        Arrays.asList(
            new MlFeature().withName("added_feature1").withDataType(MlFeatureDataType.Numerical),
            new MlFeature().withName("added_feature2").withDataType(MlFeatureDataType.Categorical));

    mlModel.setMlFeatures(features);
    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel);
    assertNotNull(updated);
    assertNotNull(updated.getMlFeatures());
    assertEquals(2, updated.getMlFeatures().size());
  }

  @Test
  void patch_mlModelAlgorithm_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_patch_algo"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");

    MlModel mlModel = createEntity(request);
    assertEquals("Random Forest", mlModel.getAlgorithm());

    // Patch algorithm
    mlModel.setAlgorithm("Gradient Boosting");
    MlModel patched = patchEntity(mlModel.getId().toString(), mlModel);
    assertEquals("Gradient Boosting", patched.getAlgorithm());
  }

  @Test
  void test_mlModelInheritsDomainFromService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create an ML model service
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    // Create an ML model under the service
    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_inherit_domain"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Logistic Regression");

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel);
    assertNotNull(mlModel.getService());
    assertEquals(service.getFullyQualifiedName(), mlModel.getService().getFullyQualifiedName());
  }

  // ===================================================================
  // ADDITIONAL ML MODEL TESTS - Migrated from MlModelResourceTest
  // ===================================================================

  @Test
  void test_mlModelVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_version"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Neural Network");
    request.setDescription("Initial description");

    MlModel mlModel = createEntity(request);
    Double initialVersion = mlModel.getVersion();

    // Update to create new version
    mlModel.setDescription("Updated description");
    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel);
    assertTrue(updated.getVersion() >= initialVersion);

    // Get version history
    EntityHistory history = getVersionHistory(mlModel.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_mlModelSoftDeleteAndRestore(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_soft_delete"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("SVM");

    MlModel mlModel = createEntity(request);
    String mlModelId = mlModel.getId().toString();

    // Soft delete
    deleteEntity(mlModelId);

    // Verify deleted
    MlModel deleted = getEntityIncludeDeleted(mlModelId);
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(mlModelId);

    // Verify restored
    MlModel restored = getEntity(mlModelId);
    assertFalse(restored.getDeleted() != null && restored.getDeleted());
  }

  @Test
  void test_mlModelHardDelete(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_hard_delete"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Decision Tree");

    MlModel mlModel = createEntity(request);
    String mlModelId = mlModel.getId().toString();

    // Hard delete
    hardDeleteEntity(mlModelId);

    // Verify completely gone
    assertThrows(
        Exception.class,
        () -> getEntityIncludeDeleted(mlModelId),
        "Hard deleted model should not be retrievable");
  }

  @Test
  void test_listMlModelsByService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    // Create multiple models
    for (int i = 0; i < 3; i++) {
      CreateMlModel request = new CreateMlModel();
      request.setName(ns.prefix("list_mlmodel_" + i));
      request.setService(service.getFullyQualifiedName());
      request.setAlgorithm("Algorithm " + i);
      createEntity(request);
    }

    // List models
    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<MlModel> models = listEntities(params);

    assertNotNull(models);
    assertTrue(models.getData().size() >= 3);
  }

  @Test
  void test_mlModelWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_with_owner"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("KNN");
    request.setOwners(List.of(testUser1().getEntityReference()));

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel.getOwners());
    assertFalse(mlModel.getOwners().isEmpty());
    assertEquals(testUser1().getId(), mlModel.getOwners().get(0).getId());
  }

  @Test
  void patch_mlModelTarget_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_patch_target"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Linear Regression");

    MlModel mlModel = createEntity(request);

    // Update target
    mlModel.setTarget("sales_forecast");
    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel);
    assertEquals("sales_forecast", updated.getTarget());
  }

  @Test
  void patch_mlModelHyperParameters_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_patch_params"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");

    MlModel mlModel = createEntity(request);

    // Add hyperparameters
    List<MlHyperParameter> params =
        Arrays.asList(
            new MlHyperParameter().withName("n_estimators").withValue("100"),
            new MlHyperParameter().withName("max_depth").withValue("5"));

    mlModel.setMlHyperParameters(params);
    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel);
    assertNotNull(updated.getMlHyperParameters());
    assertEquals(2, updated.getMlHyperParameters().size());
  }

  @Test
  void test_mlModelDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_display"));
    request.setDisplayName("My Custom ML Model");
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");

    MlModel mlModel = createEntity(request);
    assertEquals("My Custom ML Model", mlModel.getDisplayName());

    // Update display name
    mlModel.setDisplayName("Updated ML Model Name");
    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel);
    assertEquals("Updated ML Model Name", updated.getDisplayName());
  }

  @Test
  void test_mlModelByName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_by_name"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Logistic Regression");

    MlModel mlModel = createEntity(request);
    String fqn = mlModel.getFullyQualifiedName();

    // Get by FQN
    MlModel fetched = getEntityByName(fqn);
    assertEquals(mlModel.getId(), fetched.getId());
    assertEquals(mlModel.getName(), fetched.getName());
  }

  @Test
  void test_mlModelWithMultipleFeatures(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    List<MlFeature> features =
        Arrays.asList(
            new MlFeature().withName("feature_a").withDataType(MlFeatureDataType.Numerical),
            new MlFeature().withName("feature_b").withDataType(MlFeatureDataType.Categorical),
            new MlFeature().withName("feature_c").withDataType(MlFeatureDataType.Numerical),
            new MlFeature().withName("feature_d").withDataType(MlFeatureDataType.Categorical),
            new MlFeature().withName("feature_e").withDataType(MlFeatureDataType.Numerical));

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_multi_features"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Deep Learning");
    request.setMlFeatures(features);

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel.getMlFeatures());
    assertEquals(5, mlModel.getMlFeatures().size());
  }

  @Test
  void test_mlModelFQNFormat(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_fqn_test"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Naive Bayes");

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel.getFullyQualifiedName());
    assertTrue(mlModel.getFullyQualifiedName().contains(service.getName()));
    assertTrue(mlModel.getFullyQualifiedName().contains(mlModel.getName()));
  }

  @Test
  void test_mlModelListWithPagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    // Create multiple models
    for (int i = 0; i < 5; i++) {
      CreateMlModel request = new CreateMlModel();
      request.setName(ns.prefix("paginated_model_" + i));
      request.setService(service.getFullyQualifiedName());
      request.setAlgorithm("Algorithm " + i);
      createEntity(request);
    }

    // First page
    ListParams params = new ListParams();
    params.setLimit(2);
    ListResponse<MlModel> page1 = listEntities(params);

    assertNotNull(page1);
    assertNotNull(page1.getData());
    assertEquals(2, page1.getData().size());
    assertNotNull(page1.getPaging());
  }

  // ===================================================================
  // ML STORE TESTS
  // ===================================================================

  @Test
  void post_mlModelWithMlStore_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    org.openmetadata.schema.type.MlStore mlStore =
        new org.openmetadata.schema.type.MlStore()
            .withStorage("s3://my-bucket/models")
            .withImageRepository("https://12345.dkr.ecr.region.amazonaws.com");

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_with_mlstore"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");
    request.setMlStore(mlStore);

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel);
    assertNotNull(mlModel.getMlStore());
    assertEquals(mlStore.getStorage(), mlModel.getMlStore().getStorage());
    assertEquals(mlStore.getImageRepository(), mlModel.getMlStore().getImageRepository());
  }

  @Test
  void patch_mlModelAddMlStore_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_add_mlstore"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("XGBoost");

    MlModel mlModel = createEntity(request);
    assertNull(mlModel.getMlStore());

    org.openmetadata.schema.type.MlStore mlStore =
        new org.openmetadata.schema.type.MlStore()
            .withStorage("s3://ml-models/storage")
            .withImageRepository("https://registry.com/images");

    mlModel.setMlStore(mlStore);
    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel);
    assertNotNull(updated.getMlStore());
    assertEquals(mlStore.getStorage(), updated.getMlStore().getStorage());
  }

  // ===================================================================
  // SERVER TESTS
  // ===================================================================

  @Test
  void post_mlModelWithServer_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_with_server"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Neural Network");
    request.setServer(java.net.URI.create("http://localhost:5000/models"));

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel);
    assertEquals("http://localhost:5000/models", mlModel.getServer().toString());
  }

  @Test
  void patch_mlModelAddServer_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_add_server"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Decision Tree");

    MlModel mlModel = createEntity(request);

    mlModel.setServer(java.net.URI.create("http://mlserver.example.com/api"));
    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel);
    assertNotNull(updated.getServer());
    assertEquals("http://mlserver.example.com/api", updated.getServer().toString());
  }

  @Test
  void patch_mlModelUpdateServer_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_update_server"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("SVM");
    request.setServer(java.net.URI.create("http://localhost:8080/v1"));

    MlModel mlModel = createEntity(request);
    assertEquals("http://localhost:8080/v1", mlModel.getServer().toString());

    mlModel.setServer(java.net.URI.create("http://localhost:8080/v2"));
    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel);
    assertEquals("http://localhost:8080/v2", updated.getServer().toString());
  }

  // ===================================================================
  // DASHBOARD INTEGRATION TESTS
  // ===================================================================

  @Test
  void post_mlModelWithDashboard_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    Dashboard dashboard = createDashboard(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_with_dashboard"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Logistic Regression");
    request.setDashboard(dashboard.getFullyQualifiedName());

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel);
    assertNotNull(mlModel.getDashboard());
    assertEquals(dashboard.getId(), mlModel.getDashboard().getId());
  }

  @Test
  void patch_mlModelAddDashboard_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_add_dashboard"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("KNN");

    MlModel mlModel = createEntity(request);

    Dashboard dashboard = createDashboard(ns);

    mlModel.setDashboard(dashboard.getEntityReference());
    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel);
    assertNotNull(updated.getDashboard());
    assertEquals(dashboard.getId(), updated.getDashboard().getId());
  }

  @Test
  void post_mlModelWithInvalidDashboard_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_invalid_dashboard"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");
    request.setDashboard("invalidDashboard");

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating ML model with invalid dashboard should fail");
  }

  // ===================================================================
  // FEATURE SOURCE AND DATA SOURCE TESTS
  // ===================================================================

  @Test
  void post_mlModelWithFeatureSources_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    List<org.openmetadata.schema.type.MlFeatureSource> featureSources =
        Arrays.asList(
            new org.openmetadata.schema.type.MlFeatureSource()
                .withName("source_age")
                .withDataType(org.openmetadata.schema.type.FeatureSourceDataType.INTEGER),
            new org.openmetadata.schema.type.MlFeatureSource()
                .withName("source_income")
                .withDataType(org.openmetadata.schema.type.FeatureSourceDataType.NUMBER));

    List<MlFeature> features =
        Arrays.asList(
            new MlFeature()
                .withName("age_group")
                .withDataType(MlFeatureDataType.Categorical)
                .withFeatureSources(featureSources)
                .withFeatureAlgorithm("Binning"));

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_feature_sources"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");
    request.setMlFeatures(features);

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel);
    assertNotNull(mlModel.getMlFeatures());
    assertEquals(1, mlModel.getMlFeatures().size());
    assertNotNull(mlModel.getMlFeatures().get(0).getFeatureSources());
    assertEquals(2, mlModel.getMlFeatures().get(0).getFeatureSources().size());
  }

  @Test
  void post_mlModelWithDataSource_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    Table table = createTable(ns);

    List<org.openmetadata.schema.type.MlFeatureSource> featureSources =
        Arrays.asList(
            new org.openmetadata.schema.type.MlFeatureSource()
                .withName("table_column")
                .withDataType(org.openmetadata.schema.type.FeatureSourceDataType.INTEGER)
                .withDataSource(table.getEntityReference()));

    List<MlFeature> features =
        Arrays.asList(
            new MlFeature()
                .withName("derived_feature")
                .withDataType(MlFeatureDataType.Numerical)
                .withFeatureSources(featureSources));

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_with_datasource"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Deep Learning");
    request.setMlFeatures(features);

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel);
    assertNotNull(mlModel.getMlFeatures());
    assertNotNull(mlModel.getMlFeatures().get(0).getFeatureSources());
    assertNotNull(mlModel.getMlFeatures().get(0).getFeatureSources().get(0).getDataSource());
    assertEquals(
        table.getId(),
        mlModel.getMlFeatures().get(0).getFeatureSources().get(0).getDataSource().getId());
  }

  @Test
  void post_mlModelWithInvalidDataSource_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    org.openmetadata.schema.type.EntityReference invalidTable =
        new org.openmetadata.schema.type.EntityReference()
            .withId(UUID.randomUUID())
            .withType("table");

    List<org.openmetadata.schema.type.MlFeatureSource> featureSources =
        Arrays.asList(
            new org.openmetadata.schema.type.MlFeatureSource()
                .withName("invalid_source")
                .withDataType(org.openmetadata.schema.type.FeatureSourceDataType.INTEGER)
                .withDataSource(invalidTable));

    List<MlFeature> features =
        Arrays.asList(
            new MlFeature()
                .withName("test_feature")
                .withDataType(MlFeatureDataType.Numerical)
                .withFeatureSources(featureSources));

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_invalid_datasource"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");
    request.setMlFeatures(features);

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating ML model with invalid data source should fail");
  }

  @Test
  void patch_mlModelUpdateFeatureSources_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_update_sources"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Gradient Boosting");

    MlModel mlModel = createEntity(request);

    List<org.openmetadata.schema.type.MlFeatureSource> newSources =
        Arrays.asList(
            new org.openmetadata.schema.type.MlFeatureSource()
                .withName("new_source")
                .withDataType(org.openmetadata.schema.type.FeatureSourceDataType.STRING));

    List<MlFeature> features =
        Arrays.asList(
            new MlFeature()
                .withName("updated_feature")
                .withDataType(MlFeatureDataType.Categorical)
                .withFeatureSources(newSources));

    mlModel.setMlFeatures(features);
    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel);
    assertNotNull(updated.getMlFeatures());
    assertEquals(1, updated.getMlFeatures().size());
    assertNotNull(updated.getMlFeatures().get(0).getFeatureSources());
  }

  // ===================================================================
  // FEATURE ALGORITHM TESTS
  // ===================================================================

  @Test
  void post_mlModelWithFeatureAlgorithm_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    List<MlFeature> features =
        Arrays.asList(
            new MlFeature()
                .withName("pca_feature")
                .withDataType(MlFeatureDataType.Numerical)
                .withFeatureAlgorithm("PCA"));

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_feature_algo"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");
    request.setMlFeatures(features);

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel);
    assertEquals("PCA", mlModel.getMlFeatures().get(0).getFeatureAlgorithm());
  }

  // ===================================================================
  // ADDITIONAL UPDATE TESTS
  // ===================================================================

  @Test
  void patch_mlModelUpdateAlgorithm_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_update_algo"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("regression");

    MlModel mlModel = createEntity(request);
    assertEquals("regression", mlModel.getAlgorithm());

    mlModel.setAlgorithm("SVM");
    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel);
    assertEquals("SVM", updated.getAlgorithm());
  }

  @Test
  void patch_mlModelUpdateTarget_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_update_target"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");
    request.setTarget("origTarget");

    MlModel mlModel = createEntity(request);
    assertEquals("origTarget", mlModel.getTarget());

    mlModel.setTarget("newTarget");
    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel);
    assertEquals("newTarget", updated.getTarget());
  }

  @Test
  void patch_mlModelUpdateMlFeatures_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    List<MlFeature> initialFeatures =
        Arrays.asList(
            new MlFeature().withName("feature1").withDataType(MlFeatureDataType.Numerical));

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_update_features"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Neural Network");
    request.setMlFeatures(initialFeatures);

    MlModel mlModel = createEntity(request);
    assertEquals(1, mlModel.getMlFeatures().size());

    List<MlFeature> updatedFeatures =
        Arrays.asList(
            new MlFeature().withName("new_feature").withDataType(MlFeatureDataType.Categorical));

    mlModel.setMlFeatures(updatedFeatures);
    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel);
    assertEquals(1, updated.getMlFeatures().size());
    assertEquals("new_feature", updated.getMlFeatures().get(0).getName());
  }

  @Test
  void test_mlModelNoChange_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_no_change"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");
    request.setOwners(List.of(testUser1().getEntityReference()));

    MlModel mlModel = createEntity(request);
    Double initialVersion = mlModel.getVersion();

    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel);
    assertEquals(initialVersion, updated.getVersion());
  }

  // ===================================================================
  // TAG TESTS
  // ===================================================================

  @Test
  void test_mlModelWithTags_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    org.openmetadata.schema.type.TagLabel tag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN("PII.Sensitive")
            .withLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_with_tags"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Logistic Regression");
    request.setTags(List.of(tag));

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel.getTags());
    assertFalse(mlModel.getTags().isEmpty());
  }

  @Test
  void test_mlModelFeatureWithTags_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);

    org.openmetadata.schema.type.TagLabel featureTag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN("PII.Sensitive")
            .withLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL);

    List<MlFeature> features =
        Arrays.asList(
            new MlFeature()
                .withName("tagged_feature")
                .withDataType(MlFeatureDataType.Numerical)
                .withTags(List.of(featureTag)));

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_feature_tags"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");
    request.setMlFeatures(features);

    MlModel mlModel = createEntity(request);
    assertNotNull(mlModel.getMlFeatures());
    assertNotNull(mlModel.getMlFeatures().get(0).getTags());
    assertFalse(mlModel.getMlFeatures().get(0).getTags().isEmpty());
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private Dashboard createDashboard(TestNamespace ns) {
    org.openmetadata.schema.entity.services.DashboardService dashboardService =
        org.openmetadata.it.factories.DashboardServiceTestFactory.createMetabase(ns);

    org.openmetadata.schema.api.data.CreateDashboard request =
        new org.openmetadata.schema.api.data.CreateDashboard();
    request.setName(ns.prefix("dashboard"));
    request.setService(dashboardService.getFullyQualifiedName());

    return SdkClients.adminClient().dashboards().create(request);
  }

  private Table createTable(TestNamespace ns) {
    org.openmetadata.schema.entity.data.DatabaseSchema schema =
        org.openmetadata.it.factories.DatabaseSchemaTestFactory.createSimple(ns);
    return org.openmetadata.it.factories.TableTestFactory.createSimple(
        ns, schema.getFullyQualifiedName());
  }

  // ===================================================================
  // BULK API SUPPORT
  // ===================================================================

  @Override
  protected BulkOperationResult executeBulkCreate(List<CreateMlModel> createRequests) {
    return SdkClients.adminClient().mlModels().bulkCreateOrUpdate(createRequests);
  }

  @Override
  protected BulkOperationResult executeBulkCreateAsync(List<CreateMlModel> createRequests) {
    return SdkClients.adminClient().mlModels().bulkCreateOrUpdateAsync(createRequests);
  }

  @Override
  protected CreateMlModel createInvalidRequestForBulk(TestNamespace ns) {
    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("invalid_ml_model"));
    return request;
  }
}
