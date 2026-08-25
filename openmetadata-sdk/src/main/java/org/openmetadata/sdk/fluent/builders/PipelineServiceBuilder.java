package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating PipelineService entities.
 *
 * <pre>
 * PipelineService pipelineService = PipelineServiceBuilder.create(client)
 *     .name("pipelineService_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class PipelineServiceBuilder {
  private final OpenMetadataClient client;
  private final CreatePipelineService request;

  public PipelineServiceBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreatePipelineService();
  }

  /**
   * Set the name (required).
   */
  public PipelineServiceBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public PipelineServiceBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public PipelineServiceBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public PipelineServiceBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreatePipelineService request without executing it.
   */
  public CreatePipelineService build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("PipelineService name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public PipelineService create() {
    CreatePipelineService createRequest = build();
    // Convert CreatePipelineService to PipelineService
    PipelineService service = new PipelineService();
    service.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      service.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      service.setDescription(createRequest.getDescription());
    // TODO: Map service type and connection
    return client.pipelineServices().create(service);
  }

  /**
   * Create or update (upsert).
   */
  public PipelineService createOrUpdate() {
    CreatePipelineService createRequest = build();
    // Convert CreatePipelineService to PipelineService
    PipelineService service = new PipelineService();
    service.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      service.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      service.setDescription(createRequest.getDescription());
    // TODO: Map service type and connection
    return client.pipelineServices().upsert(service);
  }
}
