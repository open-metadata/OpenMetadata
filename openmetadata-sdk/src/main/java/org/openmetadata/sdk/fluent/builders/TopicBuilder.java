package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating Topic entities.
 *
 * <pre>
 * Topic topic = TopicBuilder.create(client)
 *     .name("topic_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class TopicBuilder {
  private final OpenMetadataClient client;
  private final CreateTopic request;

  public TopicBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateTopic();
  }

  /**
   * Set the name (required).
   */
  public TopicBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public TopicBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public TopicBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public TopicBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateTopic request without executing it.
   */
  public CreateTopic build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Topic name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public Topic create() {
    CreateTopic createRequest = build();
    // Convert CreateTopic to Topic
    Topic entity = new Topic();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.topics().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public Topic createOrUpdate() {
    CreateTopic createRequest = build();
    // Convert CreateTopic to Topic
    Topic entity = new Topic();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.topics().upsert(entity);
  }
}
