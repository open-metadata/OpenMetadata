package org.openmetadata.service.entity.history;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.util.EntityUtil;

/** Reads and writes historical snapshots through the caller's transaction-bound extension DAO. */
public final class EntityVersionStore<T extends EntityInterface> {
  private final EntityHistoryType<T> type;
  private final Supplier<EntityExtensionDAO> extensions;
  private final Function<T, String> serialize;

  public EntityVersionStore(
      final EntityHistoryType<T> type,
      final Supplier<EntityExtensionDAO> extensions,
      final Function<T, String> serialize) {
    this.type = type;
    this.extensions = extensions;
    this.serialize = serialize;
  }

  public void insert(final T entity) {
    extensions
        .get()
        .insert(
            entity.getId(), extension(entity.getVersion()), type.name(), serialize.apply(entity));
  }

  public void remove(final UUID id, final Double version) {
    extensions.get().delete(id, extension(version));
  }

  public void insertMany(final List<T> entities) {
    if (entities.isEmpty()) {
      return;
    }
    final List<UUID> ids = new ArrayList<>(entities.size());
    final List<String> names = new ArrayList<>(entities.size());
    final List<String> jsons = new ArrayList<>(entities.size());
    for (final T entity : entities) {
      ids.add(entity.getId());
      names.add(extension(entity.getVersion()));
      jsons.add(serialize.apply(entity));
    }
    extensions.get().insertMany(ids, names, type.name(), jsons);
  }

  public T previous(final T entity) {
    final String json =
        extensions
            .get()
            .getExtension(
                entity.getId(), extension(entity.getChangeDescription().getPreviousVersion()));
    // Current-field hydration would replace the historical relationships needed for consolidation.
    return JsonUtils.readValue(json, type.entityClass());
  }

  private String extension(final Double version) {
    return EntityUtil.getVersionExtension(type.name(), version);
  }
}
