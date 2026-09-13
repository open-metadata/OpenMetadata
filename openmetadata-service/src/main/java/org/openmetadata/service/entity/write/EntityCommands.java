package org.openmetadata.service.entity.write;

import static org.openmetadata.schema.type.Include.NON_DELETED;

import jakarta.ws.rs.core.UriInfo;
import java.time.Clock;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.read.EntityReader;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/** Composes the shared create, PUT and PATCH services once with the entity's policies. */
public final class EntityCommands<T extends EntityInterface> {
  public record Selections(Fields put, Fields patch, Supplier<Fields> inherited) {}

  public record Reads<T extends EntityInterface>(
      Class<T> entityClass,
      Function<String, T> existing,
      EntityReader<T> detail,
      BiConsumer<T, Fields> hydrate) {}

  public record Policies<T extends EntityInterface>(
      BiConsumer<T, Fields> inherit,
      BiFunction<UriInfo, T, T> withHref,
      Consumer<T> prepareCreate,
      EntityPatchPreparation<T> preparePatch) {}

  public record Writes<T extends EntityInterface>(
      EntityUpdateFactory<T> put,
      EntityUpdateFactory<T> patch,
      BiConsumer<String, UUID> restore,
      Consumer<T> checkModificationAllowed,
      Function<T, T> create) {}

  private final EntityPuts<T> puts;
  private final EntityPatches<T> patches;
  private final EntityCreates<T> creates;

  public EntityCommands(
      final Selections selections,
      final Reads<T> reads,
      final Policies<T> policies,
      final Writes<T> writes,
      final Clock clock) {
    puts = putService(selections, reads, policies, writes, clock);
    patches = patchService(selections.patch(), reads, policies, writes.patch());
    creates = creationService(reads.existing(), policies, writes);
  }

  public EntityPuts<T> puts() {
    return puts;
  }

  public EntityPatches<T> patches() {
    return patches;
  }

  public EntityCreates<T> creates() {
    return creates;
  }

  private EntityPuts<T> putService(
      final Selections selections,
      final Reads<T> reads,
      final Policies<T> policies,
      final Writes<T> writes,
      final Clock clock) {
    return new EntityPutService<>(
        new EntityPutService.Preparation<>(
            entity -> reads.hydrate().accept(entity, selections.put()), writes.restore()),
        new EntityPutService.Projection<>(
            entity -> policies.inherit().accept(entity, selections.inherited().get()),
            policies.withHref()),
        writes.put(),
        clock);
  }

  private EntityPatches<T> patchService(
      final Fields fields,
      final Reads<T> reads,
      final Policies<T> policies,
      final EntityUpdateFactory<T> writes) {
    return new EntityPatchService<>(
        reads.entityClass(),
        new EntityPatchService.Readers<>(
            id -> reads.detail().byId(id, patchQuery(fields)),
            name -> reads.detail().byName(name, patchQuery(fields))),
        policies.preparePatch(),
        writes,
        new EntityPatchService.Projection<>(
            entity -> policies.inherit().accept(entity, fields), policies.withHref()));
  }

  private EntityReadService.Query patchQuery(final Fields fields) {
    return new EntityReadService.Query(
        null, fields, RelationIncludes.fromInclude(NON_DELETED), false);
  }

  private EntityCreationService<T> creationService(
      final Function<String, T> existing, final Policies<T> policies, final Writes<T> writes) {
    return new EntityCreationService<>(
        new EntityCreationService.Steps<>(
            policies.prepareCreate(), existing, writes.create(), policies.withHref()),
        writes.checkModificationAllowed(),
        puts);
  }
}
