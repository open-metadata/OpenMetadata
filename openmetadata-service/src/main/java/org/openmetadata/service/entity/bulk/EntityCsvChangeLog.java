package org.openmetadata.service.entity.bulk;

import java.time.Clock;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.EntityUtil;

/** Persists one CSV summary version, its history and its feed event in the retained transaction. */
public final class EntityCsvChangeLog<T extends EntityInterface> {
  public static final String BULK_IMPORT = "bulkImport";

  public record Preparation<T>(
      Class<T> entityClass, Function<UUID, T> find, Consumer<T> hydrate, Consumer<T> inherit) {}

  public record Persistence<T>(
      Consumer<T> history,
      BiConsumer<T, String> row,
      Function<T, ChangeEvent> event,
      Consumer<String> storeEvent) {}

  public record Boundary(Consumer<Runnable> flush, Consumer<Runnable> afterCommit) {}

  private final Preparation<T> preparation;
  private final Persistence<T> persistence;
  private final Boundary boundary;
  private final Consumer<T> invalidate;
  private final Clock clock;

  public EntityCsvChangeLog(
      final Preparation<T> preparation,
      final Persistence<T> persistence,
      final Boundary boundary,
      final Consumer<T> invalidate,
      final Clock clock) {
    this.preparation = preparation;
    this.persistence = persistence;
    this.boundary = boundary;
    this.invalidate = invalidate;
    this.clock = clock;
  }

  public void record(final UUID id, final CsvImportResult result, final String actor) {
    final T original = preparation.find().apply(id);
    preparation.hydrate().accept(original);
    preparation.inherit().accept(original);
    final T updated = prepareSummary(original, result, actor);
    final String json = JsonUtils.pojoToJson(updated);
    boundary.flush().accept(() -> persist(original, updated, json));
  }

  private T prepareSummary(final T original, final CsvImportResult result, final String actor) {
    final T updated =
        JsonUtils.readFromTokenBuffer(JsonUtils.toTokenBuffer(original), preparation.entityClass());
    final ChangeDescription change =
        new ChangeDescription().withPreviousVersion(original.getVersion());
    change
        .getFieldsUpdated()
        .add(
            new FieldChange()
                .withName(BULK_IMPORT)
                .withNewValue(CsvImportSummary.summarize(result)));
    updated.setChangeDescription(change);
    updated.setVersion(EntityUtil.nextVersion(original.getVersion()));
    updated.setUpdatedBy(actor);
    updated.setUpdatedAt(clock.millis());
    return updated;
  }

  private void persist(final T original, final T updated, final String json) {
    persistence.history().accept(original);
    persistence.row().accept(updated, json);
    persistence.storeEvent().accept(JsonUtils.pojoToJson(persistence.event().apply(updated)));
    boundary.afterCommit().accept(() -> invalidate.accept(updated));
  }
}
