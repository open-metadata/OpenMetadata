package org.openmetadata.service.entity.delete;

import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.util.RestUtil.DeleteResponse;

/** Selects a deletion target while retaining the owning flush and publication policies. */
public interface EntityDeletes<T extends EntityInterface> {
  DeleteResponse<T> byId(String actor, UUID id, boolean recursive, boolean hardDelete);

  DeleteResponse<T> byName(String actor, String name, boolean recursive, boolean hardDelete);

  DeleteResponse<T> byNameIfExists(
      String actor, String name, boolean recursive, boolean hardDelete);

  DeleteResponse<T> internalById(String actor, UUID id, boolean recursive, boolean hardDelete);

  DeleteResponse<T> internalByName(
      String actor, String name, boolean recursive, boolean hardDelete);
}
