package org.openmetadata.service.mapper;

import org.openmetadata.schema.EntityInterface;

public interface EntityUpdateMapper<T extends EntityInterface, U> {
  String getFqn(U update);

  void applyEntitySpecificUpdates(T original, U update);
}
