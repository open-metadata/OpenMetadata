package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating Classification entities.
 *
 * <pre>
 * Classification classification = ClassificationBuilder.create(client)
 *     .name("classification_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class ClassificationBuilder {
  private final OpenMetadataClient client;
  private final CreateClassification request;

  public ClassificationBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateClassification();
  }

  /**
   * Set the name (required).
   */
  public ClassificationBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public ClassificationBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public ClassificationBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public ClassificationBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateClassification request without executing it.
   */
  public CreateClassification build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Classification name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public Classification create() {
    CreateClassification createRequest = build();
    // Convert CreateClassification to Classification
    Classification entity = new Classification();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.classifications().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public Classification createOrUpdate() {
    CreateClassification createRequest = build();
    // Convert CreateClassification to Classification
    Classification entity = new Classification();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.classifications().upsert(entity);
  }
}
