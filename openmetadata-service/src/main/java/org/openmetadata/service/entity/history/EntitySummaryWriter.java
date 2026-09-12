package org.openmetadata.service.entity.history;

import static org.openmetadata.service.Entity.FIELD_FULLY_QUALIFIED_NAME;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Clock;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeSummaryMap;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.change.ChangeSummary;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;

/** Updates attribution without loading or replacing the entity's other stored fields. */
public final class EntitySummaryWriter {
  public record Attribution(UUID id, String field, ChangeSource source, String actor) {}

  public record Update(UUID id, String fullyQualifiedName, String changeDescriptionJson) {}

  public record Rows(Function<UUID, String> lockAndRead, Consumer<Update> update) {}

  public record Boundary(Consumer<Runnable> execute, Consumer<Update> invalidate) {}

  private static final String CHANGES = "changeDescription";
  private static final String VERSION = "version";
  private final String entityType;
  private final Rows rows;
  private final Boundary boundary;
  private final Clock clock;

  public EntitySummaryWriter(
      final String entityType, final Rows rows, final Boundary boundary, final Clock clock) {
    this.entityType = entityType;
    this.rows = rows;
    this.boundary = boundary;
    this.clock = clock;
  }

  public void update(final Attribution attribution) {
    boundary.execute().accept(() -> persist(attribution));
  }

  private void persist(final Attribution attribution) {
    final ObjectNode entity = read(attribution.id());
    final ChangeDescription changes = changes(entity);
    updateSummary(changes, attribution);
    final Update stored =
        new Update(
            attribution.id(),
            entity.path(FIELD_FULLY_QUALIFIED_NAME).asText(null),
            JsonUtils.pojoToJson(changes));
    rows.update().accept(stored);
    boundary.invalidate().accept(stored);
  }

  private ObjectNode read(final UUID id) {
    final String json = rows.lockAndRead().apply(id);
    final JsonNode entity = json == null ? null : JsonUtils.readTree(json);
    if (entity == null || entity.isNull()) {
      throw EntityNotFoundException.byMessage(
          CatalogExceptionMessage.entityNotFound(entityType, id));
    }
    return (ObjectNode) entity;
  }

  private ChangeDescription changes(final ObjectNode entity) {
    final JsonNode current = entity.get(CHANGES);
    if (current != null && !current.isNull()) {
      return JsonUtils.treeToValue(current, ChangeDescription.class);
    }
    final ChangeDescription changes = new ChangeDescription();
    if (entity.has(VERSION)) {
      changes.setPreviousVersion(JsonUtils.treeToValue(entity.get(VERSION), Double.class));
    }
    return changes;
  }

  private void updateSummary(final ChangeDescription changes, final Attribution attribution) {
    if (changes.getChangeSummary() == null) {
      changes.setChangeSummary(new ChangeSummaryMap());
    }
    changes
        .getChangeSummary()
        .getAdditionalProperties()
        .put(
            attribution.field(),
            new ChangeSummary()
                .withChangeSource(attribution.source())
                .withChangedBy(attribution.actor())
                .withChangedAt(clock.millis()));
  }
}
