package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating MlModelService entities.
 *
 * <pre>
 * MlModelService mlModelService = MlModelServiceBuilder.create(client)
 *     .name("mlModelService_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class MlModelServiceBuilder {
  private final OpenMetadataClient client;
  private final CreateMlModelService request;

  public MlModelServiceBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateMlModelService();
  }

  /**
   * Set the name (required).
   */
  public MlModelServiceBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public MlModelServiceBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public MlModelServiceBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public MlModelServiceBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateMlModelService request without executing it.
   */
  public CreateMlModelService build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("MlModelService name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public MlModelService create() {
    CreateMlModelService createRequest = build();
    // Convert CreateMlModelService to MlModelService
    MlModelService service = new MlModelService();
    service.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      service.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      service.setDescription(createRequest.getDescription());
    // TODO: Map service type and connection
    return client.mlModelServices().create(service);
  }

  /**
   * Create or update (upsert).
   */
  public MlModelService createOrUpdate() {
    CreateMlModelService createRequest = build();
    // Convert CreateMlModelService to MlModelService
    MlModelService service = new MlModelService();
    service.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      service.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      service.setDescription(createRequest.getDescription());
    // TODO: Map service type and connection
    return client.mlModelServices().upsert(service);
  }
}
