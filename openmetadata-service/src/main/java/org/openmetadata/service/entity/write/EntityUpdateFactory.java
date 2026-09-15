package org.openmetadata.service.entity.write;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.change.ChangeSource;

@FunctionalInterface
public interface EntityUpdateFactory<T extends EntityInterface> {
  EntityUpdateCommand create(T original, T updated, ChangeSource source, boolean optimistic);
}
