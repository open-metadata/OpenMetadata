package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for Tag entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * Tag updated = new FluentTag(tag, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentTag {
  private final Tag tag;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentTag(Tag tag, OpenMetadataClient client) {
    this.tag = tag;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentTag withDescription(String description) {
    tag.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentTag withDisplayName(String displayName) {
    tag.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentTag addTag(String tagFQN) {
    List<TagLabel> tags = tag.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      tag.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentTag addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentTag withExtension(Object extension) {
    tag.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public Tag save() {
    if (!modified) {
      return tag;
    }

    if (tag.getId() == null) {
      throw new IllegalStateException("Tag must have an ID to update");
    }

    return client.tags().update(tag.getId().toString(), tag);
  }

  /**
   * Get the underlying entity.
   */
  public Tag get() {
    return tag;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
