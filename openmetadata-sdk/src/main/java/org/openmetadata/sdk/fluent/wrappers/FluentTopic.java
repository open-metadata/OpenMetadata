package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for Topic entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * Topic updated = new FluentTopic(topic, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentTopic {
  private final Topic topic;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentTopic(Topic topic, OpenMetadataClient client) {
    this.topic = topic;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentTopic withDescription(String description) {
    topic.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentTopic withDisplayName(String displayName) {
    topic.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentTopic addTag(String tagFQN) {
    List<TagLabel> tags = topic.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      topic.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentTopic addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentTopic withExtension(Object extension) {
    topic.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public Topic save() {
    if (!modified) {
      return topic;
    }

    if (topic.getId() == null) {
      throw new IllegalStateException("Topic must have an ID to update");
    }

    return client.topics().update(topic.getId().toString(), topic);
  }

  /**
   * Get the underlying entity.
   */
  public Topic get() {
    return topic;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
