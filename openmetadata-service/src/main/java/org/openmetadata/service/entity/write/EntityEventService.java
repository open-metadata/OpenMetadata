package org.openmetadata.service.entity.write;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_NO_CHANGE;

import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;

/** Records best-effort feed events for commands whose responses bypass the response filter. */
@Slf4j
public final class EntityEventService<T extends EntityInterface> {
  @FunctionalInterface
  public interface Factory<T> {
    ChangeEvent create(String actor, EventType type, T entity);
  }

  private final Factory<T> factory;
  private final Consumer<String> insert;
  private final Consumer<List<String>> insertBatch;

  public EntityEventService(
      final Factory<T> factory,
      final Consumer<String> insert,
      final Consumer<List<String>> insertBatch) {
    this.factory = factory;
    this.insert = insert;
    this.insertBatch = insertBatch;
  }

  public Optional<String> json(final T entity, final EventType type, final String actor) {
    return json(entity, type, actor, false);
  }

  public void recordAsync(
      final T entity, final EventType type, final boolean recursive, final String actor) {
    if (entity != null && type != null) {
      json(entity, type, actor, recursive).ifPresent(this::insert);
    }
  }

  public void insert(final String json) {
    try {
      insert.accept(json);
    } catch (RuntimeException exception) {
      LOG.error("Failed to insert change event", exception);
    }
  }

  public void insertBatch(final List<String> events) {
    if (!nullOrEmpty(events)) {
      try {
        insertBatch.accept(events);
      } catch (RuntimeException exception) {
        LOG.error("Failed to insert change events batch", exception);
      }
    }
  }

  private Optional<String> json(
      final T entity, final EventType type, final String actor, final boolean recursive) {
    if (type == null || ENTITY_NO_CHANGE.equals(type)) {
      return Optional.empty();
    }
    try {
      final ChangeEvent event = masked(factory.create(actor, type, entity));
      if (recursive) {
        event.setRecursive(true);
      }
      return Optional.of(JsonUtils.pojoToJson(event));
    } catch (RuntimeException exception) {
      LOG.error("Failed to create change event for bulk operation", exception);
      return Optional.empty();
    }
  }

  private ChangeEvent masked(final ChangeEvent event) {
    if (event.getEntity() == null) {
      return event;
    }
    return new ChangeEvent()
        .withId(event.getId())
        .withEventType(event.getEventType())
        .withEntityId(event.getEntityId())
        .withEntityType(event.getEntityType())
        .withUserName(event.getUserName())
        .withImpersonatedBy(event.getImpersonatedBy())
        .withTimestamp(event.getTimestamp())
        .withChangeDescription(event.getChangeDescription())
        .withCurrentVersion(event.getCurrentVersion())
        .withPreviousVersion(event.getPreviousVersion())
        .withEntityFullyQualifiedName(event.getEntityFullyQualifiedName())
        .withEntity(JsonUtils.pojoToMaskedJson(event.getEntity()));
  }
}
