package org.openmetadata.service.entity.delete;

import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.util.RestUtil.PutResponse;

/** Restores an entity through its retained mutation boundary and existing descendant policies. */
@FunctionalInterface
public interface EntityRestores<T extends EntityInterface> {
  PutResponse<T> restore(String actor, UUID id);
}
