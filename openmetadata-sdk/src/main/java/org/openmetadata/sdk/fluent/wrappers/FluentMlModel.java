package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent wrapper for MlModel entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * MlModel updated = new FluentMlModel(mlModel, client)
 *     .withDescription("Updated description")
 *     .addTags("tag1", "tag2")
 *     .save();
 * </pre>
 */
public class FluentMlModel {
  private final MlModel mlModel;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentMlModel(MlModel mlModel, OpenMetadataClient client) {
    this.mlModel = mlModel;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentMlModel withDescription(String description) {
    mlModel.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentMlModel withDisplayName(String displayName) {
    mlModel.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag.
   */
  public FluentMlModel addTag(String tagFQN) {
    List<TagLabel> tags = mlModel.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      mlModel.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags.
   */
  public FluentMlModel addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Set custom extension data.
   */
  public FluentMlModel withExtension(Object extension) {
    mlModel.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public MlModel save() {
    if (!modified) {
      return mlModel;
    }

    if (mlModel.getId() == null) {
      throw new IllegalStateException("MlModel must have an ID to update");
    }

    return client.mlModels().update(mlModel.getId().toString(), mlModel);
  }

  /**
   * Get the underlying entity.
   */
  public MlModel get() {
    return mlModel;
  }

  /**
   * Check if modified.
   */
  public boolean isModified() {
    return modified;
  }
}
