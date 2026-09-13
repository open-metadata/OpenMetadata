package org.openmetadata.service.entity.write;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.UriInfo;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.util.RestUtil.PatchResponse;

/** Applies an entity patch through the owning mutation transaction. */
@FunctionalInterface
public interface EntityPatches<T extends EntityInterface> {
  PatchResponse<T> patch(
      EntityPatchService.Target target,
      JsonPatch patch,
      EntityCommandActor actor,
      UriInfo uri,
      EntityPatchService.Options options);
}
