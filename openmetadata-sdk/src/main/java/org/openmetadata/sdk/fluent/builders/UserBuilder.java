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

  /**
   * Create a new UserBuilder with the given client.
   */
  public static UserBuilder create(OpenMetadataClient client) {
    return new UserBuilder(client);
  }

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
    return client.users().create(build());
  }

  /**
   * Set the user's email address.
   */
  public UserBuilder email(String email) {
    request.setEmail(email);
    return this;
  }
}
