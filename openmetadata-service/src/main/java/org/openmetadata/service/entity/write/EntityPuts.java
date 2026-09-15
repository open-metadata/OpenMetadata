package org.openmetadata.service.entity.write;

import jakarta.ws.rs.core.UriInfo;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.util.RestUtil.PutResponse;

/** Runs an entity update through its owning command and transaction lifecycle. */
@FunctionalInterface
public interface EntityPuts<T extends EntityInterface> {
  PutResponse<T> update(
      UriInfo uri, T original, T updated, EntityCommandActor actor, EntityPutService.Mode mode);
}
