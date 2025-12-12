package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating User entities.
 *
 * <pre>
 * User user = UserBuilder.create(client)
 *     .name("user_name")
 *     .description("Description")
 *     .create();
 * </pre>
 */
public class UserBuilder {
  private final OpenMetadataClient client;
  private final CreateUser request;

  public UserBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateUser();
  }

  /**
   * Set the name (required).
   */
  public UserBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public UserBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public UserBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set custom extension data.
   */
  public UserBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateUser request without executing it.
   */
  public CreateUser build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("User name is required");
    }

    return request;
  }

  /**
   * Create and return the created entity.
   */
  public User create() {
    CreateUser createRequest = build();
    // Convert CreateUser to User
    User entity = new User();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.users().create(entity);
  }

  /**
   * Create or update (upsert).
   */
  public User createOrUpdate() {
    CreateUser createRequest = build();
    // Convert CreateUser to User
    User entity = new User();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.users().upsert(entity);
  }
}
