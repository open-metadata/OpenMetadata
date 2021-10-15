package org.openmetadata.catalog.util;

import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;

import java.util.List;
import java.util.UUID;

public interface EntityInterface {
  UUID getId();
  String getDescription();
  EntityReference getOwner();
  String getFullyQualifiedName();
  List<TagLabel> getTags();

  void setDescription(String description);
  void setTags(List<TagLabel> tags);
}
