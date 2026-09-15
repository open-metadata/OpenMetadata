package org.openmetadata.service.entity.metadata;

import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO.OrderBy;

/** Reads and mutates extension series through the operation's retained DAO. */
public final class EntityTimeSeries {
  public record Window(Long start, Long end, OrderBy order, Integer limit) {
    public static Window descending(final Long start, final Long end) {
      return new Window(start, end, OrderBy.DESC, null);
    }
  }

  private final Supplier<? extends EntityTimeSeriesDAO> dao;

  public EntityTimeSeries(final Supplier<? extends EntityTimeSeriesDAO> dao) {
    this.dao = dao;
  }

  public void insert(
      final String fqn, final String extension, final String jsonSchema, final String json) {
    dao.get().insert(fqn, extension, jsonSchema, json);
  }

  public String at(final String fqn, final String extension, final Long timestamp) {
    return dao.get().getExtensionAtTimestamp(fqn, extension, timestamp);
  }

  public String latest(final String fqn, final String extension) {
    return dao.get().getLatestExtension(fqn, extension);
  }

  public Map<String, String> latestBatch(final List<String> fqnHashes, final String extension) {
    return dao.get().getLatestExtensionBatch(fqnHashes, extension);
  }

  public Map<String, List<String>> latestBatch(
      final List<String> fqnHashes, final String extension, final int limit) {
    return dao.get().getLatestExtensionsBatch(fqnHashes, extension, limit);
  }

  public List<String> between(final String fqn, final String extension, final Window window) {
    final EntityTimeSeriesDAO current = dao.get();
    return window.limit() == null
        ? current.listBetweenTimestampsByOrder(
            fqn, extension, window.start(), window.end(), window.order())
        : current.listBetweenTimestampsByOrderWithLimit(
            fqn, extension, window.start(), window.end(), window.order(), window.limit());
  }

  public void deleteAt(final String fqn, final String extension, final Long timestamp) {
    dao.get().deleteAtTimestamp(fqn, extension, timestamp);
  }

  public void deleteBefore(final String fqn, final String extension, final Long timestamp) {
    dao.get().deleteBeforeTimestamp(fqn, extension, timestamp);
  }
}
