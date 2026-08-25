package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureDataType;
import org.openmetadata.schema.type.MlHyperParameter;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.dataassets.MlModelService;

/**
 * Mock tests for MlModel entity operations.
 */
public class MlModelMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private MlModelService mockMlModelService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.mlModels()).thenReturn(mockMlModelService);
    org.openmetadata.sdk.entities.MlModel.setDefaultClient(mockClient);
  }

  @Test
  void testCreateMlModel() {
    // Arrange
    CreateMlModel createRequest = new CreateMlModel();
    createRequest.setName("customer-churn-predictor");
    createRequest.setService("mlflow");
    createRequest.setAlgorithm("XGBoost");
    createRequest.setDisplayName("Customer Churn Predictor");

    MlModel expectedModel = new MlModel();
    expectedModel.setId(UUID.randomUUID());
    expectedModel.setName("customer-churn-predictor");
    expectedModel.setFullyQualifiedName("mlflow.customer-churn-predictor");
    expectedModel.setAlgorithm("XGBoost");

    when(mockMlModelService.create(any(CreateMlModel.class))).thenReturn(expectedModel);

    // Act
    MlModel result = org.openmetadata.sdk.entities.MlModel.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("customer-churn-predictor", result.getName());
    assertEquals("XGBoost", result.getAlgorithm());
    verify(mockMlModelService).create(any(CreateMlModel.class));
  }

  @Test
  void testRetrieveMlModel() {
    // Arrange
    String modelId = UUID.randomUUID().toString();
    MlModel expectedModel = new MlModel();
    expectedModel.setId(UUID.fromString(modelId));
    expectedModel.setName("fraud-detection-model");
    expectedModel.setAlgorithm("RandomForest");
    expectedModel.setTarget("is_fraud");

    when(mockMlModelService.get(modelId)).thenReturn(expectedModel);

    // Act
    MlModel result = org.openmetadata.sdk.entities.MlModel.retrieve(modelId);

    // Assert
    assertNotNull(result);
    assertEquals(modelId, result.getId().toString());
    assertEquals("fraud-detection-model", result.getName());
    assertEquals("is_fraud", result.getTarget());
    verify(mockMlModelService).get(modelId);
  }

  @Test
  void testRetrieveMlModelWithFeatures() {
    // Arrange
    String modelId = UUID.randomUUID().toString();
    String fields = "mlFeatures,mlHyperParameters,mlStore";
    MlModel expectedModel = new MlModel();
    expectedModel.setId(UUID.fromString(modelId));
    expectedModel.setName("recommendation-engine");

    // Mock ML features
    MlFeature feature1 = new MlFeature();
    feature1.setName("user_age");
    feature1.setDataType(MlFeatureDataType.Numerical);
    MlFeature feature2 = new MlFeature();
    feature2.setName("purchase_history");
    feature2.setDataType(MlFeatureDataType.Categorical);
    expectedModel.setMlFeatures(List.of(feature1, feature2));

    when(mockMlModelService.get(modelId, fields)).thenReturn(expectedModel);

    // Act
    MlModel result = org.openmetadata.sdk.entities.MlModel.retrieve(modelId, fields);

    // Assert
    assertNotNull(result);
    assertNotNull(result.getMlFeatures());
    assertEquals(2, result.getMlFeatures().size());
    assertEquals("user_age", result.getMlFeatures().get(0).getName());
    verify(mockMlModelService).get(modelId, fields);
  }

  @Test
  void testRetrieveMlModelByName() {
    // Arrange
    String fqn = "sagemaker.models.sentiment-analyzer";
    MlModel expectedModel = new MlModel();
    expectedModel.setName("sentiment-analyzer");
    expectedModel.setFullyQualifiedName(fqn);
    expectedModel.setAlgorithm("BERT");

    when(mockMlModelService.getByName(fqn)).thenReturn(expectedModel);

    // Act
    MlModel result = org.openmetadata.sdk.entities.MlModel.retrieveByName(fqn);

    // Assert
    assertNotNull(result);
    assertEquals(fqn, result.getFullyQualifiedName());
    assertEquals("BERT", result.getAlgorithm());
    verify(mockMlModelService).getByName(fqn);
  }

  @Test
  void testUpdateMlModel() {
    // Arrange
    MlModel modelToUpdate = new MlModel();
    modelToUpdate.setId(UUID.randomUUID());
    modelToUpdate.setName("price-predictor");
    modelToUpdate.setDescription("Updated price prediction model");
    modelToUpdate.setAlgorithm("GradientBoosting");

    MlModel expectedModel = new MlModel();
    expectedModel.setId(modelToUpdate.getId());
    expectedModel.setName(modelToUpdate.getName());
    expectedModel.setDescription(modelToUpdate.getDescription());
    expectedModel.setAlgorithm(modelToUpdate.getAlgorithm());

    when(mockMlModelService.update(modelToUpdate.getId().toString(), modelToUpdate))
        .thenReturn(expectedModel);

    // Act
    MlModel result =
        org.openmetadata.sdk.entities.MlModel.update(
            modelToUpdate.getId().toString(), modelToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated price prediction model", result.getDescription());
    assertEquals("GradientBoosting", result.getAlgorithm());
    verify(mockMlModelService).update(modelToUpdate.getId().toString(), modelToUpdate);
  }

  @Test
  void testMlModelWithHyperParameters() {
    // Arrange
    String modelId = UUID.randomUUID().toString();
    MlModel expectedModel = new MlModel();
    expectedModel.setId(UUID.fromString(modelId));
    expectedModel.setName("neural-network-model");

    // Mock hyperparameters
    MlHyperParameter param1 = new MlHyperParameter();
    param1.setName("learning_rate");
    param1.setValue("0.001");
    MlHyperParameter param2 = new MlHyperParameter();
    param2.setName("batch_size");
    param2.setValue("32");
    expectedModel.setMlHyperParameters(List.of(param1, param2));

    when(mockMlModelService.get(modelId, "mlHyperParameters")).thenReturn(expectedModel);

    // Act
    MlModel result = org.openmetadata.sdk.entities.MlModel.retrieve(modelId, "mlHyperParameters");

    // Assert
    assertNotNull(result.getMlHyperParameters());
    assertEquals(2, result.getMlHyperParameters().size());
    assertEquals("learning_rate", result.getMlHyperParameters().get(0).getName());
    assertEquals("0.001", result.getMlHyperParameters().get(0).getValue());
    verify(mockMlModelService).get(modelId, "mlHyperParameters");
  }

  @Test
  void testDeleteMlModel() {
    // Arrange
    String modelId = UUID.randomUUID().toString();
    doNothing().when(mockMlModelService).delete(eq(modelId), any());

    // Act
    org.openmetadata.sdk.entities.MlModel.delete(modelId);

    // Assert
    verify(mockMlModelService).delete(eq(modelId), any());
  }

  @Test
  void testAsyncOperations() throws Exception {
    // Arrange
    String modelId = UUID.randomUUID().toString();
    MlModel expectedModel = new MlModel();
    expectedModel.setId(UUID.fromString(modelId));
    expectedModel.setName("async-model");

    when(mockMlModelService.get(modelId)).thenReturn(expectedModel);

    // Act
    var future = org.openmetadata.sdk.entities.MlModel.retrieveAsync(modelId);
    MlModel result = future.get();

    // Assert
    assertNotNull(result);
    assertEquals("async-model", result.getName());
    verify(mockMlModelService).get(modelId);
  }
}
