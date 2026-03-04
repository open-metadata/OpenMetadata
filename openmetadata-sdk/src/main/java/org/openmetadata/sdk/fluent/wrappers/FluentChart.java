package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for Chart entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * Chart updated = new FluentChart(chart, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentChart {
  private final Chart chart;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentChart(Chart chart, OpenMetadataClient client) {
    this.chart = chart;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentChart withDescription(String description) {
    chart.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentChart withDisplayName(String displayName) {
    chart.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentChart addTag(String tagFQN) {
    List<TagLabel> tags = chart.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      chart.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentChart addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentChart withExtension(Object extension) {
    chart.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public Chart save() {
    if (!modified) {
      return chart;
    }

    if (chart.getId() == null) {
      throw new IllegalStateException("Chart must have an ID to update");
    }

    return client.charts().update(chart.getId().toString(), chart);
  }

  /**
   * Get the underlying entity.
   */
  public Chart get() {
    return chart;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
