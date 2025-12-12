package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for SearchIndex entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * SearchIndex updated = new FluentSearchIndex(searchIndex, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentSearchIndex {
  private final SearchIndex searchIndex;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentSearchIndex(SearchIndex searchIndex, OpenMetadataClient client) {
    this.searchIndex = searchIndex;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentSearchIndex withDescription(String description) {
    searchIndex.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentSearchIndex withDisplayName(String displayName) {
    searchIndex.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentSearchIndex addTag(String tagFQN) {
    List<TagLabel> tags = searchIndex.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      searchIndex.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentSearchIndex addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentSearchIndex withExtension(Object extension) {
    searchIndex.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public SearchIndex save() {
    if (!modified) {
      return searchIndex;
    }

    if (searchIndex.getId() == null) {
      throw new IllegalStateException("SearchIndex must have an ID to update");
    }

    return client.searchIndexes().update(searchIndex.getId().toString(), searchIndex);
  }

  /**
   * Get the underlying entity.
   */
  public SearchIndex get() {
    return searchIndex;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
