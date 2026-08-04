package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.BindMap;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.jdbi.BindFQN;

public interface EntityTimeSeriesDAO {
  String getTimeSeriesTableName();

  default String getPartitionFieldName() {
    return "entityFQNHash";
  }

  enum OrderBy {
    ASC,
    DESC
  }

  class ReportDataMapper implements RowMapper<CollectionDAO.ReportDataRow> {
    @Override
    public CollectionDAO.ReportDataRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      String rowNumber = rs.getString("row_num");
      String json = rs.getString("json");
      ReportData reportData;
      reportData = JsonUtils.readValue(json, ReportData.class);
      return new CollectionDAO.ReportDataRow(rowNumber, reportData);
    }
  }

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO <table>(entityFQNHash, extension, jsonSchema, json) "
              + "VALUES (:entityFQNHash, :extension, :jsonSchema, :json)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO <table>(entityFQNHash, extension, jsonSchema, json) "
              + "VALUES (:entityFQNHash, :extension, :jsonSchema, (:json :: jsonb))",
      connectionType = POSTGRES)
  void insert(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension,
      @Bind("jsonSchema") String jsonSchema,
      @Bind("json") String json);

  default void insert(String entityFQNHash, String extension, String jsonSchema, String json) {
    insert(getTimeSeriesTableName(), entityFQNHash, extension, jsonSchema, json);
  }

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO <table>(entityFQNHash, jsonSchema, json) "
              + "VALUES (:entityFQNHash, :jsonSchema, :json)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO <table>(entityFQNHash, jsonSchema, json) "
              + "VALUES (:entityFQNHash, :jsonSchema, (:json :: jsonb))",
      connectionType = POSTGRES)
  void insertWithoutExtension(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("jsonSchema") String jsonSchema,
      @Bind("json") String json);

  default void insert(String entityFQNHash, String jsonSchema, String json) {
    insertWithoutExtension(getTimeSeriesTableName(), entityFQNHash, jsonSchema, json);
  }

  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE <table> set json = :json where entityFQNHash=:entityFQNHash and extension=:extension and timestamp=:timestamp",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE <table> set json = (:json :: jsonb) where entityFQNHash=:entityFQNHash and extension=:extension and timestamp=:timestamp",
      connectionType = POSTGRES)
  void update(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension,
      @Bind("json") String json,
      @Bind("timestamp") Long timestamp);

  default void update(String entityFQNHash, String extension, String json, Long timestamp) {
    update(getTimeSeriesTableName(), entityFQNHash, extension, json, timestamp);
  }

  @ConnectionAwareSqlUpdate(
      value = "UPDATE <table> set json = :json where id=:id",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value = "UPDATE <table> set json = (:json :: jsonb) where id=:id",
      connectionType = POSTGRES)
  void update(@Define("table") String table, @Bind("json") String json, @Bind("id") String id);

  default void update(String json, UUID id) {
    update(getTimeSeriesTableName(), json, id.toString());
  }

  @SqlQuery(
      "SELECT json FROM <table> <cond> " + "ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
  List<String> listWithOffset(
      @Define("table") String table,
      @BindMap Map<String, ?> params,
      @Define("cond") String cond,
      @Bind("limit") int limit,
      @Bind("offset") int offset);

  @SqlQuery(
      "SELECT json FROM <table> <cond> "
          + "AND timestamp BETWEEN :startTs AND :endTs "
          + "ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
  List<String> listWithOffset(
      @Define("table") String table,
      @BindMap Map<String, ?> params,
      @Define("cond") String cond,
      @Bind("limit") int limit,
      @Bind("offset") int offset,
      @Bind("startTs") Long startTs,
      @Bind("endTs") Long endTs);

  @SqlQuery(
      "SELECT json FROM "
          + "(SELECT id, json, ROW_NUMBER() OVER(PARTITION BY <partition> ORDER BY timestamp DESC) AS row_num "
          + "FROM <table> <cond> "
          + "AND timestamp BETWEEN :startTs AND :endTs "
          + "ORDER BY timestamp DESC) ranked "
          + "WHERE ranked.row_num = 1 LIMIT :limit OFFSET :offset")
  List<String> listWithOffset(
      @Define("table") String table,
      @BindMap Map<String, ?> params,
      @Define("cond") String cond,
      @Define("partition") String partition,
      @Bind("limit") int limit,
      @Bind("offset") int offset,
      @Bind("startTs") Long startTs,
      @Bind("endTs") Long endTs);

  default List<String> listWithOffset(
      ListFilter filter, int limit, int offset, Long startTs, Long endTs, boolean latest) {
    return latest
        ? listWithOffset(
            getTimeSeriesTableName(),
            filter.getQueryParams(),
            filter.getCondition(),
            getPartitionFieldName(),
            limit,
            offset,
            startTs,
            endTs)
        : listWithOffset(
            getTimeSeriesTableName(),
            filter.getQueryParams(),
            filter.getCondition(),
            limit,
            offset,
            startTs,
            endTs);
  }

  default List<String> listWithOffset(ListFilter filter, int limit, int offset) {
    return listWithOffset(
        getTimeSeriesTableName(), filter.getQueryParams(), filter.getCondition(), limit, offset);
  }

  record TimeSeriesRow(String json, long timestamp, String entityFQNHash) {}

  record TimeSeriesCursor(long afterTs, String afterFQNHash) {
    /** Encodes a keyset cursor position as {@code "timestamp|entityFQNHash"}. */
    public static String format(long timestamp, String entityFQNHash) {
      return timestamp + "|" + entityFQNHash;
    }

    /** Decodes a Base64 keyset cursor back into its timestamp and FQN hash components. */
    public static TimeSeriesCursor parse(String keysetCursor) {
      if (keysetCursor == null || keysetCursor.isEmpty()) {
        return new TimeSeriesCursor(0, "");
      }
      String decoded = RestUtil.decodeCursor(keysetCursor);
      int sep = decoded.indexOf('|');
      if (sep < 0) {
        throw new IllegalArgumentException(
            "Malformed keyset cursor (missing '|'): " + keysetCursor);
      }
      return new TimeSeriesCursor(
          Long.parseLong(decoded.substring(0, sep)), decoded.substring(sep + 1));
    }
  }

  /** Holds the extracted JSON payloads and next-page cursor from a keyset query result. */
  record KeysetPage(List<String> jsons, String afterCursor) {
    public static KeysetPage from(List<TimeSeriesRow> rows, int limitParam) {
      boolean hasMoreData = rows.size() > limitParam;
      List<TimeSeriesRow> rowsToProcess = hasMoreData ? rows.subList(0, limitParam) : rows;
      List<String> jsons = rowsToProcess.stream().map(TimeSeriesRow::json).toList();
      String afterCursor = null;
      if (hasMoreData) {
        TimeSeriesRow lastRow = rowsToProcess.get(rowsToProcess.size() - 1);
        afterCursor = TimeSeriesCursor.format(lastRow.timestamp(), lastRow.entityFQNHash());
      }
      return new KeysetPage(jsons, afterCursor);
    }
  }

  class TimeSeriesRowMapper implements RowMapper<TimeSeriesRow> {
    @Override
    public TimeSeriesRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new TimeSeriesRow(
          rs.getString("json"), rs.getLong("timestamp"), rs.getString("entityFQNHash"));
    }
  }

  @SqlQuery(
      "SELECT json, timestamp, entityFQNHash FROM <table> <cond> "
          + "AND (timestamp > :afterTs OR (timestamp = :afterTs AND entityFQNHash > :afterFQNHash)) "
          + "ORDER BY timestamp ASC, entityFQNHash ASC LIMIT :limit")
  @RegisterRowMapper(TimeSeriesRowMapper.class)
  List<TimeSeriesRow> listAfterKeyset(
      @Define("table") String table,
      @BindMap Map<String, ?> params,
      @Define("cond") String cond,
      @Bind("limit") int limit,
      @Bind("afterTs") long afterTs,
      @Bind("afterFQNHash") String afterFQNHash);

  default List<TimeSeriesRow> listAfterKeyset(
      ListFilter filter, int limit, long afterTs, String afterFQNHash) {
    return listAfterKeyset(
        getTimeSeriesTableName(),
        filter.getQueryParams(),
        filter.getCondition(),
        limit,
        afterTs,
        afterFQNHash);
  }

  @SqlQuery(
      "SELECT json, timestamp, entityFQNHash FROM <table> <cond> "
          + "AND timestamp >= :startTs AND timestamp <= :endTs "
          + "AND (timestamp > :afterTs OR (timestamp = :afterTs AND entityFQNHash > :afterFQNHash)) "
          + "ORDER BY timestamp ASC, entityFQNHash ASC LIMIT :limit")
  @RegisterRowMapper(TimeSeriesRowMapper.class)
  List<TimeSeriesRow> listAfterKeysetWithRange(
      @Define("table") String table,
      @BindMap Map<String, ?> params,
      @Define("cond") String cond,
      @Bind("limit") int limit,
      @Bind("startTs") long startTs,
      @Bind("endTs") long endTs,
      @Bind("afterTs") long afterTs,
      @Bind("afterFQNHash") String afterFQNHash);

  default List<TimeSeriesRow> listAfterKeysetWithRange(
      ListFilter filter, int limit, long startTs, long endTs, long afterTs, String afterFQNHash) {
    return listAfterKeysetWithRange(
        getTimeSeriesTableName(),
        filter.getQueryParams(),
        filter.getCondition(),
        limit,
        startTs,
        endTs,
        afterTs,
        afterFQNHash);
  }

  @SqlQuery(
      "SELECT json, timestamp, entityFQNHash FROM <table> <cond> "
          + "ORDER BY timestamp ASC, entityFQNHash ASC LIMIT 1 OFFSET :offset")
  @RegisterRowMapper(TimeSeriesRowMapper.class)
  TimeSeriesRow getCursorAtOffset(
      @Define("table") String table,
      @BindMap Map<String, ?> params,
      @Define("cond") String cond,
      @Bind("offset") int offset);

  default TimeSeriesRow getCursorAtOffset(ListFilter filter, int offset) {
    return getCursorAtOffset(
        getTimeSeriesTableName(), filter.getQueryParams(), filter.getCondition(), offset);
  }

  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE <table> set json = :json where entityFQNHash=:entityFQNHash and extension=:extension and timestamp=:timestamp and json -> '$.operation' = :operation",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE <table> set json = (:json :: jsonb) where entityFQNHash=:entityFQNHash and extension=:extension and timestamp=:timestamp and json #>>'{operation}' = :operation",
      connectionType = POSTGRES)
  void updateExtensionByOperation(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension,
      @Bind("json") String json,
      @Bind("timestamp") Long timestamp,
      @Bind("operation") String operation);

  default void updateExtensionByOperation(
      String entityFQNHash, String extension, String json, Long timestamp, String operation) {
    updateExtensionByOperation(
        getTimeSeriesTableName(), entityFQNHash, extension, json, timestamp, operation);
  }

  @SqlQuery(
      "SELECT json FROM <table> WHERE entityFQNHash = :entityFQNHash AND extension = :extension")
  String getExtension(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityId,
      @Bind("extension") String extension);

  default String getExtension(String entityId, String extension) {
    return getExtension(getTimeSeriesTableName(), entityId, extension);
  }

  @SqlQuery("SELECT count(*) FROM <table> <cond>")
  int listCount(
      @Define("table") String table, @BindMap Map<String, ?> params, @Define("cond") String cond);

  default int listCount(ListFilter filter) {
    return listCount(getTimeSeriesTableName(), filter.getQueryParams(), filter.getCondition());
  }

  default int listCount() {
    return listCount(new ListFilter(null));
  }

  @SqlQuery("SELECT count(*) FROM <table> <cond> AND timestamp BETWEEN :startTs AND :endTs")
  int listCount(
      @Define("table") String table,
      @BindMap Map<String, ?> params,
      @Define("cond") String cond,
      @Bind("startTs") Long startTs,
      @Bind("endTs") Long endTs);

  @SqlQuery(
      "SELECT count(*) FROM "
          + "(SELECT id, ROW_NUMBER() OVER(PARTITION BY <partition> ORDER BY timestamp DESC) AS row_num FROM "
          + "<table> <cond> AND timestamp BETWEEN :startTs AND :endTs) ranked "
          + "WHERE ranked.row_num = 1")
  int listCount(
      @Define("table") String table,
      @Define("partition") String partition,
      @BindMap Map<String, ?> params,
      @Define("cond") String cond,
      @Bind("startTs") Long startTs,
      @Bind("endTs") Long endTs);

  default int listCount(ListFilter filter, Long startTs, Long endTs, boolean latest) {
    return latest
        ? listCount(
            getTimeSeriesTableName(),
            getPartitionFieldName(),
            filter.getQueryParams(),
            filter.getCondition(),
            startTs,
            endTs)
        : listCount(
            getTimeSeriesTableName(),
            filter.getQueryParams(),
            filter.getCondition(),
            startTs,
            endTs);
  }

  @SqlQuery("SELECT json FROM <table> WHERE id = :id")
  String getById(@Define("table") String table, @Bind("id") String id);

  default String getById(UUID id) {
    return getById(getTimeSeriesTableName(), id.toString());
  }

  @SqlQuery("SELECT EXISTS (SELECT 1 FROM <table> WHERE id = :id)")
  boolean exists(@Define("table") String table, @Bind("id") String id);

  default boolean existsById(UUID id) {
    return exists(getTimeSeriesTableName(), id.toString());
  }

  @SqlUpdate(value = "DELETE from <table> WHERE id = :id")
  void deleteById(@Define("table") String table, @Bind("id") String id);

  default void deleteById(UUID id) {
    deleteById(getTimeSeriesTableName(), id.toString());
  }

  /** @deprecated */
  @SqlQuery("SELECT COUNT(DISTINCT entityFQN) FROM <table>")
  @Deprecated(since = "1.1.1")
  int listDistinctCount(@Define("table") String table);

  default void listDistinctCount() {
    listDistinctCount(getTimeSeriesTableName());
  }

  @ConnectionAwareSqlQuery(
      value =
          "WITH data AS (SELECT ROW_NUMBER() OVER(ORDER BY timestamp ASC) AS row_num, json "
              + "FROM <table> WHERE entityFQNHash = :entityFQNHash) "
              + "SELECT row_num, json FROM data WHERE row_num > :after LIMIT :limit",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "WITH data AS (SELECT ROW_NUMBER() OVER(ORDER BY timestamp ASC) AS row_num, json "
              + "FROM <table> WHERE entityFQNHash = :entityFQNHash) "
              + "SELECT row_num, json FROM data WHERE row_num > (:after :: integer) LIMIT :limit",
      connectionType = POSTGRES)
  @RegisterRowMapper(ReportDataMapper.class)
  List<CollectionDAO.ReportDataRow> getAfterExtension(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("limit") int limit,
      @Bind("after") String after);

  default List<CollectionDAO.ReportDataRow> getAfterExtension(
      String entityFQNHash, int limit, String after) {
    return getAfterExtension(getTimeSeriesTableName(), entityFQNHash, limit, after);
  }

  @SqlQuery(
      "SELECT json FROM <table> WHERE entityFQNHash = :entityFQNHash AND extension = :extension AND timestamp = :timestamp")
  String getExtensionAtTimestamp(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension,
      @Bind("timestamp") long timestamp);

  default String getExtensionAtTimestamp(String entityFQNHash, String extension, long timestamp) {
    return getExtensionAtTimestamp(getTimeSeriesTableName(), entityFQNHash, extension, timestamp);
  }

  @ConnectionAwareSqlQuery(
      value =
          "SELECT json FROM <table> WHERE entityFQNHash = :entityFQNHash AND extension = :extension AND timestamp = :timestamp AND json -> '$.operation' = :operation",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT json FROM <table> WHERE entityFQNHash = :entityFQNHash AND extension = :extension AND timestamp = :timestamp AND json #>>'{operation}' = :operation",
      connectionType = POSTGRES)
  String getExtensionAtTimestampWithOperation(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension,
      @Bind("timestamp") long timestamp,
      @Bind("operation") String operation);

  default String getExtensionAtTimestampWithOperation(
      String entityFQNHash, String extension, long timestamp, String operation) {
    return getExtensionAtTimestampWithOperation(
        getTimeSeriesTableName(), entityFQNHash, extension, timestamp, operation);
  }

  @SqlQuery(
      "SELECT json FROM <table> WHERE entityFQNHash = :entityFQNHash AND extension = :extension "
          + "ORDER BY timestamp DESC LIMIT 1")
  String getLatestExtension(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension);

  default String getLatestExtension(String entityFQNHash, String extension) {
    return getLatestExtension(getTimeSeriesTableName(), entityFQNHash, extension);
  }

  record FQNHashJsonRow(String entityFQNHash, String json) {}

  class FQNHashJsonRowMapper implements RowMapper<FQNHashJsonRow> {
    @Override
    public FQNHashJsonRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new FQNHashJsonRow(rs.getString("entityFQNHash"), rs.getString("json"));
    }
  }

  /**
   * The single newest row per entity. Same shape as {@link #getLatestExtensionsBatch} with N = 1, and
   * the same trade-off between the two dialects: the MySQL form ranks every historical row for the
   * requested entities before discarding all but the newest, so its cost tracks total history rather
   * than the number of entities asked for. Measured on 26 entities holding 52k rows between them,
   * that is 77ms against 8ms for the Postgres seek below.
   */
  @ConnectionAwareSqlQuery(
      value =
          "SELECT entityFQNHash, json FROM (SELECT entityFQNHash, json, "
              + "ROW_NUMBER() OVER (PARTITION BY entityFQNHash ORDER BY timestamp DESC) AS rn "
              + "FROM <table> WHERE entityFQNHash IN (<entityFQNHashes>) "
              + "AND extension = :extension) ranked WHERE rn = 1",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT h.hash AS \"entityFQNHash\", x.json AS json "
              + "FROM unnest(ARRAY[<entityFQNHashes>]::varchar[]) AS h(hash) "
              + "CROSS JOIN LATERAL (SELECT json FROM <table> "
              + "WHERE entityFQNHash = h.hash AND extension = :extension "
              + "ORDER BY timestamp DESC LIMIT 1) x",
      connectionType = POSTGRES)
  @RegisterRowMapper(FQNHashJsonRowMapper.class)
  List<FQNHashJsonRow> getLatestExtensionBatch(
      @Define("table") String table,
      @BindList("entityFQNHashes") List<String> entityFQNHashes,
      @Bind("extension") String extension);

  default Map<String, String> getLatestExtensionBatch(
      List<String> entityFQNHashes, String extension) {
    if (entityFQNHashes == null || entityFQNHashes.isEmpty()) {
      return Map.of();
    }
    // Distinct for the same reason as the overload below: `IN (...)` collapses a repeated hash but
    // `unnest(ARRAY[...])` yields a row per occurrence. Harmless for this map, wasteful either way.
    List<FQNHashJsonRow> rows =
        EntityDAO.queryInChunks(
            entityFQNHashes.stream().distinct().toList(),
            chunk -> getLatestExtensionBatch(getTimeSeriesTableName(), chunk, extension));
    Map<String, String> result = new HashMap<>();
    for (FQNHashJsonRow row : rows) {
      result.put(row.entityFQNHash(), row.json());
    }
    return result;
  }

  /**
   * Top-N rows per entity, each entity's rows newest-first.
   *
   * <p>The newest-first order is part of the contract, not a convenience: callers index straight
   * into the result to get an entity's most recent row. A per-entity ordering key must therefore
   * appear in the outer ORDER BY — ordering by the entity hash alone leaves rows unordered within an
   * entity, which silently returns an arbitrary historical row as the newest one.
   *
   * <p>The MySQL form ranks every historical row for the requested entities and then discards all
   * but the newest N, so its cost grows with total history rather than with N. The Postgres form
   * asks for the newest N per entity via LATERAL, which lets the planner walk
   * {@code (entityFQNHash, extension, timestamp)} backwards and stop at N instead of reading that
   * entity's whole history. Which plan it picks is its own choice — on a small table it may still
   * sort — so treat this as removing the guaranteed full scan, not as a guaranteed seek.
   *
   * <p>MySQL keeps the window form because LATERAL needs MySQL 8.0.14+ and this project declares no
   * minimum 8.0.x patch level.
   *
   * <p>Prefer the {@code (hashes, extension, limit)} overload below. It de-duplicates the hash list,
   * which the two dialects require to agree: {@code IN (...)} collapses a repeated hash while
   * {@code unnest(ARRAY[...])} yields one N-row block per occurrence.
   */
  @ConnectionAwareSqlQuery(
      value =
          "SELECT entityFQNHash, json FROM (SELECT entityFQNHash, json, "
              + "ROW_NUMBER() OVER (PARTITION BY entityFQNHash ORDER BY timestamp DESC) AS rn "
              + "FROM <table> WHERE entityFQNHash IN (<entityFQNHashes>) "
              + "AND extension = :extension) ranked WHERE rn <= :limit "
              + "ORDER BY entityFQNHash, rn",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT h.hash AS \"entityFQNHash\", x.json AS json "
              + "FROM unnest(ARRAY[<entityFQNHashes>]::varchar[]) AS h(hash) "
              + "CROSS JOIN LATERAL (SELECT json, timestamp FROM <table> "
              + "WHERE entityFQNHash = h.hash AND extension = :extension "
              + "ORDER BY timestamp DESC LIMIT :limit) x "
              + "ORDER BY h.hash, x.timestamp DESC",
      connectionType = POSTGRES)
  @RegisterRowMapper(FQNHashJsonRowMapper.class)
  List<FQNHashJsonRow> getLatestExtensionsBatch(
      @Define("table") String table,
      @BindList("entityFQNHashes") List<String> entityFQNHashes,
      @Bind("extension") String extension,
      @Bind("limit") int limit);

  default Map<String, List<String>> getLatestExtensionsBatch(
      List<String> entityFQNHashes, String extension, int limit) {
    // "Newest N per entity" has no meaning for N <= 0, so this is always a caller bug. Fail loudly:
    // returning an empty map instead is indistinguishable from "no entity has any rows", which
    // surfaces as every pipeline reporting no runs at all, with nothing logged anywhere.
    if (limit <= 0) {
      throw new IllegalArgumentException(
          "limit must be positive to fetch top-N rows, got " + limit);
    }
    Map<String, List<String>> result = new LinkedHashMap<>();
    // De-duplicate before binding: MySQL's `IN (...)` collapses a repeated hash, whereas the
    // Postgres form expands one array element per occurrence and would return `limit` rows per
    // occurrence. Distinct input keeps the two dialects returning the same rows.
    List<String> distinctHashes =
        entityFQNHashes == null ? List.of() : entityFQNHashes.stream().distinct().toList();
    if (!distinctHashes.isEmpty()) {
      List<FQNHashJsonRow> rows =
          EntityDAO.queryInChunks(
              distinctHashes,
              chunk -> getLatestExtensionsBatch(getTimeSeriesTableName(), chunk, extension, limit));
      for (FQNHashJsonRow row : rows) {
        result.computeIfAbsent(row.entityFQNHash(), key -> new ArrayList<>()).add(row.json());
      }
    }
    return result;
  }

  @SqlQuery(
      "SELECT json FROM <table> WHERE entityFQNHash = :entityFQNHash "
          + "ORDER BY timestamp DESC LIMIT 1")
  String getLatestRecord(
      @Define("table") String table, @BindFQN("entityFQNHash") String entityFQNHash);

  default String getLatestRecord(String entityFQNHash) {
    return getLatestRecord(getTimeSeriesTableName(), entityFQNHash);
  }

  @SqlUpdate("DELETE FROM <table> WHERE entityFQNHash = :entityFQNHash AND extension = :extension")
  void delete(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension);

  default void delete(String entityFQNHash, String extension) {
    delete(getTimeSeriesTableName(), entityFQNHash, extension);
  }

  @SqlUpdate(
      "DELETE FROM <table> WHERE entityFQNHash = :entityFQNHash AND extension = :extension AND timestamp = :timestamp")
  void deleteAtTimestamp(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension,
      @Bind("timestamp") Long timestamp);

  default void deleteAtTimestamp(String entityFQNHash, String extension, Long timestamp) {
    deleteAtTimestamp(getTimeSeriesTableName(), entityFQNHash, extension, timestamp);
  }

  @SqlUpdate(
      "DELETE FROM <table> WHERE entityFQNHash = :entityFQNHash AND extension = :extension AND timestamp < :timestamp")
  void deleteBeforeTimestamp(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension,
      @Bind("timestamp") Long timestamp);

  default void deleteBeforeTimestamp(String entityFQNHash, String extension, Long timestamp) {
    deleteBeforeTimestamp(getTimeSeriesTableName(), entityFQNHash, extension, timestamp);
  }

  @ConnectionAwareSqlUpdate(
      value =
          "DELETE FROM <table> "
              + "WHERE entityFQNHash = :entityFQNHash "
              + "AND extension = :extension "
              + "<mysqlCond>",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "DELETE FROM <table> "
              + "WHERE entityFQNHash = :entityFQNHash "
              + "AND extension = :extension "
              + "<psqlCond>",
      connectionType = POSTGRES)
  void deleteExtensionByKeyInternal(
      @Define("table") String table,
      @Bind("value") String value,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension,
      @Define("mysqlCond") String mysqlCond,
      @Define("psqlCond") String psqlCond);

  default void deleteExtensionByKey(String key, String value, String entityFQN, String extension) {
    String mysqlCond = String.format("AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.%s')) = :value", key);
    String psqlCond = String.format("AND json->>'%s' = :value", key);
    deleteExtensionByKeyInternal(
        getTimeSeriesTableName(), value, entityFQN, extension, mysqlCond, psqlCond);
  }

  @SqlQuery(
      "SELECT json FROM <table> where entityFQNHash = :entityFQNHash and extension = :extension "
          + " AND timestamp >= :startTs and timestamp <= :endTs ORDER BY timestamp DESC")
  List<String> listBetweenTimestamps(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension,
      @Bind("startTs") Long startTs,
      @Bind("endTs") long endTs);

  default List<String> listBetweenTimestamps(
      String entityFQNHash, String extension, Long startTs, long endTs) {
    return listBetweenTimestamps(
        getTimeSeriesTableName(), entityFQNHash, extension, startTs, endTs);
  }

  @SqlQuery(
      "SELECT json FROM <table> where entityFQNHash = :entityFQNHash and extension = :extension "
          + " AND timestamp >= :startTs and timestamp <= :endTs ORDER BY timestamp <orderBy>")
  List<String> listBetweenTimestampsByOrder(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension,
      @Bind("startTs") Long startTs,
      @Bind("endTs") long endTs,
      @Define("orderBy") OrderBy orderBy);

  default List<String> listBetweenTimestampsByOrder(
      String entityFQNHash, String extension, Long startTs, long endTs, OrderBy orderBy) {
    return listBetweenTimestampsByOrder(
        getTimeSeriesTableName(), entityFQNHash, extension, startTs, endTs, orderBy);
  }

  @SqlQuery(
      "SELECT json FROM <table> where entityFQNHash = :entityFQNHash and extension = :extension "
          + " AND timestamp >= :startTs and timestamp <= :endTs ORDER BY timestamp <orderBy> LIMIT :limit")
  List<String> listBetweenTimestampsByOrderWithLimit(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension,
      @Bind("startTs") Long startTs,
      @Bind("endTs") long endTs,
      @Define("orderBy") OrderBy orderBy,
      @Bind("limit") int limit);

  default List<String> listBetweenTimestampsByOrderWithLimit(
      String entityFQNHash,
      String extension,
      Long startTs,
      long endTs,
      OrderBy orderBy,
      int limit) {
    return listBetweenTimestampsByOrderWithLimit(
        getTimeSeriesTableName(), entityFQNHash, extension, startTs, endTs, orderBy, limit);
  }

  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE <table> SET json = :json "
              + "WHERE entityFQNHash = :entityFQNHash "
              + "AND extension = :extension "
              + "<mysqlCond>",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE <table> SET json = (:json :: jsonb) "
              + "WHERE entityFQNHash = :entityFQNHash "
              + "AND extension = :extension "
              + "<psqlCond>",
      connectionType = POSTGRES)
  void updateExtensionByKeyInternal(
      @Define("table") String table,
      @Bind("value") String value,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension,
      @Bind("json") String json,
      @Define("mysqlCond") String mysqlCond,
      @Define("psqlCond") String psqlCond);

  default void updateExtensionByKey(
      String key, String value, String entityFQN, String extension, String json) {
    String mysqlCond = String.format("AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.%s')) = :value", key);
    String psqlCond = String.format("AND json->>'%s' = :value", key);
    updateExtensionByKeyInternal(
        getTimeSeriesTableName(), value, entityFQN, extension, json, mysqlCond, psqlCond);
  }

  /*
   * Support selecting data filtering by top-level keys in the JSON
   */
  @ConnectionAwareSqlQuery(
      value =
          "SELECT json from <table> "
              + "WHERE entityFQNHash = :entityFQNHash "
              + "AND extension = :extension "
              + "<mysqlCond>",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT json from <table> "
              + "WHERE entityFQNHash = :entityFQNHash "
              + "AND extension = :extension "
              + "<psqlCond>",
      connectionType = POSTGRES)
  String getExtensionByKeyInternal(
      @Define("table") String table,
      @Bind("value") String value,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension,
      @Define("mysqlCond") String mysqlCond,
      @Define("psqlCond") String psqlCond);

  default String getExtensionByKey(String key, String value, String entityFQN, String extension) {
    String mysqlCond = String.format("AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.%s')) = :value", key);
    String psqlCond = String.format("AND json->>'%s' = :value", key);
    return getExtensionByKeyInternal(
        getTimeSeriesTableName(), value, entityFQN, extension, mysqlCond, psqlCond);
  }

  @ConnectionAwareSqlQuery(
      value =
          "SELECT json from <table> "
              + "WHERE entityFQNHash = :entityFQNHash "
              + "AND extension = :extension "
              + "<mysqlCond> "
              + "ORDER BY timestamp DESC LIMIT 1",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT json from <table> "
              + "WHERE entityFQNHash = :entityFQNHash "
              + "AND extension = :extension "
              + "<psqlCond> "
              + "ORDER BY timestamp DESC LIMIT 1",
      connectionType = POSTGRES)
  String getLatestExtensionByKeyInternal(
      @Define("table") String table,
      @Bind("value") String value,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension,
      @Define("mysqlCond") String mysqlCond,
      @Define("psqlCond") String psqlCond);

  default String getLatestExtensionByKey(
      String key, String value, String entityFQN, String extension) {
    String mysqlCond = String.format("AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.%s')) = :value", key);
    String psqlCond = String.format("AND json->>'%s' = :value", key);
    return getLatestExtensionByKeyInternal(
        getTimeSeriesTableName(), value, entityFQN, extension, mysqlCond, psqlCond);
  }

  default void storeTimeSeriesWithOperation(
      String fqn,
      String extension,
      String jsonSchema,
      String entityJson,
      Long timestamp,
      String operation,
      boolean update) {
    if (update) {
      updateExtensionByOperation(fqn, extension, entityJson, timestamp, operation);
    } else {
      insert(fqn, extension, jsonSchema, entityJson);
    }
  }

  @ConnectionAwareSqlUpdate(
      value =
          "DELETE FROM <table> "
              + "WHERE json->>'id' IN ( "
              + "  SELECT json->>'id' FROM <table> "
              + "  WHERE timestamp < :cutoffTs ORDER BY timestamp LIMIT :limit "
              + ")",
      connectionType = POSTGRES)
  @ConnectionAwareSqlUpdate(
      value =
          """
            DELETE FROM <table> WHERE timestamp < :cutoffTs ORDER BY timestamp LIMIT :limit
            """,
      connectionType = MYSQL)
  int deleteRecordsBeforeCutOff(
      @Define("table") String table, @Bind("cutoffTs") long cutoffTs, @Bind("limit") int limit);

  default int deleteRecordsBeforeCutOff(long cutoffTs, int limit) {
    return deleteRecordsBeforeCutOff(getTimeSeriesTableName(), cutoffTs, limit);
  }

  /** @deprecated */
  @SqlQuery(
      "SELECT DISTINCT entityFQN FROM <table> WHERE entityFQNHash = '' or entityFQNHash is null LIMIT :limit")
  @Deprecated(since = "1.1.1")
  List<String> migrationListDistinctWithOffset(
      @Define("table") String table, @Bind("limit") int limit);

  default List<String> migrationListDistinctWithOffset(int limit) {
    return migrationListDistinctWithOffset(getTimeSeriesTableName(), limit);
  }
}
