package org.openmetadata.it.factories;

import java.net.URI;
import java.util.UUID;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateApiService;
import org.openmetadata.schema.api.services.CreateApiService.ApiServiceType;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.services.connections.api.RestConnection;
import org.openmetadata.schema.type.ApiConnection;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Factory for creating ApiService entities in integration tests.
 *
 * <p>Provides namespace-isolated entity creation with consistent patterns.
 */
public class APIServiceTestFactory {

  /**
   * Create a REST API service with default settings. Each call creates a unique service to avoid
   * conflicts in parallel test execution.
   */
  public static ApiService createRest(OpenMetadataClient client, TestNamespace ns) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("restApiService_" + uniqueId);

    RestConnection restConn =
        new RestConnection().withOpenAPISchemaURL(URI.create("http://localhost:8585/swagger.json"));

    ApiConnection conn = new ApiConnection().withConfig(restConn);

    CreateApiService request =
        new CreateApiService()
            .withName(name)
            .withServiceType(ApiServiceType.Rest)
            .withConnection(conn)
            .withDescription("Test REST API service");

    return client.apiServices().create(request);
  }

  /** Get API service by ID. */
  public static ApiService getById(OpenMetadataClient client, String id) {
    return client.apiServices().get(id);
  }
}
