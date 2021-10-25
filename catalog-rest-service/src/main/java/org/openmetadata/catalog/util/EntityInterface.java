package org.openmetadata.catalog.util;

import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;

import java.util.Collection;
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

  EntityReference getEntityReference();
  T getEntity();

  void setId(UUID id);
  void setDescription(String description);
  void setTags(List<TagLabel> tags);
  void setDisplayName(String displayName);
  void setVersion(Double version);
  void setUpdatedBy(String user);
  void setUpdatedAt(Date date);
}
