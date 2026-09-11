package org.openmetadata.schema;

import java.util.List;
import org.openmetadata.schema.type.TagLabel;

public interface FieldInterface {
  String getName();

  default String getDisplayName() {
    return null;
  }

  String getDescription();

  default String getDataTypeDisplay() {
    return null;
  }

  String getFullyQualifiedName();

  default void setFullyQualifiedName(String fullyQualifiedName) {
    /* no-op, overridden by generated POJOs that carry a fullyQualifiedName field */
  }

  default void setDescription(String description) {
    /* no-op, overridden by generated POJOs that carry a description field */
  }

  default void setDisplayName(String displayName) {
    /* no-op, overridden by generated POJOs that carry a displayName field */
  }

  List<TagLabel> getTags();

  default void setTags(List<TagLabel> tags) {
    /* no-op implementation to be overridden */
  }

  default List<? extends FieldInterface> getChildren() {
    return null;
  }
}
