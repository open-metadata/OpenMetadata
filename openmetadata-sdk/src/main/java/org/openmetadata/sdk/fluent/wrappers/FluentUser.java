package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for User entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * User updated = new FluentUser(user, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentUser {
  private final User user;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentUser(User user, OpenMetadataClient client) {
    this.user = user;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentUser withDescription(String description) {
    user.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentUser withDisplayName(String displayName) {
    user.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentUser addTag(String tagFQN) {
    List<TagLabel> tags = user.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      user.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentUser addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentUser withExtension(Object extension) {
    user.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public User save() {
    if (!modified) {
      return user;
    }

    if (user.getId() == null) {
      throw new IllegalStateException("User must have an ID to update");
    }

    return client.users().update(user.getId().toString(), user);
  }

  /**
   * Get the underlying entity.
   */
  public User get() {
    return user;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
