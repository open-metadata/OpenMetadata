package org.openmetadata.catalog.util;

import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;

import java.net.URI;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * Interface to be implemented by all entities to provide a way to access all the common fields.
 */
public interface EntityInterface<T> {
  UUID getId();
  String getDescription();
  String getDisplayName();
  EntityReference getOwner();
  String getFullyQualifiedName();
  List<TagLabel> getTags();
  Double getVersion();
  String getUpdatedBy();
  Date getUpdatedAt();
  default URI getHref() {
    return null; // Remove this implementation once all entities implement this
  }

  EntityReference getEntityReference();
  T getEntity();

  void setId(UUID id);
  void setDescription(String description);
  void setTags(List<TagLabel> tags);
  void setDisplayName(String displayName);
  void setUpdateDetails(String updatedBy, Date updatedAt);
  void setChangeDescription(Double newVersion, ChangeDescription changeDescription);
  default ChangeDescription getChangeDescription() {
    return null;
  }
}
