package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.data.CreateStoredProcedure;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating StoredProcedure entities.
 *
 * <pre>
 * StoredProcedure storedProcedure = StoredProcedureBuilder.create(client)
 *     .name("storedProcedure_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class StoredProcedureBuilder {
  private final OpenMetadataClient client;
  private final CreateStoredProcedure request;

  public StoredProcedureBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateStoredProcedure();
  }

  /**
   * Set the name (required).
   */
  public StoredProcedureBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public StoredProcedureBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public StoredProcedureBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public StoredProcedureBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateStoredProcedure request without executing it.
   */
  public CreateStoredProcedure build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("StoredProcedure name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public StoredProcedure create() {
    CreateStoredProcedure createRequest = build();
    // Convert CreateStoredProcedure to StoredProcedure
    StoredProcedure entity = new StoredProcedure();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.storedProcedures().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public StoredProcedure createOrUpdate() {
    CreateStoredProcedure createRequest = build();
    // Convert CreateStoredProcedure to StoredProcedure
    StoredProcedure entity = new StoredProcedure();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.storedProcedures().upsert(entity);
  }
}
