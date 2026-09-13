package org.openmetadata.service.entity.write;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.util.RestUtil.PatchResponse;

public final class EntityPatchFixture<T extends EntityInterface> implements EntityPatches<T> {
  public record Request(
      EntityPatchService.Target target,
      JsonPatch patch,
      EntityCommandActor actor,
      UriInfo uri,
      EntityPatchService.Options options) {}

  private final Function<Request, PatchResponse<T>> operation;
  private final List<Request> requests = new ArrayList<>();

  public EntityPatchFixture(final Function<Request, PatchResponse<T>> operation) {
    this.operation = operation;
  }

  @Override
  public PatchResponse<T> patch(
      final EntityPatchService.Target target,
      final JsonPatch patch,
      final EntityCommandActor actor,
      final UriInfo uri,
      final EntityPatchService.Options options) {
    final Request request = new Request(target, patch, actor, uri, options);
    requests.add(request);
    return operation.apply(request);
  }

  public List<Request> requests() {
    return List.copyOf(requests);
  }
}
