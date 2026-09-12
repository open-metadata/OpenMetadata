package org.openmetadata.service.entity.write;

import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response.Status;
import jakarta.ws.rs.core.UriInfo;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.EntityETag;
import org.openmetadata.service.util.RestUtil.PatchResponse;

/** Runs the shared PATCH contract with type-specific readers, preparation and mutation commands. */
@Slf4j
public final class EntityPatchService<T extends EntityInterface> implements EntityPatches<T> {
  public sealed interface Target {
    record Id(UUID value) implements Target {}

    record Name(String value) implements Target {}
  }

  public record Options(ChangeSource source, String ifMatch) {}

  public record Readers<T>(Function<UUID, T> byId, Function<String, T> byName) {}

  public record Projection<T>(Consumer<T> inherit, BiFunction<UriInfo, T, T> withHref) {}

  private final Class<T> entityClass;
  private final Readers<T> readers;
  private final EntityPatchPreparation<T> preparation;
  private final EntityUpdateFactory<T> updates;
  private final Projection<T> projection;

  public EntityPatchService(
      final Class<T> entityClass,
      final Readers<T> readers,
      final EntityPatchPreparation<T> preparation,
      final EntityUpdateFactory<T> updates,
      final Projection<T> projection) {
    this.entityClass = entityClass;
    this.readers = readers;
    this.preparation = preparation;
    this.updates = updates;
    this.projection = projection;
  }

  @Override
  public PatchResponse<T> patch(
      final Target target,
      final JsonPatch patch,
      final EntityCommandActor actor,
      final UriInfo uri,
      final Options options) {
    final Set<String> fields = JsonUtils.extractPatchedFields(patch);
    final T original = load(target);
    final boolean optimistic = validateETag(original, options.ifMatch());
    final T updated = preparation.prepare(original, applyPatch(original, patch), actor);
    final EntityUpdateCommand command =
        execute(original, updated, fields, options.source(), optimistic);
    if (command.fieldsChanged()) {
      try (var ignored = phase("patchSetInheritedFields")) {
        projection.inherit().accept(updated);
      }
    }
    updated.setChangeDescription(command.getIncrementalChangeDescription());
    return new PatchResponse<>(
        Status.OK, projection.withHref().apply(uri, updated), command.getChangeType());
  }

  private T load(final Target target) {
    return switch (target) {
      case Target.Id id -> {
        try (var ignored = phase("patchLoadOriginal")) {
          yield readers.byId().apply(id.value());
        }
      }
      case Target.Name name -> {
        try (var ignored = phase("patchLoadOriginalByName")) {
          yield readers.byName().apply(name.value());
        }
      }
    };
  }

  private boolean validateETag(final T original, final String ifMatch) {
    final boolean optimistic = ifMatch != null && !ifMatch.isEmpty();
    if (optimistic) {
      LOG.debug(
          "PATCH with ETag validation - entity: {}, version: {}, updatedAt: {}, provided ETag: {}",
          original.getId(),
          original.getVersion(),
          original.getUpdatedAt(),
          ifMatch);
      EntityETag.validateETag(ifMatch, original, true);
    }
    return optimistic;
  }

  private T applyPatch(final T original, final JsonPatch patch) {
    try (var ignored = phase("patchApplyJson")) {
      return JsonUtils.applyPatch(original, patch, entityClass);
    }
  }

  private EntityUpdateCommand execute(
      final T original,
      final T updated,
      final Set<String> fields,
      final ChangeSource source,
      final boolean optimistic) {
    try (var ignored = phase("patchEntityUpdate")) {
      final EntityUpdateCommand command = updates.create(original, updated, source, optimistic);
      command.setPatchedFields(fields);
      if (optimistic) {
        command.updateWithOptimisticLocking();
      } else {
        command.update();
      }
      return command;
    }
  }
}
