package org.openmetadata.service.entity.bulk;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.entity.write.EntityDeferredUpdate;

/** Entity-specific mutation prepared within a bulk flush, with effects published after commit. */
public interface EntityBulkMutation<T extends EntityInterface> extends EntityDeferredUpdate<T> {
  void setOverrideMetadata(boolean overrideMetadata);

  void storeUpdate();

  void runDeferredReactOperations();

  EventType getChangeType();
}
