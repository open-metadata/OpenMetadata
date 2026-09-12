package org.openmetadata.service.entity.history;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityVersionPair;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecord;
import org.openmetadata.service.util.EntityUtil;

public final class EntityVersionHistory<T extends EntityInterface> {
  public record Hydration<T>(UnaryOperator<T> fields, Consumer<T> inheritance) {}

  public record Page(EntityHistory entityHistory, int nextOffset) {}

  private final EntityHistoryType<T> type;
  private final Supplier<EntityExtensionDAO> extensions;
  private final Function<UUID, T> current;
  private final Hydration<T> hydration;

  public EntityVersionHistory(
      final EntityHistoryType<T> type,
      final Supplier<EntityExtensionDAO> extensions,
      final Function<UUID, T> current,
      final Hydration<T> hydration) {
    this.type = type;
    this.extensions = extensions;
    this.current = current;
    this.hydration = hydration;
  }

  public T getVersion(final UUID id, final String version) {
    final Double requested = Double.parseDouble(version);
    final String json =
        extensions.get().getExtension(id, EntityUtil.getVersionExtension(type.name(), requested));
    if (json != null) {
      return JsonUtils.readValue(json, type.entityClass());
    }
    final T latest = hydration.fields().apply(current.apply(id));
    if (!latest.getVersion().equals(requested)) {
      throw EntityNotFoundException.byMessage(
          CatalogExceptionMessage.entityVersionNotFound(type.name(), id, requested));
    }
    return latest;
  }

  public EntityHistory listVersions(final UUID id) {
    final T latest = current.apply(id);
    final String latestJson = latestJson(latest);
    final List<ExtensionRecord> records =
        extensions.get().getExtensions(id, EntityUtil.getVersionExtensionPrefix(type.name()));
    return history(records, latestJson);
  }

  public EntityHistory listVersions(final UUID id, final int limit, final int offset) {
    final T latest = current.apply(id);
    final String latestJson = offset == 0 ? latestJson(latest) : null;
    final List<ExtensionRecord> records =
        extensions
            .get()
            .getExtensionsWithOffset(
                id, EntityUtil.getVersionExtensionPrefix(type.name()), limit, offset);
    return history(records, latestJson);
  }

  public Page page(final UUID id, final int limit, final int offset) {
    return new Page(listVersions(id, limit, offset), offset + limit);
  }

  private String latestJson(final T entity) {
    final T latest = hydration.fields().apply(entity);
    hydration.inheritance().accept(latest);
    return JsonUtils.pojoToJson(latest);
  }

  private EntityHistory history(final List<ExtensionRecord> records, final String latestJson) {
    final List<Object> versions = new ArrayList<>(records.size() + 1);
    if (latestJson != null) {
      versions.add(latestJson);
    }
    records.stream()
        .map(EntityVersionPair::new)
        .sorted(EntityUtil.compareVersion.reversed())
        .map(EntityVersionPair::getEntityJson)
        .forEach(versions::add);
    return new EntityHistory().withEntityType(type.name()).withVersions(versions);
  }
}
