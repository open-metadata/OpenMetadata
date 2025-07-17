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
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.Entity.ORGANIZATION_NAME;
import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.jdbi3.ListFilter.escapeApostrophe;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.commons.lang3.tuple.Triple;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.StatementException;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindBean;
import org.jdbi.v3.sqlobject.customizer.BindBeanList;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.BindMap;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.jdbi.v3.sqlobject.statement.UseRowMapper;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.api.configuration.UiThemePreference;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.analytics.WebAnalyticEvent;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.api.configuration.profiler.ProfilerConfiguration;
import org.openmetadata.schema.api.lineage.LineageSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.auth.EmailVerificationToken;
import org.openmetadata.schema.auth.PasswordResetToken;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.auth.TokenType;
import org.openmetadata.schema.auth.collate.SupportToken;
import org.openmetadata.schema.configuration.AssetCertificationSettings;
import org.openmetadata.schema.configuration.WorkflowSettings;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Report;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FailedEvent;
import org.openmetadata.schema.entity.events.FailedEventResponse;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.UsageDetails;
import org.openmetadata.schema.type.UsageStats;
import org.openmetadata.schema.util.EntitiesCount;
import org.openmetadata.schema.util.ServicesCount;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.TagUsageDAO.TagLabelMapper;
import org.openmetadata.service.jdbi3.CollectionDAO.UsageDAO.UsageDetailsMapper;
import org.openmetadata.service.jdbi3.FeedRepository.FilterType;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlBatch;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.resources.events.subscription.TypedEvent;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.jdbi.BindConcat;
import org.openmetadata.service.util.jdbi.BindFQN;
import org.openmetadata.service.util.jdbi.BindJsonContains;
import org.openmetadata.service.util.jdbi.BindListFQN;
import org.openmetadata.service.util.jdbi.BindUUID;

public interface CollectionDAO {
  @CreateSqlObject
  DatabaseDAO databaseDAO();

  @CreateSqlObject
  DatabaseSchemaDAO databaseSchemaDAO();

  @CreateSqlObject
  EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  FieldRelationshipDAO fieldRelationshipDAO();

  @CreateSqlObject
  EntityExtensionDAO entityExtensionDAO();

  @CreateSqlObject
  AppExtensionTimeSeries appExtensionTimeSeriesDao();

  @CreateSqlObject
  AppsDataStore appStoreDAO();

  @CreateSqlObject
  EntityExtensionTimeSeriesDAO entityExtensionTimeSeriesDao();

  @CreateSqlObject
  ReportDataTimeSeriesDAO reportDataTimeSeriesDao();

  @CreateSqlObject
  ProfilerDataTimeSeriesDAO profilerDataTimeSeriesDao();

  @CreateSqlObject
  DataQualityDataTimeSeriesDAO dataQualityDataTimeSeriesDao();

  @CreateSqlObject
  TestCaseResolutionStatusTimeSeriesDAO testCaseResolutionStatusTimeSeriesDao();

  @CreateSqlObject
  QueryCostTimeSeriesDAO queryCostRecordTimeSeriesDAO();

  @CreateSqlObject
  TestCaseResultTimeSeriesDAO testCaseResultTimeSeriesDao();

  @CreateSqlObject
  RoleDAO roleDAO();

  @CreateSqlObject
  UserDAO userDAO();

  @CreateSqlObject
  TeamDAO teamDAO();

  @CreateSqlObject
  PersonaDAO personaDAO();

  @CreateSqlObject
  TagUsageDAO tagUsageDAO();

  @CreateSqlObject
  TagDAO tagDAO();

  @CreateSqlObject
  ClassificationDAO classificationDAO();

  @CreateSqlObject
  TableDAO tableDAO();

  @CreateSqlObject
  QueryDAO queryDAO();

  @CreateSqlObject
  UsageDAO usageDAO();

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
  DashboardDAO dashboardDAO();

  @CreateSqlObject
  ReportDAO reportDAO();

  @CreateSqlObject
  TopicDAO topicDAO();

  @CreateSqlObject
  MlModelDAO mlModelDAO();

  @CreateSqlObject
  SearchIndexDAO searchIndexDAO();

  @CreateSqlObject
  GlossaryDAO glossaryDAO();

  @CreateSqlObject
  GlossaryTermDAO glossaryTermDAO();

  @CreateSqlObject
  BotDAO botDAO();

  @CreateSqlObject
  DomainDAO domainDAO();

  @CreateSqlObject
  DataProductDAO dataProductDAO();

  @CreateSqlObject
  DataContractDAO dataContractDAO();

  @CreateSqlObject
  EventSubscriptionDAO eventSubscriptionDAO();

  @CreateSqlObject
  PolicyDAO policyDAO();

  @CreateSqlObject
  IngestionPipelineDAO ingestionPipelineDAO();

  @CreateSqlObject
  DatabaseServiceDAO dbServiceDAO();

  @CreateSqlObject
  MetadataServiceDAO metadataServiceDAO();

  @CreateSqlObject
  PipelineServiceDAO pipelineServiceDAO();

  @CreateSqlObject
  MlModelServiceDAO mlModelServiceDAO();

  @CreateSqlObject
  DashboardServiceDAO dashboardServiceDAO();

  @CreateSqlObject
  MessagingServiceDAO messagingServiceDAO();

  @CreateSqlObject
  StorageServiceDAO storageServiceDAO();

  @CreateSqlObject
  SearchServiceDAO searchServiceDAO();

  @CreateSqlObject
  ApiServiceDAO apiServiceDAO();

  @CreateSqlObject
  ContainerDAO containerDAO();

  @CreateSqlObject
  FeedDAO feedDAO();

  @CreateSqlObject
  StoredProcedureDAO storedProcedureDAO();

  @CreateSqlObject
  ChangeEventDAO changeEventDAO();

  @CreateSqlObject
  TypeEntityDAO typeEntityDAO();

  @CreateSqlObject
  TestDefinitionDAO testDefinitionDAO();

  @CreateSqlObject
  TestConnectionDefinitionDAO testConnectionDefinitionDAO();

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
  SystemDAO systemDAO();

  @CreateSqlObject
  TokenDAO getTokenDAO();

  @CreateSqlObject
  KpiDAO kpiDAO();

  @CreateSqlObject
  WorkflowDAO workflowDAO();

  @CreateSqlObject
  DataModelDAO dashboardDataModelDAO();

  @CreateSqlObject
  DocStoreDAO docStoreDAO();

  @CreateSqlObject
  SuggestionDAO suggestionDAO();

  @CreateSqlObject
  APICollectionDAO apiCollectionDAO();

  @CreateSqlObject
  APIEndpointDAO apiEndpointDAO();

  @CreateSqlObject
  WorkflowDefinitionDAO workflowDefinitionDAO();

  @CreateSqlObject
  WorkflowInstanceTimeSeriesDAO workflowInstanceTimeSeriesDAO();

  @CreateSqlObject
  WorkflowInstanceStateTimeSeriesDAO workflowInstanceStateTimeSeriesDAO();

  interface DashboardDAO extends EntityDAO<Dashboard> {
    @Override
    default String getTableName() {
      return "dashboard_entity";
    }

    @Override
    default Class<Dashboard> getEntityClass() {
      return Dashboard.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface DashboardServiceDAO extends EntityDAO<DashboardService> {
    @Override
    default String getTableName() {
      return "dashboard_service_entity";
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }

    @Override
    default Class<DashboardService> getEntityClass() {
      return DashboardService.class;
    }
  }

  interface DatabaseDAO extends EntityDAO<Database> {
    @Override
    default String getTableName() {
      return "database_entity";
    }

    @Override
    default Class<Database> getEntityClass() {
      return Database.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            "select JSON_EXTRACT(json, '$.fullyQualifiedName') from database_entity where id not in (select toId from entity_relationship where fromEntity = 'databaseService' and toEntity = 'database')",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "select json ->> 'fullyQualifiedName' from database_entity where id not in (select toId from entity_relationship where fromEntity = 'databaseService' and toEntity = 'database')",
        connectionType = POSTGRES)
    List<String> getBrokenDatabase();

    @SqlUpdate(
        value =
            "delete from database_entity where id not in (select toId from entity_relationship where fromEntity = 'databaseService' and toEntity = 'database')")
    int removeDatabase();
  }

  interface DatabaseSchemaDAO extends EntityDAO<DatabaseSchema> {
    @Override
    default String getTableName() {
      return "database_schema_entity";
    }

    @Override
    default Class<DatabaseSchema> getEntityClass() {
      return DatabaseSchema.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            "select JSON_EXTRACT(json, '$.fullyQualifiedName') from database_schema_entity where id not in (select toId from entity_relationship where fromEntity = 'database' and toEntity = 'databaseSchema')",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "select json ->> 'fullyQualifiedName' from database_schema_entity where id not in (select toId from entity_relationship where fromEntity = 'database' and toEntity = 'databaseSchema')",
        connectionType = POSTGRES)
    List<String> getBrokenDatabaseSchemas();

    @SqlUpdate(
        value =
            "delete from database_schema_entity where id not in (select toId from entity_relationship where fromEntity = 'database' and toEntity = 'databaseSchema')")
    int removeBrokenDatabaseSchemas();
  }

  interface DatabaseServiceDAO extends EntityDAO<DatabaseService> {
    @Override
    default String getTableName() {
      return "dbservice_entity";
    }

    @Override
    default Class<DatabaseService> getEntityClass() {
      return DatabaseService.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }
  }

  interface MetadataServiceDAO extends EntityDAO<MetadataService> {
    @Override
    default String getTableName() {
      return "metadata_service_entity";
    }

    @Override
    default Class<MetadataService> getEntityClass() {
      return MetadataService.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }
  }

  interface TestConnectionDefinitionDAO extends EntityDAO<TestConnectionDefinition> {
    @Override
    default String getTableName() {
      return "test_connection_definition";
    }

    @Override
    default Class<TestConnectionDefinition> getEntityClass() {
      return TestConnectionDefinition.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }
  }

  interface StorageServiceDAO extends EntityDAO<StorageService> {
    @Override
    default String getTableName() {
      return "storage_service_entity";
    }

    @Override
    default Class<StorageService> getEntityClass() {
      return StorageService.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }
  }

  interface ContainerDAO extends EntityDAO<Container> {
    @Override
    default String getTableName() {
      return "storage_container_entity";
    }

    @Override
    default Class<Container> getEntityClass() {
      return Container.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {

      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();

      // By default, root will be false. We won't filter the results then
      if (!root) {
        return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
      }

      String sqlCondition = String.format("%s AND er.toId is NULL", condition);
      return listBefore(
          getTableName(), filter.getQueryParams(), sqlCondition, limit, beforeName, beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();

      if (!root) {
        return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
      }

      String sqlCondition = String.format("%s AND er.toId is NULL", condition);

      return listAfter(
          getTableName(), filter.getQueryParams(), sqlCondition, limit, afterName, afterId);
    }

    @Override
    default int listCount(ListFilter filter) {
      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();

      if (!root) {
        return EntityDAO.super.listCount(filter);
      }

      String sqlCondition = String.format("%s AND er.toId is NULL", condition);
      return listCount(getTableName(), getNameHashColumn(), filter.getQueryParams(), sqlCondition);
    }

    @SqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT name,id, ce.json FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity = 'container' AND toEntity = 'container' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition> AND "
                + "(name < :beforeName OR (name = :beforeName AND id < :beforeId))  "
                + "ORDER BY name DESC,id DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name,id")
    List<String> listBefore(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String sqlCondition,
        @Bind("limit") int limit,
        @Bind("beforeName") String beforeName,
        @Bind("beforeId") String beforeId);

    @SqlQuery(
        value =
            "SELECT ce.json FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity = 'container' AND toEntity = 'container' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition> AND "
                + "(name > :afterName OR (name = :afterName AND id > :afterId))  "
                + "ORDER BY name,id "
                + "LIMIT :limit")
    List<String> listAfter(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String sqlCondition,
        @Bind("limit") int limit,
        @Bind("afterName") String afterName,
        @Bind("afterId") String afterId);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(<nameHashColumn>) FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity = 'container' AND toEntity = 'container' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition>",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity = 'container' AND toEntity = 'container' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition>",
        connectionType = POSTGRES)
    int listCount(
        @Define("table") String table,
        @Define("nameHashColumn") String nameHashColumn,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String mysqlCond);
  }

  interface SearchServiceDAO extends EntityDAO<SearchService> {
    @Override
    default String getTableName() {
      return "search_service_entity";
    }

    @Override
    default Class<SearchService> getEntityClass() {
      return SearchService.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }
  }

  interface ApiServiceDAO extends EntityDAO<ApiService> {
    @Override
    default String getTableName() {
      return "api_service_entity";
    }

    @Override
    default Class<ApiService> getEntityClass() {
      return ApiService.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }
  }

  interface SearchIndexDAO extends EntityDAO<SearchIndex> {
    @Override
    default String getTableName() {
      return "search_index_entity";
    }

    @Override
    default Class<SearchIndex> getEntityClass() {
      return SearchIndex.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface EntityExtensionDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "REPLACE INTO entity_extension(id, extension, jsonSchema, json) "
                + "VALUES (:id, :extension, :jsonSchema, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_extension(id, extension, jsonSchema, json) "
                + "VALUES (:id, :extension, :jsonSchema, (:json :: jsonb)) "
                + "ON CONFLICT (id, extension) DO UPDATE SET jsonSchema = EXCLUDED.jsonSchema, json = EXCLUDED.json",
        connectionType = POSTGRES)
    void insert(
        @BindUUID("id") UUID id,
        @Bind("extension") String extension,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @Transaction
    @ConnectionAwareSqlBatch(
        value =
            "REPLACE INTO entity_extension(id, extension, jsonSchema, json) "
                + "VALUES (:id, :extension, :jsonSchema, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlBatch(
        value =
            "INSERT INTO entity_extension(id, extension, jsonSchema, json) "
                + "VALUES (:id, :extension, :jsonSchema, (:json :: jsonb)) "
                + "ON CONFLICT (id, extension) DO UPDATE SET jsonSchema = EXCLUDED.jsonSchema, json = EXCLUDED.json",
        connectionType = POSTGRES)
    void insertMany(
        @BindUUID("id") List<UUID> id,
        @Bind("extension") List<String> extension,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") List<String> json);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE entity_extension SET json = :json where (json -> '$.id') = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE entity_extension SET json = (:json :: jsonb) where (json ->> 'id) = :id",
        connectionType = POSTGRES)
    void update(@BindUUID("id") UUID id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM entity_extension WHERE id = :id AND extension = :extension")
    String getExtension(@BindUUID("id") UUID id, @Bind("extension") String extension);

    @SqlQuery(
        "SELECT id, extension, json "
            + "FROM entity_extension "
            + "WHERE id IN (<ids>) AND extension LIKE :extension "
            + "ORDER BY id, extension")
    @RegisterRowMapper(ExtensionRecordWithIdMapper.class)
    List<ExtensionRecordWithId> getExtensionsBatch(
        @BindList("ids") List<String> ids,
        @BindConcat(
                value = "extension",
                parts = {":extensionPrefix", ".%"})
            String extensionPrefix);

    @SqlQuery(
        "SELECT id, extension, json, jsonschema "
            + "FROM entity_extension "
            + "WHERE extension LIKE :extension "
            + "ORDER BY id, extension")
    @RegisterRowMapper(ExtensionWithIdAndSchemaRowMapper.class)
    List<ExtensionWithIdAndSchemaObject> getExtensionsByPrefixBatch(
        @BindConcat(
                value = "extension",
                parts = {":extensionPrefix", "%"})
            String extensionPrefix);

    @Transaction
    @ConnectionAwareSqlBatch(
        value =
            "INSERT INTO entity_extension (id, extension, json, jsonschema) "
                + "VALUES (:id, :extension, :json, :jsonschema) "
                + "ON DUPLICATE KEY UPDATE json = VALUES(json), jsonschema = VALUES(jsonschema)",
        connectionType = MYSQL)
    @ConnectionAwareSqlBatch(
        value =
            "INSERT INTO entity_extension (id, extension, json,jsonschema) VALUES (:id, :extension, :json::jsonb,:jsonschema) "
                + "ON CONFLICT (id, extension) DO UPDATE SET json = EXCLUDED.json , jsonschema = EXCLUDED.jsonschema",
        connectionType = POSTGRES)
    void bulkUpsertExtensions(
        @BindBean List<ExtensionWithIdAndSchemaObject> extensionWithIdObjects);

    @RegisterRowMapper(ExtensionMapper.class)
    @SqlQuery(
        "SELECT extension, json FROM entity_extension WHERE id = :id AND extension "
            + "LIKE CONCAT (:extensionPrefix, '.%') "
            + "ORDER BY extension")
    List<ExtensionRecord> getExtensions(
        @BindUUID("id") UUID id, @Bind("extensionPrefix") String extensionPrefix);

    @RegisterRowMapper(ExtensionMapper.class)
    @SqlQuery(
        "SELECT extension, json FROM entity_extension WHERE id = :id AND extension "
            + "LIKE CONCAT (:extensionPrefix, '.%') "
            + "ORDER BY extension DESC "
            + "LIMIT :limit OFFSET :offset")
    List<ExtensionRecord> getExtensionsWithOffset(
        @BindUUID("id") UUID id,
        @Bind("extensionPrefix") String extensionPrefix,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    @SqlUpdate("DELETE FROM entity_extension WHERE id = :id AND extension = :extension")
    void delete(@BindUUID("id") UUID id, @Bind("extension") String extension);

    @SqlUpdate("DELETE FROM entity_extension WHERE extension = :extension")
    void deleteExtension(@Bind("extension") String extension);

    @SqlUpdate("DELETE FROM entity_extension WHERE id = :id")
    void deleteAll(@BindUUID("id") UUID id);
  }

  class EntityVersionPair {
    @Getter private final Double version;
    @Getter private final String entityJson;

    public EntityVersionPair(ExtensionRecord extensionRecord) {
      this.version = EntityUtil.getVersion(extensionRecord.extensionName());
      this.entityJson = extensionRecord.extensionJson();
    }
  }

  record ExtensionRecord(String extensionName, String extensionJson) {}

  record ExtensionRecordWithId(UUID id, String extensionName, String extensionJson) {}

  class ExtensionMapper implements RowMapper<ExtensionRecord> {
    @Override
    public ExtensionRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new ExtensionRecord(rs.getString("extension"), rs.getString("json"));
    }
  }

  class ExtensionRecordWithIdMapper implements RowMapper<ExtensionRecordWithId> {
    @Override
    public ExtensionRecordWithId map(ResultSet rs, StatementContext ctx) throws SQLException {
      String id = rs.getString("id");
      String extensionName = rs.getString("extension");
      String extensionJson = rs.getString("json");
      return new ExtensionRecordWithId(UUID.fromString(id), extensionName, extensionJson);
    }
  }

  @Getter
  @Setter
  @Builder
  class ExtensionWithIdAndSchemaObject {
    private String id;
    private String extension;
    private String json;
    private String jsonschema;
  }

  class ExtensionWithIdAndSchemaRowMapper implements RowMapper<ExtensionWithIdAndSchemaObject> {
    @Override
    public ExtensionWithIdAndSchemaObject map(ResultSet rs, StatementContext ctx)
        throws SQLException {
      String id = rs.getString("id");
      String extensionName = rs.getString("extension");
      String extensionJson = rs.getString("json");
      String jsonSchema = rs.getString("jsonschema");
      return new ExtensionWithIdAndSchemaObject(id, extensionName, extensionJson, jsonSchema);
    }
  }

  @Getter
  @Builder
  class EntityRelationshipRecord {
    private UUID id;
    private String type;
    private String json;
  }

  @Getter
  @Builder
  class EntityRelationshipCount {
    private UUID id;
    private Integer count;
  }

  @Getter
  @Builder
  class EntityRelationshipObject {
    private String fromId;
    private String toId;
    private String fromEntity;
    private String toEntity;
    private int relation;
    private String json;
    private String jsonSchema;
  }

  @Getter
  @Builder
  class ReportDataRow {
    private String rowNum;
    private ReportData reportData;
  }

  @Getter
  @Builder
  class QueryList {
    private String fqn;
    private Query query;
  }

  interface EntityRelationshipDAO {
    default void insert(UUID fromId, UUID toId, String fromEntity, String toEntity, int relation) {
      insert(fromId, toId, fromEntity, toEntity, relation, null);
    }

    default void bulkInsertToRelationship(
        UUID fromId, List<UUID> toIds, String fromEntity, String toEntity, int relation) {

      List<EntityRelationshipObject> insertToRelationship =
          toIds.stream()
              .map(
                  testCase ->
                      EntityRelationshipObject.builder()
                          .fromId(fromId.toString())
                          .toId(testCase.toString())
                          .fromEntity(fromEntity)
                          .toEntity(toEntity)
                          .relation(relation)
                          .build())
              .collect(Collectors.toList());

      bulkInsertTo(insertToRelationship);
    }

    default void bulkRemoveToRelationship(
        UUID fromId, List<UUID> toIds, String fromEntity, String toEntity, int relation) {

      List<String> toIdsAsString = toIds.stream().map(UUID::toString).toList();
      bulkRemoveTo(fromId, toIdsAsString, fromEntity, toEntity, relation);
    }

    default void bulkRemoveFromRelationship(
        List<UUID> fromIds, UUID toId, String fromEntity, String toEntity, int relation) {

      List<String> fromIdsAsString = fromIds.stream().map(UUID::toString).toList();
      bulkRemoveFrom(fromIdsAsString, toId, fromEntity, toEntity, relation);
    }

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_relationship(fromId, toId, fromEntity, toEntity, relation, json) "
                + "VALUES (:fromId, :toId, :fromEntity, :toEntity, :relation, :json) "
                + "ON DUPLICATE KEY UPDATE json = :json",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_relationship(fromId, toId, fromEntity, toEntity, relation, json) VALUES "
                + "(:fromId, :toId, :fromEntity, :toEntity, :relation, (:json :: jsonb)) "
                + "ON CONFLICT (fromId, toId, relation) DO UPDATE SET json = EXCLUDED.json",
        connectionType = POSTGRES)
    void insert(
        @BindUUID("fromId") UUID fromId,
        @BindUUID("toId") UUID toId,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO entity_relationship(fromId, toId, fromEntity, toEntity, relation) VALUES <values>",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_relationship(fromId, toId, fromEntity, toEntity, relation) VALUES <values>"
                + "ON CONFLICT DO NOTHING",
        connectionType = POSTGRES)
    void bulkInsertTo(
        @BindBeanList(
                value = "values",
                propertyNames = {"fromId", "toId", "fromEntity", "toEntity", "relation"})
            List<EntityRelationshipObject> values);

    @SqlUpdate(
        value =
            "DELETE FROM entity_relationship WHERE fromId = :fromId "
                + "AND fromEntity = :fromEntity AND toId IN (<toIds>) "
                + "AND toEntity = :toEntity AND relation = :relation")
    void bulkRemoveTo(
        @BindUUID("fromId") UUID fromId,
        @BindList("toIds") List<String> toIds,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    @SqlUpdate(
        "DELETE FROM entity_relationship "
            + "WHERE fromEntity = :fromEntity "
            + "AND fromId IN (<fromIds>) "
            + "AND toEntity = :toEntity "
            + "AND relation = :relation "
            + "AND toId = :toId")
    void bulkRemoveFrom(
        @BindList("fromIds") List<String> fromIds,
        @BindUUID("toId") UUID toId,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    //
    // Find to operations
    //
    @SqlQuery(
        "SELECT toId, toEntity, json FROM entity_relationship "
            + "WHERE fromId = :fromId AND fromEntity = :fromEntity AND relation IN (<relation>)")
    @RegisterRowMapper(ToRelationshipMapper.class)
    List<EntityRelationshipRecord> findTo(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @BindList("relation") List<Integer> relation);

    @SqlQuery(
        "SELECT * FROM entity_relationship er1 JOIN entity_relationship er2  ON er1.toId = er2.toId WHERE er1.relation = 10 AND er1.fromEntity = 'domain' AND er2.fromId = :fromId AND er2.fromEntity = :fromEntity AND er2.relation = 13")
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findDownstreamDomains(
        @BindUUID("fromId") UUID fromId, @Bind("fromEntity") String fromEntity);

    @SqlQuery(
        "SELECT * FROM entity_relationship er1 JOIN entity_relationship er2  ON er1.toId = er2.fromId WHERE er1.relation = 10 AND er1.fromEntity = 'domain' AND er2.toId = :toId AND er2.toEntity = :toEntity AND er2.relation = 13")
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findUpstreamDomains(
        @BindUUID("toId") UUID toId, @Bind("toEntity") String toEntity);

    @SqlQuery(
        "select count(*) from entity_relationship where fromId in (select toId from entity_relationship where fromId = :fromDomainId and fromEntity = 'domain' and relation = 10) AND toId in (select toId from entity_relationship where fromId = :toDomainId and fromEntity = 'domain' and relation = 10) and relation = 13")
    Integer countDomainChildAssets(
        @BindUUID("fromDomainId") UUID fromDomainId, @BindUUID("toDomainId") UUID toId);

    @SqlQuery(
        "SELECT * FROM entity_relationship er1 JOIN entity_relationship er2  ON er1.toId = er2.toId WHERE er1.relation = 10 AND er1.fromEntity = 'dataProduct' AND er2.fromId = :fromId AND er2.fromEntity = :fromEntity AND er2.relation = 13")
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findDownstreamDataProducts(
        @BindUUID("fromId") UUID fromId, @Bind("fromEntity") String fromEntity);

    @SqlQuery(
        "SELECT * FROM entity_relationship er1 JOIN entity_relationship er2  ON er1.toId = er2.fromId WHERE er1.relation = 10 AND er1.fromEntity = 'dataProduct' AND er2.toId = :toId AND er2.toEntity = :toEntity AND er2.relation = 13")
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findUpstreamDataProducts(
        @BindUUID("toId") UUID toId, @Bind("toEntity") String toEntity);

    @SqlQuery(
        "select count(*) from entity_relationship where fromId in (select toId from entity_relationship where fromId = :fromDataProductId and fromEntity = 'dataProduct' and relation = 10) AND toId in (select toId from entity_relationship where fromId = :toDataProductId and fromEntity = 'dataProduct' and relation = 10) and relation = 13")
    Integer countDataProductsChildAssets(
        @BindUUID("fromDataProductId") UUID fromDataProductId,
        @BindUUID("toDataProductId") UUID toDataProductId);

    default List<EntityRelationshipRecord> findTo(UUID fromId, String fromEntity, int relation) {
      return findTo(fromId, fromEntity, List.of(relation));
    }

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE fromId IN (<fromIds>) "
            + "AND relation = :relation "
            + "AND fromEntity = :fromEntityType "
            + "AND toEntity = :toEntityType "
            + "AND deleted = FALSE")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findToBatch(
        @BindList("fromIds") List<String> fromIds,
        @Bind("relation") int relation,
        @Bind("fromEntityType") String fromEntityType,
        @Bind("toEntityType") String toEntityType);

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE fromId IN (<fromIds>) "
            + "AND relation = :relation "
            + "AND toEntity = :toEntityType "
            + "AND deleted = FALSE")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findToBatch(
        @BindList("fromIds") List<String> fromIds,
        @Bind("relation") int relation,
        @Bind("toEntityType") String toEntityType);

    @SqlQuery(
        "SELECT toId, toEntity, json FROM entity_relationship "
            + "WHERE fromId = :fromId AND fromEntity = :fromEntity AND relation = :relation AND toEntity = :toEntity")
    @RegisterRowMapper(ToRelationshipMapper.class)
    List<EntityRelationshipRecord> findTo(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity);

    @SqlQuery(
        "SELECT toId FROM entity_relationship  "
            + "WHERE fromId = :fromId AND fromEntity = :fromEntity AND relation = :relation AND toEntity = :toEntity")
    @RegisterRowMapper(ToRelationshipMapper.class)
    List<UUID> findToIds(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity);

    @SqlQuery(
        "SELECT fromId, COUNT(toId) FROM entity_relationship "
            + "WHERE fromId IN (<fromIds>) AND fromEntity = :fromEntity AND relation = :relation AND toEntity = :toEntity "
            + "GROUP BY fromId")
    @RegisterRowMapper(ToRelationshipCountMapper.class)
    List<EntityRelationshipCount> countFindTo(
        @BindList("fromIds") List<String> fromIds,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity);

    @SqlQuery(
        "SELECT COUNT(toId) FROM entity_relationship WHERE fromId = :fromId AND fromEntity = :fromEntity "
            + "AND relation IN (<relation>)")
    @RegisterRowMapper(ToRelationshipMapper.class)
    int countFindTo(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @BindList("relation") List<Integer> relation);

    @SqlQuery(
        "SELECT toId, toEntity, json FROM entity_relationship WHERE fromId = :fromId AND fromEntity = :fromEntity "
            + "AND relation IN (<relation>) ORDER BY toId LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(ToRelationshipMapper.class)
    List<EntityRelationshipRecord> findToWithOffset(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @BindList("relation") List<Integer> relation,
        @Bind("offset") int offset,
        @Bind("limit") int limit);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT toId, toEntity, json FROM entity_relationship "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.pipeline.id')) =:fromId OR fromId = :fromId AND relation = :relation "
                + "ORDER BY toId",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT toId, toEntity, json FROM entity_relationship "
                + "WHERE  json->'pipeline'->>'id' =:fromId OR fromId = :fromId AND relation = :relation "
                + "ORDER BY toId",
        connectionType = POSTGRES)
    @RegisterRowMapper(ToRelationshipMapper.class)
    List<EntityRelationshipRecord> findToPipeline(
        @BindUUID("fromId") UUID fromId, @Bind("relation") int relation);

    //
    // Find from operations
    //
    @SqlQuery(
        "SELECT fromId, fromEntity, json FROM entity_relationship "
            + "WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation AND fromEntity = :fromEntity ")
    @RegisterRowMapper(FromRelationshipMapper.class)
    List<EntityRelationshipRecord> findFrom(
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("fromEntity") String fromEntity);

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE toId IN (<toIds>) "
            + "AND relation = :relation "
            + "AND deleted = FALSE")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findFromBatch(
        @BindList("toIds") List<String> toIds, @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE toId IN (<toIds>) "
            + "AND relation = :relation "
            + "AND fromEntity = :fromEntityType  "
            + "AND deleted = FALSE")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<CollectionDAO.EntityRelationshipObject> findFromBatch(
        @BindList("toIds") List<String> toIds,
        @Bind("relation") int relation,
        @Bind("fromEntityType") String fromEntityType);

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE toId IN (<toIds>) "
            + "AND relation = :relation "
            + "AND toEntity = :toEntityType "
            + "AND deleted = FALSE")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findFromBatch(
        @BindList("toIds") List<String> toIds,
        @Bind("toEntityType") String toEntityType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromId, fromEntity, json FROM entity_relationship "
            + "WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation")
    @RegisterRowMapper(FromRelationshipMapper.class)
    List<EntityRelationshipRecord> findFrom(
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromId, toId, fromEntity, toEntity, relation, json, jsonSchema "
            + "FROM entity_relationship "
            + "WHERE toId IN (<toIds>) "
            + "AND relation = :relation "
            + "AND fromEntity = :fromEntityType "
            + "AND toEntity = :toEntityType "
            + "AND deleted = FALSE")
    @UseRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findFromBatch(
        @BindList("toIds") List<String> toIds,
        @Bind("relation") int relation,
        @Bind("fromEntityType") String fromEntityType,
        @Bind("toEntityType") String toEntityType);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT fromId, fromEntity, json FROM entity_relationship "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.pipeline.id')) = :toId OR toId = :toId AND relation = :relation "
                + "ORDER BY fromId",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT fromId, fromEntity, json FROM entity_relationship "
                + "WHERE  json->'pipeline'->>'id' = :toId OR toId = :toId AND relation = :relation "
                + "ORDER BY fromId",
        connectionType = POSTGRES)
    @RegisterRowMapper(FromRelationshipMapper.class)
    List<EntityRelationshipRecord> findFromPipeline(
        @BindUUID("toId") UUID toId, @Bind("relation") int relation);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT toId, toEntity, fromId, fromEntity, relation, json, jsonSchema FROM entity_relationship "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.source')) = :source AND (toId = :toId AND toEntity = :toEntity) "
                + "AND relation = :relation ORDER BY fromId",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT toId, toEntity, fromId, fromEntity, relation, json, jsonSchema FROM entity_relationship "
                + "WHERE  json->>'source' = :source AND (toId = :toId AND toEntity = :toEntity) "
                + "AND relation = :relation ORDER BY fromId",
        connectionType = POSTGRES)
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findLineageBySource(
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("source") String source,
        @Bind("relation") int relation);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT toId, toEntity, fromId, fromEntity, relation, json, jsonSchema FROM entity_relationship "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.pipeline.id')) =:toId OR toId = :toId AND relation = :relation "
                + "AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.source')) = :source ORDER BY toId",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT toId, toEntity, fromId, fromEntity, relation, json, jsonSchema FROM entity_relationship "
                + "WHERE  json->'pipeline'->>'id' =:toId OR toId = :toId AND relation = :relation "
                + "AND json->>'source' = :source ORDER BY toId",
        connectionType = POSTGRES)
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findLineageBySourcePipeline(
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("source") String source,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT count(*) FROM entity_relationship WHERE fromEntity = :fromEntity AND toEntity = :toEntity")
    int findIfAnyRelationExist(
        @Bind("fromEntity") String fromEntity, @Bind("toEntity") String toEntity);

    @SqlQuery(
        "SELECT json FROM entity_relationship WHERE fromId = :fromId "
            + " AND toId = :toId "
            + " AND relation = :relation ")
    String getRelation(
        @BindUUID("fromId") UUID fromId,
        @BindUUID("toId") UUID toId,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT toId, toEntity, fromId, fromEntity, relation, json, jsonSchema FROM entity_relationship WHERE fromId = :fromId "
            + " AND toId = :toId "
            + " AND relation = :relation ")
    @RegisterRowMapper(RelationshipObjectMapper.class)
    EntityRelationshipObject getRecord(
        @BindUUID("fromId") UUID fromId,
        @BindUUID("toId") UUID toId,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT toId, toEntity, fromId, fromEntity, relation, json, jsonSchema FROM entity_relationship where relation = :relation ORDER BY fromId, toId LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> getRecordWithOffset(
        @Bind("relation") int relation, @Bind("offset") long offset, @Bind("limit") int limit);

    @SqlQuery(
        "SELECT toId, toEntity, fromId, fromEntity, relation, json, jsonSchema FROM entity_relationship ORDER BY fromId, toId LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(RelationshipObjectMapper.class)
    List<EntityRelationshipObject> getAllRelationshipsPaginated(
        @Bind("offset") long offset, @Bind("limit") int limit);

    @SqlQuery("SELECT COUNT(*) FROM entity_relationship")
    long getTotalRelationshipCount();

    //
    // Delete Operations
    //
    @SqlUpdate(
        "DELETE from entity_relationship WHERE fromId = :fromId "
            + "AND fromEntity = :fromEntity AND toId = :toId AND toEntity = :toEntity "
            + "AND relation = :relation")
    int delete(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    // Delete all the entity relationship fromID --- relation --> entity of type toEntity
    @SqlUpdate(
        "DELETE from entity_relationship WHERE fromId = :fromId AND fromEntity = :fromEntity "
            + "AND relation = :relation AND toEntity = :toEntity")
    void deleteFrom(
        @BindUUID("fromId") UUID fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity);

    // Delete all the entity relationship toId <-- relation --  entity of type fromEntity
    @SqlUpdate(
        "DELETE from entity_relationship WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation "
            + "AND fromEntity = :fromEntity")
    void deleteTo(
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("fromEntity") String fromEntity);

    @SqlUpdate(
        "DELETE from entity_relationship WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation")
    void deleteTo(
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    @SqlUpdate(
        "DELETE from entity_relationship WHERE (toId = :id AND toEntity = :entity) OR "
            + "(fromId = :id AND fromEntity = :entity)")
    void deleteAll(@BindUUID("id") UUID id, @Bind("entity") String entity);

    @SqlUpdate(
        "DELETE FROM entity_relationship "
            + "WHERE (toId IN (<ids>) AND toEntity = :entity) "
            + "   OR (fromId IN (<ids>) AND fromEntity = :entity)")
    void deleteAllByThreadIds(@BindList("ids") List<String> ids, @Bind("entity") String entity);

    @SqlUpdate("DELETE from entity_relationship WHERE fromId = :id or toId = :id")
    void deleteAllWithId(@BindUUID("id") UUID id);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM entity_relationship "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.source')) = :source AND toId = :toId AND toEntity = :toEntity "
                + "AND relation = :relation",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM entity_relationship "
                + "WHERE  json->>'source' = :source AND (toId = :toId AND toEntity = :toEntity) "
                + "AND relation = :relation",
        connectionType = POSTGRES)
    void deleteLineageBySource(
        @BindUUID("toId") UUID toId,
        @Bind("toEntity") String toEntity,
        @Bind("source") String source,
        @Bind("relation") int relation);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM entity_relationship "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.pipeline.id')) =:toId OR toId = :toId AND relation = :relation "
                + "AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.source')) = :source ORDER BY toId",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM entity_relationship "
                + "WHERE  json->'pipeline'->>'id' =:toId OR toId = :toId AND relation = :relation "
                + "AND json->>'source' = :source",
        connectionType = POSTGRES)
    void deleteLineageBySourcePipeline(
        @BindUUID("toId") UUID toId, @Bind("source") String source, @Bind("relation") int relation);

    class FromRelationshipMapper implements RowMapper<EntityRelationshipRecord> {
      @Override
      public EntityRelationshipRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return EntityRelationshipRecord.builder()
            .id(UUID.fromString(rs.getString("fromId")))
            .type(rs.getString("fromEntity"))
            .json(rs.getString("json"))
            .build();
      }
    }

    class ToRelationshipMapper implements RowMapper<EntityRelationshipRecord> {
      @Override
      public EntityRelationshipRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return EntityRelationshipRecord.builder()
            .id(UUID.fromString(rs.getString("toId")))
            .type(rs.getString("toEntity"))
            .json(rs.getString("json"))
            .build();
      }
    }

    class ToRelationshipCountMapper implements RowMapper<EntityRelationshipCount> {
      @Override
      public EntityRelationshipCount map(ResultSet rs, StatementContext ctx) throws SQLException {
        return EntityRelationshipCount.builder()
            .id(UUID.fromString(rs.getString(1)))
            .count(rs.getInt(2))
            .build();
      }
    }

    class RelationshipObjectMapper implements RowMapper<EntityRelationshipObject> {
      @Override
      public EntityRelationshipObject map(ResultSet rs, StatementContext ctx) throws SQLException {
        return EntityRelationshipObject.builder()
            .fromId(rs.getString("fromId"))
            .fromEntity(rs.getString("fromEntity"))
            .toEntity(rs.getString("toEntity"))
            .toId(rs.getString("toId"))
            .relation(rs.getInt("relation"))
            .json(rs.getString("json"))
            .jsonSchema(rs.getString("jsonSchema"))
            .build();
      }
    }
  }

  interface FeedDAO {
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO thread_entity(json) VALUES (:json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO thread_entity(json) VALUES (:json :: jsonb)",
        connectionType = POSTGRES)
    void insert(@Bind("json") String json);

    @SqlQuery("SELECT json FROM thread_entity WHERE id = :id")
    String findById(@BindUUID("id") UUID id);

    @SqlQuery("SELECT json FROM thread_entity ORDER BY createdAt DESC")
    List<String> list();

    @SqlQuery("SELECT count(id) FROM thread_entity <condition>")
    int listCount(@Define("condition") String condition);

    @SqlUpdate("DELETE FROM thread_entity WHERE id = :id")
    void delete(@BindUUID("id") UUID id);

    @SqlUpdate("DELETE FROM thread_entity WHERE id IN (<ids>)")
    int deleteByIds(@BindList("ids") List<String> ids);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE task_sequence SET id=LAST_INSERT_ID(id+1)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE task_sequence SET id=(id+1) RETURNING id",
        connectionType = POSTGRES)
    void updateTaskId();

    @SqlQuery("SELECT id FROM task_sequence LIMIT 1")
    int getTaskId();

    @SqlQuery("SELECT json FROM thread_entity WHERE taskId = :id")
    String findByTaskId(@Bind("id") int id);

    @SqlQuery("SELECT json FROM thread_entity <condition> ORDER BY createdAt DESC LIMIT :limit")
    List<String> list(@Bind("limit") int limit, @Define("condition") String condition);

    @SqlQuery(
        "SELECT json FROM thread_entity "
            + "WHERE type='Announcement' AND (:threadId IS NULL OR id != :threadId) "
            + "AND entityId = :entityId "
            + "AND (( :startTs >= announcementStart AND :startTs < announcementEnd) "
            + "OR (:endTs > announcementStart AND :endTs < announcementEnd) "
            + "OR (:startTs <= announcementStart AND :endTs >= announcementEnd))")
    List<String> listAnnouncementBetween(
        @BindUUID("threadId") UUID threadId,
        @BindUUID("entityId") UUID entityId,
        @Bind("startTs") long startTs,
        @Bind("endTs") long endTs);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM thread_entity <condition> AND "
                + "to_tsvector('simple', taskAssigneesIds) @@ to_tsquery('simple', :userTeamJsonPostgres) "
                + "ORDER BY createdAt DESC "
                + "LIMIT :limit",
        connectionType = POSTGRES)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM thread_entity <condition> AND "
                + "MATCH(taskAssigneesIds) AGAINST (:userTeamJsonMysql IN BOOLEAN MODE) "
                + "ORDER BY createdAt DESC "
                + "LIMIT :limit",
        connectionType = MYSQL)
    List<String> listTasksAssigned(
        @Bind("userTeamJsonPostgres") String userTeamJsonPostgres,
        @Bind("userTeamJsonMysql") String userTeamJsonMysql,
        @Bind("limit") int limit,
        @Define("condition") String condition);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(id) FROM thread_entity <condition> AND "
                + "to_tsvector('simple', taskAssigneesIds) @@ to_tsquery('simple', :userTeamJsonPostgres) ",
        connectionType = POSTGRES)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(id) FROM thread_entity <condition> AND "
                + "MATCH(taskAssigneesIds) AGAINST (:userTeamJsonMysql IN BOOLEAN MODE) ",
        connectionType = MYSQL)
    int listCountTasksAssignedTo(
        @Bind("userTeamJsonPostgres") String userTeamJsonPostgres,
        @Bind("userTeamJsonMysql") String userTeamJsonMysql,
        @Define("condition") String condition);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM thread_entity <condition> "
                + "AND (to_tsvector('simple', taskAssigneesIds) @@ to_tsquery('simple', :userTeamJsonPostgres) OR createdBy = :username) "
                + "ORDER BY createdAt DESC "
                + "LIMIT :limit",
        connectionType = POSTGRES)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM thread_entity <condition> "
                + "AND (MATCH(taskAssigneesIds) AGAINST (:userTeamJsonMysql IN BOOLEAN MODE) OR createdBy = :username) "
                + "ORDER BY createdAt DESC "
                + "LIMIT :limit",
        connectionType = MYSQL)
    List<String> listTasksOfUser(
        @Bind("userTeamJsonPostgres") String userTeamJsonPostgres,
        @Bind("userTeamJsonMysql") String userTeamJsonMysql,
        @Bind("username") String username,
        @Bind("limit") int limit,
        @Define("condition") String condition);

    @SqlQuery(
        "SELECT id FROM thread_entity WHERE type = 'Conversation' AND createdAt < :cutoffMillis LIMIT :batchSize")
    List<UUID> fetchConversationThreadIdsOlderThan(
        @Bind("cutoffMillis") long cutoffMillis, @Bind("batchSize") int batchSize);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(id) FROM thread_entity <condition> "
                + "AND (to_tsvector('simple', taskAssigneesIds) @@ to_tsquery('simple', :userTeamJsonPostgres)  OR createdBy = :username) ",
        connectionType = POSTGRES)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(id) FROM thread_entity <condition> "
                + "AND (MATCH(taskAssigneesIds) AGAINST (:userTeamJsonMysql IN BOOLEAN MODE) OR createdBy = :username) ",
        connectionType = MYSQL)
    int listCountTasksOfUser(
        @Bind("userTeamJsonPostgres") String userTeamJsonPostgres,
        @Bind("userTeamJsonMysql") String userTeamJsonMysql,
        @Bind("username") String username,
        @Define("condition") String condition);

    @SqlQuery(
        "SELECT json FROM thread_entity <condition> AND createdBy = :username ORDER BY createdAt DESC LIMIT :limit")
    List<String> listTasksAssigned(
        @Bind("username") String username,
        @Bind("limit") int limit,
        @Define("condition") String condition);

    @SqlQuery("SELECT count(id) FROM thread_entity <condition> AND createdBy = :username")
    int listCountTasksAssignedBy(
        @Bind("username") String username, @Define("condition") String condition);

    @SqlQuery(
        "SELECT json FROM thread_entity where type = 'Task' LIMIT :limit OFFSET :paginationOffset")
    List<String> listTaskThreadWithOffset(
        @Bind("limit") int limit, @Bind("paginationOffset") int paginationOffset);

    @SqlQuery(
        "SELECT json FROM thread_entity where type != 'Task' AND createdAt > :cutoffMillis ORDER BY createdAt LIMIT :limit OFFSET :paginationOffset")
    List<String> listOtherConversationThreadWithOffset(
        @Bind("cutoffMillis") long cutoffMillis,
        @Bind("limit") int limit,
        @Bind("paginationOffset") int paginationOffset);

    @SqlQuery(
        "SELECT json FROM thread_entity <condition> AND "
            // Entity for which the thread is about is owned by the user or his teams
            + "(entityId in (SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation=8) OR "
            + "id in (SELECT toId FROM entity_relationship WHERE (fromEntity='user' AND fromId= :userId AND toEntity='THREAD' AND relation IN (1,2)))) "
            + "ORDER BY createdAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByOwner(
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("limit") int limit,
        @Define("condition") String condition);

    @SqlQuery(
        "SELECT count(id) FROM thread_entity <condition> AND "
            + "(entityId in (SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation=8) OR "
            + "id in (SELECT toId FROM entity_relationship WHERE (fromEntity='user' AND fromId= :userId AND toEntity='THREAD' AND relation IN (1,2)))) ")
    int listCountThreadsByOwner(
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Define("condition") String condition);

    @SqlQuery(
        value =
            "SELECT json "
                + " FROM thread_entity "
                + " WHERE testCaseResolutionStatusId = :testCaseResolutionStatusId")
    String fetchThreadByTestCaseResolutionStatusId(
        @BindUUID("testCaseResolutionStatusId") UUID testCaseResolutionStatusId);

    default List<String> listThreadsByEntityLink(
        FeedFilter filter,
        EntityLink entityLink,
        int limit,
        int relation,
        String userName,
        List<String> teamNames) {
      int filterRelation = -1;
      if (userName != null && filter.getFilterType() == FilterType.MENTIONS) {
        filterRelation = MENTIONED_IN.ordinal();
      }
      return listThreadsByEntityLink(
          entityLink.getFullyQualifiedFieldValue(),
          entityLink.getFullyQualifiedFieldType(),
          limit,
          relation,
          userName,
          teamNames,
          filterRelation,
          filter.getCondition());
    }

    @SqlQuery(
        "SELECT json FROM thread_entity <condition> "
            + "AND hash_id in (SELECT fromFQNHash FROM field_relationship WHERE "
            + "(:fqnPrefixHash IS NULL OR toFQNHash LIKE :concatFqnPrefixHash OR toFQNHash=:fqnPrefixHash) AND fromType='THREAD' AND "
            + "(:toType IS NULL OR toType LIKE :concatToType OR toType=:toType) AND relation= :relation) "
            + "AND (:userName IS NULL OR MD5(id) in (SELECT toFQNHash FROM field_relationship WHERE "
            + " ((fromType='user' AND fromFQNHash= :userName) OR"
            + " (fromType='team' AND fromFQNHash IN (<teamNames>))) AND toType='THREAD' AND relation= :filterRelation) )"
            + "ORDER BY createdAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByEntityLink(
        @BindConcat(
                value = "concatFqnPrefixHash",
                original = "fqnPrefixHash",
                parts = {":fqnPrefixHash", ".%"},
                hash = true)
            String fqnPrefixHash,
        @BindConcat(
                value = "concatToType",
                original = "toType",
                parts = {":toType", ".%"})
            String toType,
        @Bind("limit") int limit,
        @Bind("relation") int relation,
        @BindFQN("userName") String userName,
        @BindList("teamNames") List<String> teamNames,
        @Bind("filterRelation") int filterRelation,
        @Define("condition") String condition);

    default int listCountThreadsByEntityLink(
        FeedFilter filter,
        EntityLink entityLink,
        int relation,
        String userName,
        List<String> teamNames) {
      int filterRelation = -1;
      if (userName != null && filter.getFilterType() == FilterType.MENTIONS) {
        filterRelation = MENTIONED_IN.ordinal();
      }
      return listCountThreadsByEntityLink(
          entityLink.getFullyQualifiedFieldValue(),
          entityLink.getFullyQualifiedFieldType(),
          relation,
          userName,
          teamNames,
          filterRelation,
          filter.getCondition(false));
    }

    @SqlQuery(
        "SELECT count(id) FROM thread_entity <condition> "
            + "AND hash_id in (SELECT fromFQNHash FROM field_relationship WHERE "
            + "(:fqnPrefixHash IS NULL OR toFQNHash LIKE :concatFqnPrefixHash OR toFQNHash=:fqnPrefixHash) AND fromType='THREAD' AND "
            + "(:toType IS NULL OR toType LIKE :concatToType OR toType=:toType) AND relation= :relation) "
            + "AND (:userName IS NULL OR id in (SELECT toFQNHash FROM field_relationship WHERE "
            + " ((fromType='user' AND fromFQNHash= :userName) OR"
            + " (fromType='team' AND fromFQNHash IN (<teamNames>))) AND toType='THREAD' AND relation= :filterRelation) )")
    int listCountThreadsByEntityLink(
        @BindConcat(
                value = "concatFqnPrefixHash",
                original = "fqnPrefixHash",
                parts = {":fqnPrefixHash", ".%"},
                hash = true)
            String fqnPrefixHash,
        @BindConcat(
                value = "concatToType",
                original = "toType",
                parts = {":toType", ".%"})
            String toType,
        @Bind("relation") int relation,
        @Bind("userName") String userName,
        @BindList("teamNames") List<String> teamNames,
        @Bind("filterRelation") int filterRelation,
        @Define("condition") String condition);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE thread_entity SET json = :json where id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE thread_entity SET json = (:json :: jsonb) where id = :id",
        connectionType = POSTGRES)
    void update(@BindUUID("id") UUID id, @Bind("json") String json);

    @SqlQuery(
        "SELECT entityLink, type, taskStatus, COUNT(id) as count FROM ( "
            + "    SELECT te.entityLink, te.type, te.taskStatus, te.id "
            + "    FROM thread_entity te "
            + "    WHERE hash_id IN ( "
            + "        SELECT fromFQNHash FROM field_relationship "
            + "        WHERE "
            + "            (:fqnPrefixHash IS NULL OR toFQNHash LIKE :concatFqnPrefixHash OR toFQNHash = :fqnPrefixHash) "
            + "            AND fromType = 'THREAD' "
            + "            AND (:toType IS NULL OR toType LIKE :concatToType OR toType = :toType) "
            + "            AND relation = 3 "
            + "    )  "
            + "    UNION  "
            + "    SELECT te.entityLink, te.type, te.taskStatus, te.id "
            + "    FROM thread_entity te "
            + "    WHERE te.entityId = :entityId "
            + ") AS combined WHERE combined.type IS NOT NULL "
            + "GROUP BY type, taskStatus, entityLink")
    @RegisterRowMapper(ThreadCountFieldMapper.class)
    List<List<String>> listCountByEntityLink(
        @BindUUID("entityId") UUID entityId,
        @BindConcat(
                value = "concatFqnPrefixHash",
                original = "fqnPrefixHash",
                parts = {":fqnPrefixHash", ".%"},
                hash = true)
            String fqnPrefixHash,
        @BindConcat(
                value = "concatToType",
                original = "toType",
                parts = {":toType", ".%"})
            String toType);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(te.id) AS count "
                + "FROM thread_entity te "
                + "WHERE te.type = 'Announcement' "
                + "  AND te.entityLink = :entityLink "
                + "  AND CAST(JSON_EXTRACT(te.json, '$.announcement.startTime') AS UNSIGNED) <= UNIX_TIMESTAMP()*1000 "
                + "  AND CAST(JSON_EXTRACT(te.json, '$.announcement.endTime') AS UNSIGNED) >= UNIX_TIMESTAMP()*1000",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(te.id) AS count "
                + "FROM thread_entity te "
                + "WHERE te.type = 'Announcement' "
                + "  AND te.entityLink = :entityLink "
                + "  AND (te.json->'announcement'->>'startTime')::numeric <= EXTRACT(EPOCH FROM NOW()) * 1000 "
                + "  AND (te.json->'announcement'->>'endTime')::numeric >= EXTRACT(EPOCH FROM NOW()) * 1000",
        connectionType = POSTGRES)
    int countActiveAnnouncement(@Bind("entityLink") String entityLink);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT combined.type, combined.taskStatus, COUNT(combined.id) AS count "
                + "FROM ( "
                + "    SELECT te.type, te.taskStatus, te.id  "
                + "    FROM thread_entity te "
                + "    JOIN entity_relationship er ON te.entityId = er.toId "
                + "    WHERE "
                + "        (er.fromEntity = 'user' AND er.fromId = :userId AND er.relation = 8 AND te.type <> 'Task') "
                + "        OR (er.fromEntity = 'team' AND er.fromId IN (<teamIds>) AND er.relation = 8  AND te.type <> 'Task') "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM thread_entity te "
                + "    JOIN entity_relationship er ON te.id = er.toId "
                + "    WHERE "
                + "        er.fromEntity = 'user' AND er.fromId = :userId AND er.toEntity = 'THREAD' AND er.relation IN (1, 2) "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM thread_entity te "
                + "    JOIN entity_relationship er ON te.id = er.toId "
                + "    WHERE "
                + "        (er.fromEntity = 'user' AND er.fromId = :userId AND er.relation = 11) "
                + "        OR (er.fromEntity = 'team' AND er.fromId IN (<teamIds>) AND er.relation = 11) "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM thread_entity te "
                + "    WHERE te.createdBy = :username "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM thread_entity te "
                + "    WHERE MATCH(te.taskAssigneesIds) AGAINST (:userTeamJsonMysql IN BOOLEAN MODE) "
                + ") AS combined WHERE combined.type is not NULL "
                + "GROUP BY combined.type, combined.taskStatus;",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT combined.type, combined.taskStatus, COUNT(combined.id) AS count "
                + "FROM ( "
                + "    SELECT te.type, te.taskStatus, te.id  "
                + "    FROM thread_entity te "
                + "    JOIN entity_relationship er ON te.entityId = er.toId "
                + "    WHERE "
                + "        (er.fromEntity = 'user' AND er.fromId = :userId AND er.relation = 8 AND te.type <> 'Task') "
                + "        OR (er.fromEntity = 'team' AND er.fromId IN (<teamIds>) AND er.relation = 8 AND te.type <> 'Task') "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM thread_entity te "
                + "    JOIN entity_relationship er ON te.id = er.toId "
                + "    WHERE "
                + "        er.fromEntity = 'user' AND er.fromId = :userId AND er.toEntity = 'THREAD' AND er.relation IN (1, 2) "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM thread_entity te "
                + "    JOIN entity_relationship er ON te.id = er.toId "
                + "    WHERE "
                + "        (er.fromEntity = 'user' AND er.fromId = :userId AND er.relation = 11) "
                + "        OR (er.fromEntity = 'team' AND er.fromId IN (<teamIds>) AND er.relation = 11) "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM thread_entity te "
                + "    WHERE te.createdBy = :username "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM thread_entity te "
                + "    WHERE to_tsvector('simple', taskAssigneesIds) @@ to_tsquery('simple', :userTeamJsonPostgres) "
                + ") AS combined WHERE combined.type is not NULL "
                + "GROUP BY combined.type, combined.taskStatus;",
        connectionType = POSTGRES)
    @RegisterRowMapper(OwnerCountFieldMapper.class)
    List<List<String>> listCountByOwner(
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("username") String username,
        @Bind("userTeamJsonMysql") String userTeamJsonMysql,
        @Bind("userTeamJsonPostgres") String userTeamJsonPostgres);

    @SqlQuery(
        "SELECT json FROM thread_entity <condition> AND "
            + "entityId in ("
            + "SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation= :relation) "
            + "ORDER BY createdAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByFollows(
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("limit") int limit,
        @Bind("relation") int relation,
        @Define("condition") String condition);

    @SqlQuery(
        "SELECT count(id) FROM thread_entity <condition> AND "
            + "entityId in ("
            + "SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation= :relation)")
    int listCountThreadsByFollows(
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("relation") int relation,
        @Define("condition") String condition);

    @SqlQuery(
        "SELECT json FROM ( "
            + "    SELECT json, createdAt FROM thread_entity te "
            + "     <condition> AND entityId IN ( "
            + "        SELECT toId FROM entity_relationship er "
            + "        WHERE er.relation = 8 "
            + "        AND ( "
            + "            (er.fromEntity = 'user' AND er.fromId = :userId) "
            + "            OR (er.fromEntity = 'team' AND er.fromId IN (<teamIds>)) "
            + "        ) "
            + "    )  "
            + "    UNION   "
            + "    SELECT json, createdAt FROM thread_entity te  "
            + "     <condition> AND id IN ( "
            + "        SELECT toId FROM entity_relationship er  "
            + "        WHERE er.toEntity = 'THREAD'  "
            + "        AND er.relation IN (1, 2)  "
            + "        AND er.fromEntity = 'user'  "
            + "        AND er.fromId = :userId  "
            + "    )  "
            + "    UNION   "
            + "    SELECT json, createdAt FROM thread_entity te  "
            + "     <condition> AND id IN ( "
            + "        SELECT toId FROM entity_relationship er  "
            + "        WHERE er.relation = 11  "
            + "        AND ( "
            + "            (er.fromEntity = 'user' AND er.fromId = :userId)  "
            + "            OR (er.fromEntity = 'team' AND er.fromId IN (<teamIds>)) "
            + "        ) "
            + "    )  "
            + ") AS combined  "
            + "ORDER BY createdAt DESC  "
            + "LIMIT :limit")
    List<String> listThreadsByOwnerOrFollows(
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("limit") int limit,
        @Define("condition") String condition);

    @SqlQuery(
        "SELECT COUNT(id) FROM ( "
            + "    SELECT te.id FROM thread_entity te  "
            + "     <condition> AND entityId IN ( "
            + "        SELECT toId FROM entity_relationship er  "
            + "        WHERE er.relation = 8  "
            + "        AND ( "
            + "            (er.fromEntity = 'user' AND er.fromId = :userId) "
            + "            OR (er.fromEntity = 'team' AND er.fromId IN (<teamIds>)) "
            + "        ) "
            + "    )  "
            + "    UNION   "
            + "    SELECT te.id FROM thread_entity te  "
            + "     <condition> AND id IN ( "
            + "        SELECT toId FROM entity_relationship er  "
            + "        WHERE er.toEntity = 'THREAD'  "
            + "        AND er.relation IN (1, 2)  "
            + "        AND er.fromEntity = 'user'  "
            + "        AND er.fromId = :userId  "
            + "    )  "
            + "    UNION   "
            + "    SELECT te.id FROM thread_entity te  "
            + "     <condition> AND id IN ( "
            + "        SELECT toId FROM entity_relationship er  "
            + "        WHERE er.relation = 11  "
            + "        AND ( "
            + "            (er.fromEntity = 'user' AND er.fromId = :userId)  "
            + "            OR (er.fromEntity = 'team' AND er.fromId IN (<teamIds>)) "
            + "        ) "
            + "    ) "
            + ") AS combined")
    int listCountThreadsByOwnerOrFollows(
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Define("condition") String condition);

    @SqlQuery(
        "SELECT json FROM thread_entity <condition> AND "
            + "hash_id in ("
            + "SELECT toFQNHash FROM field_relationship WHERE "
            + "((fromType='user' AND fromFQNHash= :userName) OR "
            + "(fromType='team' AND fromFQNHash IN (<teamNames>)))  AND toType='THREAD' AND relation= :relation) "
            + "ORDER BY createdAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByMentions(
        @Bind("userName") String userName,
        @BindList("teamNames") List<String> teamNames,
        @Bind("limit") int limit,
        @Bind("relation") int relation,
        @Define("condition") String condition);

    @SqlQuery(
        "SELECT count(id) FROM thread_entity <condition> AND "
            + "hash_id in ("
            + "SELECT toFQNHash FROM field_relationship WHERE "
            + "((fromType='user' AND fromFQNHash= :userName) OR "
            + "(fromType='team' AND fromFQNHash IN (<teamNames>)))  AND toType='THREAD' AND relation= :relation) ")
    int listCountThreadsByMentions(
        @Bind("userName") String userName,
        @BindList("teamNames") List<String> teamNames,
        @Bind("relation") int relation,
        @Define("condition") String condition);

    @SqlQuery(
        "SELECT json FROM thread_entity <condition> "
            + "AND MD5(id) in (SELECT fromFQNHash FROM field_relationship WHERE "
            + "(:fqnPrefixHash IS NULL OR toFQNHash LIKE :concatFqnPrefixHash OR toFQNHash=:fqnPrefixHash) AND fromType='THREAD' AND "
            + "((:toType1 IS NULL OR toType LIKE :concatToType1 OR toType=:toType1) OR "
            + "(:toType2 IS NULL OR toType LIKE :concatToType2 OR toType=:toType2)) AND relation= :relation)"
            + "AND (:userName IS NULL OR MD5(id) in (SELECT toFQNHash FROM field_relationship WHERE "
            + " ((fromType='user' AND fromFQNHash= :userName) OR"
            + " (fromType='team' AND fromFQNHash IN (<teamNames>))) AND toType='THREAD' AND relation= :filterRelation) )"
            + "ORDER BY createdAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByGlossaryAndTerms(
        @BindConcat(
                value = "concatFqnPrefixHash",
                original = "fqnPrefixHash",
                parts = {":fqnPrefixHash", ".%"},
                hash = true)
            String fqnPrefixHash,
        @BindConcat(
                value = "concatToType1",
                original = "toType1",
                parts = {":toType1", ".%"})
            String toType1,
        @BindConcat(
                value = "concatToType2",
                original = "toType2",
                parts = {":toType2", ".%"})
            String toType2,
        @Bind("limit") int limit,
        @Bind("relation") int relation,
        @BindFQN("userName") String userName,
        @BindList("teamNames") List<String> teamNames,
        @Bind("filterRelation") int filterRelation,
        @Define("condition") String condition);

    default List<List<String>> listCountThreadsByGlossaryAndTerms(
        EntityLink entityLink, EntityReference reference) {
      EntityLink glossaryTermLink =
          new EntityLink(GLOSSARY_TERM, entityLink.getFullyQualifiedFieldValue());
      return listCountThreadsByGlossaryAndTerms(
          reference.getId(),
          reference.getFullyQualifiedName(),
          entityLink.getFullyQualifiedFieldType(),
          glossaryTermLink.getFullyQualifiedFieldType());
    }

    default List<String> listThreadsByTaskAssignee(String taskAssigneesId) {
      String condition = String.format(" WHERE taskAssigneesIds LIKE '%%%s%%'", taskAssigneesId);
      return listThreadsByTaskAssigneesId(condition);
    }

    @SqlQuery("SELECT json FROM thread_entity <cond>")
    List<String> listThreadsByTaskAssigneesId(@Define("cond") String cond);

    @SqlQuery(
        "SELECT entityLink, type, taskStatus, COUNT(id) as count "
            + "FROM ( "
            + "    SELECT te.entityLink, te.type, te.taskStatus, te.id "
            + "    FROM thread_entity te "
            + "    WHERE te.entityId = :entityId "
            + "    UNION "
            + "    SELECT te.entityLink, te.type, te.taskStatus, te.id "
            + "    FROM thread_entity te "
            + "    WHERE te.hash_id IN ( "
            + "        SELECT fr.fromFQNHash "
            + "        FROM field_relationship fr "
            + "        WHERE (:fqnPrefixHash IS NULL OR fr.toFQNHash LIKE :concatFqnPrefixHash OR fr.toFQNHash = :fqnPrefixHash) "
            + "        AND fr.fromType = 'THREAD' "
            + "        AND (:toType1 IS NULL OR fr.toType LIKE :concatToType1 OR fr.toType = :toType1) "
            + "        AND fr.relation = 3 "
            + "    ) "
            + "    UNION "
            + "    SELECT te.entityLink, te.type, te.taskStatus, te.id "
            + "    FROM thread_entity te "
            + "    WHERE te.type = 'Task' "
            + "    AND te.hash_id IN ( "
            + "        SELECT fr.fromFQNHash "
            + "        FROM field_relationship fr "
            + "        JOIN thread_entity te2 ON te2.hash_id = fr.fromFQNHash WHERE fr.fromFQNHash = te.hash_id AND te2.type = 'Task' "
            + "        AND (:fqnPrefixHash IS NULL OR fr.toFQNHash LIKE :concatFqnPrefixHash OR fr.toFQNHash = :fqnPrefixHash) "
            + "        AND fr.fromType = 'THREAD' "
            + "        AND (:toType2 IS NULL OR fr.toType LIKE :concatToType2 OR fr.toType = :toType2) "
            + "        AND fr.relation = 3 "
            + "    ) "
            + ") AS combined_results WHERE combined_results.type is not NULL "
            + "GROUP BY entityLink, type, taskStatus ")
    @RegisterRowMapper(ThreadCountFieldMapper.class)
    List<List<String>> listCountThreadsByGlossaryAndTerms(
        @BindUUID("entityId") UUID entityId,
        @BindConcat(
                value = "concatFqnPrefixHash",
                original = "fqnPrefixHash",
                parts = {":fqnPrefixHash", ".%"},
                hash = true)
            String fqnPrefixHash,
        @BindConcat(
                value = "concatToType1",
                original = "toType1",
                parts = {":toType1", ".%"})
            String toType1,
        @BindConcat(
                value = "concatToType2",
                original = "toType2",
                parts = {":toType2", ".%"})
            String toType2);

    @SqlQuery("select id from thread_entity where entityId = :entityId")
    List<String> findByEntityId(@Bind("entityId") String entityId);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE thread_entity SET json = JSON_SET(json, '$.about', :newEntityLink)\n"
                + "WHERE entityId = :entityId",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE thread_entity SET json = jsonb_set(json, '{about}', to_jsonb(:newEntityLink::text), false)\n"
                + "WHERE entityId = :entityId",
        connectionType = POSTGRES)
    void updateByEntityId(
        @Bind("newEntityLink") String newEntityLink, @Bind("entityId") String entityId);

    class OwnerCountFieldMapper implements RowMapper<List<String>> {
      @Override
      public List<String> map(ResultSet rs, StatementContext ctx) throws SQLException {
        return Arrays.asList(
            rs.getString("type"), rs.getString("taskStatus"), rs.getString("count"));
      }
    }

    class ThreadCountFieldMapper implements RowMapper<List<String>> {
      @Override
      public List<String> map(ResultSet rs, StatementContext ctx) throws SQLException {
        return Arrays.asList(
            rs.getString("entityLink"),
            rs.getString("type"),
            rs.getString("taskStatus"),
            rs.getString("count"));
      }
    }
  }

  interface FieldRelationshipDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO field_relationship(fromFQNHash, toFQNHash, fromFQN, toFQN, fromType, toType, relation, json) "
                + "VALUES (:fromFQNHash, :toFQNHash, :fromFQN, :toFQN, :fromType, :toType, :relation, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO field_relationship(fromFQNHash, toFQNHash, fromFQN, toFQN, fromType, toType, relation, json) "
                + "VALUES (:fromFQNHash, :toFQNHash, :fromFQN, :toFQN, :fromType, :toType, :relation, (:json :: jsonb)) "
                + "ON CONFLICT (fromFQNHash, toFQNHash, relation) DO NOTHING",
        connectionType = POSTGRES)
    void insert(
        @BindFQN("fromFQNHash") String fromFQNHash,
        @BindFQN("toFQNHash") String toFQNHash,
        @Bind("fromFQN") String fromFQN,
        @Bind("toFQN") String toFQN,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation,
        @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO field_relationship(fromFQNHash, toFQNHash, fromFQN, toFQN, fromType, toType, relation, jsonSchema, json) "
                + "VALUES (:fromFQNHash, :toFQNHash, :fromFQN, :toFQN, :fromType, :toType, :relation, :jsonSchema, :json) "
                + "ON DUPLICATE KEY UPDATE json = :json",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO field_relationship(fromFQNHash, toFQNHash, fromFQN, toFQN, fromType, toType, relation, jsonSchema, json) "
                + "VALUES (:fromFQNHash, :toFQNHash, :fromFQN, :toFQN, :fromType, :toType, :relation, :jsonSchema, (:json :: jsonb)) "
                + "ON CONFLICT (fromFQNHash, toFQNHash, relation) DO UPDATE SET json = EXCLUDED.json",
        connectionType = POSTGRES)
    void upsert(
        @BindFQN("fromFQNHash") String fromFQNHash,
        @BindFQN("toFQNHash") String toFQNHash,
        @Bind("fromFQN") String fromFQN,
        @Bind("toFQN") String toFQN,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @SqlQuery(
        "SELECT json FROM field_relationship WHERE "
            + "fromFQNHash = :fromFQNHash AND toFQNHash = :toFQNHash AND fromType = :fromType "
            + "AND toType = :toType AND relation = :relation")
    String find(
        @BindFQN("fromFQNHash") String fromFQNHash,
        @BindFQN("toFQNHash") String toFQNHash,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromFQN, fromType, json FROM field_relationship WHERE "
            + "toFQNHash = :toFQNHash AND toType = :toType AND relation = :relation")
    @RegisterRowMapper(FromFieldMapper.class)
    List<Triple<String, String, String>> findFrom(
        @BindFQN("toFQNHash") String toFQNHash,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromFQN, toFQN, json FROM field_relationship WHERE "
            + "fromFQNHash LIKE :concatFqnPrefixHash AND fromType = :fromType AND toType = :toType "
            + "AND relation = :relation")
    @RegisterRowMapper(ToFieldMapper.class)
    List<Triple<String, String, String>> listToByPrefix(
        @BindConcat(
                value = "concatFqnPrefixHash",
                parts = {":fqnPrefixHash", "%"},
                hash = true)
            String fqnPrefixHash,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @Deprecated(since = "Release 1.1")
    @SqlQuery(
        "SELECT DISTINCT fromFQN, toFQN FROM field_relationship WHERE fromFQNHash = '' or fromFQNHash is null or toFQNHash = '' or toFQNHash is null LIMIT :limit")
    @RegisterRowMapper(FieldRelationShipMapper.class)
    List<Pair<String, String>> migrationListDistinctWithOffset(@Bind("limit") int limit);

    @SqlQuery(
        "SELECT fromFQN, toFQN, json FROM field_relationship WHERE "
            + "fromFQNHash = :fqnHash AND fromType = :type AND toType = :otherType AND relation = :relation "
            + "UNION "
            + "SELECT toFQN, fromFQN, json FROM field_relationship WHERE "
            + "toFQNHash = :fqnHash AND toType = :type AND fromType = :otherType AND relation = :relation")
    @RegisterRowMapper(ToFieldMapper.class)
    List<Triple<String, String, String>> listBidirectional(
        @BindFQN("fqnHash") String fqnHash,
        @Bind("type") String type,
        @Bind("otherType") String otherType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromFQN, toFQN, json FROM field_relationship WHERE "
            + "fromFQNHash LIKE :concatFqnPrefixHash AND fromType = :type AND toType = :otherType AND relation = :relation "
            + "UNION "
            + "SELECT toFQN, fromFQN, json FROM field_relationship WHERE "
            + "toFQNHash LIKE :concatFqnPrefixHash AND toType = :type AND fromType = :otherType AND relation = :relation")
    @RegisterRowMapper(ToFieldMapper.class)
    List<Triple<String, String, String>> listBidirectionalByPrefix(
        @BindConcat(
                value = "concatFqnPrefixHash",
                parts = {":fqnPrefixHash", "%"},
                hash = true)
            String fqnPrefixHash,
        @Bind("type") String type,
        @Bind("otherType") String otherType,
        @Bind("relation") int relation);

    default void deleteAllByPrefix(String fqn) {
      String prefix = String.format("%s%s%%", FullyQualifiedName.buildHash(fqn), Entity.SEPARATOR);
      String condition = "WHERE (toFQNHash LIKE :prefix OR fromFQNHash LIKE :prefix)";
      Map<String, String> bindMap = new HashMap<>();
      bindMap.put("prefix", prefix);
      deleteAllByPrefixInternal(condition, bindMap);
    }

    default void deleteAllByPrefixes(List<String> threadIds) {
      for (String threadId : threadIds) {
        deleteAllByPrefix(threadId);
      }
    }

    @SqlUpdate("DELETE from field_relationship <cond>")
    void deleteAllByPrefixInternal(
        @Define("cond") String cond, @BindMap Map<String, String> bindings);

    @SqlUpdate(
        "DELETE from field_relationship WHERE fromFQNHash = :fromFQNHash AND toFQNHash = :toFQNHash AND fromType = :fromType "
            + "AND toType = :toType AND relation = :relation")
    void delete(
        @BindFQN("fromFQNHash") String fromFQNHash,
        @BindFQN("toFQNHash") String toFQNHash,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    default void renameByToFQN(String oldToFQN, String newToFQN) {
      renameByToFQNInternal(
          oldToFQN,
          FullyQualifiedName.buildHash(oldToFQN),
          newToFQN,
          FullyQualifiedName.buildHash(newToFQN)); // First rename targetFQN from oldFQN to newFQN
      renameByToFQNPrefix(oldToFQN, newToFQN);
      // Rename all the targetFQN prefixes starting with the oldFQN to newFQN
    }

    @SqlUpdate(
        "Update field_relationship set toFQN  = :newToFQN , toFQNHash  = :newToFQNHash "
            + "where fromtype = 'THREAD' AND relation='3' AND toFQN = :oldToFQN and toFQNHash =:oldToFQNHash ;")
    void renameByToFQNInternal(
        @Bind("oldToFQN") String oldToFQN,
        @Bind("oldToFQNHash") String oldToFQNHash,
        @Bind("newToFQN") String newToFQN,
        @Bind("newToFQNHash") String newToFQNHash);

    default void renameByToFQNPrefix(String oldToFQNPrefix, String newToFQNPrefix) {
      String update =
          String.format(
              "UPDATE field_relationship SET toFQN  = REPLACE(toFQN, '%s.', '%s.') , toFQNHash  = REPLACE(toFQNHash, '%s.', '%s.') where fromtype = 'THREAD' AND relation='3' AND  toFQN like '%s.%%' and toFQNHash like '%s.%%' ",
              escapeApostrophe(oldToFQNPrefix),
              escapeApostrophe(newToFQNPrefix),
              FullyQualifiedName.buildHash(oldToFQNPrefix),
              FullyQualifiedName.buildHash(newToFQNPrefix),
              escapeApostrophe(oldToFQNPrefix),
              FullyQualifiedName.buildHash(oldToFQNPrefix));
      renameByToFQNPrefixInternal(update);
    }

    @SqlUpdate("<update>")
    void renameByToFQNPrefixInternal(@Define("update") String update);

    class FromFieldMapper implements RowMapper<Triple<String, String, String>> {
      @Override
      public Triple<String, String, String> map(ResultSet rs, StatementContext ctx)
          throws SQLException {
        return Triple.of(rs.getString("fromFQN"), rs.getString("fromType"), rs.getString("json"));
      }
    }

    class ToFieldMapper implements RowMapper<Triple<String, String, String>> {
      @Override
      public Triple<String, String, String> map(ResultSet rs, StatementContext ctx)
          throws SQLException {
        return Triple.of(rs.getString("fromFQN"), rs.getString("toFQN"), rs.getString("json"));
      }
    }

    class FieldRelationShipMapper implements RowMapper<Pair<String, String>> {
      @Override
      public Pair<String, String> map(ResultSet rs, StatementContext ctx) throws SQLException {
        return Pair.of(rs.getString("fromFQN"), rs.getString("toFQN"));
      }
    }

    @Getter
    @Setter
    class FieldRelationship {
      private String fromFQNHash;
      private String toFQNHash;
      private String fromFQN;
      private String toFQN;
      private String fromType;
      private String toType;
      private int relation;
      private String jsonSchema;
      private String json;
    }
  }

  interface BotDAO extends EntityDAO<Bot> {
    @Override
    default String getTableName() {
      return "bot_entity";
    }

    @Override
    default Class<Bot> getEntityClass() {
      return Bot.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }
  }

  interface DomainDAO extends EntityDAO<Domain> {
    @Override
    default String getTableName() {
      return "domain_entity";
    }

    @Override
    default Class<Domain> getEntityClass() {
      return Domain.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }
  }

  interface DataProductDAO extends EntityDAO<DataProduct> {
    @Override
    default String getTableName() {
      return "data_product_entity";
    }

    @Override
    default Class<DataProduct> getEntityClass() {
      return DataProduct.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }
  }

  interface DataContractDAO extends EntityDAO<DataContract> {
    @Override
    default String getTableName() {
      return "data_contract_entity";
    }

    @Override
    default Class<DataContract> getEntityClass() {
      return DataContract.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface EventSubscriptionDAO extends EntityDAO<EventSubscription> {
    @Override
    default String getTableName() {
      return "event_subscription_entity";
    }

    @Override
    default Class<EventSubscription> getEntityClass() {
      return EventSubscription.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }

    @SqlQuery("SELECT json FROM event_subscription_entity")
    List<String> listAllEventsSubscriptions();

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }

    @SqlQuery("SELECT json FROM change_event_consumers where id = :id AND extension = :extension")
    String getSubscriberExtension(@Bind("id") String id, @Bind("extension") String extension);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO change_event_consumers(id, extension, jsonSchema, json) "
                + "VALUES (:id, :extension, :jsonSchema, :json)"
                + "ON DUPLICATE KEY UPDATE json = :json, jsonSchema = :jsonSchema",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO change_event_consumers(id, extension, jsonSchema, json) "
                + "VALUES (:id, :extension, :jsonSchema, (:json :: jsonb)) ON CONFLICT (id, extension) "
                + "DO UPDATE SET json = EXCLUDED.json, jsonSchema = EXCLUDED.jsonSchema",
        connectionType = POSTGRES)
    void upsertSubscriberExtension(
        @Bind("id") String id,
        @Bind("extension") String extension,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO consumers_dlq(id, extension, json, source) "
                + "VALUES (:id, :extension, :json, :source) "
                + "ON DUPLICATE KEY UPDATE json = :json, source = :source",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO consumers_dlq(id, extension, json, source) "
                + "VALUES (:id, :extension, (:json :: jsonb), :source) "
                + "ON CONFLICT (id, extension) "
                + "DO UPDATE SET json = EXCLUDED.json, source = EXCLUDED.source",
        connectionType = POSTGRES)
    void upsertFailedEvent(
        @Bind("id") String id,
        @Bind("extension") String extension,
        @Bind("json") String json,
        @Bind("source") String source);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO successful_sent_change_events (change_event_id, event_subscription_id, json, timestamp) "
                + "VALUES (:change_event_id, :event_subscription_id, :json, :timestamp) "
                + "ON DUPLICATE KEY UPDATE json = :json, timestamp = :timestamp",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO successful_sent_change_events (change_event_id, event_subscription_id, json, timestamp) "
                + "VALUES (:change_event_id, :event_subscription_id, CAST(:json AS jsonb), :timestamp) "
                + "ON CONFLICT (change_event_id, event_subscription_id) "
                + "DO UPDATE SET json = EXCLUDED.json, timestamp = EXCLUDED.timestamp",
        connectionType = POSTGRES)
    void upsertSuccessfulChangeEvent(
        @Bind("change_event_id") String changeEventId,
        @Bind("event_subscription_id") String eventSubscriptionId,
        @Bind("json") String json,
        @Bind("timestamp") long timestamp);

    @SqlQuery(
        "SELECT COUNT(*) FROM successful_sent_change_events WHERE event_subscription_id = :eventSubscriptionId")
    long getSuccessfulRecordCount(@Bind("eventSubscriptionId") String eventSubscriptionId);

    @SqlQuery(
        "SELECT event_subscription_id FROM successful_sent_change_events "
            + "GROUP BY event_subscription_id "
            + "HAVING COUNT(*) >= :threshold")
    List<String> findSubscriptionsAboveThreshold(@Bind("threshold") int threshold);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM successful_sent_change_events WHERE event_subscription_id = :eventSubscriptionId ORDER BY timestamp ASC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM successful_sent_change_events WHERE ctid IN (SELECT ctid FROM successful_sent_change_events WHERE event_subscription_id = :eventSubscriptionId ORDER BY timestamp ASC LIMIT :limit)",
        connectionType = POSTGRES)
    void deleteOldRecords(
        @Bind("eventSubscriptionId") String eventSubscriptionId, @Bind("limit") long limit);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM successful_sent_change_events "
                + "WHERE timestamp < :cutoff ORDER BY timestamp LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM successful_sent_change_events "
                + "WHERE ctid IN ( "
                + "  SELECT ctid FROM successful_sent_change_events "
                + "  WHERE timestamp < :cutoff ORDER BY timestamp LIMIT :limit "
                + ")",
        connectionType = POSTGRES)
    int deleteSuccessfulSentChangeEventsInBatches(
        @Bind("cutoff") long cutoff, @Bind("limit") int limit);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM change_event "
                + "WHERE eventTime < :cutoff ORDER BY eventTime LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM change_event "
                + "WHERE ctid IN ( "
                + "  SELECT ctid FROM change_event "
                + "  WHERE eventTime < :cutoff ORDER BY eventTime LIMIT :limit "
                + ")",
        connectionType = POSTGRES)
    int deleteChangeEventsInBatches(@Bind("cutoff") long cutoff, @Bind("limit") int limit);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM consumers_dlq "
                + "WHERE timestamp < :cutoff ORDER BY timestamp LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM consumers_dlq "
                + "WHERE ctid IN ( "
                + "  SELECT ctid FROM consumers_dlq "
                + "  WHERE timestamp < :cutoff ORDER BY timestamp LIMIT :limit "
                + ")",
        connectionType = POSTGRES)
    int deleteConsumersDlqInBatches(@Bind("cutoff") long cutoff, @Bind("limit") int limit);

    @SqlQuery(
        "SELECT json FROM successful_sent_change_events WHERE event_subscription_id = :eventSubscriptionId ORDER BY timestamp DESC LIMIT :limit OFFSET :paginationOffset")
    List<String> getSuccessfulChangeEventBySubscriptionId(
        @Bind("eventSubscriptionId") String eventSubscriptionId,
        @Bind("limit") int limit,
        @Bind("paginationOffset") long paginationOffset);

    @SqlUpdate(
        "DELETE FROM successful_sent_change_events WHERE event_subscription_id = :eventSubscriptionId")
    void deleteSuccessfulChangeEventBySubscriptionId(
        @Bind("eventSubscriptionId") String eventSubscriptionId);

    @SqlUpdate("DELETE FROM consumers_dlq WHERE id = :eventSubscriptionId")
    void deleteFailedRecordsBySubscriptionId(
        @Bind("eventSubscriptionId") String eventSubscriptionId);

    @SqlUpdate("DELETE from change_event_consumers cec where id = :eventSubscriptionId;")
    void deleteAlertMetrics(@Bind("eventSubscriptionId") String eventSubscriptionId);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(*) FROM ( "
                + "    SELECT json, 'FAILED' AS status, timestamp "
                + "    FROM consumers_dlq WHERE id = :id "
                + "    UNION ALL "
                + "    SELECT json, 'SUCCESSFUL' AS status, timestamp "
                + "    FROM successful_sent_change_events WHERE event_subscription_id = :id "
                + ") AS combined_events",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(*) FROM ( "
                + "    SELECT json, 'failed' AS status, timestamp "
                + "    FROM consumers_dlq WHERE id = :id "
                + "    UNION ALL "
                + "    SELECT json, 'successful' AS status, timestamp "
                + "    FROM successful_sent_change_events WHERE event_subscription_id = :id "
                + ") AS combined_events",
        connectionType = POSTGRES)
    int countAllEventsWithStatuses(@Bind("id") String id);

    @SqlQuery("SELECT COUNT(*) FROM consumers_dlq WHERE id = :id")
    int countFailedEventsById(@Bind("id") String id);

    @SqlQuery(
        "SELECT COUNT(*) FROM successful_sent_change_events WHERE event_subscription_id = :eventSubscriptionId")
    int countSuccessfulEventsBySubscriptionId(
        @Bind("eventSubscriptionId") String eventSubscriptionId);
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

    @SqlQuery("SELECT id, name from installed_apps")
    @RegisterRowMapper(AppEntityReferenceMapper.class)
    List<EntityReference> listAppsRef();

    class AppEntityReferenceMapper implements RowMapper<EntityReference> {
      @Override
      public EntityReference map(ResultSet rs, StatementContext ctx) throws SQLException {
        String fqn = rs.getString("name");
        return new EntityReference()
            .withId(UUID.fromString(rs.getString("id")))
            .withName(fqn)
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

    @Override
    default String getNameHashColumn() {
      return "nameHash";
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

    @Override
    default String getNameHashColumn() {
      return "nameHash";
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

    @SqlQuery(
        "SELECT COUNT(*) FROM glossary_term_entity WHERE fqnHash LIKE :glossaryHash AND LOWER(name) = LOWER(:termName)")
    int getGlossaryTermCountIgnoreCase(
        @BindConcat(
                value = "glossaryHash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash,
        @Bind("termName") String termName);
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
        String providerCondition = String.format(" and %s", filter.getProviderCondition());
        condition += providerCondition;
      }

      Map<String, Object> bindMap = new HashMap<>();
      String serviceType = filter.getQueryParam("serviceType");
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
        String providerCondition = String.format(" and %s", filter.getProviderCondition());
        condition += providerCondition;
      }

      Map<String, Object> bindMap = new HashMap<>();
      String serviceType = filter.getQueryParam("serviceType");
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
        String providerCondition = String.format(" and %s", filter.getProviderCondition());
        condition += providerCondition;
      }

      Map<String, Object> bindMap = new HashMap<>();
      String serviceType = filter.getQueryParam("serviceType");
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

    @Override
    default String getNameHashColumn() {
      return "nameHash";
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

    @Override
    default String getNameHashColumn() {
      return "nameHash";
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
  }

  interface ClassificationDAO extends EntityDAO<Classification> {
    @Override
    default String getTableName() {
      return "classification";
    }

    @Override
    default Class<Classification> getEntityClass() {
      return Classification.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }
  }

  interface TagDAO extends EntityDAO<Tag> {
    @Override
    default String getTableName() {
      return "tag";
    }

    @Override
    default Class<Tag> getEntityClass() {
      return Tag.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default int listCount(ListFilter filter) {
      boolean disabled = Boolean.parseBoolean(filter.getQueryParam("classification.disabled"));
      String condition =
          String.format(
              "INNER JOIN entity_relationship er ON tag.id=er.toId AND er.relation=%s AND er.fromEntity='%s'  "
                  + "INNER JOIN classification c on er.fromId=c.id",
              CONTAINS.ordinal(), Entity.CLASSIFICATION);
      String mySqlCondition = condition;
      String postgresCondition = condition;

      if (disabled) {
        mySqlCondition =
            String.format(
                "%s AND (JSON_EXTRACT(c.json, '$.disabled') IS NULL OR JSON_EXTRACT(c.json, '$.disabled') = TRUE)",
                mySqlCondition);
        postgresCondition =
            String.format(
                "%s AND ((c.json#>'{disabled}') IS NULL OR ((c.json#>'{disabled}')::boolean)  = TRUE)",
                postgresCondition);
      } else {
        mySqlCondition =
            String.format(
                "%s AND (JSON_EXTRACT(c.json, '$.disabled') IS NULL OR JSON_EXTRACT(c.json, '$.disabled') = FALSE)",
                mySqlCondition);
        postgresCondition =
            String.format(
                "%s AND ((c.json#>'{disabled}') IS NULL OR ((c.json#>'{disabled}')::boolean)  = FALSE)",
                postgresCondition);
      }

      mySqlCondition = String.format("%s %s", mySqlCondition, filter.getCondition("tag"));
      postgresCondition = String.format("%s %s", postgresCondition, filter.getCondition("tag"));
      return listCount(
          getTableName(),
          getNameHashColumn(),
          filter.getQueryParams(),
          mySqlCondition,
          postgresCondition);
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      boolean disabled = Boolean.parseBoolean(filter.getQueryParam("classification.disabled"));
      String condition =
          String.format(
              "INNER JOIN entity_relationship er ON tag.id=er.toId AND er.relation=%s AND er.fromEntity='%s'  "
                  + "INNER JOIN classification c on er.fromId=c.id",
              CONTAINS.ordinal(), Entity.CLASSIFICATION);

      String mySqlCondition = condition;
      String postgresCondition = condition;

      if (disabled) {
        mySqlCondition =
            String.format(
                "%s AND (JSON_EXTRACT(c.json, '$.disabled') IS NULL OR JSON_EXTRACT(c.json, '$.disabled') = TRUE)",
                mySqlCondition);
        postgresCondition =
            String.format(
                "%s AND ((c.json#>'{disabled}') IS NULL OR ((c.json#>'{disabled}')::boolean) = TRUE)",
                postgresCondition);
      } else {
        mySqlCondition =
            String.format(
                "%s AND (JSON_EXTRACT(c.json, '$.disabled') IS NULL OR JSON_EXTRACT(c.json, '$.disabled') = FALSE)",
                mySqlCondition);
        postgresCondition =
            String.format(
                "%s AND ((c.json#>'{disabled}') IS NULL OR ((c.json#>'{disabled}')::boolean)  = FALSE)",
                postgresCondition);
      }

      mySqlCondition = String.format("%s %s", mySqlCondition, filter.getCondition("tag"));
      postgresCondition = String.format("%s %s", postgresCondition, filter.getCondition("tag"));

      return listBefore(
          getTableName(),
          filter.getQueryParams(),
          mySqlCondition,
          postgresCondition,
          limit,
          beforeName,
          beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      boolean disabled = Boolean.parseBoolean(filter.getQueryParam("classification.disabled"));
      String condition =
          String.format(
              "INNER JOIN entity_relationship er ON tag.id=er.toId AND er.relation=%s AND er.fromEntity='%s'  "
                  + "INNER JOIN classification c on er.fromId=c.id",
              CONTAINS.ordinal(), Entity.CLASSIFICATION);

      String mySqlCondition = condition;
      String postgresCondition = condition;

      if (disabled) {
        mySqlCondition =
            String.format(
                "%s AND (JSON_EXTRACT(c.json, '$.disabled') IS NULL OR JSON_EXTRACT(c.json, '$.disabled') = TRUE)",
                mySqlCondition);
        postgresCondition =
            String.format(
                "%s AND ((c.json#>'{disabled}') IS NULL OR ((c.json#>'{disabled}')::boolean) = TRUE)",
                postgresCondition);
      } else {
        mySqlCondition =
            String.format(
                "%s AND (JSON_EXTRACT(c.json, '$.disabled') IS NULL OR JSON_EXTRACT(c.json, '$.disabled') = FALSE)",
                mySqlCondition);
        postgresCondition =
            String.format(
                "%s AND ((c.json#>'{disabled}') IS NULL OR ((c.json#>'{disabled}')::boolean)  = FALSE)",
                postgresCondition);
      }

      mySqlCondition = String.format("%s %s", mySqlCondition, filter.getCondition("tag"));
      postgresCondition = String.format("%s %s", postgresCondition, filter.getCondition("tag"));
      return listAfter(
          getTableName(),
          filter.getQueryParams(),
          mySqlCondition,
          postgresCondition,
          limit,
          afterName,
          afterId);
    }

    @SqlQuery("select json FROM tag where fqnhash LIKE :concatFqnhash")
    List<String> getTagsStartingWithPrefix(
        @BindConcat(
                value = "concatFqnhash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash);
  }

  @RegisterRowMapper(TagLabelMapper.class)
  interface TagUsageDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO tag_usage (source, tagFQN, tagFQNHash, targetFQNHash, labelType, state) VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO tag_usage (source, tagFQN, tagFQNHash, targetFQNHash, labelType, state) VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state) ON CONFLICT (source, tagFQNHash, targetFQNHash) DO NOTHING",
        connectionType = POSTGRES)
    void applyTag(
        @Bind("source") int source,
        @Bind("tagFQN") String tagFQN,
        @BindFQN("tagFQNHash") String tagFQNHash,
        @BindFQN("targetFQNHash") String targetFQNHash,
        @Bind("labelType") int labelType,
        @Bind("state") int state);

    default List<TagLabel> getTags(String targetFQN) {
      List<TagLabel> tags = getTagsInternal(targetFQN);
      tags.forEach(TagLabelUtil::applyTagCommonFields);
      return tags;
    }

    default Map<String, List<TagLabel>> getTagsByPrefix(
        String targetFQNPrefix, String postfix, boolean requiresFqnHash) {
      String targetFQNPrefixHash =
          requiresFqnHash ? FullyQualifiedName.buildHash(targetFQNPrefix) : targetFQNPrefix;
      Map<String, List<TagLabel>> resultSet = new LinkedHashMap<>();
      List<Pair<String, TagLabel>> tags =
          getTagsInternalByPrefix(new String[] {targetFQNPrefixHash, postfix});
      tags.forEach(
          pair -> {
            String targetHash = pair.getLeft();
            TagLabel tagLabel = pair.getRight();
            List<TagLabel> listOfTarget = new ArrayList<>();
            if (resultSet.containsKey(targetHash)) {
              listOfTarget = resultSet.get(targetHash);
              listOfTarget.add(tagLabel);
            } else {
              listOfTarget.add(tagLabel);
            }
            resultSet.put(targetHash, listOfTarget);
          });
      return resultSet;
    }

    @SqlQuery(
        "SELECT source, tagFQN,  labelType, state FROM tag_usage WHERE targetFQNHash = :targetFQNHash ORDER BY tagFQN")
    List<TagLabel> getTagsInternal(@BindFQN("targetFQNHash") String targetFQNHash);

    @SqlQuery(
        "SELECT targetFQNHash, source, tagFQN, labelType, state "
            + "FROM tag_usage "
            + "WHERE targetFQNHash IN (<targetFQNHashes>) "
            + "ORDER BY targetFQNHash, tagFQN")
    @UseRowMapper(TagLabelWithFQNHashMapper.class)
    List<TagLabelWithFQNHash> getTagsInternalBatch(
        @BindListFQN("targetFQNHashes") List<String> targetFQNHashes);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT source, tagFQN, labelType, targetFQNHash, state, json "
                + "FROM ("
                + "  SELECT gterm.* , tu.* "
                + "  FROM glossary_term_entity AS gterm "
                + "  JOIN tag_usage AS tu "
                + "  ON gterm.fqnHash = tu.tagFQNHash "
                + "  WHERE tu.source = 1 "
                + "  UNION ALL "
                + "  SELECT ta.*, tu.* "
                + "  FROM tag AS ta "
                + "  JOIN tag_usage AS tu "
                + "  ON ta.fqnHash = tu.tagFQNHash "
                + "  WHERE tu.source = 0 "
                + ") AS combined_data "
                + "WHERE combined_data.targetFQNHash LIKE :targetFQNHash",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT source, tagFQN, labelType, targetFQNHash, state, json "
                + "FROM ("
                + "  SELECT gterm.*, tu.* "
                + "  FROM glossary_term_entity AS gterm "
                + "  JOIN tag_usage AS tu ON gterm.fqnHash = tu.tagFQNHash "
                + "  WHERE tu.source = 1 "
                + "  UNION ALL "
                + "  SELECT ta.*, tu.* "
                + "  FROM tag AS ta "
                + "  JOIN tag_usage AS tu ON ta.fqnHash = tu.tagFQNHash "
                + "  WHERE tu.source = 0 "
                + ") AS combined_data "
                + "WHERE combined_data.targetFQNHash LIKE :targetFQNHash",
        connectionType = POSTGRES)
    @RegisterRowMapper(TagLabelRowMapperWithTargetFqnHash.class)
    List<Pair<String, TagLabel>> getTagsInternalByPrefix(
        @BindConcat(
                value = "targetFQNHash",
                parts = {":targetFQNHashPrefix", ":postfix"})
            String... targetFQNHash);

    @SqlQuery("SELECT * FROM tag_usage")
    @Deprecated(since = "Release 1.1")
    @RegisterRowMapper(TagLabelMapperMigration.class)
    List<TagLabelMigration> listAll();

    @SqlQuery(
        "SELECT COUNT(*) FROM tag_usage "
            + "WHERE (tagFQNHash LIKE :concatTagFQNHash OR tagFQNHash = :tagFqnHash) "
            + "AND source = :source")
    int getTagCount(
        @Bind("source") int source,
        @BindConcat(
                value = "concatTagFQNHash",
                original = "tagFqnHash",
                parts = {":tagFqnHash", ".%"},
                hash = true)
            String tagFqnHash);

    @SqlUpdate("DELETE FROM tag_usage where targetFQNHash = :targetFQNHash")
    void deleteTagsByTarget(@BindFQN("targetFQNHash") String targetFQNHash);

    @SqlUpdate(
        "DELETE FROM tag_usage where tagFQNHash = :tagFqnHash AND targetFQNHash LIKE :targetFQNHash")
    void deleteTagsByTagAndTargetEntity(
        @BindFQN("tagFqnHash") String tagFqnHash,
        @BindConcat(
                value = "targetFQNHash",
                parts = {":targetFQNHashPrefix", "%"},
                hash = true)
            String targetFQNHashPrefix);

    @SqlUpdate("DELETE FROM tag_usage where tagFQNHash = :tagFQNHash AND source = :source")
    void deleteTagLabels(@Bind("source") int source, @BindFQN("tagFQNHash") String tagFQNHash);

    @ConnectionAwareSqlUpdate(
        value = "DELETE FROM tag_usage where tagFQNHash = :tagFQNHash ORDER BY tagFQN",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "DELETE FROM tag_usage where tagFQNHash = :tagFQNHash",
        connectionType = POSTGRES)
    void deleteTagLabelsByFqn(@BindFQN("tagFQNHash") String tagFQNHash);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM tag_usage where targetFQNHash = :targetFQNHash OR targetFQNHash LIKE :concatTargetFQNHash ORDER BY tagFQN",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM tag_usage where targetFQNHash = :targetFQNHash OR targetFQNHash LIKE :concatTargetFQNHash",
        connectionType = POSTGRES)
    void deleteTagLabelsByTargetPrefix(
        @BindConcat(
                value = "concatTargetFQNHash",
                original = "targetFQNHash",
                parts = {":targetFQNHashPrefix", ".%"},
                hash = true)
            String targetFQNHashPrefix);

    @Deprecated(since = "Release 1.1")
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO tag_usage (source, tagFQN, tagFQNHash, targetFQNHash, labelType, state, targetFQN)"
                + "VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state, :targetFQN) "
                + "ON DUPLICATE KEY UPDATE tagFQNHash = :tagFQNHash, targetFQNHash = :targetFQNHash",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO tag_usage (source, tagFQN, tagFQNHash, targetFQNHash, labelType, state, targetFQN) "
                + "VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state, :targetFQN) "
                + "ON CONFLICT (source, tagFQN, targetFQN) "
                + "DO UPDATE SET tagFQNHash = EXCLUDED.tagFQNHash, targetFQNHash = EXCLUDED.targetFQNHash",
        connectionType = POSTGRES)
    void upsertFQNHash(
        @Bind("source") int source,
        @Bind("tagFQN") String tagFQN,
        @Bind("tagFQNHash") String tagFQNHash,
        @Bind("targetFQNHash") String targetFQNHash,
        @Bind("labelType") int labelType,
        @Bind("state") int state,
        @Bind("targetFQN") String targetFQN);

    /** Update all the tagFQN starting with oldPrefix to start with newPrefix due to tag or glossary name change */
    default void updateTagPrefix(int source, String oldPrefix, String newPrefix) {
      String update =
          String.format(
              "UPDATE tag_usage SET tagFQN = REPLACE(tagFQN, '%s.', '%s.'), tagFQNHash = REPLACE(tagFQNHash, '%s.', '%s.') WHERE source = %s AND tagFQNHash LIKE '%s.%%'",
              escapeApostrophe(oldPrefix),
              escapeApostrophe(newPrefix),
              FullyQualifiedName.buildHash(oldPrefix),
              FullyQualifiedName.buildHash(newPrefix),
              source,
              FullyQualifiedName.buildHash(oldPrefix));
      updateTagPrefixInternal(update);
    }

    default void updateTargetFQNHashPrefix(
        int source, String oldTargetFQNHashPrefix, String newTargetFQNHashPrefix) {
      String update =
          String.format(
              "UPDATE tag_usage SET targetFQNHash = REPLACE(targetFQNHash, '%s.', '%s.') WHERE source = %s AND targetFQNHash LIKE '%s.%%'",
              FullyQualifiedName.buildHash(oldTargetFQNHashPrefix),
              FullyQualifiedName.buildHash(newTargetFQNHashPrefix),
              source,
              FullyQualifiedName.buildHash(oldTargetFQNHashPrefix));
      updateTagPrefixInternal(update);
    }

    default void rename(int source, String oldFQN, String newFQN) {
      renameInternal(source, oldFQN, newFQN, newFQN); // First rename tagFQN from oldFQN to newFQN
      updateTagPrefix(
          source, oldFQN,
          newFQN); // Rename all the tagFQN prefixes starting with the oldFQN to newFQN
    }

    default void renameByTargetFQNHash(
        int source, String oldTargetFQNHash, String newTargetFQNHash) {
      updateTargetFQNHashPrefix(
          source,
          oldTargetFQNHash,
          newTargetFQNHash); // Rename all the targetFQN prefixes starting with the oldFQN to newFQN
    }

    /** Rename the tagFQN */
    @SqlUpdate(
        "Update tag_usage set tagFQN = :newFQN, tagFQNHash = :newFQNHash WHERE source = :source AND tagFQNHash = :oldFQNHash")
    void renameInternal(
        @Bind("source") int source,
        @BindFQN("oldFQNHash") String oldFQNHash,
        @Bind("newFQN") String newFQN,
        @BindFQN("newFQNHash") String newFQNHash);

    @SqlUpdate("<update>")
    void updateTagPrefixInternal(@Define("update") String update);

    @SqlQuery("select targetFQNHash FROM tag_usage where tagFQNHash = :tagFQNHash")
    @RegisterRowMapper(TagLabelMapper.class)
    List<String> getTargetFQNHashForTag(@BindFQN("tagFQNHash") String tagFQNHash);

    @SqlQuery("select targetFQNHash FROM tag_usage where tagFQNHash LIKE :tagFQNHash")
    @RegisterRowMapper(TagLabelMapper.class)
    List<String> getTargetFQNHashForTagPrefix(
        @BindConcat(
                value = "tagFQNHash",
                parts = {":tagFQNHashPrefix", ".%"},
                hash = true)
            String tagFQNHashPrefix);

    class TagLabelMapper implements RowMapper<TagLabel> {
      @Override
      public TagLabel map(ResultSet r, StatementContext ctx) throws SQLException {
        return new TagLabel()
            .withSource(TagLabel.TagSource.values()[r.getInt("source")])
            .withLabelType(TagLabel.LabelType.values()[r.getInt("labelType")])
            .withState(TagLabel.State.values()[r.getInt("state")])
            .withTagFQN(r.getString("tagFQN"));
      }
    }

    class TagLabelRowMapperWithTargetFqnHash implements RowMapper<Pair<String, TagLabel>> {
      @Override
      public Pair<String, TagLabel> map(ResultSet r, StatementContext ctx) throws SQLException {
        TagLabel label =
            new TagLabel()
                .withSource(TagLabel.TagSource.values()[r.getInt("source")])
                .withLabelType(TagLabel.LabelType.values()[r.getInt("labelType")])
                .withState(TagLabel.State.values()[r.getInt("state")])
                .withTagFQN(r.getString("tagFQN"));
        TagLabel.TagSource source = TagLabel.TagSource.values()[r.getInt("source")];
        if (source == TagLabel.TagSource.CLASSIFICATION) {
          Tag tag = JsonUtils.readValue(r.getString("json"), Tag.class);
          label.setName(tag.getName());
          label.setDisplayName(tag.getDisplayName());
          label.setDescription(tag.getDescription());
          label.setStyle(tag.getStyle());
        } else if (source == TagLabel.TagSource.GLOSSARY) {
          GlossaryTerm glossaryTerm = JsonUtils.readValue(r.getString("json"), GlossaryTerm.class);
          label.setName(glossaryTerm.getName());
          label.setDisplayName(glossaryTerm.getDisplayName());
          label.setDescription(glossaryTerm.getDescription());
          label.setStyle(glossaryTerm.getStyle());
        } else {
          throw new IllegalArgumentException("Invalid source type " + source);
        }
        return Pair.of(r.getString("targetFQNHash"), label);
      }
    }

    class TagLabelWithFQNHashMapper implements RowMapper<TagLabelWithFQNHash> {
      @Override
      public TagLabelWithFQNHash map(ResultSet rs, StatementContext ctx) throws SQLException {
        TagLabelWithFQNHash tag = new TagLabelWithFQNHash();
        tag.setTargetFQNHash(rs.getString("targetFQNHash"));
        tag.setSource(rs.getInt("source"));
        tag.setTagFQN(rs.getString("tagFQN"));
        tag.setLabelType(rs.getInt("labelType"));
        tag.setState(rs.getInt("state"));
        return tag;
      }
    }

    @Getter
    @Setter
    class TagLabelWithFQNHash {
      private String targetFQNHash;
      private int source;
      private String tagFQN;
      private int labelType;
      private int state;

      // Getters and Setters

      public TagLabel toTagLabel() {
        TagLabel tagLabel = new TagLabel();
        tagLabel.setSource(TagLabel.TagSource.values()[this.source]);
        tagLabel.setTagFQN(this.tagFQN);
        tagLabel.setLabelType(TagLabel.LabelType.values()[this.labelType]);
        tagLabel.setState(TagLabel.State.values()[this.state]);
        return tagLabel;
      }
    }

    @Getter
    @Setter
    @Deprecated(since = "Release 1.1")
    class TagLabelMigration {
      private int source;
      private String tagFQN;
      private String targetFQN;
      private int labelType;
      private int state;
      private String tagFQNHash;
      private String targetFQNHash;
    }

    @Deprecated(since = "Release 1.1")
    class TagLabelMapperMigration implements RowMapper<TagLabelMigration> {
      @Override
      public TagLabelMigration map(ResultSet r, StatementContext ctx) throws SQLException {
        TagLabelMigration tagLabel = new TagLabelMigration();

        tagLabel.setSource(r.getInt("source"));
        tagLabel.setLabelType(r.getInt("labelType"));
        tagLabel.setState(r.getInt("state"));
        tagLabel.setTagFQN(r.getString("tagFQN"));
        // TODO : Ugly ,  but this is present is lower version and removed on higher version
        try {
          // This field is removed in latest
          tagLabel.setTargetFQN(r.getString("targetFQN"));
        } catch (Exception ex) {
          // Nothing to do
        }
        try {
          tagLabel.setTagFQNHash(r.getString("tagFQNHash"));
        } catch (Exception ex) {
          // Nothing to do
        }
        try {
          tagLabel.setTargetFQNHash(r.getString("targetFQNHash"));
        } catch (Exception ex) {
          // Nothing to do
        }
        return tagLabel;
      }
    }
  }

  interface RoleDAO extends EntityDAO<Role> {
    @Override
    default String getTableName() {
      return "role_entity";
    }

    @Override
    default Class<Role> getEntityClass() {
      return Role.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }
  }

  interface PersonaDAO extends EntityDAO<Persona> {
    @Override
    default String getTableName() {
      return "persona_entity";
    }

    @Override
    default Class<Persona> getEntityClass() {
      return Persona.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }
  }

  interface TeamDAO extends EntityDAO<Team> {
    @Override
    default String getTableName() {
      return "team_entity";
    }

    @Override
    default Class<Team> getEntityClass() {
      return Team.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }

    @Override
    default int listCount(ListFilter filter) {
      String parentTeam = filter.getQueryParam("parentTeam");
      String isJoinable = filter.getQueryParam("isJoinable");
      String condition = filter.getCondition();
      if (parentTeam != null) {
        // validate parent team
        Team team = findEntityByName(parentTeam, filter.getInclude());
        if (ORGANIZATION_NAME.equals(team.getName())) {
          // All the teams without parents should come under "organization" team
          condition =
              String.format(
                  "%s AND id NOT IN ( (SELECT '%s') UNION (SELECT toId FROM entity_relationship WHERE fromId!='%s' AND fromEntity='team' AND toEntity='team' AND relation=%d) )",
                  condition, team.getId(), team.getId(), Relationship.PARENT_OF.ordinal());
        } else {
          condition =
              String.format(
                  "%s AND id IN (SELECT toId FROM entity_relationship WHERE fromId='%s' AND fromEntity='team' AND toEntity='team' AND relation=%d)",
                  condition, team.getId(), Relationship.PARENT_OF.ordinal());
        }
      }
      String mySqlCondition = condition;
      String postgresCondition = condition;
      if (isJoinable != null) {
        mySqlCondition =
            String.format(
                "%s AND JSON_EXTRACT(json, '$.isJoinable') = :isJoinable ", mySqlCondition);
        postgresCondition =
            String.format(
                "%s AND ((json#>'{isJoinable}')::boolean)  = :isJoinable ", postgresCondition);
      }

      return listCount(
          getTableName(),
          getNameHashColumn(),
          filter.getQueryParams(),
          mySqlCondition,
          postgresCondition);
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String parentTeam = filter.getQueryParam("parentTeam");
      String isJoinable = filter.getQueryParam("isJoinable");
      String condition = filter.getCondition();
      if (parentTeam != null) {
        // validate parent team
        Team team = findEntityByName(parentTeam);
        if (ORGANIZATION_NAME.equals(team.getName())) {
          // All the parentless teams should come under "organization" team
          condition =
              String.format(
                  "%s AND id NOT IN ( (SELECT '%s') UNION (SELECT toId FROM entity_relationship WHERE fromId!='%s' AND fromEntity='team' AND toEntity='team' AND relation=%d) )",
                  condition, team.getId(), team.getId(), Relationship.PARENT_OF.ordinal());
        } else {
          condition =
              String.format(
                  "%s AND id IN (SELECT toId FROM entity_relationship WHERE fromId='%s' AND fromEntity='team' AND toEntity='team' AND relation=%d)",
                  condition, team.getId(), Relationship.PARENT_OF.ordinal());
        }
      }
      String mySqlCondition = condition;
      String postgresCondition = condition;
      if (isJoinable != null) {
        mySqlCondition =
            String.format(
                "%s AND JSON_EXTRACT(json, '$.isJoinable') = :isJoinable ", mySqlCondition);
        postgresCondition =
            String.format(
                "%s AND ((json#>'{isJoinable}')::boolean)  = :isJoinable ", postgresCondition);
      }

      // Quoted name is stored in fullyQualifiedName column and not in the name column
      beforeName =
          Optional.ofNullable(beforeName).map(FullyQualifiedName::unquoteName).orElse(null);
      return listBefore(
          getTableName(),
          filter.getQueryParams(),
          mySqlCondition,
          postgresCondition,
          limit,
          beforeName,
          beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String parentTeam = filter.getQueryParam("parentTeam");
      String isJoinable = filter.getQueryParam("isJoinable");
      String condition = filter.getCondition();
      if (parentTeam != null) {
        // validate parent team
        Team team = findEntityByName(parentTeam, filter.getInclude());
        if (ORGANIZATION_NAME.equals(team.getName())) {
          // All the parentless teams should come under "organization" team
          condition =
              String.format(
                  "%s AND id NOT IN ( (SELECT '%s') UNION (SELECT toId FROM entity_relationship WHERE fromId!='%s' AND fromEntity='team' AND toEntity='team' AND relation=%d) )",
                  condition, team.getId(), team.getId(), Relationship.PARENT_OF.ordinal());
        } else {
          condition =
              String.format(
                  "%s AND id IN (SELECT toId FROM entity_relationship WHERE fromId='%s' AND fromEntity='team' AND toEntity='team' AND relation=%d)",
                  condition, team.getId(), Relationship.PARENT_OF.ordinal());
        }
      }
      String mySqlCondition = condition;
      String postgresCondition = condition;
      if (isJoinable != null) {
        mySqlCondition =
            String.format(
                "%s AND JSON_EXTRACT(json, '$.isJoinable') = %s ", mySqlCondition, isJoinable);
        postgresCondition =
            String.format(
                "%s AND ((json#>'{isJoinable}')::boolean)  = %s ", postgresCondition, isJoinable);
      }

      // Quoted name is stored in fullyQualifiedName column and not in the name column
      afterName = Optional.ofNullable(afterName).map(FullyQualifiedName::unquoteName).orElse(null);
      return listAfter(
          getTableName(),
          filter.getQueryParams(),
          mySqlCondition,
          postgresCondition,
          limit,
          afterName,
          afterId);
    }

    default List<String> listTeamsUnderOrganization(UUID teamId) {
      return listTeamsUnderOrganization(teamId, Relationship.PARENT_OF.ordinal());
    }

    @SqlQuery(
        "SELECT te.id "
            + "FROM team_entity te "
            + "WHERE te.id NOT IN ((SELECT :teamId) UNION "
            + "(SELECT toId FROM entity_relationship "
            + "WHERE fromId != :teamId AND fromEntity = 'team' AND relation = :relation AND toEntity = 'team'))")
    List<String> listTeamsUnderOrganization(
        @BindUUID("teamId") UUID teamId, @Bind("relation") int relation);
  }

  interface TopicDAO extends EntityDAO<Topic> {
    @Override
    default String getTableName() {
      return "topic_entity";
    }

    @Override
    default Class<Topic> getEntityClass() {
      return Topic.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  @RegisterRowMapper(UsageDetailsMapper.class)
  interface UsageDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_usage (usageDate, id, entityType, count1, count7, count30) "
                + "SELECT :date, :id, :entityType, :count1, "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - "
                + "INTERVAL 6 DAY)), "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - "
                + "INTERVAL 29 DAY))"
                + "ON DUPLICATE KEY UPDATE count7 = count7 - count1 + :count1, count30 = count30 - count1 + :count1, count1 = :count1",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_usage (usageDate, id, entityType, count1, count7, count30) "
                + "SELECT (:date :: date), :id, :entityType, :count1, "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= (:date :: date) - INTERVAL '6 days')), "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= (:date :: date) - INTERVAL '29 days'))"
                + "ON CONFLICT (usageDate, id) DO UPDATE SET count7 = entity_usage.count7 - entity_usage.count1 + :count1,"
                + "count30 = entity_usage.count30 - entity_usage.count1 + :count1, count1 = :count1",
        connectionType = POSTGRES)
    void insertOrReplaceCount(
        @Bind("date") String date,
        @BindUUID("id") UUID id,
        @Bind("entityType") String entityType,
        @Bind("count1") int count1);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_usage (usageDate, id, entityType, count1, count7, count30) "
                + "SELECT :date, :id, :entityType, :count1, "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - "
                + "INTERVAL 6 DAY)), "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - "
                + "INTERVAL 29 DAY)) "
                + "ON DUPLICATE KEY UPDATE count1 = count1 + :count1, count7 = count7 + :count1, count30 = count30 + :count1",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_usage (usageDate, id, entityType, count1, count7, count30) "
                + "SELECT (:date :: date), :id, :entityType, :count1, "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= (:date :: date) - INTERVAL '6 days')), "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= (:date :: date) - INTERVAL '29 days')) "
                + "ON CONFLICT (usageDate, id) DO UPDATE SET count1 = entity_usage.count1 + :count1, count7 = entity_usage.count7 + :count1, count30 = entity_usage.count30 + :count1",
        connectionType = POSTGRES)
    void insertOrUpdateCount(
        @Bind("date") String date,
        @BindUUID("id") UUID id,
        @Bind("entityType") String entityType,
        @Bind("count1") int count1);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT id, usageDate, entityType, count1, count7, count30, "
                + "percentile1, percentile7, percentile30 FROM entity_usage "
                + "WHERE id = :id AND usageDate >= :date - INTERVAL :days DAY AND usageDate <= :date ORDER BY usageDate DESC",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT id, usageDate, entityType, count1, count7, count30, "
                + "percentile1, percentile7, percentile30 FROM entity_usage "
                + "WHERE id = :id AND usageDate >= (:date :: date) - make_interval(days => :days) AND usageDate <= (:date :: date) ORDER BY usageDate DESC",
        connectionType = POSTGRES)
    List<UsageDetails> getUsageById(
        @BindUUID("id") UUID id, @Bind("date") String date, @Bind("days") int days);

    /** Get latest usage record */
    @SqlQuery(
        "SELECT id, usageDate, entityType, count1, count7, count30, "
            + "percentile1, percentile7, percentile30 FROM entity_usage "
            + "WHERE usageDate IN (SELECT MAX(usageDate) FROM entity_usage WHERE id = :id) AND id = :id")
    UsageDetails getLatestUsage(@Bind("id") String id);

    @SqlUpdate("DELETE FROM entity_usage WHERE id = :id")
    void delete(@BindUUID("id") UUID id);

    /**
     * TODO: Not sure I get what the next comment means, but tests now use mysql 8 so maybe tests can be improved here
     * Note not using in following percentile computation PERCENT_RANK function as unit tests use mysql5.7, and it does
     * not have window function
     */
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE entity_usage u JOIN ( "
                + "SELECT u1.id, "
                + "(SELECT COUNT(*) FROM entity_usage as u2 WHERE u2.count1 <  u1.count1 AND u2.entityType = :entityType "
                + "AND u2.usageDate = :date) as p1, "
                + "(SELECT COUNT(*) FROM entity_usage as u3 WHERE u3.count7 <  u1.count7 AND u3.entityType = :entityType "
                + "AND u3.usageDate = :date) as p7, "
                + "(SELECT COUNT(*) FROM entity_usage as u4 WHERE u4.count30 <  u1.count30 AND u4.entityType = :entityType "
                + "AND u4.usageDate = :date) as p30, "
                + "(SELECT COUNT(*) FROM entity_usage WHERE entityType = :entityType AND usageDate = :date) as total "
                + "FROM entity_usage u1 WHERE u1.entityType = :entityType AND u1.usageDate = :date"
                + ") vals ON u.id = vals.id AND usageDate = :date "
                + "SET u.percentile1 = ROUND(100 * p1/total, 2), u.percentile7 = ROUND(p7 * 100/total, 2), u.percentile30 ="
                + " ROUND(p30*100/total, 2)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE entity_usage u "
                + "SET percentile1 = ROUND(100 * p1 / total, 2), percentile7 = ROUND(p7 * 100 / total, 2), percentile30 = ROUND(p30 * 100 / total, 2) "
                + "FROM ("
                + "   SELECT u1.id, "
                + "       (SELECT COUNT(*) FROM entity_usage as u2 WHERE u2.count1 < u1.count1 AND u2.entityType = :entityType AND u2.usageDate = (:date :: date)) as p1, "
                + "       (SELECT COUNT(*) FROM entity_usage as u3 WHERE u3.count7 < u1.count7 AND u3.entityType = :entityType AND u3.usageDate = (:date :: date)) as p7, "
                + "       (SELECT COUNT(*) FROM entity_usage as u4 WHERE u4.count30 < u1.count30 AND u4.entityType = :entityType AND u4.usageDate = (:date :: date)) as p30, "
                + "       (SELECT COUNT(*) FROM entity_usage WHERE entityType = :entityType AND usageDate = (:date :: date)"
                + "   ) as total FROM entity_usage u1 "
                + "   WHERE u1.entityType = :entityType AND u1.usageDate = (:date :: date)"
                + ") vals "
                + "WHERE u.id = vals.id AND usageDate = (:date :: date);",
        connectionType = POSTGRES)
    void computePercentile(@Bind("entityType") String entityType, @Bind("date") String date);

    class UsageDetailsMapper implements RowMapper<UsageDetails> {
      @Override
      public UsageDetails map(ResultSet r, StatementContext ctx) throws SQLException {
        UsageStats dailyStats =
            new UsageStats()
                .withCount(r.getInt("count1"))
                .withPercentileRank(r.getDouble("percentile1"));
        UsageStats weeklyStats =
            new UsageStats()
                .withCount(r.getInt("count7"))
                .withPercentileRank(r.getDouble("percentile7"));
        UsageStats monthlyStats =
            new UsageStats()
                .withCount(r.getInt("count30"))
                .withPercentileRank(r.getDouble("percentile30"));
        return new UsageDetails()
            .withDate(r.getString("usageDate"))
            .withDailyStats(dailyStats)
            .withWeeklyStats(weeklyStats)
            .withMonthlyStats(monthlyStats);
      }
    }
  }

  interface UserDAO extends EntityDAO<User> {
    @Override
    default String getTableName() {
      return "user_entity";
    }

    @Override
    default Class<User> getEntityClass() {
      return User.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }

    @Override
    default int listCount(ListFilter filter) {
      String team = EntityInterfaceUtil.quoteName(filter.getQueryParam("team"));
      String isBotStr = filter.getQueryParam("isBot");
      String isAdminStr = filter.getQueryParam("isAdmin");
      String mySqlCondition = filter.getCondition("ue");
      String postgresCondition = filter.getCondition("ue");
      if (isAdminStr != null) {
        boolean isAdmin = Boolean.parseBoolean(isAdminStr);
        if (isAdmin) {
          mySqlCondition =
              String.format("%s AND JSON_EXTRACT(ue.json, '$.isAdmin') = TRUE ", mySqlCondition);
          postgresCondition =
              String.format("%s AND ((ue.json#>'{isAdmin}')::boolean)  = TRUE ", postgresCondition);
        } else {
          mySqlCondition =
              String.format(
                  "%s AND (JSON_EXTRACT(ue.json, '$.isAdmin') IS NULL OR JSON_EXTRACT(ue.json, '$.isAdmin') = FALSE ) ",
                  mySqlCondition);
          postgresCondition =
              String.format(
                  "%s AND (ue.json#>'{isAdmin}' IS NULL OR ((ue.json#>'{isAdmin}')::boolean) = FALSE ) ",
                  postgresCondition);
        }
      }
      if (isBotStr != null) {
        boolean isBot = Boolean.parseBoolean(isBotStr);
        if (isBot) {
          mySqlCondition =
              String.format("%s AND JSON_EXTRACT(ue.json, '$.isBot') = TRUE ", mySqlCondition);
          postgresCondition =
              String.format("%s AND ((ue.json#>'{isBot}')::boolean) = TRUE ", postgresCondition);
        } else {
          mySqlCondition =
              String.format(
                  "%s AND (JSON_EXTRACT(ue.json, '$.isBot') IS NULL OR JSON_EXTRACT(ue.json, '$.isBot') = FALSE ) ",
                  mySqlCondition);
          postgresCondition =
              String.format(
                  "%s AND (ue.json#>'{isBot}' IS NULL OR ((ue.json#>'{isBot}')::boolean) = FALSE) ",
                  postgresCondition);
        }
      }
      if (team == null && isAdminStr == null && isBotStr == null) {
        return EntityDAO.super.listCount(filter);
      }
      return listCount(
          getTableName(), mySqlCondition, postgresCondition, team, Relationship.HAS.ordinal());
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String team = EntityInterfaceUtil.quoteName(filter.getQueryParam("team"));
      String isBotStr = filter.getQueryParam("isBot");
      String isAdminStr = filter.getQueryParam("isAdmin");
      String mySqlCondition = filter.getCondition("ue");
      String postgresCondition = filter.getCondition("ue");
      if (isAdminStr != null) {
        boolean isAdmin = Boolean.parseBoolean(isAdminStr);
        if (isAdmin) {
          mySqlCondition =
              String.format("%s AND JSON_EXTRACT(ue.json, '$.isAdmin') = TRUE ", mySqlCondition);
          postgresCondition =
              String.format("%s AND ((ue.json#>'{isAdmin}')::boolean) = TRUE ", postgresCondition);
        } else {
          mySqlCondition =
              String.format(
                  "%s AND (JSON_EXTRACT(ue.json, '$.isAdmin') IS NULL OR JSON_EXTRACT(ue.json, '$.isAdmin') = FALSE ) ",
                  mySqlCondition);
          postgresCondition =
              String.format(
                  "%s AND (ue.json#>'{isAdmin}' IS NULL OR ((ue.json#>'{isAdmin}')::boolean) = FALSE ) ",
                  postgresCondition);
        }
      }
      if (isBotStr != null) {
        boolean isBot = Boolean.parseBoolean(isBotStr);
        if (isBot) {
          mySqlCondition =
              String.format("%s AND JSON_EXTRACT(ue.json, '$.isBot') = TRUE ", mySqlCondition);
          postgresCondition =
              String.format("%s AND ((ue.json#>'{isBot}')::boolean) = TRUE ", postgresCondition);
        } else {
          mySqlCondition =
              String.format(
                  "%s AND (JSON_EXTRACT(ue.json, '$.isBot') IS NULL OR JSON_EXTRACT(ue.json, '$.isBot') = FALSE ) ",
                  mySqlCondition);
          postgresCondition =
              String.format(
                  "%s AND (ue.json#>'{isBot}' IS NULL OR ((ue.json#>'{isBot}')::boolean) = FALSE) ",
                  postgresCondition);
        }
      }
      if (team == null && isAdminStr == null && isBotStr == null) {
        return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
      }
      return listBefore(
          getTableName(),
          mySqlCondition,
          postgresCondition,
          team,
          limit,
          beforeName,
          beforeId,
          Relationship.HAS.ordinal());
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String team = EntityInterfaceUtil.quoteName(filter.getQueryParam("team"));
      String isBotStr = filter.getQueryParam("isBot");
      String isAdminStr = filter.getQueryParam("isAdmin");
      String mySqlCondition = filter.getCondition("ue");
      String postgresCondition = filter.getCondition("ue");
      if (isAdminStr != null) {
        boolean isAdmin = Boolean.parseBoolean(isAdminStr);
        if (isAdmin) {
          mySqlCondition =
              String.format("%s AND JSON_EXTRACT(ue.json, '$.isAdmin') = TRUE ", mySqlCondition);
          postgresCondition =
              String.format("%s AND ((ue.json#>'{isAdmin}')::boolean) = TRUE ", postgresCondition);
        } else {
          mySqlCondition =
              String.format(
                  "%s AND (JSON_EXTRACT(ue.json, '$.isAdmin') IS NULL OR JSON_EXTRACT(ue.json, '$.isAdmin') = FALSE ) ",
                  mySqlCondition);
          postgresCondition =
              String.format(
                  "%s AND (ue.json#>'{isAdmin}' IS NULL OR ((ue.json#>'{isAdmin}')::boolean) = FALSE ) ",
                  postgresCondition);
        }
      }
      if (isBotStr != null) {
        boolean isBot = Boolean.parseBoolean(isBotStr);
        if (isBot) {
          mySqlCondition =
              String.format("%s AND JSON_EXTRACT(ue.json, '$.isBot') = TRUE ", mySqlCondition);
          postgresCondition =
              String.format("%s AND ((ue.json#>'{isBot}')::boolean) = TRUE ", postgresCondition);
        } else {
          mySqlCondition =
              String.format(
                  "%s AND (JSON_EXTRACT(ue.json, '$.isBot') IS NULL OR JSON_EXTRACT(ue.json, '$.isBot') = FALSE ) ",
                  mySqlCondition);
          postgresCondition =
              String.format(
                  "%s AND (ue.json#>'{isBot}' IS NULL OR ((ue.json#>'{isBot}')::boolean) = FALSE) ",
                  postgresCondition);
        }
      }
      if (team == null && isAdminStr == null && isBotStr == null) {
        return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
      }
      return listAfter(
          getTableName(),
          mySqlCondition,
          postgresCondition,
          team,
          limit,
          afterName,
          afterId,
          Relationship.HAS.ordinal());
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(id) FROM ("
                + "SELECT ue.id "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <mysqlCond> "
                + " AND (:team IS NULL OR te.nameHash = :team) "
                + "GROUP BY ue.id) subquery",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(id) FROM ("
                + "SELECT ue.id "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <postgresCond> "
                + " AND (:team IS NULL OR te.nameHash = :team) "
                + "GROUP BY ue.id) subquery",
        connectionType = POSTGRES)
    int listCount(
        @Define("table") String table,
        @Define("mysqlCond") String mysqlCond,
        @Define("postgresCond") String postgresCond,
        @BindFQN("team") String team,
        @Bind("relation") int relation);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT ue.name, ue.id, ue.json "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <mysqlCond> "
                + "AND (:team IS NULL OR te.nameHash = :team) "
                + "AND (ue.name < :beforeName OR (ue.name = :beforeName AND ue.id < :beforeId)) "
                + "GROUP BY ue.name, ue.id, ue.json "
                + "ORDER BY ue.name DESC,ue.id DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name,id",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT ue.name, ue.id, ue.json "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <postgresCond> "
                + "AND (:team IS NULL OR te.nameHash = :team) "
                + "AND (ue.name < :beforeName OR (ue.name = :beforeName AND ue.id < :beforeId))  "
                + "GROUP BY ue.name, ue.id, ue.json "
                + "ORDER BY ue.name DESC,ue.id DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name,id",
        connectionType = POSTGRES)
    List<String> listBefore(
        @Define("table") String table,
        @Define("mysqlCond") String mysqlCond,
        @Define("postgresCond") String postgresCond,
        @BindFQN("team") String team,
        @Bind("limit") int limit,
        @Bind("beforeName") String beforeName,
        @Bind("beforeId") String beforeId,
        @Bind("relation") int relation);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT ue.json "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <mysqlCond> "
                + "AND (:team IS NULL OR te.nameHash = :team) "
                + "AND (ue.name > :afterName OR (ue.name = :afterName AND ue.id > :afterId)) "
                + "GROUP BY ue.name, ue.id, ue.json "
                + "ORDER BY ue.name,ue.id "
                + "LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT ue.json "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <postgresCond> "
                + "AND (:team IS NULL OR te.nameHash = :team) "
                + "AND (ue.name > :afterName OR (ue.name = :afterName AND ue.id > :afterId))  "
                + "GROUP BY ue.name,ue.id, ue.json "
                + "ORDER BY ue.name,ue.id "
                + "LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listAfter(
        @Define("table") String table,
        @Define("mysqlCond") String mysqlCond,
        @Define("postgresCond") String postgresCond,
        @BindFQN("team") String team,
        @Bind("limit") int limit,
        @Bind("afterName") String afterName,
        @Bind("afterId") String afterId,
        @Bind("relation") int relation);

    @SqlQuery("SELECT COUNT(*) FROM user_entity WHERE LOWER(email) = LOWER(:email)")
    int checkEmailExists(@Bind("email") String email);

    @SqlQuery("SELECT COUNT(*) FROM user_entity WHERE LOWER(name) = LOWER(:name)")
    int checkUserNameExists(@Bind("name") String name);

    @SqlQuery(
        "SELECT json FROM user_entity WHERE LOWER(name) = LOWER(:name) AND LOWER(email) = LOWER(:email)")
    String findUserByNameAndEmail(@Bind("name") String name, @Bind("email") String email);

    @SqlQuery("SELECT json FROM user_entity WHERE LOWER(email) = LOWER(:email)")
    String findUserByEmail(@Bind("email") String email);

    @Override
    default User findEntityByName(String fqn, Include include) {
      return EntityDAO.super.findEntityByName(fqn.toLowerCase(), include);
    }
  }

  interface ChangeEventDAO {
    @SqlQuery(
        "SELECT json FROM change_event ce where ce.offset > :offset ORDER BY ce.eventTime DESC LIMIT :limit OFFSET :paginationOffset")
    List<String> listUnprocessedEvents(
        @Bind("offset") long offset,
        @Bind("limit") int limit,
        @Bind("paginationOffset") int paginationOffset);

    @SqlQuery(
        "SELECT json, source FROM consumers_dlq WHERE id = :id ORDER BY timestamp DESC LIMIT :limit OFFSET :paginationOffset")
    @RegisterRowMapper(FailedEventResponseMapper.class)
    List<FailedEventResponse> listFailedEventsById(
        @Bind("id") String id,
        @Bind("limit") int limit,
        @Bind("paginationOffset") int paginationOffset);

    @SqlQuery("SELECT COUNT(*) FROM consumers_dlq WHERE id = :id")
    long countFailedEvents(@Bind("id") String id);

    @SqlQuery(
        "SELECT json, source FROM consumers_dlq WHERE id = :id AND source = :source ORDER BY timestamp DESC LIMIT :limit OFFSET :paginationOffset")
    @RegisterRowMapper(FailedEventResponseMapper.class)
    List<FailedEventResponse> listFailedEventsByIdAndSource(
        @Bind("id") String id,
        @Bind("source") String source,
        @Bind("limit") int limit,
        @Bind("paginationOffset") int paginationOffset);

    @SqlQuery(
        "SELECT json, source FROM consumers_dlq ORDER BY timestamp DESC LIMIT :limit OFFSET :paginationOffset")
    @RegisterRowMapper(FailedEventResponseMapper.class)
    List<FailedEventResponse> listAllFailedEvents(
        @Bind("limit") int limit, @Bind("paginationOffset") int paginationOffset);

    @SqlQuery(
        "SELECT json, source FROM consumers_dlq WHERE source = :source ORDER BY timestamp DESC LIMIT :limit OFFSET :paginationOffset")
    @RegisterRowMapper(FailedEventResponseMapper.class)
    List<FailedEventResponse> listAllFailedEventsBySource(
        @Bind("source") String source,
        @Bind("limit") int limit,
        @Bind("paginationOffset") int paginationOffset);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json, status, timestamp "
                + "FROM ( "
                + "    SELECT json, 'FAILED' AS status, timestamp "
                + "    FROM consumers_dlq WHERE id = :id "
                + "    UNION ALL "
                + "    SELECT json, 'SUCCESSFUL' AS status, timestamp "
                + "    FROM successful_sent_change_events WHERE event_subscription_id = :id "
                + ") AS combined_events "
                + "ORDER BY timestamp DESC "
                + "LIMIT :limit OFFSET :paginationOffset",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json, status, timestamp "
                + "FROM ( "
                + "    SELECT json, 'failed' AS status, timestamp "
                + "    FROM consumers_dlq WHERE id = :id "
                + "    UNION ALL "
                + "    SELECT json, 'successful' AS status, timestamp "
                + "    FROM successful_sent_change_events WHERE event_subscription_id = :id "
                + ") AS combined_events "
                + "ORDER BY timestamp ASC "
                + "LIMIT :limit OFFSET :paginationOffset",
        connectionType = POSTGRES)
    @RegisterRowMapper(EventResponseMapper.class)
    List<TypedEvent> listAllEventsWithStatuses(
        @Bind("id") String id,
        @Bind("limit") int limit,
        @Bind("paginationOffset") long paginationOffset);

    @SqlQuery("SELECT json FROM change_event ce where ce.offset > :offset")
    List<String> listUnprocessedEvents(@Bind("offset") long offset);

    @SqlQuery(
        "SELECT CASE WHEN EXISTS (SELECT 1 FROM event_subscription_entity WHERE id = :id) THEN 1 ELSE 0 END AS record_exists")
    int recordExists(@Bind("id") String id);

    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO change_event (json) VALUES (:json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO change_event (json) VALUES (:json :: jsonb)",
        connectionType = POSTGRES)
    void insert(@Bind("json") String json);

    @SqlUpdate("DELETE FROM change_event WHERE entityType = :entityType")
    void deleteAll(@Bind("entityType") String entityType);

    default List<String> list(EventType eventType, List<String> entityTypes, long timestamp) {
      if (nullOrEmpty(entityTypes)) {
        return Collections.emptyList();
      }
      if (entityTypes.get(0).equals("*")) {
        return listWithoutEntityFilter(eventType.value(), timestamp);
      }
      return listWithEntityFilter(eventType.value(), entityTypes, timestamp);
    }

    @SqlQuery(
        "SELECT json FROM change_event WHERE "
            + "eventType = :eventType AND (entityType IN (<entityTypes>)) AND eventTime >= :timestamp "
            + "ORDER BY eventTime ASC")
    List<String> listWithEntityFilter(
        @Bind("eventType") String eventType,
        @BindList("entityTypes") List<String> entityTypes,
        @Bind("timestamp") long timestamp);

    @SqlQuery(
        "SELECT json FROM change_event WHERE "
            + "eventType = :eventType AND eventTime >= :timestamp "
            + "ORDER BY eventTime ASC")
    List<String> listWithoutEntityFilter(
        @Bind("eventType") String eventType, @Bind("timestamp") long timestamp);

    @SqlQuery(
        "SELECT json FROM change_event ce  WHERE ce.offset > :offset ORDER BY ce.offset ASC LIMIT :limit")
    List<String> list(@Bind("limit") long limit, @Bind("offset") long offset);

    @ConnectionAwareSqlQuery(value = "SELECT MAX(offset) FROM change_event", connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT MAX(\"offset\") FROM change_event",
        connectionType = POSTGRES)
    long getLatestOffset();

    @SqlQuery("SELECT count(*) FROM change_event")
    long listCount();
  }

  class FailedEventResponseMapper implements RowMapper<FailedEventResponse> {
    @Override
    public FailedEventResponse map(ResultSet rs, StatementContext ctx) throws SQLException {
      FailedEventResponse response = new FailedEventResponse();
      FailedEvent failedEvent = JsonUtils.readValue(rs.getString("json"), FailedEvent.class);
      response.setFailingSubscriptionId(failedEvent.getFailingSubscriptionId());
      response.setChangeEvent(failedEvent.getChangeEvent());
      response.setReason(failedEvent.getReason());
      response.setSource(rs.getString("source"));
      response.setTimestamp(failedEvent.getTimestamp());
      return response;
    }
  }

  class EventResponseMapper implements RowMapper<TypedEvent> {
    @Override
    public TypedEvent map(ResultSet rs, StatementContext ctx) throws SQLException {
      TypedEvent response = new TypedEvent();
      String status = rs.getString("status").toLowerCase();

      if (TypedEvent.Status.FAILED.value().equalsIgnoreCase(status)) {
        FailedEvent failedEvent = JsonUtils.readValue(rs.getString("json"), FailedEvent.class);
        response.setData(List.of(failedEvent));
        response.setStatus(TypedEvent.Status.FAILED);
      } else {
        ChangeEvent changeEvent = JsonUtils.readValue(rs.getString("json"), ChangeEvent.class);
        response.setData(List.of(changeEvent));
        response.setStatus(TypedEvent.Status.fromValue(status));
      }

      long timestampMillis = rs.getLong("timestamp");
      response.setTimestamp((double) timestampMillis);
      return response;
    }
  }

  interface TypeEntityDAO extends EntityDAO<Type> {
    @Override
    default String getTableName() {
      return "type_entity";
    }

    @Override
    default Class<Type> getEntityClass() {
      return Type.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }
  }

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
    default String getNameHashColumn() {
      return "nameHash";
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String entityType = filter.getQueryParam("entityType");
      String testPlatform = filter.getQueryParam("testPlatform");
      String supportedDataType = filter.getQueryParam("supportedDataType");
      String condition = filter.getCondition();

      if (entityType == null && testPlatform == null && supportedDataType == null) {
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
        filter.queryParams.put("supportedDataTypeLike", String.format("%%%s%%", supportedDataType));
        mysqlCondition.append(
            "AND json_extract(json, '$.supportedDataTypes') LIKE :supportedDataTypeLike ");
        psqlCondition.append("AND json->>'supportedDataTypes' LIKE :supportedDataTypeLike ");
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
      String condition = filter.getCondition();

      if (entityType == null && testPlatform == null && supportedDataType == null) {
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
        filter.queryParams.put("supportedDataTypeLike", String.format("%%%s%%", supportedDataType));
        mysqlCondition.append(
            "AND json_extract(json, '$.supportedDataTypes') LIKE :supportedDataTypeLike ");
        psqlCondition.append("AND json->>'supportedDataTypes' LIKE :supportedDataTypeLike ");
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
      String condition = filter.getCondition();

      if (entityType == null && testPlatform == null && supportedDataType == null) {
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
        filter.queryParams.put("supportedDataTypeLike", String.format("%%%s%%", supportedDataType));
        mysqlCondition.append(
            "AND json_extract(json, '$.supportedDataTypes') LIKE :supportedDataTypeLike ");
        psqlCondition.append("AND json->>'supportedDataTypes' LIKE :supportedDataTypeLike ");
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
  }

  interface DataQualityDataTimeSeriesDAO extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "data_quality_data_time_series";
    }

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

    @SqlQuery(
        """
              SELECT dqdts1.json FROM
              data_quality_data_time_series dqdts1
              INNER JOIN (
                  SELECT tc.fqnHash
                  FROM entity_relationship er
                  INNER JOIN test_case tc ON er.toId = tc.id
                  where fromEntity = 'testSuite' AND toEntity = 'testCase' and fromId = :testSuiteId
              ) ts ON dqdts1.entityFQNHash = ts.fqnHash
              LEFT JOIN data_quality_data_time_series dqdts2 ON
                  (dqdts1.entityFQNHash = dqdts2.entityFQNHash and dqdts1.timestamp < dqdts2.timestamp)
              WHERE dqdts2.entityFQNHash IS NULL""")
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
  }

  class EntitiesCountRowMapper implements RowMapper<EntitiesCount> {
    @Override
    public EntitiesCount map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new EntitiesCount()
          .withTableCount(rs.getInt("tableCount"))
          .withTopicCount(rs.getInt("topicCount"))
          .withDashboardCount(rs.getInt("dashboardCount"))
          .withPipelineCount(rs.getInt("pipelineCount"))
          .withMlmodelCount(rs.getInt("mlmodelCount"))
          .withServicesCount(rs.getInt("servicesCount"))
          .withUserCount(rs.getInt("userCount"))
          .withTeamCount(rs.getInt("teamCount"))
          .withTestSuiteCount(rs.getInt("testSuiteCount"))
          .withStorageContainerCount(rs.getInt("storageContainerCount"))
          .withGlossaryCount(rs.getInt("glossaryCount"))
          .withGlossaryTermCount(rs.getInt("glossaryTermCount"));
    }
  }

  class ServicesCountRowMapper implements RowMapper<ServicesCount> {
    @Override
    public ServicesCount map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new ServicesCount()
          .withDatabaseServiceCount(rs.getInt("databaseServiceCount"))
          .withMessagingServiceCount(rs.getInt("messagingServiceCount"))
          .withDashboardServiceCount(rs.getInt("dashboardServiceCount"))
          .withPipelineServiceCount(rs.getInt("pipelineServiceCount"))
          .withMlModelServiceCount(rs.getInt("mlModelServiceCount"))
          .withStorageServiceCount(rs.getInt("storageServiceCount"));
    }
  }

  interface SystemDAO {
    @ConnectionAwareSqlQuery(
        value =
            "SELECT (SELECT COUNT(fqnHash) FROM table_entity <cond>) as tableCount, "
                + "(SELECT COUNT(fqnHash) FROM topic_entity <cond>) as topicCount, "
                + "(SELECT COUNT(fqnHash) FROM dashboard_entity <cond>) as dashboardCount, "
                + "(SELECT COUNT(fqnHash) FROM pipeline_entity <cond>) as pipelineCount, "
                + "(SELECT COUNT(fqnHash) FROM ml_model_entity <cond>) as mlmodelCount, "
                + "(SELECT COUNT(fqnHash) FROM storage_container_entity <cond>) as storageContainerCount, "
                + "(SELECT COUNT(fqnHash) FROM search_index_entity <cond>) as searchIndexCount, "
                + "(SELECT COUNT(nameHash) FROM glossary_entity <cond>) as glossaryCount, "
                + "(SELECT COUNT(fqnHash) FROM glossary_term_entity <cond>) as glossaryTermCount, "
                + "(SELECT (SELECT COUNT(nameHash) FROM metadata_service_entity <cond>) + "
                + "(SELECT COUNT(nameHash) FROM dbservice_entity <cond>)+"
                + "(SELECT COUNT(nameHash) FROM messaging_service_entity <cond>)+ "
                + "(SELECT COUNT(nameHash) FROM dashboard_service_entity <cond>)+ "
                + "(SELECT COUNT(nameHash) FROM pipeline_service_entity <cond>)+ "
                + "(SELECT COUNT(nameHash) FROM mlmodel_service_entity <cond>)+ "
                + "(SELECT COUNT(nameHash) FROM search_service_entity <cond>)+ "
                + "(SELECT COUNT(nameHash) FROM storage_service_entity <cond>)) as servicesCount, "
                + "(SELECT COUNT(nameHash) FROM user_entity <cond> AND (JSON_EXTRACT(json, '$.isBot') IS NULL OR JSON_EXTRACT(json, '$.isBot') = FALSE)) as userCount, "
                + "(SELECT COUNT(nameHash) FROM team_entity <cond>) as teamCount, "
                + "(SELECT COUNT(fqnHash) FROM test_suite <cond>) as testSuiteCount",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT (SELECT COUNT(*) FROM table_entity <cond>) as tableCount, "
                + "(SELECT COUNT(*) FROM topic_entity <cond>) as topicCount, "
                + "(SELECT COUNT(*) FROM dashboard_entity <cond>) as dashboardCount, "
                + "(SELECT COUNT(*) FROM pipeline_entity <cond>) as pipelineCount, "
                + "(SELECT COUNT(*) FROM ml_model_entity <cond>) as mlmodelCount, "
                + "(SELECT COUNT(*) FROM storage_container_entity <cond>) as storageContainerCount, "
                + "(SELECT COUNT(*) FROM search_index_entity <cond>) as searchIndexCount, "
                + "(SELECT COUNT(*) FROM glossary_entity <cond>) as glossaryCount, "
                + "(SELECT COUNT(*) FROM glossary_term_entity <cond>) as glossaryTermCount, "
                + "(SELECT (SELECT COUNT(*) FROM metadata_service_entity <cond>) + "
                + "(SELECT COUNT(*) FROM dbservice_entity <cond>)+"
                + "(SELECT COUNT(*) FROM messaging_service_entity <cond>)+ "
                + "(SELECT COUNT(*) FROM dashboard_service_entity <cond>)+ "
                + "(SELECT COUNT(*) FROM pipeline_service_entity <cond>)+ "
                + "(SELECT COUNT(*) FROM mlmodel_service_entity <cond>)+ "
                + "(SELECT COUNT(*) FROM search_service_entity <cond>)+ "
                + "(SELECT COUNT(*) FROM storage_service_entity <cond>)) as servicesCount, "
                + "(SELECT COUNT(*) FROM user_entity <cond> AND (json#>'{isBot}' IS NULL OR ((json#>'{isBot}')::boolean) = FALSE)) as userCount, "
                + "(SELECT COUNT(*) FROM team_entity <cond>) as teamCount, "
                + "(SELECT COUNT(*) FROM test_suite <cond>) as testSuiteCount",
        connectionType = POSTGRES)
    @RegisterRowMapper(EntitiesCountRowMapper.class)
    EntitiesCount getAggregatedEntitiesCount(@Define("cond") String cond) throws StatementException;

    @ConnectionAwareSqlQuery(
        value =
            "SELECT (SELECT COUNT(nameHash) FROM dbservice_entity <cond>) as databaseServiceCount, "
                + "(SELECT COUNT(nameHash) FROM messaging_service_entity <cond>) as messagingServiceCount, "
                + "(SELECT COUNT(nameHash) FROM dashboard_service_entity <cond>) as dashboardServiceCount, "
                + "(SELECT COUNT(nameHash) FROM pipeline_service_entity <cond>) as pipelineServiceCount, "
                + "(SELECT COUNT(nameHash) FROM mlmodel_service_entity <cond>) as mlModelServiceCount, "
                + "(SELECT COUNT(nameHash) FROM storage_service_entity <cond>) as storageServiceCount, "
                + "(SELECT COUNT(nameHash) FROM search_service_entity <cond>) as searchServiceCount",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT (SELECT COUNT(*) FROM dbservice_entity <cond>) as databaseServiceCount, "
                + "(SELECT COUNT(*) FROM messaging_service_entity <cond>) as messagingServiceCount, "
                + "(SELECT COUNT(*) FROM dashboard_service_entity <cond>) as dashboardServiceCount, "
                + "(SELECT COUNT(*) FROM pipeline_service_entity <cond>) as pipelineServiceCount, "
                + "(SELECT COUNT(*) FROM mlmodel_service_entity <cond>) as mlModelServiceCount, "
                + "(SELECT COUNT(*) FROM storage_service_entity <cond>) as storageServiceCount, "
                + "(SELECT COUNT(*) FROM search_service_entity <cond>) as searchServiceCount",
        connectionType = POSTGRES)
    @RegisterRowMapper(ServicesCountRowMapper.class)
    ServicesCount getAggregatedServicesCount(@Define("cond") String cond) throws StatementException;

    @SqlQuery("SELECT configType,json FROM openmetadata_settings")
    @RegisterRowMapper(SettingsRowMapper.class)
    List<Settings> getAllConfig() throws StatementException;

    @SqlQuery("SELECT configType, json FROM openmetadata_settings WHERE configType = :configType")
    @RegisterRowMapper(SettingsRowMapper.class)
    Settings getConfigWithKey(@Bind("configType") String configType) throws StatementException;

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT into openmetadata_settings (configType, json)"
                + "VALUES (:configType, :json) ON DUPLICATE KEY UPDATE json = :json",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT into openmetadata_settings (configType, json)"
                + "VALUES (:configType, :json :: jsonb) ON CONFLICT (configType) DO UPDATE SET json = EXCLUDED.json",
        connectionType = POSTGRES)
    void insertSettings(@Bind("configType") String configType, @Bind("json") String json);

    @SqlUpdate(value = "DELETE from openmetadata_settings WHERE configType = :configType")
    void delete(@Bind("configType") String configType);

    @SqlQuery("SELECT 42")
    Integer testConnection() throws StatementException;

    @ConnectionAwareSqlQuery(
        value =
            "SELECT JSON_EXTRACT(json, '$.fullyQualifiedName') FROM <table> WHERE id NOT IN ( SELECT toId FROM entity_relationship WHERE fromEntity = :fromEntity AND toEntity = :toEntity)",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json ->> 'fullyQualifiedName' FROM <table> WHERE id NOT IN ( SELECT toId FROM entity_relationship WHERE fromEntity = :fromEntity AND toEntity = :toEntity)",
        connectionType = POSTGRES)
    List<String> getBrokenRelationFromParentToChild(
        @Define("table") String tableName,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity);

    @SqlUpdate(
        value =
            "DELETE FROM <table> WHERE id NOT IN (SELECT toId FROM entity_relationship WHERE fromEntity = :fromEntity AND toEntity = :toEntity)")
    int deleteBrokenRelationFromParentToChild(
        @Define("table") String tableName,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity);
  }

  class SettingsRowMapper implements RowMapper<Settings> {
    @Override
    public Settings map(ResultSet rs, StatementContext ctx) throws SQLException {
      return getSettings(SettingsType.fromValue(rs.getString("configType")), rs.getString("json"));
    }

    public static Settings getSettings(SettingsType configType, String json) {
      Settings settings = new Settings();
      settings.setConfigType(configType);
      Object value =
          switch (configType) {
            case EMAIL_CONFIGURATION -> JsonUtils.readValue(json, SmtpSettings.class);
            case OPEN_METADATA_BASE_URL_CONFIGURATION -> JsonUtils.readValue(
                json, OpenMetadataBaseUrlConfiguration.class);
            case CUSTOM_UI_THEME_PREFERENCE -> JsonUtils.readValue(json, UiThemePreference.class);
            case LOGIN_CONFIGURATION -> JsonUtils.readValue(json, LoginConfiguration.class);
            case SLACK_APP_CONFIGURATION, SLACK_INSTALLER, SLACK_BOT, SLACK_STATE -> JsonUtils
                .readValue(json, String.class);
            case PROFILER_CONFIGURATION -> JsonUtils.readValue(json, ProfilerConfiguration.class);
            case SEARCH_SETTINGS -> JsonUtils.readValue(json, SearchSettings.class);
            case ASSET_CERTIFICATION_SETTINGS -> JsonUtils.readValue(
                json, AssetCertificationSettings.class);
            case WORKFLOW_SETTINGS -> JsonUtils.readValue(json, WorkflowSettings.class);
            case LINEAGE_SETTINGS -> JsonUtils.readValue(json, LineageSettings.class);
            default -> throw new IllegalArgumentException("Invalid Settings Type " + configType);
          };
      settings.setConfigValue(value);
      return settings;
    }
  }

  class TokenRowMapper implements RowMapper<TokenInterface> {
    @Override
    public TokenInterface map(ResultSet rs, StatementContext ctx) throws SQLException {
      return getToken(TokenType.fromValue(rs.getString("tokenType")), rs.getString("json"));
    }

    public static TokenInterface getToken(TokenType type, String json) {
      return switch (type) {
        case EMAIL_VERIFICATION -> JsonUtils.readValue(json, EmailVerificationToken.class);
        case PASSWORD_RESET -> JsonUtils.readValue(json, PasswordResetToken.class);
        case REFRESH_TOKEN -> JsonUtils.readValue(json, RefreshToken.class);
        case PERSONAL_ACCESS_TOKEN -> JsonUtils.readValue(json, PersonalAccessToken.class);
        case SUPPORT_TOKEN -> JsonUtils.readValue(json, SupportToken.class);
      };
    }
  }

  interface TokenDAO {
    @SqlQuery("SELECT tokenType, json FROM user_tokens WHERE token = :token")
    @RegisterRowMapper(TokenRowMapper.class)
    TokenInterface findByToken(@Bind("token") String token) throws StatementException;

    @SqlQuery(
        "SELECT tokenType, json FROM user_tokens WHERE userId = :userId AND tokenType = :tokenType ")
    @RegisterRowMapper(TokenRowMapper.class)
    List<TokenInterface> getAllUserTokenWithType(
        @BindUUID("userId") UUID userId, @Bind("tokenType") String tokenType)
        throws StatementException;

    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO user_tokens (json) VALUES (:json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO user_tokens (json) VALUES (:json :: jsonb)",
        connectionType = POSTGRES)
    void insert(@Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE user_tokens SET json = :json WHERE token = :token",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE user_tokens SET json = (:json :: jsonb) WHERE token = :token",
        connectionType = POSTGRES)
    void update(@Bind("token") String token, @Bind("json") String json);

    @SqlUpdate(value = "DELETE from user_tokens WHERE token = :token")
    void delete(@Bind("token") String token);

    @SqlUpdate(value = "DELETE from user_tokens WHERE token IN (<tokenIds>)")
    void deleteAll(@BindList("tokenIds") List<String> tokens);

    @SqlUpdate(value = "DELETE from user_tokens WHERE userid = :userid AND tokenType = :tokenType")
    void deleteTokenByUserAndType(
        @BindUUID("userid") UUID userid, @Bind("tokenType") String tokenType);
  }

  interface KpiDAO extends EntityDAO<Kpi> {
    @Override
    default String getTableName() {
      return "kpi_entity";
    }

    @Override
    default Class<Kpi> getEntityClass() {
      return Kpi.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }
  }

  interface WorkflowDAO extends EntityDAO<Workflow> {
    @Override
    default String getTableName() {
      return "automations_workflow";
    }

    @Override
    default Class<Workflow> getEntityClass() {
      return Workflow.class;
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String workflowType = filter.getQueryParam("workflowType");
      String workflowStatus = filter.getQueryParam("workflowStatus");
      String condition = filter.getCondition();

      if (workflowType == null && workflowStatus == null) {
        return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
      }

      StringBuilder sqlCondition = new StringBuilder();
      sqlCondition.append(String.format("%s ", condition));

      if (workflowType != null) {
        sqlCondition.append("AND workflowType=:workflowType ");
      }

      if (workflowStatus != null) {
        sqlCondition.append("AND status=:workflowStatus ");
      }

      return listBefore(
          getTableName(),
          filter.getQueryParams(),
          sqlCondition.toString(),
          limit,
          beforeName,
          beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String workflowType = filter.getQueryParam("workflowType");
      String workflowStatus = filter.getQueryParam("workflowStatus");
      String condition = filter.getCondition();

      if (workflowType == null && workflowStatus == null) {
        return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
      }

      StringBuilder sqlCondition = new StringBuilder();
      sqlCondition.append(String.format("%s ", condition));

      if (workflowType != null) {
        sqlCondition.append("AND workflowType=:workflowType ");
      }

      if (workflowStatus != null) {
        sqlCondition.append("AND status=:workflowStatus ");
      }

      return listAfter(
          getTableName(),
          filter.getQueryParams(),
          sqlCondition.toString(),
          limit,
          afterName,
          afterId);
    }

    @Override
    default int listCount(ListFilter filter) {
      String workflowType = filter.getQueryParam("workflowType");
      String workflowStatus = filter.getQueryParam("workflowStatus");
      String condition = filter.getCondition();

      if (workflowType == null && workflowStatus == null) {
        return EntityDAO.super.listCount(filter);
      }

      StringBuilder sqlCondition = new StringBuilder();
      sqlCondition.append(String.format("%s ", condition));

      if (workflowType != null) {
        sqlCondition.append("AND workflowType=:workflowType ");
      }

      if (workflowStatus != null) {
        sqlCondition.append("AND status=:workflowStatus ");
      }

      return listCount(getTableName(), filter.getQueryParams(), sqlCondition.toString());
    }

    @SqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT name, id, json FROM <table> <sqlCondition> AND "
                + "(<table>.name < :beforeName OR (<table>.name = :beforeName AND <table>.id < :beforeId))  "
                + "ORDER BY name DESC,id DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name,id")
    List<String> listBefore(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String sqlCondition,
        @Bind("limit") int limit,
        @Bind("beforeName") String beforeName,
        @Bind("beforeId") String beforeId);

    @SqlQuery(
        value =
            "SELECT json FROM <table> <sqlCondition> AND (<table>.name > :afterName OR (<table>.name = :afterName AND <table>.id > :afterId))  ORDER BY name,id LIMIT :limit")
    List<String> listAfter(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String sqlCondition,
        @Bind("limit") int limit,
        @Bind("afterName") String afterName,
        @Bind("afterId") String afterId);

    @SqlQuery(value = "SELECT count(*) FROM <table> <sqlCondition>")
    int listCount(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String sqlCondition);
  }

  interface DataModelDAO extends EntityDAO<DashboardDataModel> {
    @Override
    default String getTableName() {
      return "dashboard_data_model_entity";
    }

    @Override
    default Class<DashboardDataModel> getEntityClass() {
      return DashboardDataModel.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface DocStoreDAO extends EntityDAO<Document> {
    @Override
    default String getTableName() {
      return "doc_store";
    }

    @Override
    default Class<Document> getEntityClass() {
      return Document.class;
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
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String entityType = filter.getQueryParam("entityType");
      String fqnPrefix = filter.getQueryParam("fqnPrefix");
      String cond = filter.getCondition();
      if (entityType == null && fqnPrefix == null) {
        return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
      }

      StringBuilder mysqlCondition = new StringBuilder();
      StringBuilder psqlCondition = new StringBuilder();
      mysqlCondition.append(cond);
      psqlCondition.append(cond);

      if (fqnPrefix != null) {
        String fqnPrefixHash = FullyQualifiedName.buildHash(fqnPrefix);
        filter.queryParams.put("fqnPrefixHash", fqnPrefixHash);
        filter.queryParams.put("concatFqnPrefixHash", fqnPrefixHash + ".%");
        String fqnCond = " AND (fqnHash LIKE :concatFqnPrefixHash OR fqnHash=:fqnPrefixHash)";
        mysqlCondition.append(fqnCond);
        psqlCondition.append(fqnCond);
      }

      if (entityType != null) {
        mysqlCondition.append(" AND entityType=:entityType ");
        psqlCondition.append(" AND entityType=:entityType ");
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
      String fqnPrefix = filter.getQueryParam("fqnPrefix");
      String cond = filter.getCondition();

      if (entityType == null && fqnPrefix == null) {
        return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
      }

      StringBuilder mysqlCondition = new StringBuilder();
      StringBuilder psqlCondition = new StringBuilder();
      mysqlCondition.append(cond);
      psqlCondition.append(cond);

      if (fqnPrefix != null) {
        String fqnPrefixHash = FullyQualifiedName.buildHash(fqnPrefix);
        filter.queryParams.put("fqnPrefixHash", fqnPrefixHash);
        filter.queryParams.put("concatFqnPrefixHash", fqnPrefixHash + ".%");
        String fqnCond = " AND (fqnHash LIKE :concatFqnPrefixHash OR fqnHash=:fqnPrefixHash)";
        mysqlCondition.append(fqnCond);
        psqlCondition.append(fqnCond);
      }
      if (entityType != null) {
        mysqlCondition.append(" AND entityType=:entityType ");
        psqlCondition.append(" AND entityType=:entityType ");
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
      String fqnPrefix = filter.getQueryParam("fqnPrefix");
      String cond = filter.getCondition();

      if (entityType == null && fqnPrefix == null) {
        return EntityDAO.super.listCount(filter);
      }

      StringBuilder mysqlCondition = new StringBuilder();
      StringBuilder psqlCondition = new StringBuilder();
      mysqlCondition.append(cond);
      psqlCondition.append(cond);

      if (fqnPrefix != null) {
        String fqnPrefixHash = FullyQualifiedName.buildHash(fqnPrefix);
        filter.queryParams.put("fqnPrefixHash", fqnPrefixHash);
        filter.queryParams.put("concatFqnPrefixHash", fqnPrefixHash + ".%");
        String fqnCond = " AND (fqnHash LIKE :concatFqnPrefixHash OR fqnHash=:fqnPrefixHash)";
        mysqlCondition.append(fqnCond);
        psqlCondition.append(fqnCond);
      }

      if (entityType != null) {
        mysqlCondition.append(" AND entityType=:entityType ");
        psqlCondition.append(" AND entityType=:entityType ");
      }

      return listCount(
          getTableName(),
          getNameHashColumn(),
          filter.getQueryParams(),
          mysqlCondition.toString(),
          psqlCondition.toString());
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT name, id, json FROM <table> <mysqlCond> AND "
                + "(name < :beforeName OR (name = :beforeName AND id < :beforeId))  "
                + "ORDER BY name DESC,id DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name,id",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT name, id, json FROM <table> <psqlCond> AND "
                + "(name < :beforeName OR (name = :beforeName AND id < :beforeId))  "
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
        value = "SELECT json FROM doc_store WHERE name = :name AND entityType = 'EmailTemplate'",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT json FROM doc_store WHERE name = :name AND entityType = 'EmailTemplate'",
        connectionType = POSTGRES)
    String fetchEmailTemplateByName(@Bind("name") String name);

    @ConnectionAwareSqlQuery(
        value = "SELECT json FROM doc_store WHERE entityType = 'EmailTemplate'",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT json FROM doc_store WHERE entityType = 'EmailTemplate'",
        connectionType = POSTGRES)
    List<String> fetchAllEmailTemplates();

    @ConnectionAwareSqlUpdate(
        value = "DELETE FROM doc_store WHERE entityType = 'EmailTemplate'",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "DELETE FROM doc_store WHERE entityType = 'EmailTemplate'",
        connectionType = POSTGRES)
    void deleteEmailTemplates();
  }

  interface SuggestionDAO {
    default String getTableName() {
      return "suggestions";
    }

    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO suggestions(fqnHash, json) VALUES (:fqnHash, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO suggestions(fqnHash, json) VALUES (:fqnHash, :json :: jsonb)",
        connectionType = POSTGRES)
    void insert(@BindFQN("fqnHash") String fullyQualifiedName, @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE suggestions SET json = :json where id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE suggestions SET json = (:json :: jsonb) where id = :id",
        connectionType = POSTGRES)
    void update(@BindUUID("id") UUID id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM suggestions WHERE id = :id")
    String findById(@BindUUID("id") UUID id);

    @SqlUpdate("DELETE FROM suggestions WHERE id = :id")
    void delete(@BindUUID("id") UUID id);

    @SqlUpdate("DELETE FROM suggestions WHERE fqnHash = :fqnHash")
    void deleteByFQN(@BindUUID("fqnHash") String fullyQualifiedName);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM suggestions suggestions WHERE JSON_EXTRACT(json, '$.createdBy.id') = :createdBy",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "DELETE FROM suggestions suggestions WHERE json #>> '{createdBy,id}' = :createdBy",
        connectionType = POSTGRES)
    void deleteByCreatedBy(@BindUUID("createdBy") UUID id);

    @SqlQuery("SELECT json FROM suggestions <condition> ORDER BY updatedAt DESC LIMIT :limit")
    List<String> list(@Bind("limit") int limit, @Define("condition") String condition);

    @ConnectionAwareSqlQuery(
        value = "SELECT count(*) FROM suggestions <mysqlCond>",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT count(*) FROM suggestions <postgresCond>",
        connectionType = POSTGRES)
    int listCount(
        @Define("mysqlCond") String mysqlCond, @Define("postgresCond") String postgresCond);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT updatedAt, json FROM suggestions <mysqlCond> "
                + "ORDER BY updatedAt DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY updatedAt",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT updatedAt, json FROM suggestions <psqlCond> "
                + "ORDER BY updatedAt DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY updatedAt",
        connectionType = POSTGRES)
    List<String> listBefore(
        @Define("mysqlCond") String mysqlCond,
        @Define("psqlCond") String psqlCond,
        @Bind("limit") int limit,
        @Bind("before") String before);

    @ConnectionAwareSqlQuery(
        value = "SELECT json FROM suggestions <mysqlCond>  ORDER BY updatedAt DESC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT json FROM suggestions <psqlCond>  ORDER BY updatedAt DESC LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listAfter(
        @Define("mysqlCond") String mysqlCond,
        @Define("psqlCond") String psqlCond,
        @Bind("limit") int limit,
        @Bind("after") String after);
  }

  interface APICollectionDAO extends EntityDAO<APICollection> {
    @Override
    default String getTableName() {
      return "api_collection_entity";
    }

    @Override
    default Class<APICollection> getEntityClass() {
      return APICollection.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface APIEndpointDAO extends EntityDAO<APIEndpoint> {
    @Override
    default String getTableName() {
      return "api_endpoint_entity";
    }

    @Override
    default Class<APIEndpoint> getEntityClass() {
      return APIEndpoint.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface WorkflowDefinitionDAO extends EntityDAO<WorkflowDefinition> {
    @Override
    default String getTableName() {
      return "workflow_definition_entity";
    }

    @Override
    default Class<WorkflowDefinition> getEntityClass() {
      return WorkflowDefinition.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface WorkflowInstanceTimeSeriesDAO extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "workflow_instance_time_series";
    }
  }

  interface WorkflowInstanceStateTimeSeriesDAO extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "workflow_instance_state_time_series";
    }

    @SqlQuery(
        value =
            "SELECT json FROM workflow_instance_state_time_series "
                + "WHERE workflowInstanceId = :workflowInstanceId AND stage = :stage ORDER BY timestamp DESC")
    List<String> listWorkflowInstanceStateForStage(
        @Bind("workflowInstanceId") String workflowInstanceId, @Bind("stage") String stage);
  }
}
