package org.openmetadata.catalog.util;

import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;

import java.util.Collection;
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
  EntityReference getEntityReference();

  void setDescription(String description);
  void setTags(List<TagLabel> tags);
  void setDisplayName(String displayName);
}
