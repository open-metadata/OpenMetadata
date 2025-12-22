package org.openmetadata.it.factories;

import java.util.UUID;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.api.services.CreateMlModelService.MlModelServiceType;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.services.connections.mlmodel.MlflowConnection;
import org.openmetadata.schema.type.MlModelConnection;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Factory for creating MlModelService entities in integration tests.
 *
 * <p>Provides namespace-isolated entity creation with consistent patterns.
 */
public class MlModelServiceTestFactory {

  /**
   * Create an MLflow ML model service with default settings. Each call creates a unique service to
   * avoid conflicts in parallel test execution.
   */
  public static MlModelService createMlflow(OpenMetadataClient client, TestNamespace ns) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("mlflowService_" + uniqueId);

    MlflowConnection mlflowConn =
        new MlflowConnection()
            .withTrackingUri("http://localhost:5000")
            .withRegistryUri("http://localhost:5000");

    MlModelConnection conn = new MlModelConnection().withConfig(mlflowConn);

    CreateMlModelService request =
        new CreateMlModelService()
            .withName(name)
            .withServiceType(MlModelServiceType.Mlflow)
            .withConnection(conn)
            .withDescription("Test MLflow service");

    return client.mlModelServices().create(request);
  }

  /** Get ML model service by ID. */
  public static MlModelService getById(OpenMetadataClient client, String id) {
    return client.mlModelServices().get(id);
  }
}
