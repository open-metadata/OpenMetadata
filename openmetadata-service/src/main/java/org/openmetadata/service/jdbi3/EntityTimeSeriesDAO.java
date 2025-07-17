package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindMap;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
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
