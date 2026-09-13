package org.openmetadata.service.entity.write;

import java.util.HashMap;
import java.util.List;
import org.openmetadata.schema.EntityInterface;

/** Entity-specific lineage rules applied by the shared column mutation component. */
public interface EntityColumnMutation<T extends EntityInterface> extends EntitySpecificMutation<T> {
  default void lineage(
      EntityUpdater<T> mutation, List<String> deleted, HashMap<String, String> renamed) {}
}
