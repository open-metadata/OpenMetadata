package org.openmetadata.schema;

import java.util.List;
import org.openmetadata.schema.type.TagLabel;

public interface FieldInterface {
  String getName();

  String getDisplayName();

  String getDescription();

  String getDataTypeDisplay();

  String getFullyQualifiedName();

  List<TagLabel> getTags();

  default void setTags(List<TagLabel> tags) {
    /* no-op implementation to be overridden */
  }

  Object getChildren();
}
