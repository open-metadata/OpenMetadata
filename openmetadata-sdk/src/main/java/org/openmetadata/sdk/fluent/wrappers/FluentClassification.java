package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for Classification entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * Classification updated = new FluentClassification(classification, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentClassification {
  private final Classification classification;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentClassification(Classification classification, OpenMetadataClient client) {
    this.classification = classification;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentClassification withDescription(String description) {
    classification.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentClassification withDisplayName(String displayName) {
    classification.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentClassification addTag(String tagFQN) {
    List<TagLabel> tags = classification.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      classification.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentClassification addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentClassification withExtension(Object extension) {
    classification.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public Classification save() {
    if (!modified) {
      return classification;
    }

    if (classification.getId() == null) {
      throw new IllegalStateException("Classification must have an ID to update");
    }

    return client.classifications().update(classification.getId().toString(), classification);
  }

  /**
   * Get the underlying entity.
   */
  public Classification get() {
    return classification;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
