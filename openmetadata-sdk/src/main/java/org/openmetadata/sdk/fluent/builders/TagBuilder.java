package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating Tag entities.
 *
 * <pre>
 * Tag tag = TagBuilder.create(client)
 *     .name("tag_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class TagBuilder {
  private final OpenMetadataClient client;
  private final CreateTag request;

  public TagBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateTag();
  }

  /**
   * Set the name (required).
   */
  public TagBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public TagBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public TagBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public TagBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateTag request without executing it.
   */
  public CreateTag build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Tag name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public Tag create() {
    CreateTag createRequest = build();
    // Convert CreateTag to Tag
    Tag entity = new Tag();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.tags().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public Tag createOrUpdate() {
    CreateTag createRequest = build();
    // Convert CreateTag to Tag
    Tag entity = new Tag();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.tags().upsert(entity);
  }
}
