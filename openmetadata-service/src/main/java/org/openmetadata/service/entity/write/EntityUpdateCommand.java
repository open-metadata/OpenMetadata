package org.openmetadata.service.entity.write;

import java.util.Set;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EventType;

/** Executes an entity mutation with the existing flush and post-commit behavior. */
public interface EntityUpdateCommand {
  void update();

  void updateForImport();

  void updateWithOptimisticLocking();

  void setPatchedFields(Set<String> fields);

  boolean fieldsChanged();

  ChangeDescription getIncrementalChangeDescription();

  EventType getChangeType();
}
