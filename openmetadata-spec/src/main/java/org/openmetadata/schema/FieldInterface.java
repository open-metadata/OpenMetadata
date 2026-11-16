package org.openmetadata.schema;

import java.util.List;
import org.openmetadata.schema.type.TagLabel;

public interface FieldInterface {
  String getName();

  String getDisplayName();

  String getDescription();

  /** Absent on Task and MlFeature, which describe no data type. */
  default String getDataTypeDisplay() {
    return null;
  }

  String getFullyQualifiedName();

  void setFullyQualifiedName(String fullyQualifiedName);

  void setDescription(String description);

  void setDisplayName(String displayName);

  List<TagLabel> getTags();

  default void setTags(List<TagLabel> tags) {
    /* no-op implementation to be overridden */
  }

  /** Absent on Task and MlFeature, which hold no nested children. */
  default List<? extends FieldInterface> getChildren() {
    return null;
  }
}
