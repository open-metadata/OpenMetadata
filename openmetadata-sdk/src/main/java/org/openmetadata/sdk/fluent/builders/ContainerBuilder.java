package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating Container entities.
 *
 * <pre>
 * Container container = ContainerBuilder.create(client)
 *     .name("container_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class ContainerBuilder {
  private final OpenMetadataClient client;
  private final CreateContainer request;

  public ContainerBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateContainer();
  }

  /**
   * Set the name (required).
   */
  public ContainerBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public ContainerBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public ContainerBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public ContainerBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateContainer request without executing it.
   */
  public CreateContainer build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Container name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public Container create() {
    CreateContainer createRequest = build();
    // Convert CreateContainer to Container
    Container entity = new Container();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.containers().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public Container createOrUpdate() {
    CreateContainer createRequest = build();
    // Convert CreateContainer to Container
    Container entity = new Container();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.containers().upsert(entity);
  }
}
