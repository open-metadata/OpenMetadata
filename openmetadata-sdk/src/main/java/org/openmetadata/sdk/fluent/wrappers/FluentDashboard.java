package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for Dashboard entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * Dashboard updated = new FluentDashboard(dashboard, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentDashboard {
  private final Dashboard dashboard;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentDashboard(Dashboard dashboard, OpenMetadataClient client) {
    this.dashboard = dashboard;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentDashboard withDescription(String description) {
    dashboard.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentDashboard withDisplayName(String displayName) {
    dashboard.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentDashboard addTag(String tagFQN) {
    List<TagLabel> tags = dashboard.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      dashboard.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentDashboard addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentDashboard withExtension(Object extension) {
    dashboard.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public Dashboard save() {
    if (!modified) {
      return dashboard;
    }

    if (dashboard.getId() == null) {
      throw new IllegalStateException("Dashboard must have an ID to update");
    }

    return client.dashboards().update(dashboard.getId().toString(), dashboard);
  }

  /**
   * Get the underlying entity.
   */
  public Dashboard get() {
    return dashboard;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
