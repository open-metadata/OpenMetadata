/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.Relationship.CONTAINS;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.BindMap;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.jdbi.v3.sqlobject.statement.UseRowMapper;
import org.openmetadata.schema.analytics.WebAnalyticEvent;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindFQN;
import org.openmetadata.service.util.jdbi.BindJsonContains;
import org.openmetadata.service.util.jdbi.BindListFQN;

public interface TimeSeriesDAOs {
  @CreateSqlObject
  TestDefinitionDAO testDefinitionDAO();

  @CreateSqlObject
  TestSuiteDAO testSuiteDAO();

  @CreateSqlObject
  TestCaseDAO testCaseDAO();

  @CreateSqlObject
  WebAnalyticEventDAO webAnalyticEventDAO();

  @CreateSqlObject
  DataInsightCustomChartDAO dataInsightCustomChartDAO();

  @CreateSqlObject
  DataInsightChartDAO dataInsightChartDAO();

  @CreateSqlObject
  EntityExtensionTimeSeriesDAO entityExtensionTimeSeriesDao();

  @CreateSqlObject
  AppsDataStore appStoreDAO();

  @CreateSqlObject
  AppExtensionTimeSeries appExtensionTimeSeriesDao();

  @CreateSqlObject
  ReportDataTimeSeriesDAO reportDataTimeSeriesDao();

  @CreateSqlObject
  ProfilerDataTimeSeriesDAO profilerDataTimeSeriesDao();

  @CreateSqlObject
  DataQualityDataTimeSeriesDAO dataQualityDataTimeSeriesDao();

  @CreateSqlObject
  QueryCostTimeSeriesDAO queryCostRecordTimeSeriesDAO();

  @CreateSqlObject
  TestCaseResolutionStatusTimeSeriesDAO testCaseResolutionStatusTimeSeriesDao();

  @CreateSqlObject
  TestCaseResultTimeSeriesDAO testCaseResultTimeSeriesDao();

  @CreateSqlObject
  TestCaseDimensionResultTimeSeriesDAO testCaseDimensionResultTimeSeriesDao();

  interface TestDefinitionDAO extends EntityDAO<TestDefinition> {
    @Override
    default String getTableName() {
      return "test_definition";
    }

    @Override
    default Class<TestDefinition> getEntityClass() {
      return TestDefinition.class;
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String entityType = filter.getQueryParam("entityType");
      String testPlatform = filter.getQueryParam("testPlatform");
      String supportedDataType = filter.getQueryParam("supportedDataType");
      String supportedService = filter.getQueryParam("supportedService");
      String enabled = filter.getQueryParam("enabled");
      String condition = filter.getCondition();

      if (entityType == null
          && testPlatform == null
          && supportedDataType == null
          && supportedService == null
          && enabled == null) {
        return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
      }

      StringBuilder mysqlCondition = new StringBuilder();
      StringBuilder psqlCondition = new StringBuilder();

      mysqlCondition.append(String.format("%s ", condition));
      psqlCondition.append(String.format("%s ", condition));

      if (testPlatform != null) {
        filter.queryParams.put("testPlatformLike", String.format("%%%s%%", testPlatform));
        mysqlCondition.append("AND json_extract(json, '$.testPlatforms') LIKE :testPlatformLike ");
        psqlCondition.append("AND json->>'testPlatforms' LIKE :testPlatformLike ");
      }

      if (entityType != null) {
        mysqlCondition.append("AND entityType=:entityType ");
        psqlCondition.append("AND entityType=:entityType ");
      }

      if (supportedDataType != null) {
        filter.queryParams.put("supportedDataTypeExact", supportedDataType);
        mysqlCondition.append(
            "AND JSON_CONTAINS(json, JSON_QUOTE(:supportedDataTypeExact), '$.supportedDataTypes') ");
        psqlCondition.append(
            "AND json->'supportedDataTypes' @> to_jsonb(CAST(:supportedDataTypeExact AS TEXT)) ");
      }

      if (supportedService != null) {
        filter.queryParams.put("supportedServiceLike", String.format("%%%s%%", supportedService));
        mysqlCondition.append(
            "AND (json_extract(json, '$.supportedServices') = JSON_ARRAY() "
                + "OR json_extract(json, '$.supportedServices') IS NULL "
                + "OR json_extract(json, '$.supportedServices') LIKE :supportedServiceLike) ");
        psqlCondition.append(
            "AND (json->>'supportedServices' = '[]' "
                + "OR json->>'supportedServices' IS NULL "
                + "OR json->>'supportedServices' LIKE :supportedServiceLike) ");
      }

      if (enabled != null) {
        String enabledValue = Boolean.parseBoolean(enabled) ? "TRUE" : "FALSE";
        mysqlCondition.append("AND enabled=").append(enabledValue).append(" ");
        psqlCondition.append("AND enabled=").append(enabledValue).append(" ");
      }

      return listBefore(
          getTableName(),
          filter.getQueryParams(),
          mysqlCondition.toString(),
          psqlCondition.toString(),
          limit,
          beforeName,
          beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String entityType = filter.getQueryParam("entityType");
      String testPlatform = filter.getQueryParam("testPlatform");
      String supportedDataType = filter.getQueryParam("supportedDataType");
      String supportedService = filter.getQueryParam("supportedService");
      String enabled = filter.getQueryParam("enabled");
      String condition = filter.getCondition();

      if (entityType == null
          && testPlatform == null
          && supportedDataType == null
          && supportedService == null
          && enabled == null) {
        return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
      }

      StringBuilder mysqlCondition = new StringBuilder();
      StringBuilder psqlCondition = new StringBuilder();

      mysqlCondition.append(String.format("%s ", condition));
      psqlCondition.append(String.format("%s ", condition));

      if (testPlatform != null) {
        filter.queryParams.put("testPlatformLike", String.format("%%%s%%", testPlatform));
        mysqlCondition.append("AND json_extract(json, '$.testPlatforms') LIKE :testPlatformLike ");
        psqlCondition.append("AND json->>'testPlatforms' LIKE :testPlatformLike ");
      }

      if (entityType != null) {
        mysqlCondition.append("AND entityType = :entityType ");
        psqlCondition.append("AND entityType = :entityType ");
      }

      if (supportedDataType != null) {
        filter.queryParams.put("supportedDataTypeExact", supportedDataType);
        mysqlCondition.append(
            "AND JSON_CONTAINS(json, JSON_QUOTE(:supportedDataTypeExact), '$.supportedDataTypes') ");
        psqlCondition.append(
            "AND json->'supportedDataTypes' @> to_jsonb(CAST(:supportedDataTypeExact AS TEXT)) ");
      }

      if (supportedService != null) {
        filter.queryParams.put("supportedServiceLike", String.format("%%%s%%", supportedService));
        mysqlCondition.append(
            "AND (json_extract(json, '$.supportedServices') = JSON_ARRAY() "
                + "OR json_extract(json, '$.supportedServices') IS NULL "
                + "OR json_extract(json, '$.supportedServices') LIKE :supportedServiceLike) ");
        psqlCondition.append(
            "AND (json->>'supportedServices' = '[]' "
                + "OR json->>'supportedServices' IS NULL "
                + "OR json->>'supportedServices' LIKE :supportedServiceLike) ");
      }

      if (enabled != null) {
        String enabledValue = Boolean.parseBoolean(enabled) ? "TRUE" : "FALSE";
        mysqlCondition.append("AND enabled=").append(enabledValue).append(" ");
        psqlCondition.append("AND enabled=").append(enabledValue).append(" ");
      }

      return listAfter(
          getTableName(),
          filter.getQueryParams(),
          mysqlCondition.toString(),
          psqlCondition.toString(),
          limit,
          afterName,
          afterId);
    }

    @Override
    default int listCount(ListFilter filter) {
      String entityType = filter.getQueryParam("entityType");
      String testPlatform = filter.getQueryParam("testPlatform");
      String supportedDataType = filter.getQueryParam("supportedDataType");
      String supportedService = filter.getQueryParam("supportedService");
      String enabled = filter.getQueryParam("enabled");
      String condition = filter.getCondition();

      if (entityType == null
          && testPlatform == null
          && supportedDataType == null
          && supportedService == null
          && enabled == null) {
        return EntityDAO.super.listCount(filter);
      }

      StringBuilder mysqlCondition = new StringBuilder();
      StringBuilder psqlCondition = new StringBuilder();

      mysqlCondition.append(String.format("%s ", condition));
      psqlCondition.append(String.format("%s ", condition));

      if (testPlatform != null) {
        filter.queryParams.put("testPlatformLike", String.format("%%%s%%", testPlatform));
        mysqlCondition.append("AND json_extract(json, '$.testPlatforms') LIKE :testPlatformLike ");
        psqlCondition.append("AND json->>'testPlatforms' LIKE :testPlatformLike ");
      }

      if (entityType != null) {
        mysqlCondition.append("AND entityType=:entityType ");
        psqlCondition.append("AND entityType=:entityType ");
      }

      if (supportedDataType != null) {
        filter.queryParams.put("supportedDataTypeExact", supportedDataType);
        mysqlCondition.append(
            "AND JSON_CONTAINS(json, JSON_QUOTE(:supportedDataTypeExact), '$.supportedDataTypes') ");
        psqlCondition.append(
            "AND json->'supportedDataTypes' @> to_jsonb(CAST(:supportedDataTypeExact AS TEXT)) ");
      }

      if (supportedService != null) {
        filter.queryParams.put("supportedServiceLike", String.format("%%%s%%", supportedService));
        mysqlCondition.append(
            "AND (json_extract(json, '$.supportedServices') = JSON_ARRAY() "
                + "OR json_extract(json, '$.supportedServices') IS NULL "
                + "OR json_extract(json, '$.supportedServices') LIKE :supportedServiceLike) ");
        psqlCondition.append(
            "AND (json->>'supportedServices' = '[]' "
                + "OR json->>'supportedServices' IS NULL "
                + "OR json->>'supportedServices' LIKE :supportedServiceLike) ");
      }

      if (enabled != null) {
        String enabledValue = Boolean.parseBoolean(enabled) ? "TRUE" : "FALSE";
        mysqlCondition.append("AND enabled=").append(enabledValue).append(" ");
        psqlCondition.append("AND enabled=").append(enabledValue).append(" ");
      }

      return listCount(
          getTableName(),
          filter.getQueryParams(),
          getNameHashColumn(),
          mysqlCondition.toString(),
          psqlCondition.toString());
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT name, id, json FROM <table> <mysqlCond> AND "
                + "(<table>.name < :beforeName OR (<table>.name = :beforeName AND <table>.id < :beforeId))  "
                + "ORDER BY name DESC,id DESC  "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name,id",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT name, id, json FROM <table> <psqlCond> AND "
                + "(<table>.name < :beforeName OR (<table>.name = :beforeName AND <table>.id < :beforeId))  "
                + "ORDER BY name DESC,id DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name,id",
        connectionType = POSTGRES)
    List<String> listBefore(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("mysqlCond") String mysqlCond,
        @Define("psqlCond") String psqlCond,
        @Bind("limit") int limit,
        @Bind("beforeName") String beforeName,
        @Bind("beforeId") String beforeId);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM <table> <mysqlCond> AND (<table>.name > :afterName OR (<table>.name = :afterName AND <table>.id > :afterId))  ORDER BY name,id LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM <table> <psqlCond> AND (<table>.name > :afterName OR (<table>.name = :afterName AND <table>.id > :afterId))  ORDER BY name,id LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listAfter(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("mysqlCond") String mysqlCond,
        @Define("psqlCond") String psqlCond,
        @Bind("limit") int limit,
        @Bind("afterName") String afterName,
        @Bind("afterId") String afterId);

    @ConnectionAwareSqlQuery(
        value = "SELECT count(<nameHashColumn>) FROM <table> <mysqlCond>",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT count(*) FROM <table> <psqlCond>",
        connectionType = POSTGRES)
    int listCount(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("nameHashColumn") String nameHashColumn,
        @Define("mysqlCond") String mysqlCond,
        @Define("psqlCond") String psqlCond);
  }

  interface TestSuiteDAO extends EntityDAO<TestSuite> {
    @Override
    default String getTableName() {
      return "test_suite";
    }

    @Override
    default Class<TestSuite> getEntityClass() {
      return TestSuite.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default int listCount(ListFilter filter) {
      String mySqlCondition = filter.getCondition(getTableName());
      String postgresCondition = filter.getCondition(getTableName());
      boolean includeEmptyTestSuite =
          Boolean.parseBoolean(filter.getQueryParam("includeEmptyTestSuites"));
      if (!includeEmptyTestSuite) {
        String condition =
            String.format(
                "INNER JOIN entity_relationship er ON %s.id=er.fromId AND er.relation=%s AND er.toEntity='%s'",
                getTableName(), CONTAINS.ordinal(), Entity.TEST_CASE);
        mySqlCondition = condition;
        postgresCondition = condition;

        mySqlCondition =
            String.format("%s %s", mySqlCondition, filter.getCondition(getTableName()));
        postgresCondition =
            String.format("%s %s", postgresCondition, filter.getCondition(getTableName()));
      }
      return listCountDistinct(
          getTableName(),
          mySqlCondition,
          postgresCondition,
          String.format("%s.%s", getTableName(), getNameHashColumn()));
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String mySqlCondition = filter.getCondition(getTableName());
      String postgresCondition = filter.getCondition(getTableName());
      String groupBy = "";
      boolean includeEmptyTestSuite =
          Boolean.parseBoolean(filter.getQueryParam("includeEmptyTestSuites"));
      if (!includeEmptyTestSuite) {
        groupBy =
            String.format(
                "group by %s.json, %s.name, %s.id", getTableName(), getTableName(), getTableName());
        String condition =
            String.format(
                "INNER JOIN entity_relationship er ON %s.id=er.fromId AND er.relation=%s AND er.toEntity='%s'",
                getTableName(), CONTAINS.ordinal(), Entity.TEST_CASE);
        mySqlCondition = condition;
        postgresCondition = condition;
        mySqlCondition =
            String.format("%s %s", mySqlCondition, filter.getCondition(getTableName()));
        postgresCondition =
            String.format("%s %s", postgresCondition, filter.getCondition(getTableName()));
      }
      return listBefore(
          getTableName(), mySqlCondition, postgresCondition, limit, beforeName, beforeId, groupBy);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String mySqlCondition = filter.getCondition(getTableName());
      String postgresCondition = filter.getCondition(getTableName());
      String groupBy = "";
      boolean includeEmptyTestSuite =
          Boolean.parseBoolean(filter.getQueryParam("includeEmptyTestSuites"));
      if (!includeEmptyTestSuite) {
        groupBy =
            String.format(
                "group by %s.json, %s.name, %s.id", getTableName(), getTableName(), getTableName());
        String condition =
            String.format(
                "INNER JOIN entity_relationship er ON %s.id=er.fromId AND er.relation=%s AND er.toEntity='%s'",
                getTableName(), CONTAINS.ordinal(), Entity.TEST_CASE);
        mySqlCondition = condition;
        postgresCondition = condition;

        mySqlCondition =
            String.format("%s %s", mySqlCondition, filter.getCondition(getTableName()));
        postgresCondition =
            String.format("%s %s", postgresCondition, filter.getCondition(getTableName()));
      }
      return listAfter(
          getTableName(), mySqlCondition, postgresCondition, limit, afterName, afterId, groupBy);
    }

    @SqlQuery(
        "SELECT json FROM <table> tn\n"
            + "INNER JOIN (SELECT DISTINCT fromId FROM entity_relationship er\n"
            + "<cond> AND toEntity = 'testSuite' and fromEntity = :entityType) er ON fromId = tn.id\n"
            + "LIMIT :limit OFFSET :offset;")
    List<String> listEntitiesWithTestSuite(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("cond") String cond,
        @Bind("entityType") String entityType,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    default List<String> listEntitiesWithTestsuite(
        ListFilter filter, String table, String entityType, int limit, int offset) {
      return listEntitiesWithTestSuite(
          table, filter.getQueryParams(), filter.getCondition(), entityType, limit, offset);
    }

    @SqlQuery(
        "SELECT COUNT(DISTINCT fromId) FROM entity_relationship er\n"
            + "<cond> AND toEntity = 'testSuite' and fromEntity = :entityType;")
    Integer countEntitiesWithTestSuite(
        @BindMap Map<String, ?> params,
        @Define("cond") String cond,
        @Bind("entityType") String entityType);

    default Integer countEntitiesWithTestsuite(ListFilter filter, String entityType) {
      return countEntitiesWithTestSuite(filter.getQueryParams(), filter.getCondition(), entityType);
    }
  }

  interface TestCaseDAO extends EntityDAO<TestCase> {
    @Override
    default String getTableName() {
      return "test_case";
    }

    @Override
    default Class<TestCase> getEntityClass() {
      return TestCase.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    default int countOfTestCases(List<UUID> testCaseIds) {
      return countOfTestCases(getTableName(), testCaseIds.stream().map(Object::toString).toList());
    }

    @SqlQuery("SELECT count(*) FROM <table> WHERE id IN (<testCaseIds>)")
    int countOfTestCases(
        @Define("table") String table, @BindList("testCaseIds") List<String> testCaseIds);

    /**
     * Returns ids of test cases whose entityFQN equals {@code entityFQN} (table-level tests) or
     * starts with {@code entityFQNPrefix} (column-level tests). The prefix must already have LIKE
     * metacharacters escaped — callers should route through
     * {@link org.openmetadata.service.util.LikeEscape#escape(String)} and append {@code ".%"}.
     * Uses {@code ESCAPE '!'} to match the convention used elsewhere in this DAO; backslash is
     * unsafe (MySQL treats it as a string-literal escape and JDBI's ColonPrefixSqlParser
     * mishandles literal {@code '\'} inside single-quoted SQL strings).
     */
    @SqlQuery(
        "SELECT id FROM test_case WHERE entityFQN = :entityFQN "
            + "OR entityFQN LIKE :entityFQNPrefix ESCAPE '!'")
    List<String> findIdsByEntityFQN(
        @Bind("entityFQN") String entityFQN, @Bind("entityFQNPrefix") String entityFQNPrefix);

    class TestCaseRecord {
      @Getter String json;
      @Getter Integer rank;

      public TestCaseRecord(String json, Integer rank) {
        this.json = json;
        this.rank = rank;
      }
    }

    class TestCaseRecordMapper implements RowMapper<TestCaseRecord> {
      @Override
      public TestCaseRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new TestCaseRecord(rs.getString("json"), rs.getInt("ranked"));
      }
    }
  }

  interface WebAnalyticEventDAO extends EntityDAO<WebAnalyticEvent> {
    @Override
    default String getTableName() {
      return "web_analytic_event";
    }

    @Override
    default Class<WebAnalyticEvent> getEntityClass() {
      return WebAnalyticEvent.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface DataInsightCustomChartDAO extends EntityDAO<DataInsightCustomChart> {
    @Override
    default String getTableName() {
      return "di_chart_entity";
    }

    @Override
    default Class<DataInsightCustomChart> getEntityClass() {
      return DataInsightCustomChart.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface DataInsightChartDAO extends EntityDAO<DataInsightChart> {
    @Override
    default String getTableName() {
      return "data_insight_chart";
    }

    @Override
    default Class<DataInsightChart> getEntityClass() {
      return DataInsightChart.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface EntityExtensionTimeSeriesDAO extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "entity_extension_time_series";
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT "
                + "  DATE(FROM_UNIXTIME(eets.timestamp / 1000)) as date_key, "
                + "  JSON_UNQUOTE(JSON_EXTRACT(eets.json, '$.executionStatus')) as status, "
                + "  COUNT(*) as count "
                + "FROM entity_extension_time_series eets "
                + "INNER JOIN pipeline_entity pe ON eets.entityFQNHash = pe.fqnHash "
                + "WHERE eets.extension = 'pipeline.pipelineStatus' "
                + "  AND pe.deleted = 0 "
                + "  AND eets.timestamp >= :startTs "
                + "  AND eets.timestamp <= :endTs "
                + "  <pipelineFqnFilter> "
                + "  <serviceTypeFilter> "
                + "  <serviceFilter> "
                + "  <mysqlStatusFilter> "
                + "  <domainFilter> "
                + "  <ownerFilter> "
                + "  <tierFilter> "
                + "GROUP BY date_key, status "
                + "ORDER BY date_key ASC",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT "
                + "  DATE(TO_TIMESTAMP(eets.timestamp / 1000)) as date_key, "
                + "  eets.json->>'executionStatus' as status, "
                + "  COUNT(*) as count "
                + "FROM entity_extension_time_series eets "
                + "INNER JOIN pipeline_entity pe ON eets.entityFQNHash = pe.fqnHash "
                + "WHERE eets.extension = 'pipeline.pipelineStatus' "
                + "  AND pe.deleted = false "
                + "  AND eets.timestamp >= :startTs "
                + "  AND eets.timestamp <= :endTs "
                + "  <pipelineFqnFilter> "
                + "  <serviceTypeFilter> "
                + "  <serviceFilter> "
                + "  <postgresStatusFilter> "
                + "  <domainFilter> "
                + "  <ownerFilter> "
                + "  <tierFilter> "
                + "GROUP BY date_key, status "
                + "ORDER BY date_key ASC",
        connectionType = POSTGRES)
    @RegisterRowMapper(CollectionDAO.ExecutionTrendRowMapper.class)
    List<CollectionDAO.ExecutionTrendRow> getExecutionTrendData(
        @Bind("startTs") Long startTs,
        @Bind("endTs") Long endTs,
        @Define("pipelineFqnFilter") String pipelineFqnFilter,
        @Define("serviceTypeFilter") String serviceTypeFilter,
        @Define("serviceFilter") String serviceFilter,
        @Define("mysqlStatusFilter") String mysqlStatusFilter,
        @Define("postgresStatusFilter") String postgresStatusFilter,
        @Define("domainFilter") String domainFilter,
        @Define("ownerFilter") String ownerFilter,
        @Define("tierFilter") String tierFilter);

    @ConnectionAwareSqlQuery(
        value =
            "WITH runtime_calc AS ( "
                + "  SELECT "
                + "    eets.*, "
                + "    pe.fqnHash, "
                + "    CASE "
                + "      WHEN JSON_LENGTH(JSON_EXTRACT(eets.json, '$.taskStatus')) > 0 "
                + "        AND JSON_EXTRACT(eets.json, '$.taskStatus[0].endTime') IS NOT NULL THEN "
                + "        ( "
                + "          SELECT MAX(CAST(JSON_EXTRACT(task.value, '$.endTime') AS UNSIGNED)) "
                + "          FROM JSON_TABLE(eets.json, '$.taskStatus[*]' COLUMNS(value JSON PATH '$')) AS task "
                + "          WHERE JSON_EXTRACT(task.value, '$.endTime') IS NOT NULL "
                + "        ) - ( "
                + "          SELECT MIN(CAST(JSON_EXTRACT(task.value, '$.startTime') AS UNSIGNED)) "
                + "          FROM JSON_TABLE(eets.json, '$.taskStatus[*]' COLUMNS(value JSON PATH '$')) AS task "
                + "          WHERE JSON_EXTRACT(task.value, '$.startTime') IS NOT NULL "
                + "        ) "
                + "      WHEN JSON_EXTRACT(eets.json, '$.endTime') IS NOT NULL THEN "
                + "        JSON_EXTRACT(eets.json, '$.endTime') - eets.timestamp "
                + "      ELSE NULL "
                + "    END AS runtime "
                + "  FROM entity_extension_time_series eets "
                + "  INNER JOIN pipeline_entity pe ON eets.entityFQNHash = pe.fqnHash "
                + "  WHERE eets.extension = 'pipeline.pipelineStatus' "
                + "    AND pe.deleted = 0 "
                + "    AND eets.timestamp >= :startTs "
                + "    AND eets.timestamp <= :endTs "
                + "    <pipelineFqnFilter> "
                + "    <serviceTypeFilter> "
                + "    <serviceFilter> "
                + "    <mysqlStatusFilter> "
                + "    <domainFilter> "
                + "    <ownerFilter> "
                + "    <tierFilter> "
                + ") "
                + "SELECT "
                + "  DATE(FROM_UNIXTIME(timestamp / 1000)) as date_key, "
                + "  MIN(timestamp) as first_timestamp, "
                + "  MAX(runtime) as max_runtime, "
                + "  MIN(runtime) as min_runtime, "
                + "  AVG(runtime) as avg_runtime, "
                + "  COUNT(DISTINCT fqnHash) as total_pipelines "
                + "FROM runtime_calc "
                + "WHERE runtime IS NOT NULL "
                + "GROUP BY date_key "
                + "ORDER BY date_key ASC",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "WITH runtime_calc AS ( "
                + "  SELECT "
                + "    eets.timestamp, "
                + "    eets.json, "
                + "    pe.fqnHash, "
                + "    CASE "
                + "      WHEN jsonb_array_length(COALESCE(eets.json->'taskStatus', '[]'::jsonb)) > 0 "
                + "        AND EXISTS ( "
                + "          SELECT 1 FROM jsonb_array_elements(eets.json->'taskStatus') AS task "
                + "          WHERE task->>'endTime' IS NOT NULL "
                + "        ) THEN "
                + "        ( "
                + "          SELECT MAX((task->>'endTime')::bigint) "
                + "          FROM jsonb_array_elements(eets.json->'taskStatus') AS task "
                + "          WHERE task->>'endTime' IS NOT NULL "
                + "        ) - ( "
                + "          SELECT MIN((task->>'startTime')::bigint) "
                + "          FROM jsonb_array_elements(eets.json->'taskStatus') AS task "
                + "          WHERE task->>'startTime' IS NOT NULL "
                + "        ) "
                + "      WHEN eets.json->>'endTime' IS NOT NULL THEN "
                + "        (eets.json->>'endTime')::bigint - eets.timestamp "
                + "      ELSE NULL "
                + "    END AS runtime "
                + "  FROM entity_extension_time_series eets "
                + "  INNER JOIN pipeline_entity pe ON eets.entityFQNHash = pe.fqnHash "
                + "  WHERE eets.extension = 'pipeline.pipelineStatus' "
                + "    AND pe.deleted = false "
                + "    AND eets.timestamp >= :startTs "
                + "    AND eets.timestamp <= :endTs "
                + "    <pipelineFqnFilter> "
                + "    <serviceTypeFilter> "
                + "    <serviceFilter> "
                + "    <postgresStatusFilter> "
                + "    <domainFilter> "
                + "    <ownerFilter> "
                + "    <tierFilter> "
                + ") "
                + "SELECT "
                + "  DATE(TO_TIMESTAMP(timestamp / 1000)) as date_key, "
                + "  MIN(timestamp) as first_timestamp, "
                + "  MAX(runtime) as max_runtime, "
                + "  MIN(runtime) as min_runtime, "
                + "  AVG(runtime) as avg_runtime, "
                + "  COUNT(DISTINCT fqnHash) as total_pipelines "
                + "FROM runtime_calc "
                + "WHERE runtime IS NOT NULL "
                + "GROUP BY date_key "
                + "ORDER BY date_key ASC",
        connectionType = POSTGRES)
    @RegisterRowMapper(CollectionDAO.RuntimeTrendRowMapper.class)
    List<CollectionDAO.RuntimeTrendRow> getRuntimeTrendData(
        @Bind("startTs") Long startTs,
        @Bind("endTs") Long endTs,
        @Define("pipelineFqnFilter") String pipelineFqnFilter,
        @Define("serviceTypeFilter") String serviceTypeFilter,
        @Define("serviceFilter") String serviceFilter,
        @Define("mysqlStatusFilter") String mysqlStatusFilter,
        @Define("postgresStatusFilter") String postgresStatusFilter,
        @Define("domainFilter") String domainFilter,
        @Define("ownerFilter") String ownerFilter,
        @Define("tierFilter") String tierFilter);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT "
                + "  JSON_UNQUOTE(JSON_EXTRACT(pe.json, '$.serviceType')) as service_type, "
                + "  COUNT(*) as pipeline_count "
                + "FROM pipeline_entity pe "
                + "LEFT JOIN entity_extension_time_series eets "
                + "  ON pe.fqnHash = eets.entityFQNHash "
                + "  AND eets.extension = 'pipeline.pipelineStatus' "
                + "WHERE pe.deleted = 0 "
                + "  <serviceTypeFilter> "
                + "  <serviceFilter> "
                + "  <mysqlStatusFilter> "
                + "  <domainFilter> "
                + "  <ownerFilter> "
                + "  <tierFilter> "
                + "  <startTsFilter> "
                + "  <endTsFilter> "
                + "GROUP BY service_type",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT "
                + "  pe.json->>'serviceType' as service_type, "
                + "  COUNT(*) as pipeline_count "
                + "FROM pipeline_entity pe "
                + "LEFT JOIN entity_extension_time_series eets "
                + "  ON pe.fqnHash = eets.entityFQNHash "
                + "  AND eets.extension = 'pipeline.pipelineStatus' "
                + "WHERE pe.deleted = false "
                + "  <serviceTypeFilter> "
                + "  <serviceFilter> "
                + "  <postgresStatusFilter> "
                + "  <domainFilter> "
                + "  <ownerFilter> "
                + "  <tierFilter> "
                + "  <startTsFilter> "
                + "  <endTsFilter> "
                + "GROUP BY service_type",
        connectionType = POSTGRES)
    @RegisterRowMapper(CollectionDAO.ServiceBreakdownRowMapper.class)
    List<CollectionDAO.ServiceBreakdownRow> getServiceBreakdown(
        @Define("serviceTypeFilter") String serviceTypeFilter,
        @Define("serviceFilter") String serviceFilter,
        @Define("mysqlStatusFilter") String mysqlStatusFilter,
        @Define("postgresStatusFilter") String postgresStatusFilter,
        @Define("domainFilter") String domainFilter,
        @Define("ownerFilter") String ownerFilter,
        @Define("tierFilter") String tierFilter,
        @Define("startTsFilter") String startTsFilter,
        @Define("endTsFilter") String endTsFilter);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT "
                + "  COUNT(DISTINCT pe.fqnHash) as total_pipelines, "
                + "  COUNT(DISTINCT CASE WHEN eets.entityFQNHash IS NOT NULL THEN pe.fqnHash END) as active_pipelines, "
                + "  COUNT(DISTINCT CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(eets.json, '$.executionStatus')) = 'Successful' THEN pe.fqnHash END) as successful_pipelines, "
                + "  COUNT(DISTINCT CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(eets.json, '$.executionStatus')) = 'Failed' THEN pe.fqnHash END) as failed_pipelines "
                + "FROM pipeline_entity pe "
                + "LEFT JOIN entity_extension_time_series eets "
                + "  ON pe.fqnHash = eets.entityFQNHash "
                + "  AND eets.extension = 'pipeline.pipelineStatus' "
                + "WHERE pe.deleted = 0 "
                + "  <serviceTypeFilter> "
                + "  <serviceFilter> "
                + "  <mysqlStatusFilter> "
                + "  <domainFilter> "
                + "  <ownerFilter> "
                + "  <tierFilter> "
                + "  <startTsFilter> "
                + "  <endTsFilter>",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT "
                + "  COUNT(DISTINCT pe.fqnHash) as total_pipelines, "
                + "  COUNT(DISTINCT CASE WHEN eets.entityFQNHash IS NOT NULL THEN pe.fqnHash END) as active_pipelines, "
                + "  COUNT(DISTINCT CASE WHEN eets.json->>'executionStatus' = 'Successful' THEN pe.fqnHash END) as successful_pipelines, "
                + "  COUNT(DISTINCT CASE WHEN eets.json->>'executionStatus' = 'Failed' THEN pe.fqnHash END) as failed_pipelines "
                + "FROM pipeline_entity pe "
                + "LEFT JOIN entity_extension_time_series eets "
                + "  ON pe.fqnHash = eets.entityFQNHash "
                + "  AND eets.extension = 'pipeline.pipelineStatus' "
                + "WHERE pe.deleted = false "
                + "  <serviceTypeFilter> "
                + "  <serviceFilter> "
                + "  <postgresStatusFilter> "
                + "  <domainFilter> "
                + "  <ownerFilter> "
                + "  <tierFilter> "
                + "  <startTsFilter> "
                + "  <endTsFilter>",
        connectionType = POSTGRES)
    @RegisterRowMapper(CollectionDAO.PipelineMetricsRowMapper.class)
    CollectionDAO.PipelineMetricsRow getPipelineMetricsData(
        @Define("serviceTypeFilter") String serviceTypeFilter,
        @Define("serviceFilter") String serviceFilter,
        @Define("mysqlStatusFilter") String mysqlStatusFilter,
        @Define("postgresStatusFilter") String postgresStatusFilter,
        @Define("domainFilter") String domainFilter,
        @Define("ownerFilter") String ownerFilter,
        @Define("tierFilter") String tierFilter,
        @Define("startTsFilter") String startTsFilter,
        @Define("endTsFilter") String endTsFilter);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT pe.id, pe.json, "
                + "(SELECT eets_inner.json FROM entity_extension_time_series eets_inner "
                + " WHERE eets_inner.entityFQNHash = pe.fqnHash "
                + " AND eets_inner.extension = 'pipeline.pipelineStatus' "
                + " ORDER BY eets_inner.timestamp DESC LIMIT 1) as latest_status "
                + "FROM pipeline_entity pe "
                + "WHERE pe.deleted = 0 "
                + "  <serviceFilter> "
                + "  <mysqlServiceTypeFilter> "
                + "  <domainFilter> "
                + "  <ownerFilter> "
                + "  <tierFilter> "
                + "  AND (:search IS NULL OR pe.name LIKE CONCAT('%', :search, '%') OR JSON_UNQUOTE(JSON_EXTRACT(pe.json, '$.fullyQualifiedName')) LIKE CONCAT('%', :search, '%')) "
                + "  <mysqlStatusFilter> "
                + "ORDER BY pe.name "
                + "LIMIT :limit OFFSET :offset",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT pe.id, pe.json, "
                + "(SELECT eets_inner.json FROM entity_extension_time_series eets_inner "
                + " WHERE eets_inner.entityFQNHash = pe.fqnHash "
                + " AND eets_inner.extension = 'pipeline.pipelineStatus' "
                + " ORDER BY eets_inner.timestamp DESC LIMIT 1) as latest_status "
                + "FROM pipeline_entity pe "
                + "WHERE pe.deleted = false "
                + "  <serviceFilter> "
                + "  <postgresServiceTypeFilter> "
                + "  <domainFilter> "
                + "  <ownerFilter> "
                + "  <tierFilter> "
                + "  AND (:search IS NULL OR pe.name LIKE '%' || :search || '%' OR pe.json->>'fullyQualifiedName' LIKE '%' || :search || '%') "
                + "  <postgresStatusFilter> "
                + "ORDER BY pe.name "
                + "LIMIT :limit OFFSET :offset",
        connectionType = POSTGRES)
    @RegisterRowMapper(CollectionDAO.PipelineSummaryRowMapper.class)
    List<CollectionDAO.PipelineSummaryRow> listPipelineSummariesFiltered(
        @Define("serviceFilter") String serviceFilter,
        @Define("mysqlServiceTypeFilter") String mysqlServiceTypeFilter,
        @Define("postgresServiceTypeFilter") String postgresServiceTypeFilter,
        @Define("domainFilter") String domainFilter,
        @Define("ownerFilter") String ownerFilter,
        @Define("tierFilter") String tierFilter,
        @Define("mysqlStatusFilter") String mysqlStatusFilter,
        @Define("postgresStatusFilter") String postgresStatusFilter,
        @Bind("search") String search,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(DISTINCT pe.id) "
                + "FROM pipeline_entity pe "
                + "WHERE pe.deleted = 0 "
                + "  <serviceFilter> "
                + "  <mysqlServiceTypeFilter> "
                + "  <domainFilter> "
                + "  <ownerFilter> "
                + "  <tierFilter> "
                + "  AND (:search IS NULL OR pe.name LIKE CONCAT('%', :search, '%') OR JSON_UNQUOTE(JSON_EXTRACT(pe.json, '$.fullyQualifiedName')) LIKE CONCAT('%', :search, '%')) "
                + "  <mysqlStatusFilter>",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(DISTINCT pe.id) "
                + "FROM pipeline_entity pe "
                + "WHERE pe.deleted = false "
                + "  <serviceFilter> "
                + "  <postgresServiceTypeFilter> "
                + "  <domainFilter> "
                + "  <ownerFilter> "
                + "  <tierFilter> "
                + "  AND (:search IS NULL OR pe.name LIKE '%' || :search || '%' OR pe.json->>'fullyQualifiedName' LIKE '%' || :search || '%') "
                + "  <postgresStatusFilter>",
        connectionType = POSTGRES)
    int countPipelineSummariesFiltered(
        @Define("serviceFilter") String serviceFilter,
        @Define("mysqlServiceTypeFilter") String mysqlServiceTypeFilter,
        @Define("postgresServiceTypeFilter") String postgresServiceTypeFilter,
        @Define("domainFilter") String domainFilter,
        @Define("ownerFilter") String ownerFilter,
        @Define("tierFilter") String tierFilter,
        @Define("mysqlStatusFilter") String mysqlStatusFilter,
        @Define("postgresStatusFilter") String postgresStatusFilter,
        @Bind("search") String search);
  }

  interface AppsDataStore {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO apps_data_store(identifier, type, json) VALUES (:identifier, :type, :json) ON DUPLICATE KEY UPDATE json = VALUES(json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO apps_data_store(identifier, type, json) VALUES (:identifier, :type, :json :: jsonb) ON CONFLICT (identifier, type) DO UPDATE SET json = EXCLUDED.json",
        connectionType = POSTGRES)
    void insert(
        @Bind("identifier") String identifier,
        @Bind("type") String type,
        @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_data_store set json = :json where identifier = :identifier AND type=:type",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_data_store set json = (:json :: jsonb) where identifier = :identifier AND type=:type",
        connectionType = POSTGRES)
    void update(
        @Bind("identifier") String identifier,
        @Bind("type") String type,
        @Bind("json") String json);

    @SqlUpdate("DELETE FROM apps_data_store WHERE identifier = :identifier AND type = :type")
    void delete(@Bind("identifier") String identifier, @Bind("type") String type);

    @SqlQuery(
        "SELECT count(*) FROM apps_data_store where identifier = :identifier AND type = :type")
    int listAppDataCount(@Bind("identifier") String identifier, @Bind("type") String type);

    @SqlQuery(
        "SELECT json FROM apps_data_store where identifier in (<identifier>) AND type = :type")
    List<String> listAppsDataWithIds(
        @BindList("identifier") List<String> identifier, @Bind("type") String type);

    @SqlQuery("SELECT json FROM apps_data_store where type = :type")
    List<String> listAppsDataWithType(@Bind("type") String type);

    @SqlQuery("SELECT json FROM apps_data_store where identifier = :identifier AND type = :type")
    String findAppData(@Bind("identifier") String identifier, @Bind("type") String type);
  }

  interface AppExtensionTimeSeries {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO apps_extension_time_series(json, extension) VALUES (:json, :extension)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO apps_extension_time_series(json, extension) VALUES (:json :: jsonb, :extension)",
        connectionType = POSTGRES)
    void insert(@Bind("json") String json, @Bind("extension") String extension);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series SET json = JSON_SET(json, '$.status', 'stopped') where appId=:appId AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.status')) = 'running' AND extension = 'status'",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series SET json = jsonb_set(json, '{status}', '\"stopped\"') WHERE appId = :appId AND json->>'status' = 'running' AND extension = 'status'",
        connectionType = POSTGRES)
    void markStaleEntriesStopped(@Bind("appId") String appId);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series SET json = JSON_SET(json, '$.status', 'stopped') WHERE appName=:appName AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.status')) = 'running' AND extension = 'status'",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series SET json = jsonb_set(json, '{status}', '\"stopped\"') WHERE appName = :appName AND json->>'status' = 'running' AND extension = 'status'",
        connectionType = POSTGRES)
    void markStaleEntriesStoppedByName(@Bind("appName") String appName);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series SET json = JSON_SET(json, '$.status', 'stopped') WHERE appName=:appName AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.status')) = 'running' AND extension = 'status' AND timestamp < :beforeTimestamp",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series SET json = jsonb_set(json, '{status}', '\"stopped\"') WHERE appName = :appName AND json->>'status' = 'running' AND extension = 'status' AND timestamp < :beforeTimestamp",
        connectionType = POSTGRES)
    void markStaleEntriesStoppedBefore(
        @Bind("appName") String appName, @Bind("beforeTimestamp") long beforeTimestamp);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series SET json = JSON_SET(json, '$.status', 'failed') WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.status')) = 'running' AND extension = 'status'",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series SET json = jsonb_set(json, '{status}', '\"failed\"') WHERE json->>'status' = 'running' AND extension = 'status'",
        connectionType = POSTGRES)
    void markAllStaleEntriesFailed();

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series SET json = JSON_SET(json, '$.status', 'failed') WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.status')) = 'running' AND extension = 'status' AND appName != :appName",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series SET json = jsonb_set(json, '{status}', '\"failed\"') WHERE json->>'status' = 'running' AND extension = 'status' AND appName != :appName",
        connectionType = POSTGRES)
    void markAllStaleEntriesFailedExcludingApp(@Bind("appName") String appName);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series SET json = JSON_SET(json, '$.status', 'failed') WHERE appName=:appName AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.status')) = 'running' AND extension = 'status'",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series SET json = jsonb_set(json, '{status}', '\"failed\"') WHERE appName = :appName AND json->>'status' = 'running' AND extension = 'status'",
        connectionType = POSTGRES)
    void markRunningEntriesFailedByName(@Bind("appName") String appName);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series SET json = JSON_SET(json, '$.status', 'running') WHERE appId = :appId AND extension = 'status' AND timestamp = :timestamp",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series SET json = jsonb_set(json, '{status}', '\"running\"') WHERE appId = :appId AND extension = 'status' AND timestamp = :timestamp",
        connectionType = POSTGRES)
    void markEntryRunning(@Bind("appId") String appId, @Bind("timestamp") long timestamp);

    @SqlQuery(
        "SELECT json FROM apps_extension_time_series WHERE appId = :appId AND extension = :extension AND timestamp = :timestamp")
    String getByAppIdAndTimestamp(
        @Bind("appId") String appId,
        @Bind("timestamp") long timestamp,
        @Bind("extension") String extension);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series set json = :json where appId=:appId and timestamp=:timestamp and extension=:extension",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE apps_extension_time_series set json = (:json :: jsonb) where appId=:appId and timestamp=:timestamp and extension=:extension",
        connectionType = POSTGRES)
    void update(
        @Bind("appId") String appId,
        @Bind("json") String json,
        @Bind("timestamp") Long timestamp,
        @Bind("extension") String extension);

    @SqlUpdate(
        "DELETE FROM apps_extension_time_series WHERE appId = :appId AND extension = :extension")
    void delete(@Bind("appId") String appId, @Bind("extension") String extension);

    @SqlUpdate("DELETE FROM apps_extension_time_series WHERE appId = :appId")
    void deleteAllByAppId(@Bind("appId") String appId);

    @SqlQuery(
        "SELECT count(*) FROM apps_extension_time_series where appId = :appId and extension = :extension AND <service_filter>")
    int listAppExtensionCount(
        @Bind("appId") String appId,
        @Bind("extension") String extension,
        @BindJsonContains(value = "service_filter", path = "$.services", property = "id")
            UUID service);

    @SqlQuery(
        "SELECT count(*) FROM apps_extension_time_series where appId = :appId and extension = :extension AND timestamp > :startTime AND <service_filter>")
    int listAppExtensionCountAfterTime(
        @Bind("appId") String appId,
        @Bind("startTime") long startTime,
        @Bind("extension") String extension,
        @BindJsonContains(
                value = "service_filter",
                path = "$.services",
                property = "id",
                ifNull = "TRUE")
            UUID service);

    @SqlQuery(
        "SELECT json FROM apps_extension_time_series where appId = :appId AND extension = :extension AND <service_filter> ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
    List<String> listAppExtension(
        @Bind("appId") String appId,
        @Bind("limit") int limit,
        @Bind("offset") int offset,
        @Bind("extension") String extension,
        @BindJsonContains(
                value = "service_filter",
                path = "$.services",
                property = "id",
                ifNull = "TRUE")
            UUID service);

    @SqlQuery(
        "SELECT json FROM apps_extension_time_series where appId = :appId AND extension = :extension AND timestamp > :startTime AND <service_filter> ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
    List<String> listAppExtensionAfterTime(
        @Bind("appId") String appId,
        @Bind("limit") int limit,
        @Bind("offset") int offset,
        @Bind("startTime") long startTime,
        @Bind("extension") String extension,
        @BindJsonContains(
                value = "service_filter",
                path = "$.services",
                property = "id",
                ifNull = "TRUE")
            UUID service);

    // Prepare methods to get extension by name instead of ID
    // For example, for limits we need to fetch by app name to ensure if we reinstall the app,
    // they'll still be taken into account
    @SqlQuery(
        "SELECT count(*) FROM apps_extension_time_series where appName = :appName and extension = :extension")
    int listAppExtensionCountByName(
        @Bind("appName") String appName, @Bind("extension") String extension);

    @SqlQuery(
        "SELECT count(*) FROM apps_extension_time_series where appName = :appName and extension = :extension AND timestamp > :startTime")
    int listAppExtensionCountAfterTimeByName(
        @Bind("appName") String appName,
        @Bind("startTime") long startTime,
        @Bind("extension") String extension);

    @SqlQuery(
        "SELECT json FROM apps_extension_time_series where appName = :appName AND extension = :extension ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
    List<String> listAppExtensionByName(
        @Bind("appName") String appName,
        @Bind("limit") int limit,
        @Bind("offset") int offset,
        @Bind("extension") String extension);

    @SqlQuery(
        "SELECT json FROM apps_extension_time_series where appName = :appName AND extension = :extension AND timestamp > :startTime ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
    List<String> listAppExtensionAfterTimeByName(
        @Bind("appName") String appName,
        @Bind("limit") int limit,
        @Bind("offset") int offset,
        @Bind("startTime") long startTime,
        @Bind("extension") String extension);

    @SqlQuery(
        "SELECT json FROM apps_extension_time_series where appName = :appName AND extension = :extension AND timestamp >= :startTime AND timestamp < :endTime ORDER BY timestamp ASC LIMIT :limit OFFSET :offset")
    List<String> listAppExtensionInWindowByName(
        @Bind("appName") String appName,
        @Bind("limit") int limit,
        @Bind("offset") int offset,
        @Bind("startTime") long startTime,
        @Bind("endTime") long endTime,
        @Bind("extension") String extension);

    default List<String> listAppExtensionAfterTime(
        String appId, int limit, int offset, long startTime, String extension) {
      return listAppExtensionAfterTime(appId, limit, offset, startTime, extension, null);
    }

    default int listAppExtensionCountAfterTime(String appName, long startTime, String extension) {
      return listAppExtensionCountAfterTime(appName, startTime, extension, null);
    }

    default List<String> listAppExtension(String appName, int limit, int offset, String extension) {
      return listAppExtension(appName, limit, offset, extension, null);
    }
  }

  interface ReportDataTimeSeriesDAO extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "report_data_time_series";
    }

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM report_data_time_series WHERE entityFQNHash = :reportDataType and date = :date",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM report_data_time_series WHERE entityFQNHash = :reportDataType and DATE(TO_TIMESTAMP((json ->> 'timestamp')::bigint/1000)) = DATE(:date)",
        connectionType = POSTGRES)
    void deleteReportDataTypeAtDate(
        @BindFQN("reportDataType") String reportDataType, @Bind("date") String date);

    @SqlUpdate("DELETE FROM report_data_time_series WHERE entityFQNHash = :reportDataType")
    void deletePreviousReportData(@BindFQN("reportDataType") String reportDataType);
  }

  interface ProfilerDataTimeSeriesDAO extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "profiler_data_time_series";
    }

    @SqlQuery(
        "SELECT p.entityFQNHash, p.json "
            + "FROM <table> p "
            + "JOIN ("
            + "  SELECT entityFQNHash, MAX(timestamp) AS latestTs "
            + "  FROM <table> "
            + "  WHERE entityFQNHash IN (<entityFQNHashes>) AND extension = :extension "
            + "  GROUP BY entityFQNHash"
            + ") latest "
            + "ON p.entityFQNHash = latest.entityFQNHash AND p.timestamp = latest.latestTs "
            + "WHERE p.extension = :extension "
            + "AND p.entityFQNHash IN (<entityFQNHashes>)")
    @RegisterRowMapper(LatestExtensionRecordMapper.class)
    List<LatestExtensionRecord> getLatestExtensionsBatch(
        @Define("table") String table,
        @BindListFQN("entityFQNHashes") List<String> entityFQNHashes,
        @Bind("extension") String extension);

    default List<LatestExtensionRecord> getLatestExtensionsBatch(
        List<String> entityFQNHashes, String extension) {
      if (entityFQNHashes == null || entityFQNHashes.isEmpty()) {
        return Collections.emptyList();
      }
      return getLatestExtensionsBatch(getTimeSeriesTableName(), entityFQNHashes, extension);
    }

    @SqlQuery(
        "SELECT json FROM <table> <cond> "
            + "AND timestamp >= :startTs and timestamp <= :endTs ORDER BY timestamp DESC")
    List<String> listEntityProfileAtTimestamp(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("cond") String cond,
        @Bind("startTs") Long startTs,
        @Bind("endTs") Long endTs);

    default List<String> listEntityProfileData(ListFilter filter, Long startTs, Long endTs) {
      return listEntityProfileAtTimestamp(
          getTimeSeriesTableName(), filter.getQueryParams(), filter.getCondition(), startTs, endTs);
    }

    @SqlUpdate("DELETE FROM <table> <cond> AND timestamp = :timestamp")
    void deleteEntityProfileData(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("cond") String cond,
        @Bind("timestamp") Long timestamp);

    default void deleteEntityProfileData(ListFilter filter, Long timestamp) {
      deleteEntityProfileData(
          getTimeSeriesTableName(), filter.getQueryParams(), filter.getCondition(), timestamp);
    }

    // profiler_data_time_series has no id column (unique key is
    // entityFQNHash + extension + operation + timestamp), so we limit by
    // row count using single-table DELETE+LIMIT on MySQL and ctid IN (...) on Postgres.
    // This bounds the rows deleted per batch, matching the other orphan-cleanup queries.
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM profiler_data_time_series "
                + "WHERE NOT EXISTS ("
                + "  SELECT 1 FROM table_entity te "
                + "  WHERE te.fqnHash = profiler_data_time_series.entityFQNHash"
                + ") "
                + "LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM profiler_data_time_series "
                + "WHERE ctid IN ("
                + "  SELECT pdts.ctid FROM profiler_data_time_series pdts "
                + "  WHERE NOT EXISTS ("
                + "    SELECT 1 FROM table_entity te "
                + "    WHERE te.fqnHash = pdts.entityFQNHash"
                + "  ) "
                + "  LIMIT :limit"
                + ")",
        connectionType = POSTGRES)
    int deleteOrphanedRecords(@Bind("limit") int limit);

    record LatestExtensionRecord(String entityFQNHash, String json) {}

    class LatestExtensionRecordMapper implements RowMapper<LatestExtensionRecord> {
      @Override
      public LatestExtensionRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new LatestExtensionRecord(rs.getString("entityFQNHash"), rs.getString("json"));
      }
    }
  }

  interface DataQualityDataTimeSeriesDAO extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "data_quality_data_time_series";
    }

    @RegisterRowMapper(LatestRecordWithFQNHashMapper.class)
    @SqlQuery(
        "SELECT t1.entityFQNHash, t1.json FROM data_quality_data_time_series t1 "
            + "INNER JOIN (SELECT entityFQNHash, MAX(timestamp) as maxTs "
            + "FROM data_quality_data_time_series WHERE entityFQNHash IN (<entityFQNHashes>) "
            + "GROUP BY entityFQNHash) t2 "
            + "ON t1.entityFQNHash = t2.entityFQNHash AND t1.timestamp = t2.maxTs")
    List<LatestRecordWithFQNHash> getLatestRecordBatch(
        @BindListFQN("entityFQNHashes") List<String> entityFQNs);

    @SqlUpdate(
        "DELETE FROM data_quality_data_time_series WHERE entityFQNHash = :testCaseFQNHash AND extension = 'testCase.testCaseResult'")
    void deleteAll(@BindFQN("testCaseFQNHash") String entityFQNHash);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO data_quality_data_time_series(entityFQNHash, extension, jsonSchema, json, incidentId) "
                + "VALUES (:testCaseFQNHash, :extension, :jsonSchema, :json, :incidentStateId)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO data_quality_data_time_series(entityFQNHash, extension, jsonSchema, json, incidentId) "
                + "VALUES (:testCaseFQNHash, :extension, :jsonSchema, (:json :: jsonb), :incidentStateId)",
        connectionType = POSTGRES)
    void insert(
        @Define("table") String table,
        @BindFQN("testCaseFQNHash") String testCaseFQNHash,
        @Bind("extension") String extension,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json,
        @Bind("incidentStateId") String incidentStateId);

    default void insert(
        String entityFQNHash,
        String extension,
        String jsonSchema,
        String json,
        String incidentStateId) {
      insert(getTimeSeriesTableName(), entityFQNHash, extension, jsonSchema, json, incidentStateId);
    }
  }

  class LatestRecordWithFQNHash {
    private final String entityFQNHash;
    private final String json;

    public LatestRecordWithFQNHash(String entityFQNHash, String json) {
      this.entityFQNHash = entityFQNHash;
      this.json = json;
    }

    public String getEntityFQNHash() {
      return entityFQNHash;
    }

    public String getJson() {
      return json;
    }
  }

  class LatestRecordWithFQNHashMapper implements RowMapper<LatestRecordWithFQNHash> {
    @Override
    public LatestRecordWithFQNHash map(ResultSet r, StatementContext ctx) throws SQLException {
      return new LatestRecordWithFQNHash(r.getString("entityFQNHash"), r.getString("json"));
    }
  }

  interface QueryCostTimeSeriesDAO extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "query_cost_time_series";
    }

    // TODO: Do not change id on override... updating json changed the id as well
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO <table>(entityFQNHash, jsonSchema, json) "
                + "VALUES (:entityFQNHash, :jsonSchema, :json) ON DUPLICATE KEY UPDATE"
                + "    json = VALUES(json);",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO <table>(entityFQNHash, jsonSchema, json) "
                + "VALUES (:entityFQNHash, :jsonSchema, (:json :: jsonb)) "
                + "ON CONFLICT (entityFQNHash, timestamp) "
                + "DO UPDATE SET "
                + "json = EXCLUDED.json",
        connectionType = POSTGRES)
    void insertWithoutExtension(
        @Define("table") String table,
        @BindFQN("entityFQNHash") String entityFQNHash,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @SqlUpdate("DELETE FROM query_cost_time_series WHERE entityFQNHash = :entityFQNHash ")
    void deleteWithEntityFqnHash(@BindFQN("entityFQNHash") String entityFQNHash);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM query_cost_time_series "
                + "WHERE id IN ("
                + "  SELECT id FROM ("
                + "    SELECT qcts.id FROM query_cost_time_series qcts "
                + "    LEFT JOIN query_entity qe ON qcts.entityFQNHash = qe.fqnHash "
                + "    WHERE qe.fqnHash IS NULL "
                + "    LIMIT :limit"
                + "  ) sub"
                + ")",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM query_cost_time_series "
                + "WHERE id IN ("
                + "  SELECT qcts.id FROM query_cost_time_series qcts "
                + "  LEFT JOIN query_entity qe ON qcts.entityFQNHash = qe.fqnHash "
                + "  WHERE qe.fqnHash IS NULL "
                + "  LIMIT :limit"
                + ")",
        connectionType = POSTGRES)
    int deleteOrphanedRecords(@Bind("limit") int limit);
  }

  interface TestCaseResolutionStatusTimeSeriesDAO extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "test_case_resolution_status_time_series";
    }

    @SqlQuery(
        value =
            "SELECT json FROM test_case_resolution_status_time_series "
                + "WHERE stateId = :stateId ORDER BY timestamp DESC")
    List<String> listTestCaseResolutionStatusesForStateId(@Bind("stateId") String stateId);

    @SqlQuery(
        value =
            "SELECT json FROM test_case_resolution_status_time_series "
                + "WHERE entityFQNHash = :entityFQNHash ORDER BY timestamp DESC")
    List<String> listTestCaseResolutionForEntityFQNHash(
        @BindFQN("entityFQNHash") String entityFqnHas);

    @SqlQuery(
        value =
            "SELECT json FROM test_case_resolution_status_time_series "
                + "WHERE assignee = :userFqn ORDER BY timestamp DESC")
    List<String> listTestCaseResolutionForAssignee(@Bind("userFqn") String userFqn);

    @SqlQuery(
        value =
            "SELECT json FROM test_case_resolution_status_time_series "
                + "WHERE stateId = :stateId ORDER BY timestamp ASC LIMIT 1")
    String listFirstTestCaseResolutionStatusesForStateId(@Bind("stateId") String stateId);

    @SqlUpdate(
        "DELETE FROM test_case_resolution_status_time_series WHERE entityFQNHash = :entityFQNHash")
    void delete(@BindFQN("entityFQNHash") String entityFQNHash);

    @SqlQuery(
        "SELECT json FROM "
            + "(SELECT id, json, testCaseResolutionStatusType, assignee, ROW_NUMBER() OVER(PARTITION BY <partition> ORDER BY timestamp DESC) AS row_num "
            + "FROM <table> <cond> "
            + "AND timestamp BETWEEN :startTs AND :endTs "
            + "ORDER BY timestamp DESC) ranked "
            + "<outerCond> AND ranked.row_num = 1 LIMIT :limit OFFSET :offset")
    List<String> listWithOffset(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("cond") String cond,
        @Define("partition") String partition,
        @Bind("limit") int limit,
        @Bind("offset") int offset,
        @Bind("startTs") Long startTs,
        @Bind("endTs") Long endTs,
        @BindMap Map<String, ?> outerParams,
        @Define("outerCond") String outerFilter);

    @Override
    default List<String> listWithOffset(
        ListFilter filter, int limit, int offset, Long startTs, Long endTs, boolean latest) {
      if (latest) {
        // When fetching latest, we need to apply Assignee and Status filters on the outer query
        // i.e. after we have fetched the latest records for each testCaseFQNHash
        // We'll first get the values, remove then from `filter` and then create `outerFilter`
        String testCaseResolutionStatusType = filter.getQueryParam("testCaseResolutionStatusType");
        filter.removeQueryParam("testCaseResolutionStatusType");
        String assignee = filter.getQueryParam("assignee");
        filter.removeQueryParam("assignee");

        ListFilter outerFilter = new ListFilter(null);
        outerFilter.addQueryParam("testCaseResolutionStatusType", testCaseResolutionStatusType);
        outerFilter.addQueryParam("assignee", assignee);

        String condition = filter.getCondition();
        condition = TestCaseResolutionStatusRepository.addOriginEntityFQNJoin(filter, condition);

        return listWithOffset(
            getTimeSeriesTableName(),
            filter.getQueryParams(),
            condition,
            getPartitionFieldName(),
            limit,
            offset,
            startTs,
            endTs,
            filter.getQueryParams(),
            outerFilter.getCondition());
      }
      String condition = filter.getCondition();
      condition = TestCaseResolutionStatusRepository.addOriginEntityFQNJoin(filter, condition);
      return listWithOffset(
          getTimeSeriesTableName(),
          filter.getQueryParams(),
          condition,
          limit,
          offset,
          startTs,
          endTs);
    }

    @Override
    default int listCount(ListFilter filter, Long startTs, Long endTs, boolean latest) {
      String condition = filter.getCondition();
      condition = TestCaseResolutionStatusRepository.addOriginEntityFQNJoin(filter, condition);
      return latest
          ? listCount(
              getTimeSeriesTableName(),
              getPartitionFieldName(),
              filter.getQueryParams(),
              condition,
              startTs,
              endTs)
          : listCount(getTimeSeriesTableName(), filter.getQueryParams(), condition, startTs, endTs);
    }

    @Override
    default List<String> listWithOffset(ListFilter filter, int limit, int offset) {
      String condition = filter.getCondition();
      condition = TestCaseResolutionStatusRepository.addOriginEntityFQNJoin(filter, condition);
      return listWithOffset(
          getTimeSeriesTableName(), filter.getQueryParams(), condition, limit, offset);
    }

    @Override
    default int listCount(ListFilter filter) {
      String condition = filter.getCondition();
      condition = TestCaseResolutionStatusRepository.addOriginEntityFQNJoin(filter, condition);
      return listCount(getTimeSeriesTableName(), filter.getQueryParams(), condition);
    }

    // relation = 9 corresponds to Relationship.PARENT_OF (the enum ordinal is stable;
    // see Relationship.java where new values must be appended). The annotation can't
    // reference the enum at compile time, so we inline the ordinal here.
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM test_case_resolution_status_time_series "
                + "WHERE id IN ("
                + "  SELECT id FROM ("
                + "    SELECT ts.id FROM test_case_resolution_status_time_series ts "
                + "    LEFT JOIN entity_relationship er "
                + "      ON er.toId = ts.id AND er.relation = 9 " // 9 = Relationship.PARENT_OF
                + "        AND er.fromEntity = 'testCase' "
                + "        AND er.toEntity = 'testCaseResolutionStatus' "
                + "    WHERE er.toId IS NULL "
                + "    LIMIT :limit"
                + "  ) sub"
                + ")",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM test_case_resolution_status_time_series "
                + "WHERE id IN ("
                + "  SELECT ts.id FROM test_case_resolution_status_time_series ts "
                + "  LEFT JOIN entity_relationship er "
                + "    ON er.toId = ts.id AND er.relation = 9 " // 9 = Relationship.PARENT_OF
                + "      AND er.fromEntity = 'testCase' "
                + "      AND er.toEntity = 'testCaseResolutionStatus' "
                + "  WHERE er.toId IS NULL "
                + "  LIMIT :limit"
                + ")",
        connectionType = POSTGRES)
    int deleteOrphanedRecords(@Bind("limit") int limit);
  }

  interface TestCaseResultTimeSeriesDAO extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "data_quality_data_time_series";
    }

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO data_quality_data_time_series(entityFQNHash, extension, jsonSchema, json, incidentId) "
                + "VALUES (:testCaseFQNHash, :extension, :jsonSchema, :json, :incidentStateId)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO data_quality_data_time_series(entityFQNHash, extension, jsonSchema, json, incidentId) "
                + "VALUES (:testCaseFQNHash, :extension, :jsonSchema, (:json :: jsonb), :incidentStateId)",
        connectionType = POSTGRES)
    void insert(
        @Define("table") String table,
        @BindFQN("testCaseFQNHash") String testCaseFQNHash,
        @Bind("extension") String extension,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json,
        @Bind("incidentStateId") String incidentStateId);

    @ConnectionAwareSqlQuery(
        value =
            """
            SELECT dqdts1.json FROM
            data_quality_data_time_series dqdts1
            INNER JOIN (
                SELECT tc.fqnHash
                FROM entity_relationship er
                INNER JOIN test_case tc ON er.toId = tc.id
                WHERE fromEntity = 'testSuite' AND toEntity = 'testCase' AND fromId = :testSuiteId
            ) ts ON dqdts1.entityFQNHash = ts.fqnHash
            LEFT JOIN data_quality_data_time_series dqdts2 FORCE INDEX (idx_entity_timestamp_desc) ON
                (dqdts1.entityFQNHash = dqdts2.entityFQNHash AND dqdts1.timestamp < dqdts2.timestamp)
            WHERE dqdts2.entityFQNHash IS NULL""",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            """
            SELECT dqdts1.json FROM
            data_quality_data_time_series dqdts1
            INNER JOIN (
                SELECT tc.fqnHash
                FROM entity_relationship er
                INNER JOIN test_case tc ON er.toId = tc.id
                WHERE fromEntity = 'testSuite' AND toEntity = 'testCase' AND fromId = :testSuiteId
            ) ts ON dqdts1.entityFQNHash = ts.fqnHash
            LEFT JOIN data_quality_data_time_series dqdts2 ON
                (dqdts1.entityFQNHash = dqdts2.entityFQNHash AND dqdts1.timestamp < dqdts2.timestamp)
            WHERE dqdts2.entityFQNHash IS NULL""",
        connectionType = POSTGRES)
    List<String> listLastTestCaseResultsForTestSuite(@BindMap Map<String, String> params);

    @SqlQuery(
        """
            SELECT dqdts1.json FROM
            data_quality_data_time_series dqdts1
            LEFT JOIN data_quality_data_time_series dqdts2 ON
                (dqdts1.entityFQNHash = dqdts2.entityFQNHash and dqdts1.timestamp < dqdts2.timestamp)
            WHERE dqdts2.entityFQNHash IS NULL AND dqdts1.entityFQNHash = :testCaseFQN""")
    String listLastTestCaseResult(@BindFQN("testCaseFQN") String testCaseFQN);

    default void insert(
        String testCaseFQN,
        String extension,
        String jsonSchema,
        String json,
        UUID incidentStateId) {

      insert(
          getTimeSeriesTableName(),
          testCaseFQN,
          extension,
          jsonSchema,
          json,
          incidentStateId != null ? incidentStateId.toString() : null);
    }

    default List<String> listLastTestCaseResultsForTestSuite(UUID testSuiteId) {
      return listLastTestCaseResultsForTestSuite(Map.of("testSuiteId", testSuiteId.toString()));
    }

    record ResultSummaryRow(
        String testSuiteId, String testCaseFQN, String testCaseStatus, long timestamp) {}

    class ResultSummaryRowMapper implements RowMapper<ResultSummaryRow> {
      @Override
      public ResultSummaryRow map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new ResultSummaryRow(
            rs.getString("testSuiteId"),
            rs.getString("testCaseFQN"),
            rs.getString("testCaseStatus"),
            rs.getLong("timestamp"));
      }
    }

    @ConnectionAwareSqlQuery(
        value =
            """
            WITH suite_test_cases AS (
                SELECT tc.fqnHash, er.fromId as testSuiteId
                FROM entity_relationship er
                INNER JOIN test_case tc ON er.toId = tc.id
                WHERE er.fromEntity = 'testSuite' AND er.toEntity = 'testCase'
                AND er.fromId IN (<testSuiteIds>)
            ),
            latest_results AS (
                SELECT dqdts.entityFQNHash,
                       JSON_UNQUOTE(JSON_EXTRACT(dqdts.json, '$.testCaseFQN')) as testCaseFQN,
                       JSON_UNQUOTE(JSON_EXTRACT(dqdts.json, '$.testCaseStatus')) as testCaseStatus,
                       dqdts.timestamp,
                       ROW_NUMBER() OVER (PARTITION BY dqdts.entityFQNHash ORDER BY dqdts.timestamp DESC) as rn
                FROM data_quality_data_time_series dqdts
                WHERE dqdts.entityFQNHash IN (SELECT fqnHash FROM suite_test_cases)
            )
            SELECT stc.testSuiteId, lr.testCaseFQN, lr.testCaseStatus, lr.timestamp
            FROM latest_results lr
            INNER JOIN suite_test_cases stc ON lr.entityFQNHash = stc.fqnHash
            WHERE lr.rn = 1
            """,
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            """
            WITH suite_test_cases AS (
                SELECT tc.fqnHash, er.fromId as testSuiteId
                FROM entity_relationship er
                INNER JOIN test_case tc ON er.toId = tc.id
                WHERE er.fromEntity = 'testSuite' AND er.toEntity = 'testCase'
                AND er.fromId IN (<testSuiteIds>)
            ),
            latest_results AS (
                SELECT dqdts.entityFQNHash,
                       dqdts.json->>'testCaseFQN' as testCaseFQN,
                       dqdts.json->>'testCaseStatus' as testCaseStatus,
                       dqdts.timestamp,
                       ROW_NUMBER() OVER (PARTITION BY dqdts.entityFQNHash ORDER BY dqdts.timestamp DESC) as rn
                FROM data_quality_data_time_series dqdts
                WHERE dqdts.entityFQNHash IN (SELECT fqnHash FROM suite_test_cases)
            )
            SELECT stc.testSuiteId, lr.testCaseFQN, lr.testCaseStatus, lr.timestamp
            FROM latest_results lr
            INNER JOIN suite_test_cases stc ON lr.entityFQNHash = stc.fqnHash
            WHERE lr.rn = 1
            """,
        connectionType = POSTGRES)
    @UseRowMapper(ResultSummaryRowMapper.class)
    List<ResultSummaryRow> listResultSummariesForTestSuites(
        @BindList("testSuiteIds") List<String> testSuiteIds);

    record SuiteMaxTimestamp(String testSuiteId, long maxTimestamp) {}

    class SuiteMaxTimestampMapper implements RowMapper<SuiteMaxTimestamp> {
      @Override
      public SuiteMaxTimestamp map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new SuiteMaxTimestamp(rs.getString("testSuiteId"), rs.getLong("maxTimestamp"));
      }
    }

    @SqlQuery(
        """
            SELECT er_sub.fromId as testSuiteId, MAX(dqdts.timestamp) as maxTimestamp
            FROM data_quality_data_time_series dqdts
            INNER JOIN (
                SELECT tc.fqnHash, er.fromId
                FROM entity_relationship er
                INNER JOIN test_case tc ON er.toId = tc.id
                WHERE er.fromEntity = 'testSuite' AND er.toEntity = 'testCase'
                AND er.fromId IN (<testSuiteIds>)
            ) er_sub ON dqdts.entityFQNHash = er_sub.fqnHash
            GROUP BY er_sub.fromId""")
    @UseRowMapper(SuiteMaxTimestampMapper.class)
    List<SuiteMaxTimestamp> getMaxTimestampForTestSuites(
        @BindList("testSuiteIds") List<String> testSuiteIds);
  }

  interface TestCaseDimensionResultTimeSeriesDAO extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "test_case_dimension_results_time_series";
    }

    @SqlQuery(
        "SELECT json FROM test_case_dimension_results_time_series "
            + "WHERE entityFQNHash = :testCaseFQN AND timestamp >= :startTs AND timestamp <= :endTs "
            + "ORDER BY timestamp DESC")
    List<String> listTestCaseDimensionResults(
        @BindFQN("testCaseFQN") String testCaseFQN,
        @Bind("startTs") Long startTs,
        @Bind("endTs") Long endTs);

    @SqlQuery(
        "SELECT json FROM test_case_dimension_results_time_series "
            + "WHERE entityFQNHash = :testCaseFQN AND dimensionKey = :dimensionKey AND timestamp >= :startTs AND timestamp <= :endTs "
            + "ORDER BY timestamp DESC")
    List<String> listTestCaseDimensionResultsByKey(
        @BindFQN("testCaseFQN") String testCaseFQN,
        @Bind("dimensionKey") String dimensionKey,
        @Bind("startTs") Long startTs,
        @Bind("endTs") Long endTs);

    @SqlQuery(
        "SELECT json FROM test_case_dimension_results_time_series "
            + "WHERE entityFQNHash = :testCaseFQN AND dimensionName = :dimensionName AND timestamp >= :startTs AND timestamp <= :endTs "
            + "ORDER BY timestamp DESC")
    List<String> listTestCaseDimensionResultsByDimensionName(
        @BindFQN("testCaseFQN") String testCaseFQN,
        @Bind("dimensionName") String dimensionName,
        @Bind("startTs") Long startTs,
        @Bind("endTs") Long endTs);

    @SqlQuery(
        "SELECT DISTINCT dimensionKey FROM test_case_dimension_results_time_series "
            + "WHERE entityFQNHash = :testCaseFQN AND timestamp >= :startTs AND timestamp <= :endTs")
    List<String> listAvailableDimensionKeys(
        @BindFQN("testCaseFQN") String testCaseFQN,
        @Bind("startTs") Long startTs,
        @Bind("endTs") Long endTs);

    @SqlUpdate(
        "DELETE FROM test_case_dimension_results_time_series WHERE entityFQNHash = :testCaseFQNHash")
    void deleteAll(@BindFQN("testCaseFQNHash") String testCaseFQN);
  }
}
