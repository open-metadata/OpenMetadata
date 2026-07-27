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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Relationship.CONTAINS;
import static org.openmetadata.schema.type.Relationship.MENTIONED_IN;
import static org.openmetadata.service.Entity.APPLICATION;
import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindMap;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Report;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.jdbi.BindConcat;

public interface EntityDataDAOs {
  @CreateSqlObject
  TableDAO tableDAO();

  @CreateSqlObject
  QueryDAO queryDAO();

  @CreateSqlObject
  MetricDAO metricDAO();

  @CreateSqlObject
  ChartDAO chartDAO();

  @CreateSqlObject
  ApplicationDAO applicationDAO();

  @CreateSqlObject
  ApplicationMarketPlaceDAO applicationMarketPlaceDAO();

  @CreateSqlObject
  PipelineDAO pipelineDAO();

  @CreateSqlObject
  ReportDAO reportDAO();

  @CreateSqlObject
  MlModelDAO mlModelDAO();

  @CreateSqlObject
  GlossaryDAO glossaryDAO();

  @CreateSqlObject
  GlossaryTermDAO glossaryTermDAO();

  @CreateSqlObject
  BotDAO botDAO();

  @CreateSqlObject
  PolicyDAO policyDAO();

  @CreateSqlObject
  IngestionPipelineDAO ingestionPipelineDAO();

  @CreateSqlObject
  PipelineServiceDAO pipelineServiceDAO();

  @CreateSqlObject
  MlModelServiceDAO mlModelServiceDAO();

  @CreateSqlObject
  MessagingServiceDAO messagingServiceDAO();

  @CreateSqlObject
  StoredProcedureDAO storedProcedureDAO();

  interface BotDAO extends EntityDAO<Bot> {
    @Override
    default String getTableName() {
      return "bot_entity";
    }

    @Override
    default Class<Bot> getEntityClass() {
      return Bot.class;
    }
  }

  interface ChartDAO extends EntityDAO<Chart> {
    @Override
    default String getTableName() {
      return "chart_entity";
    }

    @Override
    default Class<Chart> getEntityClass() {
      return Chart.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface ApplicationDAO extends EntityDAO<App> {
    @Override
    default String getTableName() {
      return "installed_apps";
    }

    @Override
    default Class<App> getEntityClass() {
      return App.class;
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT id, name, JSON_UNQUOTE(JSON_EXTRACT(json, '$.displayName')) as displayName from installed_apps",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT id, name, json ->> 'displayName' as displayName from installed_apps",
        connectionType = POSTGRES)
    @RegisterRowMapper(AppEntityReferenceMapper.class)
    List<EntityReference> listAppsRef();

    class AppEntityReferenceMapper implements RowMapper<EntityReference> {
      @Override
      public EntityReference map(ResultSet rs, StatementContext ctx) throws SQLException {
        String fqn = rs.getString("name");
        String displayName = rs.getString("displayName");

        return new EntityReference()
            .withId(UUID.fromString(rs.getString("id")))
            .withName(fqn)
            .withDisplayName(displayName)
            .withFullyQualifiedName(fqn)
            .withType(APPLICATION);
      }
    }
  }

  interface ApplicationMarketPlaceDAO extends EntityDAO<AppMarketPlaceDefinition> {
    @Override
    default String getTableName() {
      return "apps_marketplace";
    }

    @Override
    default Class<AppMarketPlaceDefinition> getEntityClass() {
      return AppMarketPlaceDefinition.class;
    }
  }

  interface MessagingServiceDAO extends EntityDAO<MessagingService> {
    @Override
    default String getTableName() {
      return "messaging_service_entity";
    }

    @Override
    default Class<MessagingService> getEntityClass() {
      return MessagingService.class;
    }
  }

  interface MetricDAO extends EntityDAO<Metric> {
    @Override
    default String getTableName() {
      return "metric_entity";
    }

    @Override
    default Class<Metric> getEntityClass() {
      return Metric.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT DISTINCT customUnitOfMeasurement AS customUnit "
                + "FROM metric_entity "
                + "WHERE customUnitOfMeasurement IS NOT NULL "
                + "AND customUnitOfMeasurement != '' "
                + "AND deleted = false "
                + "ORDER BY customUnitOfMeasurement",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT DISTINCT customUnitOfMeasurement AS customUnit "
                + "FROM metric_entity "
                + "WHERE customUnitOfMeasurement IS NOT NULL "
                + "AND customUnitOfMeasurement != '' "
                + "AND deleted = false "
                + "ORDER BY customUnitOfMeasurement",
        connectionType = POSTGRES)
    List<String> getDistinctCustomUnitsOfMeasurement();
  }

  interface MlModelDAO extends EntityDAO<MlModel> {
    @Override
    default String getTableName() {
      return "ml_model_entity";
    }

    @Override
    default Class<MlModel> getEntityClass() {
      return MlModel.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface GlossaryDAO extends EntityDAO<Glossary> {
    @Override
    default String getTableName() {
      return "glossary_entity";
    }

    @Override
    default Class<Glossary> getEntityClass() {
      return Glossary.class;
    }
  }

  interface GlossaryTermDAO extends EntityDAO<GlossaryTerm> {
    @Override
    default String getTableName() {
      return "glossary_term_entity";
    }

    @Override
    default Class<GlossaryTerm> getEntityClass() {
      return GlossaryTerm.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default int listCount(ListFilter filter) {
      String condition = filter.getCondition();
      String directChildrenOf = filter.getQueryParam("directChildrenOf");

      if (!nullOrEmpty(directChildrenOf)) {
        String parentFqnHash = FullyQualifiedName.buildHash(directChildrenOf);
        filter.queryParams.put("fqnHashSingleLevel", parentFqnHash + ".%");
        filter.queryParams.put("fqnHashNestedLevel", parentFqnHash + ".%.%");

        condition +=
            " AND fqnHash LIKE :fqnHashSingleLevel AND fqnHash NOT LIKE :fqnHashNestedLevel";
      }

      return listCount(getTableName(), getNameHashColumn(), filter.getQueryParams(), condition);
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String condition = filter.getCondition();
      String directChildrenOf = filter.getQueryParam("directChildrenOf");

      if (!nullOrEmpty(directChildrenOf)) {
        String parentFqnHash = FullyQualifiedName.buildHash(directChildrenOf);
        filter.queryParams.put("fqnHashSingleLevel", parentFqnHash + ".%");
        filter.queryParams.put("fqnHashNestedLevel", parentFqnHash + ".%.%");

        condition +=
            " AND fqnHash LIKE :fqnHashSingleLevel AND fqnHash NOT LIKE :fqnHashNestedLevel";
      }

      return listBefore(
          getTableName(), filter.getQueryParams(), condition, limit, beforeName, beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String condition = filter.getCondition();
      String directChildrenOf = filter.getQueryParam("directChildrenOf");

      if (!nullOrEmpty(directChildrenOf)) {
        String parentFqnHash = FullyQualifiedName.buildHash(directChildrenOf);
        filter.queryParams.put("fqnHashSingleLevel", parentFqnHash + ".%");
        filter.queryParams.put("fqnHashNestedLevel", parentFqnHash + ".%.%");

        condition +=
            " AND fqnHash LIKE :fqnHashSingleLevel AND fqnHash NOT LIKE :fqnHashNestedLevel";
      }
      return listAfter(
          getTableName(), filter.getQueryParams(), condition, limit, afterName, afterId);
    }

    @SqlQuery("select json FROM glossary_term_entity where fqnhash LIKE :concatFqnhash ")
    List<String> getNestedTerms(
        @BindConcat(
                value = "concatFqnhash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash);

    @SqlQuery("SELECT COUNT(*) FROM glossary_term_entity WHERE fqnHash LIKE :concatFqnhash ")
    int countNestedTerms(
        @BindConcat(
                value = "concatFqnhash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash);

    @SqlQuery(
        "SELECT COUNT(*) FROM glossary_term_entity WHERE fqnHash LIKE :glossaryHash AND LOWER(name) = LOWER(:termName)")
    int getGlossaryTermCountIgnoreCase(
        @BindConcat(
                value = "glossaryHash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash,
        @Bind("termName") String termName);

    @SqlQuery(
        "SELECT COUNT(*) FROM glossary_term_entity WHERE fqnHash LIKE :glossaryHash AND LOWER(name) = LOWER(:termName) AND id != :excludeId")
    int getGlossaryTermCountIgnoreCaseExcludingId(
        @BindConcat(
                value = "glossaryHash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash,
        @Bind("termName") String termName,
        @Bind("excludeId") String excludeId);

    @SqlQuery(
        "SELECT json FROM glossary_term_entity WHERE fqnHash LIKE :glossaryHash AND LOWER(name) = LOWER(:termName)")
    String getGlossaryTermByNameAndGlossaryIgnoreCase(
        @BindConcat(
                value = "glossaryHash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash,
        @Bind("termName") String termName);

    // Search glossary terms by name and displayName using LIKE queries
    // The displayName column is a generated column added in migration 1.9.3
    // entityStatus filtering uses generated column added in migration 1.12.2
    @SqlQuery(
        "SELECT json FROM glossary_term_entity WHERE deleted = FALSE "
            + "AND fqnHash LIKE :parentHash "
            + "AND (LOWER(name) LIKE LOWER(:searchTerm) "
            + "OR LOWER(COALESCE(displayName, '')) LIKE LOWER(:searchTerm)) "
            + "<statusCondition> "
            + "ORDER BY name "
            + "LIMIT :limit OFFSET :offset")
    List<String> searchGlossaryTerms(
        @Bind("parentHash") String parentHash,
        @Bind("searchTerm") String searchTerm,
        @Define("statusCondition") String statusCondition,
        @Bind("limit") int limit,
        @Bind("offset") int offset);
  }

  interface IngestionPipelineDAO extends EntityDAO<IngestionPipeline> {
    @Override
    default String getTableName() {
      return "ingestion_pipeline_entity";
    }

    @Override
    default Class<IngestionPipeline> getEntityClass() {
      return IngestionPipeline.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default int listCount(ListFilter filter) {
      String condition =
          "INNER JOIN entity_relationship ON ingestion_pipeline_entity.id = entity_relationship.toId";

      if (filter.getQueryParam("pipelineType") != null) {
        String pipelineTypeCondition =
            String.format(" and %s", filter.getPipelineTypeCondition(null));
        condition += pipelineTypeCondition;
      }

      if (filter.getQueryParam("applicationType") != null) {
        String applicationTypeCondition =
            String.format(" and %s", filter.getApplicationTypeCondition());
        condition += applicationTypeCondition;
      }

      if (filter.getQueryParam("service") != null) {
        String serviceCondition = String.format(" and %s", filter.getServiceCondition(null));
        condition += serviceCondition;
      }

      if (filter.getQueryParam("provider") != null) {
        String providerCondition =
            String.format(" and %s", filter.getProviderCondition(getTableName()));
        condition += providerCondition;
      }

      Map<String, Object> bindMap = new HashMap<>();
      String serviceType = filter.getQueryParam("serviceType");
      String provider = filter.getQueryParam("provider");
      if (!nullOrEmpty(provider)) {
        bindMap.put("provider", provider);
      }
      if (!nullOrEmpty(serviceType)) {

        condition =
            String.format(
                "%s WHERE entity_relationship.fromEntity = :serviceType and entity_relationship.relation = :relation",
                condition);
        bindMap.put("relation", CONTAINS.ordinal());
        return listIngestionPipelineCount(condition, bindMap, filter.getQueryParams());
      }
      return EntityDAO.super.listCount(filter);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String condition =
          "INNER JOIN entity_relationship ON ingestion_pipeline_entity.id = entity_relationship.toId";

      if (filter.getQueryParam("pipelineType") != null) {
        String pipelineTypeCondition =
            String.format(" and %s", filter.getPipelineTypeCondition(null));
        condition += pipelineTypeCondition;
      }

      if (filter.getQueryParam("applicationType") != null) {
        String applicationTypeCondition =
            String.format(" and %s", filter.getApplicationTypeCondition());
        condition += applicationTypeCondition;
      }

      if (filter.getQueryParam("service") != null) {
        String serviceCondition = String.format(" and %s", filter.getServiceCondition(null));
        condition += serviceCondition;
      }

      if (filter.getQueryParam("provider") != null) {
        String providerCondition =
            String.format(" and %s", filter.getProviderCondition(getTableName()));
        condition += providerCondition;
      }

      Map<String, Object> bindMap = new HashMap<>();
      String serviceType = filter.getQueryParam("serviceType");
      String provider = filter.getQueryParam("provider");
      if (!nullOrEmpty(provider)) {
        bindMap.put("provider", provider);
      }
      if (!nullOrEmpty(serviceType)) {

        condition =
            String.format(
                "%s WHERE entity_relationship.fromEntity = :serviceType and entity_relationship.relation = :relation and (ingestion_pipeline_entity.name > :afterName OR (ingestion_pipeline_entity.name = :afterName AND ingestion_pipeline_entity.id > :afterId))  order by ingestion_pipeline_entity.name ASC,ingestion_pipeline_entity.id ASC LIMIT :limit",
                condition);

        bindMap.put("relation", CONTAINS.ordinal());
        bindMap.put("afterName", afterName);
        bindMap.put("afterId", afterId);
        bindMap.put("limit", limit);
        return listAfterIngestionPipelineByserviceType(condition, bindMap, filter.getQueryParams());
      }
      return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String condition =
          "INNER JOIN entity_relationship ON ingestion_pipeline_entity.id = entity_relationship.toId";

      if (filter.getQueryParam("pipelineType") != null) {
        String pipelineTypeCondition =
            String.format(" and %s", filter.getPipelineTypeCondition(null));
        condition += pipelineTypeCondition;
      }

      if (filter.getQueryParam("applicationType") != null) {
        String applicationTypeCondition =
            String.format(" and %s", filter.getApplicationTypeCondition());
        condition += applicationTypeCondition;
      }

      if (filter.getQueryParam("service") != null) {
        String serviceCondition = String.format(" and %s", filter.getServiceCondition(null));
        condition += serviceCondition;
      }

      if (filter.getQueryParam("provider") != null) {
        String providerCondition =
            String.format(" and %s", filter.getProviderCondition(getTableName()));
        condition += providerCondition;
      }

      Map<String, Object> bindMap = new HashMap<>();
      String serviceType = filter.getQueryParam("serviceType");
      String provider = filter.getQueryParam("provider");
      if (!nullOrEmpty(provider)) {
        bindMap.put("provider", provider);
      }
      if (!nullOrEmpty(serviceType)) {
        condition =
            String.format(
                "%s WHERE entity_relationship.fromEntity = :serviceType and entity_relationship.relation = :relation and (ingestion_pipeline_entity.name < :beforeName OR (ingestion_pipeline_entity.name = :beforeName AND ingestion_pipeline_entity.id < :beforeId))  order by ingestion_pipeline_entity.name DESC, ingestion_pipeline_entity.id DESC LIMIT :limit",
                condition);

        bindMap.put("relation", CONTAINS.ordinal());
        bindMap.put("beforeName", beforeName);
        bindMap.put("beforeId", beforeId);
        bindMap.put("limit", limit);
        return listBeforeIngestionPipelineByserviceType(
            condition, bindMap, filter.getQueryParams());
      }
      return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
    }

    @SqlQuery("SELECT ingestion_pipeline_entity.json FROM ingestion_pipeline_entity <cond>")
    List<String> listAfterIngestionPipelineByserviceType(
        @Define("cond") String cond,
        @BindMap Map<String, Object> bindings,
        @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT json FROM (SELECT ingestion_pipeline_entity.name, ingestion_pipeline_entity.id, ingestion_pipeline_entity.json FROM ingestion_pipeline_entity <cond>) last_rows_subquery ORDER BY last_rows_subquery.name,last_rows_subquery.id")
    List<String> listBeforeIngestionPipelineByserviceType(
        @Define("cond") String cond,
        @BindMap Map<String, Object> bindings,
        @BindMap Map<String, String> params);

    @SqlQuery("SELECT count(*) FROM ingestion_pipeline_entity <cond> ")
    int listIngestionPipelineCount(
        @Define("cond") String cond,
        @BindMap Map<String, Object> bindings,
        @BindMap Map<String, String> params);
  }

  interface PipelineServiceDAO extends EntityDAO<PipelineService> {
    @Override
    default String getTableName() {
      return "pipeline_service_entity";
    }

    @Override
    default Class<PipelineService> getEntityClass() {
      return PipelineService.class;
    }
  }

  interface MlModelServiceDAO extends EntityDAO<MlModelService> {
    @Override
    default String getTableName() {
      return "mlmodel_service_entity";
    }

    @Override
    default Class<MlModelService> getEntityClass() {
      return MlModelService.class;
    }
  }

  interface PolicyDAO extends EntityDAO<Policy> {
    @Override
    default String getTableName() {
      return "policy_entity";
    }

    @Override
    default Class<Policy> getEntityClass() {
      return Policy.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface ReportDAO extends EntityDAO<Report> {
    @Override
    default String getTableName() {
      return "report_entity";
    }

    @Override
    default Class<Report> getEntityClass() {
      return Report.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface TableDAO extends EntityDAO<Table> {
    @Override
    default String getTableName() {
      return "table_entity";
    }

    @Override
    default Class<Table> getEntityClass() {
      return Table.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            "select JSON_EXTRACT(json, '$.fullyQualifiedName') from table_entity where id not in (select toId from entity_relationship where fromEntity = 'databaseSchema' and toEntity = 'table')",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "select json ->> 'fullyQualifiedName' from table_entity where id not in (select toId from entity_relationship where fromEntity = 'databaseSchema' and toEntity = 'table')",
        connectionType = POSTGRES)
    List<String> getBrokenTables();

    @SqlUpdate(
        value =
            "delete from table_entity where id not in (select toId from entity_relationship where fromEntity = 'databaseSchema' and toEntity = 'table')")
    int removeBrokenTables();

    @Override
    default int listCount(ListFilter filter) {
      String includeEmptyTestSuite = filter.getQueryParam("includeEmptyTestSuite");
      if (includeEmptyTestSuite != null && !Boolean.parseBoolean(includeEmptyTestSuite)) {
        String condition =
            String.format(
                "INNER JOIN entity_relationship er ON %s.id=er.fromId AND er.relation=%s AND er.toEntity='%s'",
                getTableName(), CONTAINS.ordinal(), Entity.TEST_SUITE);
        String mySqlCondition = condition;
        String postgresCondition = condition;

        mySqlCondition =
            String.format("%s %s", mySqlCondition, filter.getCondition(getTableName()));
        postgresCondition =
            String.format("%s %s", postgresCondition, filter.getCondition(getTableName()));
        return listCount(
            getTableName(),
            getNameHashColumn(),
            filter.getQueryParams(),
            mySqlCondition,
            postgresCondition);
      }

      String condition = filter.getCondition(getTableName());
      return listCount(
          getTableName(), getNameHashColumn(), filter.getQueryParams(), condition, condition);
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String includeEmptyTestSuite = filter.getQueryParam("includeEmptyTestSuite");
      if (includeEmptyTestSuite != null && !Boolean.parseBoolean(includeEmptyTestSuite)) {
        String condition =
            String.format(
                "INNER JOIN entity_relationship er ON %s.id=er.fromId AND er.relation=%s AND er.toEntity='%s'",
                getTableName(), CONTAINS.ordinal(), Entity.TEST_SUITE);
        String mySqlCondition = condition;
        String postgresCondition = condition;

        mySqlCondition =
            String.format("%s %s", mySqlCondition, filter.getCondition(getTableName()));
        postgresCondition =
            String.format("%s %s", postgresCondition, filter.getCondition(getTableName()));
        return listBefore(
            getTableName(),
            filter.getQueryParams(),
            mySqlCondition,
            postgresCondition,
            limit,
            beforeName,
            beforeId);
      }
      String condition = filter.getCondition(getTableName());
      return listBefore(
          getTableName(),
          filter.getQueryParams(),
          condition,
          condition,
          limit,
          beforeName,
          beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String includeEmptyTestSuite = filter.getQueryParam("includeEmptyTestSuite");
      if (includeEmptyTestSuite != null && !Boolean.parseBoolean(includeEmptyTestSuite)) {
        String condition =
            String.format(
                "INNER JOIN entity_relationship er ON %s.id=er.fromId AND er.relation=%s AND er.toEntity='%s'",
                getTableName(), CONTAINS.ordinal(), Entity.TEST_SUITE);
        String mySqlCondition = condition;
        String postgresCondition = condition;

        mySqlCondition =
            String.format("%s %s", mySqlCondition, filter.getCondition(getTableName()));
        postgresCondition =
            String.format("%s %s", postgresCondition, filter.getCondition(getTableName()));
        return listAfter(
            getTableName(),
            filter.getQueryParams(),
            mySqlCondition,
            postgresCondition,
            limit,
            afterName,
            afterId);
      }
      String condition = filter.getCondition(getTableName());
      return listAfter(
          getTableName(), filter.getQueryParams(), condition, condition, limit, afterName, afterId);
    }
  }

  interface StoredProcedureDAO extends EntityDAO<StoredProcedure> {
    @Override
    default String getTableName() {
      return "stored_procedure_entity";
    }

    @Override
    default Class<StoredProcedure> getEntityClass() {
      return StoredProcedure.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface QueryDAO extends EntityDAO<Query> {
    @Override
    default String getTableName() {
      return "query_entity";
    }

    @Override
    default Class<Query> getEntityClass() {
      return Query.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }

    @Override
    default int listCount(ListFilter filter) {
      String entityId = filter.getQueryParam("entityId");
      String condition =
          "INNER JOIN entity_relationship ON query_entity.id = entity_relationship.toId";
      Map<String, Object> bindMap = new HashMap<>();
      if (!nullOrEmpty(entityId)) {
        condition =
            String.format(
                "%s WHERE entity_relationship.fromId = :id and entity_relationship.relation = :relation and entity_relationship.toEntity = :toEntityType",
                condition);
        bindMap.put("id", entityId);
        bindMap.put("relation", MENTIONED_IN.ordinal());
        bindMap.put("toEntityType", QUERY);
        return listQueryCount(condition, bindMap);
      }
      return EntityDAO.super.listCount(filter);
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String entityId = filter.getQueryParam("entityId");
      String condition =
          "INNER JOIN entity_relationship ON query_entity.id = entity_relationship.toId";
      Map<String, Object> bindMap = new HashMap<>();
      if (!nullOrEmpty(entityId)) {
        condition =
            String.format(
                "%s WHERE entity_relationship.fromId = :entityId and entity_relationship.relation = :relation and entity_relationship.toEntity = :toEntity and (query_entity.name < :beforeName OR (query_entity.name = :beforeName AND query_entity.id < :beforeId))  order by query_entity.name DESC, query_entity.id DESC LIMIT :limit",
                condition);
        bindMap.put("entityId", entityId);
        bindMap.put("relation", MENTIONED_IN.ordinal());
        bindMap.put("toEntity", QUERY);
        bindMap.put("beforeName", beforeName);
        bindMap.put("beforeId", beforeId);
        bindMap.put("limit", limit);
        return listBeforeQueriesByEntityId(condition, bindMap);
      }
      return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String entityId = filter.getQueryParam("entityId");
      String condition =
          "INNER JOIN entity_relationship ON query_entity.id = entity_relationship.toId";
      Map<String, Object> bindMap = new HashMap<>();
      if (!nullOrEmpty(entityId)) {
        condition =
            String.format(
                "%s WHERE entity_relationship.fromId = :entityId and entity_relationship.relation = :relation and entity_relationship.toEntity = :toEntity and (query_entity.name > :afterName OR (query_entity.name = :afterName AND query_entity.name > :afterId))  order by query_entity.name ASC,query_entity.id ASC LIMIT :limit",
                condition);

        bindMap.put("entityId", entityId);
        bindMap.put("relation", MENTIONED_IN.ordinal());
        bindMap.put("toEntity", QUERY);
        bindMap.put("afterName", afterName);
        bindMap.put("afterId", afterId);
        bindMap.put("limit", limit);
        return listAfterQueriesByEntityId(condition, bindMap);
      }
      return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
    }

    @SqlQuery("SELECT query_entity.json FROM query_entity <cond>")
    List<String> listAfterQueriesByEntityId(
        @Define("cond") String cond, @BindMap Map<String, Object> bindings);

    @SqlQuery(
        "SELECT json FROM (SELECT query_entity.name, query_entity.id, query_entity.json FROM query_entity <cond>) last_rows_subquery ORDER BY name,id")
    List<String> listBeforeQueriesByEntityId(
        @Define("cond") String cond, @BindMap Map<String, Object> bindings);

    @SqlQuery("SELECT count(*) FROM query_entity <cond> ")
    int listQueryCount(@Define("cond") String cond, @BindMap Map<String, Object> bindings);
  }

  interface PipelineDAO extends EntityDAO<Pipeline> {
    @Override
    default String getTableName() {
      return "pipeline_entity";
    }

    @Override
    default Class<Pipeline> getEntityClass() {
      return Pipeline.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String status = filter.getQueryParam("status");
      if (status != null && !status.isEmpty()) {
        // Remove status from filter to avoid SQL error
        Map<String, String> params = new HashMap<>(filter.getQueryParams());
        params.remove("status");
        ListFilter cleanFilter = new ListFilter(filter.getInclude());
        params.forEach(cleanFilter::addQueryParam);

        // Build condition with status JOIN
        String condition = cleanFilter.getCondition();
        String statusCondition =
            buildStatusJoinCondition(getTableName(), condition, status, beforeName, beforeId, true);
        return listBeforeWithStatus(
            statusCondition, getBindMap(cleanFilter, status, limit, beforeName, beforeId));
      }
      return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String status = filter.getQueryParam("status");
      if (status != null && !status.isEmpty()) {
        // Remove status from filter to avoid SQL error
        Map<String, String> params = new HashMap<>(filter.getQueryParams());
        params.remove("status");
        ListFilter cleanFilter = new ListFilter(filter.getInclude());
        params.forEach(cleanFilter::addQueryParam);

        // Build condition with status JOIN
        String condition = cleanFilter.getCondition();
        String statusCondition =
            buildStatusJoinCondition(getTableName(), condition, status, afterName, afterId, false);
        return listAfterWithStatus(
            statusCondition, getBindMap(cleanFilter, status, limit, afterName, afterId));
      }
      return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
    }

    @Override
    default int listCount(ListFilter filter) {
      String status = filter.getQueryParam("status");
      if (status != null && !status.isEmpty()) {
        // Remove status from filter to avoid SQL error
        Map<String, String> params = new HashMap<>(filter.getQueryParams());
        params.remove("status");
        ListFilter cleanFilter = new ListFilter(filter.getInclude());
        params.forEach(cleanFilter::addQueryParam);

        // Build condition with status JOIN
        String condition = cleanFilter.getCondition();
        String statusCondition = buildStatusCountCondition(getTableName(), condition, status);
        return listCountWithStatus(statusCondition, getBindMap(cleanFilter, status, 0, null, null));
      }
      return EntityDAO.super.listCount(filter);
    }

    default String buildStatusJoinCondition(
        String tableName,
        String baseCondition,
        String status,
        String name,
        String id,
        boolean isBefore) {
      String orderDirection = isBefore ? "DESC" : "ASC";
      String nameComparison = isBefore ? "<" : ">";
      String idComparison = isBefore ? "<" : ">";

      return String.format(
          "INNER JOIN ("
              + "  SELECT entityFQNHash, JSON_UNQUOTE(JSON_EXTRACT(json, '$.executionStatus')) as execStatus "
              + "  FROM entity_extension_time_series "
              + "  WHERE extension = 'pipeline.pipelineStatus' "
              + "    AND timestamp = (SELECT MAX(timestamp) FROM entity_extension_time_series eets2 "
              + "                      WHERE eets2.entityFQNHash = entity_extension_time_series.entityFQNHash "
              + "                      AND eets2.extension = 'pipeline.pipelineStatus') "
              + ") latest_status ON %s.fqnHash = latest_status.entityFQNHash "
              + "%s AND latest_status.execStatus = :status "
              + "AND (%s.name %s :beforeAfterName OR (%s.name = :beforeAfterName AND %s.id %s :beforeAfterId)) "
              + "ORDER BY %s.name %s, %s.id %s LIMIT :limit",
          tableName,
          baseCondition,
          tableName,
          nameComparison,
          tableName,
          tableName,
          idComparison,
          tableName,
          orderDirection,
          tableName,
          orderDirection);
    }

    default String buildStatusCountCondition(
        String tableName, String baseCondition, String status) {
      return String.format(
          "INNER JOIN ("
              + "  SELECT entityFQNHash, JSON_UNQUOTE(JSON_EXTRACT(json, '$.executionStatus')) as execStatus "
              + "  FROM entity_extension_time_series "
              + "  WHERE extension = 'pipeline.pipelineStatus' "
              + "    AND timestamp = (SELECT MAX(timestamp) FROM entity_extension_time_series eets2 "
              + "                      WHERE eets2.entityFQNHash = entity_extension_time_series.entityFQNHash "
              + "                      AND eets2.extension = 'pipeline.pipelineStatus') "
              + ") latest_status ON %s.fqnHash = latest_status.entityFQNHash "
              + "%s AND latest_status.execStatus = :status",
          tableName, baseCondition);
    }

    default Map<String, Object> getBindMap(
        ListFilter filter, String status, int limit, String name, String id) {
      Map<String, Object> bindMap = new HashMap<>();
      if (status != null) {
        bindMap.put("status", status);
      }
      if (limit > 0) {
        bindMap.put("limit", limit);
      }
      if (name != null) {
        bindMap.put("beforeAfterName", name);
      }
      if (id != null) {
        bindMap.put("beforeAfterId", id);
      }
      // Add filter params
      bindMap.putAll(filter.getQueryParams());
      return bindMap;
    }

    @SqlQuery("SELECT json FROM pipeline_entity <cond>")
    List<String> listAfterWithStatus(
        @Define("cond") String cond, @BindMap Map<String, Object> bindings);

    @SqlQuery(
        "SELECT json FROM (SELECT name, id, json FROM pipeline_entity <cond>) last_rows_subquery ORDER BY name, id")
    List<String> listBeforeWithStatus(
        @Define("cond") String cond, @BindMap Map<String, Object> bindings);

    @SqlQuery("SELECT count(*) FROM pipeline_entity <cond>")
    int listCountWithStatus(@Define("cond") String cond, @BindMap Map<String, Object> bindings);
  }
}
