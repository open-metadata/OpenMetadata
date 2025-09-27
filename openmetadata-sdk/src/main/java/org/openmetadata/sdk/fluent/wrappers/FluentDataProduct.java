package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for DataProduct entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * DataProduct updated = new FluentDataProduct(dataProduct, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentDataProduct {
  private final DataProduct dataProduct;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentDataProduct(DataProduct dataProduct, OpenMetadataClient client) {
    this.dataProduct = dataProduct;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentDataProduct withDescription(String description) {
    dataProduct.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentDataProduct withDisplayName(String displayName) {
    dataProduct.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentDataProduct addTag(String tagFQN) {
    List<TagLabel> tags = dataProduct.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      dataProduct.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentDataProduct addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentDataProduct withExtension(Object extension) {
    dataProduct.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public DataProduct save() {
    if (!modified) {
      return dataProduct;
    }

    if (dataProduct.getId() == null) {
      throw new IllegalStateException("DataProduct must have an ID to update");
    }

    return client.dataProducts().update(dataProduct.getId().toString(), dataProduct);
  }

  /**
   * Get the underlying entity.
   */
  public DataProduct get() {
    return dataProduct;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
