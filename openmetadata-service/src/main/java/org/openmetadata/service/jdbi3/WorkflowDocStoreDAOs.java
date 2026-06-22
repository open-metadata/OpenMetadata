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

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindMap;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.learning.LearningResource;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.jdbi.BindFQN;
import org.openmetadata.service.util.jdbi.BindUUID;

public interface WorkflowDocStoreDAOs {
  @CreateSqlObject
  KpiDAO kpiDAO();

  @CreateSqlObject
  WorkflowDAO workflowDAO();

  @CreateSqlObject
  DataModelDAO dashboardDataModelDAO();

  @CreateSqlObject
  DocStoreDAO docStoreDAO();

  @CreateSqlObject
  LearningResourceDAO learningResourceDAO();

  @CreateSqlObject
  ContextMemoryDAO contextMemoryDAO();

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

  @CreateSqlObject
  RecognizerFeedbackDAO recognizerFeedbackDAO();

  interface KpiDAO extends EntityDAO<Kpi> {
    @Override
    default String getTableName() {
      return "kpi_entity";
    }

    @Override
    default Class<Kpi> getEntityClass() {
      return Kpi.class;
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

  interface LearningResourceDAO extends EntityDAO<LearningResource> {
    @Override
    default String getTableName() {
      return "learning_resource_entity";
    }

    @Override
    default Class<LearningResource> getEntityClass() {
      return LearningResource.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface ContextMemoryDAO extends EntityDAO<ContextMemory> {
    @Override
    default String getTableName() {
      return "context_memory";
    }

    @Override
    default Class<ContextMemory> getEntityClass() {
      return ContextMemory.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }
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
    List<String> list(
        @Bind("limit") int limit,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @ConnectionAwareSqlQuery(
        value = "SELECT count(*) FROM suggestions <mysqlCond>",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT count(*) FROM suggestions <postgresCond>",
        connectionType = POSTGRES)
    int listCount(
        @Define("mysqlCond") String mysqlCond,
        @Define("postgresCond") String postgresCond,
        @BindMap Map<String, String> params);

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
        @Bind("before") String before,
        @BindMap Map<String, String> params);

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
        @Bind("after") String after,
        @BindMap Map<String, String> params);
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

    /**
     * Repoint the workflow-instance {@code relatedEntity} (the {@code entityLink} the history card
     * filters by) for an entire moved subtree in one set-based statement: the moved term itself
     * (exact {@code oldLink}) plus every descendant ({@code entityLink LIKE oldChildPrefix}). The
     * stem swap rewrites {@code <#E::type::oldFqn} to {@code <#E::type::newFqn} for both. The
     * {@code .}-suffixed prefix is collision-safe (a move of {@code a.b} never touches sibling
     * {@code a.bc}), matching the existing {@code renameByToFQNPrefix} pattern.
     */
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE workflow_instance_time_series "
                + "SET json = JSON_SET(json, '$.variables.global_relatedEntity', "
                + "REPLACE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.variables.global_relatedEntity')), :oldStem, :newStem)) "
                + "WHERE entityLink = :oldLink OR entityLink LIKE :oldChildPrefix",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE workflow_instance_time_series "
                + "SET json = jsonb_set(json, '{variables,global_relatedEntity}', "
                + "to_jsonb(REPLACE(json->'variables'->>'global_relatedEntity', :oldStem, :newStem))) "
                + "WHERE entityLink = :oldLink OR entityLink LIKE :oldChildPrefix",
        connectionType = POSTGRES)
    int repointRelatedEntitySubtree(
        @Bind("oldLink") String oldLink,
        @Bind("oldChildPrefix") String oldChildPrefix,
        @Bind("oldStem") String oldStem,
        @Bind("newStem") String newStem);
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

    @SqlQuery(
        value =
            "SELECT json FROM workflow_instance_state_time_series "
                + "WHERE workflowInstanceId = :workflowInstanceId ORDER BY timestamp ASC")
    List<String> listAllStatesForInstance(@Bind("workflowInstanceId") String workflowInstanceId);
  }

  interface RecognizerFeedbackDAO {
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO recognizer_feedback_entity(json) VALUES (:json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO recognizer_feedback_entity(json) VALUES (:json :: jsonb)",
        connectionType = POSTGRES)
    void insert(@Bind("json") String json);

    @SqlQuery("SELECT json FROM recognizer_feedback_entity WHERE id = :id")
    String findById(@BindUUID("id") UUID id);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE recognizer_feedback_entity SET json = :json WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE recognizer_feedback_entity SET json = :json :: jsonb WHERE id = :id",
        connectionType = POSTGRES)
    void update(@BindUUID("id") UUID id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM recognizer_feedback_entity WHERE entityLink = :entityLink")
    List<String> findByEntityLink(@Bind("entityLink") String entityLink);

    @SqlQuery("SELECT json FROM recognizer_feedback_entity WHERE tagFQN = :tagFQN")
    List<String> findByTagFQN(@Bind("tagFQN") String tagFQN);

    @SqlQuery("SELECT json FROM recognizer_feedback_entity WHERE status = :status")
    List<String> findByStatus(@Bind("status") String status);

    @SqlQuery("SELECT count(id) FROM recognizer_feedback_entity")
    int count();

    @SqlUpdate("DELETE FROM recognizer_feedback_entity WHERE id = :id")
    void delete(@BindUUID("id") UUID id);
  }
}
