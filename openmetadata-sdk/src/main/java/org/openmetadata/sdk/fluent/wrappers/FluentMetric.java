package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for Metric entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * Metric updated = new FluentMetric(metric, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentMetric {
  private final Metric metric;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentMetric(Metric metric, OpenMetadataClient client) {
    this.metric = metric;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentMetric withDescription(String description) {
    metric.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentMetric withDisplayName(String displayName) {
    metric.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentMetric addTag(String tagFQN) {
    List<TagLabel> tags = metric.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      metric.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentMetric addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentMetric withExtension(Object extension) {
    metric.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public Metric save() {
    if (!modified) {
      return metric;
    }

    if (metric.getId() == null) {
      throw new IllegalStateException("Metric must have an ID to update");
    }

    return client.metrics().update(metric.getId().toString(), metric);
  }

  /**
   * Get the underlying entity.
   */
  public Metric get() {
    return metric;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
