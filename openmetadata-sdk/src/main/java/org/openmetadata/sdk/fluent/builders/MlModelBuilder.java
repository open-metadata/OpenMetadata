package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating MlModel entities.
 *
 * <pre>
 * MlModel mlModel = MlModelBuilder.create(client)
 *     .name("mlModel_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class MlModelBuilder {
  private final OpenMetadataClient client;
  private final CreateMlModel request;

  public MlModelBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateMlModel();
  }

  /**
   * Set the name (required).
   */
  public MlModelBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public MlModelBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public MlModelBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public MlModelBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateMlModel request without executing it.
   */
  public CreateMlModel build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("MlModel name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public MlModel create() {
    CreateMlModel createRequest = build();
    // Convert CreateMlModel to MlModel
    MlModel entity = new MlModel();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.mlModels().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public MlModel createOrUpdate() {
    CreateMlModel createRequest = build();
    // Convert CreateMlModel to MlModel
    MlModel entity = new MlModel();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.mlModels().upsert(entity);
  }
}
