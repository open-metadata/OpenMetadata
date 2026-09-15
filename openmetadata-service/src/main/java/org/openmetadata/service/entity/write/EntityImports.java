package org.openmetadata.service.entity.write;

import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.util.RestUtil.PutResponse;

/** Prepared import writes and entity-specific identity matching. */
public interface EntityImports<T extends EntityInterface> {
  T match(T entity);

  boolean identifyUpdate(T entity);

  PutResponse<T> upsert(UriInfo uri, T entity, String actor);

  PutResponse<T> upsertAs(UriInfo uri, T entity, EntityCommandActor actor);

  List<PutResponse<T>> upsert(List<T> entities, String actor);

  List<T> create(List<T> entities, String impersonatedBy);

  List<T> update(List<T> originals, List<T> updates, EntityCommandActor actor);
}
