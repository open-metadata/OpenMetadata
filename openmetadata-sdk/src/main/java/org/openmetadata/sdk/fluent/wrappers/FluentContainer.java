package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for Container entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * Container updated = new FluentContainer(container, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentContainer {
  private final Container container;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentContainer(Container container, OpenMetadataClient client) {
    this.container = container;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentContainer withDescription(String description) {
    container.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentContainer withDisplayName(String displayName) {
    container.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentContainer addTag(String tagFQN) {
    List<TagLabel> tags = container.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      container.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentContainer addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentContainer withExtension(Object extension) {
    container.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public Container save() {
    if (!modified) {
      return container;
    }

    if (container.getId() == null) {
      throw new IllegalStateException("Container must have an ID to update");
    }

    return client.containers().update(container.getId().toString(), container);
  }

  /**
   * Get the underlying entity.
   */
  public Container get() {
    return container;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
