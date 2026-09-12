package org.openmetadata.service.entity.write;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.EntityDAO;

/** Persists canonical rows using the caller's transaction and returns their serialized write results. */
@Slf4j
public final class EntityStore<T extends EntityInterface> {
  private final String entityType;
  private final EntityDAO<T> dao;
  private final Function<T, String> serialize;
  private final Consumer<T> invalidate;
  private final StoredEntityCollector results = new StoredEntityCollector();

  public EntityStore(
      String entityType, EntityDAO<T> dao, Function<T, String> serialize, Consumer<T> invalidate) {
    this.entityType = entityType;
    this.dao = dao;
    this.serialize = serialize;
    this.invalidate = invalidate;
  }

  public StoredEntity store(final T entity, final boolean update, final Double expectedVersion) {
    final StoredEntity stored = serialize(entity);
    if (update) {
      update(entity, stored, expectedVersion);
      invalidate.accept(entity);
    } else {
      dao.insert(
          dao.getTableName(), dao.getNameHashColumn(), stored.fullyQualifiedName(), stored.json());
      LOG.info("Created {}:{}:{}", entityType, entity.getId(), entity.getFullyQualifiedName());
    }
    results.record(stored);
    return stored;
  }

  public void insertMany(final List<T> entities) {
    final BatchRows rows = serializeBatch(entities, results.isActive());
    dao.insertMany(dao.getTableName(), dao.getNameHashColumn(), rows.names(), rows.jsons());
    captureRows(rows);
  }

  public void updateMany(final List<T> entities) {
    final BatchRows rows = serializeBatch(entities, true);
    dao.updateMany(
        dao.getTableName(), dao.getNameHashColumn(), rows.names(), rows.ids(), rows.jsons());
    captureRows(rows);
  }

  private BatchRows serializeBatch(final List<T> entities, final boolean includeIds) {
    final List<UUID> ids = includeIds ? new ArrayList<>(entities.size()) : List.of();
    final List<String> names = new ArrayList<>(entities.size());
    final List<String> jsons = new ArrayList<>(entities.size());
    for (final T entity : entities) {
      names.add(entity.getFullyQualifiedName());
      if (includeIds) {
        ids.add(entity.getId());
      }
      jsons.add(serialize.apply(entity));
    }
    return new BatchRows(ids, names, jsons);
  }

  private void captureRows(final BatchRows rows) {
    if (results.isActive()) {
      for (int index = 0; index < rows.ids().size(); index++) {
        results.record(
            new StoredEntity(
                rows.ids().get(index), rows.names().get(index), rows.jsons().get(index)));
      }
    }
  }

  private record BatchRows(List<UUID> ids, List<String> names, List<String> jsons) {}

  public List<StoredEntity> capture(final Runnable operation) {
    return results.collect(operation);
  }

  private StoredEntity serialize(final T entity) {
    return new StoredEntity(
        entity.getId(), entity.getFullyQualifiedName(), serialize.apply(entity));
  }

  private void update(final T entity, final StoredEntity stored, final Double expectedVersion) {
    if (expectedVersion == null) {
      dao.update(stored.id(), stored.fullyQualifiedName(), stored.json());
      LOG.info("Updated {}:{}:{}", entityType, stored.id(), stored.fullyQualifiedName());
    } else {
      updateWithVersion(entity, stored, expectedVersion);
    }
  }

  private void updateWithVersion(
      final T entity, final StoredEntity stored, final Double expectedVersion) {
    final int updated =
        dao.updateWithVersion(
            dao.getTableName(),
            dao.getNameHashColumn(),
            stored.fullyQualifiedName(),
            stored.id().toString(),
            stored.json(),
            expectedVersion.toString());
    if (updated == 0) {
      throw new PreconditionFailedException(
          "The entity has been modified by another user. Please refresh and retry.");
    }
    LOG.info(
        "Updated {}:{}:{} with version check (expected: {}, actual: {})",
        entityType,
        stored.id(),
        stored.fullyQualifiedName(),
        expectedVersion,
        entity.getVersion());
  }
}
