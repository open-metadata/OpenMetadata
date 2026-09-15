package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;

/** Validates membership changes and commits their relationship and audit writes in one owning transaction. */
public final class EntityAssetMembership {
  public enum Mode {
    ADD,
    REMOVE
  }

  public record Target(UUID id, String type, Relationship relation) {}

  public record References(
      Consumer<List<EntityReference>> validate, BiFunction<String, UUID, EntityInterface> source) {}

  public record Effects(Consumer<EntityReference> invalidate, Consumer<EntityReference> index) {}

  @FunctionalInterface
  public interface ChangeFactory {
    ChangeDescription create(Double version, boolean add, Object values, Object previous);
  }

  @FunctionalInterface
  public interface EventFactory {
    ChangeEvent create(
        EntityInterface entity,
        ChangeDescription change,
        String type,
        Double version,
        String actor);
  }

  public record Events(ChangeFactory change, EventFactory event, Consumer<ChangeEvent> append) {}

  @FunctionalInterface
  public interface Transaction {
    BulkOperationResult execute(Supplier<BulkOperationResult> work);
  }

  private final References references;
  private final EntityRelationshipWriter relationships;
  private final Effects effects;
  private final Events events;
  private final Transaction transaction;

  public EntityAssetMembership(
      final References references,
      final EntityRelationshipWriter relationships,
      final Effects effects,
      final Events events,
      final Transaction transaction) {
    this.references = references;
    this.relationships = relationships;
    this.effects = effects;
    this.events = events;
    this.transaction = transaction;
  }

  public BulkOperationResult apply(
      final Target target, final BulkAssets request, final Mode mode, final String actor) {
    final boolean dryRun = Boolean.TRUE.equals(request.getDryRun());
    if (nullOrEmpty(request.getAssets())) {
      return result(dryRun)
          .withSuccessRequest(List.of(new BulkResponse().withMessage("Nothing to Validate.")));
    }
    references.validate().accept(request.getAssets());
    return dryRun
        ? applyAssets(target, request, mode, true)
        : transaction.execute(() -> persist(target, request, mode, actor));
  }

  private BulkOperationResult persist(
      final Target target, final BulkAssets request, final Mode mode, final String actor) {
    final BulkOperationResult result = applyAssets(target, request, mode, false);
    record(target, request, mode, actor);
    return result;
  }

  private BulkOperationResult applyAssets(
      final Target target, final BulkAssets request, final Mode mode, final boolean dryRun) {
    final BulkOperationResult result = result(dryRun);
    final List<BulkResponse> success = new ArrayList<>();
    for (final EntityReference asset : request.getAssets()) {
      result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);
      if (!result.getDryRun()) {
        mutate(target, asset, mode);
        effects.invalidate().accept(asset);
      }
      success.add(new BulkResponse().withRequest(asset));
      result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
      if (!result.getDryRun()) {
        effects.index().accept(asset);
      }
    }
    return result.withSuccessRequest(success);
  }

  private BulkOperationResult result(final boolean dryRun) {
    return new BulkOperationResult().withStatus(ApiStatus.SUCCESS).withDryRun(dryRun);
  }

  private void mutate(final Target target, final EntityReference asset, final Mode mode) {
    final var edge =
        new EntityRelationshipWriter.Edge(
            target.id(), asset.getId(), target.type(), asset.getType(), target.relation());
    if (mode == Mode.ADD) {
      relationships.add(edge, EntityRelationshipWriter.Value.EMPTY, false);
    } else {
      relationships.delete(edge);
    }
  }

  private void record(
      final Target target, final BulkAssets request, final Mode mode, final String actor) {
    final EntityInterface source = references.source().apply(target.type(), target.id());
    final ChangeDescription change =
        events.change().create(source.getVersion(), mode == Mode.ADD, request.getAssets(), null);
    final String eventActor = actor != null ? actor : source.getUpdatedBy();
    final ChangeEvent event =
        events.event().create(source, change, target.type(), source.getVersion(), eventActor);
    events.append().accept(event);
  }
}
