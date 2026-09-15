package org.openmetadata.service.entity.write;

import org.openmetadata.schema.EntityInterface;

/** A prepared entity mutation whose current row and history can be persisted as a batch. */
public interface EntityDeferredUpdate<T extends EntityInterface> {
  T getOriginal();

  T getUpdated();

  boolean isVersionChanged();

  boolean isEntityChanged();

  void updateWithDeferredStore();
}
