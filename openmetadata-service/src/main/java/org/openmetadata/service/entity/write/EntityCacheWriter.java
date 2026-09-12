package org.openmetadata.service.entity.write;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.cache.CachedEntityDao.Entry;
import org.openmetadata.service.util.PostCommitActionQueue;

@Slf4j
public final class EntityCacheWriter<T extends EntityInterface> {
  private final String entityType;
  private final Supplier<CachedEntityDao> cache;
  private final Function<T, String> serializer;
  private final boolean cacheable;

  public EntityCacheWriter(
      final String entityType,
      final Supplier<CachedEntityDao> cache,
      final Function<T, String> serializer,
      final boolean cacheable) {
    this.entityType = entityType;
    this.cache = cache;
    this.serializer = serializer;
    this.cacheable = cacheable;
  }

  public void write(final T entity, final String storedJson) {
    final CachedEntityDao target = cache.get();
    if (target != null && cacheable && isValid(entity)) {
      final Entry entry = entry(entity, storedJson);
      if (entry != null) {
        PostCommitActionQueue.runOrDefer(() -> publish(target, entry));
      }
    }
  }

  public void writeMany(final List<T> entities, final List<StoredEntity> stored) {
    final CachedEntityDao target = cache.get();
    if (target == null || !cacheable || nullOrEmpty(entities)) {
      return;
    }
    final Map<UUID, String> jsonById = new HashMap<>();
    stored.forEach(row -> jsonById.put(row.id(), row.json()));
    for (int offset = 0; offset < entities.size(); offset += CachedEntityDao.WRITE_BATCH_SIZE) {
      final int end = Math.min(offset + CachedEntityDao.WRITE_BATCH_SIZE, entities.size());
      final List<Entry> entries = entries(entities.subList(offset, end), jsonById);
      if (!entries.isEmpty()) {
        PostCommitActionQueue.runOrDefer(() -> target.putMany(entityType, entries));
      }
    }
  }

  private List<Entry> entries(final List<T> entities, final Map<UUID, String> stored) {
    return entities.stream()
        .filter(EntityCacheWriter::isValid)
        .map(entity -> entry(entity, stored.get(entity.getId())))
        .filter(Objects::nonNull)
        .toList();
  }

  private Entry entry(final T entity, final String storedJson) {
    try {
      final String json = storedJson == null ? serializer.apply(entity) : storedJson;
      return new Entry(entity.getId(), entity.getFullyQualifiedName(), json);
    } catch (RuntimeException exception) {
      LOG.debug("Cache serialization failed for {} {}", entityType, entity.getId(), exception);
      return null;
    }
  }

  private void publish(final CachedEntityDao target, final Entry entry) {
    if (!nullOrEmpty(entry.json())) {
      try {
        target.putBase(entityType, entry.id(), entry.json());
        target.putByName(entityType, entry.fullyQualifiedName(), entry.json());
      } catch (RuntimeException exception) {
        LOG.debug("Cache publication failed for {} {}", entityType, entry.id(), exception);
      }
    }
  }

  private static boolean isValid(final EntityInterface entity) {
    return entity != null && entity.getId() != null && entity.getFullyQualifiedName() != null;
  }
}
