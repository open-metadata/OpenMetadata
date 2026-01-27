package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for Query entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * Query updated = new FluentQuery(query, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentQuery {
  private final Query query;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentQuery(Query query, OpenMetadataClient client) {
    this.query = query;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentQuery withDescription(String description) {
    query.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentQuery withDisplayName(String displayName) {
    query.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentQuery addTag(String tagFQN) {
    List<TagLabel> tags = query.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      query.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentQuery addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentQuery withExtension(Object extension) {
    query.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public Query save() {
    if (!modified) {
      return query;
    }

    if (query.getId() == null) {
      throw new IllegalStateException("Query must have an ID to update");
    }

    return client.queries().update(query.getId().toString(), query);
  }

  /**
   * Get the underlying entity.
   */
  public Query get() {
    return query;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
