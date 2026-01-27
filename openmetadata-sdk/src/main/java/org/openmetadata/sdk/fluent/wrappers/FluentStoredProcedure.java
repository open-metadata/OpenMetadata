package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for StoredProcedure entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * StoredProcedure updated = new FluentStoredProcedure(storedProcedure, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentStoredProcedure {
  private final StoredProcedure storedProcedure;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentStoredProcedure(StoredProcedure storedProcedure, OpenMetadataClient client) {
    this.storedProcedure = storedProcedure;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentStoredProcedure withDescription(String description) {
    storedProcedure.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentStoredProcedure withDisplayName(String displayName) {
    storedProcedure.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentStoredProcedure addTag(String tagFQN) {
    List<TagLabel> tags = storedProcedure.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      storedProcedure.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentStoredProcedure addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentStoredProcedure withExtension(Object extension) {
    storedProcedure.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public StoredProcedure save() {
    if (!modified) {
      return storedProcedure;
    }

    if (storedProcedure.getId() == null) {
      throw new IllegalStateException("StoredProcedure must have an ID to update");
    }

    return client.storedProcedures().update(storedProcedure.getId().toString(), storedProcedure);
  }

  /**
   * Get the underlying entity.
   */
  public StoredProcedure get() {
    return storedProcedure;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
