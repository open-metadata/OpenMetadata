package org.openmetadata.service.entity.history;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;

public final class EntityHistoryQuery<T extends EntityInterface> {
  public record Window(
      long startTimestamp, long endTimestamp, String after, String before, int limit) {}

  private record CountKey(
      String tableName, String entityType, long startTimestamp, long endTimestamp) {}

  private static final Cache<CountKey, Integer> COUNTS =
      CacheBuilder.newBuilder()
          .maximumSize(500)
          .expireAfterWrite(5, TimeUnit.MINUTES)
          .recordStats()
          .build();

  private final EntityHistoryType<T> type;
  private final Supplier<EntityExtensionDAO> extensions;
  private final Consumer<List<T>> hydration;

  public EntityHistoryQuery(
      final EntityHistoryType<T> type,
      final Supplier<EntityExtensionDAO> extensions,
      final Consumer<List<T>> hydration) {
    this.type = type;
    this.extensions = extensions;
    this.hydration = hydration;
  }

  public ResultList<T> list(final Window window) {
    final HistoryCursor cursor = HistoryCursor.of(window.after(), window.before());
    final List<T> rows = read(window, cursor);
    final boolean hasMore = rows.size() > window.limit();
    final List<T> entities =
        new ArrayList<>(rows.subList(0, Math.min(rows.size(), window.limit())));
    if (cursor.isBackward()) {
      Collections.reverse(entities);
    }
    hydration.accept(entities);
    return result(entities, cursor, hasMore, count(window));
  }

  private List<T> read(final Window window, final HistoryCursor cursor) {
    final List<String> jsons =
        extensions
            .get()
            .getEntityHistoryByTimestampRange(
                type.tableName(),
                window.startTimestamp(),
                window.endTimestamp(),
                cursor.condition(),
                cursor.sortOrder(),
                type.name(),
                cursor.updatedAt(),
                cursor.id(),
                window.limit() + 1);
    return JsonUtils.readObjects(jsons, type.entityClass());
  }

  private int count(final Window window) {
    final CountKey key =
        new CountKey(type.tableName(), type.name(), window.startTimestamp(), window.endTimestamp());
    try {
      return COUNTS.get(
          key,
          () ->
              extensions
                  .get()
                  .getEntityHistoryByTimestampRangeCount(
                      key.tableName(), key.startTimestamp(), key.endTimestamp(), key.entityType()));
    } catch (ExecutionException exception) {
      throw new RuntimeException("Failed to get version count from cache", exception);
    }
  }

  private ResultList<T> result(
      final List<T> entities, final HistoryCursor page, final boolean hasMore, final int total) {
    if (entities.isEmpty()) {
      return new ResultList<>(entities, null, null, total);
    }
    final boolean hasNewer = page.isBackward() ? hasMore : !page.isFirstPage();
    final boolean hasOlder = page.isBackward() || hasMore;
    return new ResultList<>(
        entities,
        hasNewer ? cursor(entities.getFirst()) : null,
        hasOlder ? cursor(entities.getLast()) : null,
        total);
  }

  private String cursor(final T entity) {
    return entity.getUpdatedAt() + ":" + entity.getId();
  }
}
