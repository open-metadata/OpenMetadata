package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

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
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureDataType;
import org.openmetadata.schema.type.MlHyperParameter;
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

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateMlModel createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    MlModelService service = MlModelServiceTestFactory.createMlflow(client, ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");
    request.setDescription("Test ML model created by integration test");

    return request;
  }

  @Override
  protected CreateMlModel createRequest(String name, TestNamespace ns, OpenMetadataClient client) {
    MlModelService service = MlModelServiceTestFactory.createMlflow(client, ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");

    return request;
  }

  @Override
  protected MlModel createEntity(CreateMlModel createRequest, OpenMetadataClient client) {
    return client.mlModels().create(createRequest);
  }

  @Override
  protected MlModel getEntity(String id, OpenMetadataClient client) {
    return client.mlModels().get(id);
  }

  @Override
  protected MlModel getEntityByName(String fqn, OpenMetadataClient client) {
    return client.mlModels().getByName(fqn);
  }

  @Override
  protected MlModel patchEntity(String id, MlModel entity, OpenMetadataClient client) {
    return client.mlModels().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.mlModels().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.mlModels().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.mlModels().delete(id, params);
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
  protected ListResponse<MlModel> listEntities(ListParams params, OpenMetadataClient client) {
    return client.mlModels().list(params);
  }

  @Override
  protected MlModel getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.mlModels().get(id, fields);
  }

  @Override
  protected MlModel getEntityByNameWithFields(
      String fqn, String fields, OpenMetadataClient client) {
    return client.mlModels().getByName(fqn, fields);
  }

  @Override
  protected MlModel getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.mlModels().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.mlModels().getVersionList(id);
  }

  @Override
  protected MlModel getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.mlModels().getVersion(id.toString(), version);
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
        () -> createEntity(request, client),
        "Creating ML model without service should fail");
  }

  @Test
  void post_mlModelWithFeatures_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(client, ns);

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

    MlModel mlModel = createEntity(request, client);
    assertNotNull(mlModel);
    assertNotNull(mlModel.getMlFeatures());
    assertEquals(2, mlModel.getMlFeatures().size());
  }

  @Test
  void post_mlModelWithHyperParameters_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(client, ns);

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

    MlModel mlModel = createEntity(request, client);
    assertNotNull(mlModel);
    assertNotNull(mlModel.getMlHyperParameters());
    assertEquals(2, mlModel.getMlHyperParameters().size());
  }

  @Test
  void post_mlModelWithSourceUrl_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(client, ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_with_url"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Neural Network");
    request.setSourceUrl("http://localhost:5000/models/my_model");

    MlModel mlModel = createEntity(request, client);
    assertNotNull(mlModel);
    assertEquals("http://localhost:5000/models/my_model", mlModel.getSourceUrl());
  }

  @Test
  void put_mlModelWithFeatures_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(client, ns);

    // Create ML model without features
    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_add_features"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Linear Regression");

    MlModel mlModel = createEntity(request, client);
    assertNotNull(mlModel);

    // Add features via update
    List<MlFeature> features =
        Arrays.asList(
            new MlFeature().withName("added_feature1").withDataType(MlFeatureDataType.Numerical),
            new MlFeature().withName("added_feature2").withDataType(MlFeatureDataType.Categorical));

    mlModel.setMlFeatures(features);
    MlModel updated = patchEntity(mlModel.getId().toString(), mlModel, client);
    assertNotNull(updated);
    assertNotNull(updated.getMlFeatures());
    assertEquals(2, updated.getMlFeatures().size());
  }

  @Test
  void patch_mlModelAlgorithm_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MlModelService service = MlModelServiceTestFactory.createMlflow(client, ns);

    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_patch_algo"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Random Forest");

    MlModel mlModel = createEntity(request, client);
    assertEquals("Random Forest", mlModel.getAlgorithm());

    // Patch algorithm
    mlModel.setAlgorithm("Gradient Boosting");
    MlModel patched = patchEntity(mlModel.getId().toString(), mlModel, client);
    assertEquals("Gradient Boosting", patched.getAlgorithm());
  }

  @Test
  void test_mlModelInheritsDomainFromService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create an ML model service
    MlModelService service = MlModelServiceTestFactory.createMlflow(client, ns);

    // Create an ML model under the service
    CreateMlModel request = new CreateMlModel();
    request.setName(ns.prefix("mlmodel_inherit_domain"));
    request.setService(service.getFullyQualifiedName());
    request.setAlgorithm("Logistic Regression");

    MlModel mlModel = createEntity(request, client);
    assertNotNull(mlModel);
    assertNotNull(mlModel.getService());
    assertEquals(service.getFullyQualifiedName(), mlModel.getService().getFullyQualifiedName());
  }
}
