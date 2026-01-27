package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating StorageService entities.
 *
 * <pre>
 * StorageService storageService = StorageServiceBuilder.create(client)
 *     .name("storageService_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class StorageServiceBuilder {
  private final OpenMetadataClient client;
  private final CreateStorageService request;

  public StorageServiceBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateStorageService();
  }

  /**
   * Set the name (required).
   */
  public StorageServiceBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public StorageServiceBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public StorageServiceBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public StorageServiceBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateStorageService request without executing it.
   */
  public CreateStorageService build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("StorageService name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public StorageService create() {
    CreateStorageService createRequest = build();
    // Convert CreateStorageService to StorageService
    StorageService service = new StorageService();
    service.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      service.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      service.setDescription(createRequest.getDescription());
    // TODO: Map service type and connection
    return client.storageServices().create(service);
  }

  /**
   * Create or update (upsert).
   */
  public StorageService createOrUpdate() {
    CreateStorageService createRequest = build();
    // Convert CreateStorageService to StorageService
    StorageService service = new StorageService();
    service.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      service.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      service.setDescription(createRequest.getDescription());
    // TODO: Map service type and connection
    return client.storageServices().upsert(service);
  }
}
