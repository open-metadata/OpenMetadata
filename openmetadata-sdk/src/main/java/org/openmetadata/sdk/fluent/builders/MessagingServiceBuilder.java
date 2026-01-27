package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating MessagingService entities.
 *
 * <pre>
 * MessagingService messagingService = MessagingServiceBuilder.create(client)
 *     .name("messagingService_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class MessagingServiceBuilder {
  private final OpenMetadataClient client;
  private final CreateMessagingService request;

  public MessagingServiceBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateMessagingService();
  }

  /**
   * Set the name (required).
   */
  public MessagingServiceBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public MessagingServiceBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public MessagingServiceBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public MessagingServiceBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateMessagingService request without executing it.
   */
  public CreateMessagingService build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("MessagingService name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public MessagingService create() {
    CreateMessagingService createRequest = build();
    // Convert CreateMessagingService to MessagingService
    MessagingService service = new MessagingService();
    service.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      service.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      service.setDescription(createRequest.getDescription());
    // TODO: Map service type and connection
    return client.messagingServices().create(service);
  }

  /**
   * Create or update (upsert).
   */
  public MessagingService createOrUpdate() {
    CreateMessagingService createRequest = build();
    // Convert CreateMessagingService to MessagingService
    MessagingService service = new MessagingService();
    service.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      service.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      service.setDescription(createRequest.getDescription());
    // TODO: Map service type and connection
    return client.messagingServices().upsert(service);
  }
}
