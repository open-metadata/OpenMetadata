package org.openmetadata.service.entity.write;

import jakarta.ws.rs.core.UriInfo;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.util.RestUtil.PutResponse;

/** Explicit creation and prepared upserts through the entity's mutation lifecycle. */
public interface EntityCreates<T extends EntityInterface> {
  T create(T entity, EntityCommandActor actor);

  T create(UriInfo uri, T entity, EntityCommandActor actor);

  PutResponse<T> upsert(UriInfo uri, T entity, EntityCommandActor actor, boolean importMode);
}
