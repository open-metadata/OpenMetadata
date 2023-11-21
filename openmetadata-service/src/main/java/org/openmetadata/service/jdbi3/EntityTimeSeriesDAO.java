package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.jdbi.BindFQN;

public interface EntityTimeSeriesDAO {
  String getTimeSeriesTableName();

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
    updateExtensionByOperation(getTimeSeriesTableName(), entityFQNHash, extension, json, timestamp, operation);
  }

  @SqlQuery("SELECT json FROM <table> WHERE entityFQNHash = :entityFQNHash AND extension = :extension")
  String getExtension(
      @Define("table") String table, @BindFQN("entityFQNHash") String entityId, @Bind("extension") String extension);

  default String getExtension(String entityId, String extension) {
    return getExtension(getTimeSeriesTableName(), entityId, extension);
  }

  @SqlQuery("SELECT count(*) FROM <table> WHERE entityFQNHash = :entityFQNHash")
  int listCount(@Define("table") String table, @BindFQN("entityFQNHash") String entityFQNHash);

  default int listCount(String entityFQNHash) {
    return listCount(getTimeSeriesTableName(), entityFQNHash);
  }

  /** @deprecated */
  @SqlQuery("SELECT COUNT(DISTINCT entityFQN) FROM <table>")
  @Deprecated(since = "1.1.1")
  int listDistinctCount(@Define("table") String table);

  default int listDistinctCount() {
    return listDistinctCount(getTimeSeriesTableName());
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

  default List<CollectionDAO.ReportDataRow> getAfterExtension(String entityFQNHash, int limit, String after) {
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
      "SELECT ranked.json FROM (SELECT json, ROW_NUMBER() OVER(PARTITION BY entityFQNHash ORDER BY timestamp DESC) AS row_num "
          + "FROM <table> WHERE entityFQNHash IN (<entityFQNHashes>) AND extension = :extension) ranked WHERE ranked.row_num = 1")
  List<String> getLatestExtensionByFQNs(
      @Define("table") String table,
      @BindList("entityFQNHashes") List<String> entityFQNHashes,
      @Bind("extension") String extension);

  default List<String> getLatestExtensionByFQNs(List<String> entityFQNHashes, String extension) {
    return getLatestExtensionByFQNs(getTimeSeriesTableName(), entityFQNHashes, extension);
  }

  @SqlQuery("SELECT json FROM <table> WHERE extension = :extension ORDER BY timestamp DESC LIMIT 1")
  String getLatestByExtension(@Define("table") String table, @Bind("extension") String extension);

  default String getLatestByExtension(String extension) {
    return getLatestByExtension(getTimeSeriesTableName(), extension);
  }

  @SqlQuery("SELECT json FROM <table> WHERE extension = :extension ORDER BY timestamp DESC")
  List<String> getAllByExtension(@Define("table") String table, @Bind("extension") String extension);

  default List<String> getAllByExtension(String extension) {
    return getAllByExtension(getTimeSeriesTableName(), extension);
  }

  @SqlUpdate("DELETE FROM <table> WHERE entityFQNHash = :entityFQNHash")
  void deleteAll(@Define("table") String table, @Bind("entityFQNHash") String entityFQNHash);

  default void deleteAll(String entityFQNHash) {
    deleteAll(getTimeSeriesTableName(), entityFQNHash);
  }

  @SqlUpdate("DELETE FROM <table> WHERE entityFQNHash = :entityFQNHash AND extension = :extension")
  void delete(
      @Define("table") String table,
      @BindFQN("entityFQNHash") String entityFQNHash,
      @Bind("extension") String extension);

  default void delete(String entityFQNHash, String extension) {
    delete(getTimeSeriesTableName(), entityFQNHash, extension);
  }

  // This just saves the limit number of records, and remove all other with given extension
  @SqlUpdate(
      "DELETE FROM <table> WHERE extension = :extension AND entityFQNHash NOT IN(SELECT entityFQNHash FROM (select * from <table> WHERE extension = :extension ORDER BY timestamp DESC LIMIT :records) AS subquery)")
  void deleteLastRecords(
      @Define("table") String table, @Bind("extension") String extension, @Bind("records") int noOfRecord);

  default void deleteLastRecords(String extension, int noOfRecord) {
    deleteLastRecords(getTimeSeriesTableName(), extension, noOfRecord);
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

  default List<String> listBetweenTimestamps(String entityFQNHash, String extension, Long startTs, long endTs) {
    return listBetweenTimestamps(getTimeSeriesTableName(), entityFQNHash, extension, startTs, endTs);
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
    return listBetweenTimestampsByOrder(getTimeSeriesTableName(), entityFQNHash, extension, startTs, endTs, orderBy);
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

  default void updateExtensionByKey(String key, String value, String entityFQN, String extension, String json) {
    String mysqlCond = String.format("AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.%s')) = :value", key);
    String psqlCond = String.format("AND json->>'%s' = :value", key);
    updateExtensionByKeyInternal(getTimeSeriesTableName(), value, entityFQN, extension, json, mysqlCond, psqlCond);
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
    return getExtensionByKeyInternal(getTimeSeriesTableName(), value, entityFQN, extension, mysqlCond, psqlCond);
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

  default String getLatestExtensionByKey(String key, String value, String entityFQN, String extension) {
    String mysqlCond = String.format("AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.%s')) = :value", key);
    String psqlCond = String.format("AND json->>'%s' = :value", key);
    return getLatestExtensionByKeyInternal(getTimeSeriesTableName(), value, entityFQN, extension, mysqlCond, psqlCond);
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
  @SqlQuery("SELECT DISTINCT entityFQN FROM <table> WHERE entityFQNHash = '' or entityFQNHash is null LIMIT :limit")
  @Deprecated(since = "1.1.1")
  List<String> migrationListDistinctWithOffset(@Define("table") String table, @Bind("limit") int limit);

  default List<String> migrationListDistinctWithOffset(int limit) {
    return migrationListDistinctWithOffset(getTimeSeriesTableName(), limit);
  }
}
