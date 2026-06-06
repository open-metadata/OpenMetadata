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

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.util.EntitiesCount;
import org.openmetadata.schema.util.ServicesCount;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindFQN;

public interface CollectionDAO
    extends CoreRelationshipDAOs,
        OAuthDAOs,
        WorkflowDocStoreDAOs,
        AccessControlDAOs,
        EntityDataDAOs,
        DataAssetServiceDAOs,
        SystemTokenDAOs,
        KnowledgeAssetDAOs,
        EventSubscriptionDAOs,
        GovernanceDAOs,
        ActivityAuditDAOs,
        TimeSeriesDAOs,
        ClassificationTagDAOs,
        FeedDAOs,
        AiGovernanceDAOs,
        SearchReindexDAOs,
        RdfInfraDAOs {
  @CreateSqlObject
  IndexMappingVersionDAO indexMappingVersionDAO();

  @CreateSqlObject
  AssetDAO assetDAO();

  @CreateSqlObject
  DeletionLockDAO deletionLockDAO();

  @CreateSqlObject
  IntakeFormDAO intakeFormDAO();

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

  class ExecutionTrendRow {
    private String dateKey;
    private String status;
    private Integer count;

    public ExecutionTrendRow() {}

    public ExecutionTrendRow(String dateKey, String status, Integer count) {
      this.dateKey = dateKey;
      this.status = status;
      this.count = count;
    }

    public String getDateKey() {
      return dateKey;
    }

    public void setDateKey(String dateKey) {
      this.dateKey = dateKey;
    }

    public String getStatus() {
      return status;
    }

    public void setStatus(String status) {
      this.status = status;
    }

    public Integer getCount() {
      return count;
    }

    public void setCount(Integer count) {
      this.count = count;
    }
  }

  class ExecutionTrendRowMapper implements RowMapper<ExecutionTrendRow> {
    @Override
    public ExecutionTrendRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      ExecutionTrendRow row = new ExecutionTrendRow();
      row.setDateKey(rs.getString("date_key"));
      row.setStatus(rs.getString("status"));
      row.setCount(rs.getInt("count"));
      return row;
    }
  }

  class RuntimeTrendRow {
    private String dateKey;
    private Long firstTimestamp;
    private Double maxRuntime;
    private Double minRuntime;
    private Double avgRuntime;
    private Integer totalPipelines;

    public RuntimeTrendRow() {}

    public RuntimeTrendRow(
        String dateKey,
        Long firstTimestamp,
        Double maxRuntime,
        Double minRuntime,
        Double avgRuntime,
        Integer totalPipelines) {
      this.dateKey = dateKey;
      this.firstTimestamp = firstTimestamp;
      this.maxRuntime = maxRuntime;
      this.minRuntime = minRuntime;
      this.avgRuntime = avgRuntime;
      this.totalPipelines = totalPipelines;
    }

    public String getDateKey() {
      return dateKey;
    }

    public void setDateKey(String dateKey) {
      this.dateKey = dateKey;
    }

    public Long getFirstTimestamp() {
      return firstTimestamp;
    }

    public void setFirstTimestamp(Long firstTimestamp) {
      this.firstTimestamp = firstTimestamp;
    }

    public Double getMaxRuntime() {
      return maxRuntime;
    }

    public void setMaxRuntime(Double maxRuntime) {
      this.maxRuntime = maxRuntime;
    }

    public Double getMinRuntime() {
      return minRuntime;
    }

    public void setMinRuntime(Double minRuntime) {
      this.minRuntime = minRuntime;
    }

    public Double getAvgRuntime() {
      return avgRuntime;
    }

    public void setAvgRuntime(Double avgRuntime) {
      this.avgRuntime = avgRuntime;
    }

    public Integer getTotalPipelines() {
      return totalPipelines;
    }

    public void setTotalPipelines(Integer totalPipelines) {
      this.totalPipelines = totalPipelines;
    }
  }

  class RuntimeTrendRowMapper implements RowMapper<RuntimeTrendRow> {
    @Override
    public RuntimeTrendRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      RuntimeTrendRow row = new RuntimeTrendRow();
      row.setDateKey(rs.getString("date_key"));
      row.setFirstTimestamp(rs.getLong("first_timestamp"));
      row.setMaxRuntime(rs.getDouble("max_runtime"));
      row.setMinRuntime(rs.getDouble("min_runtime"));
      row.setAvgRuntime(rs.getDouble("avg_runtime"));
      row.setTotalPipelines(rs.getInt("total_pipelines"));
      return row;
    }
  }

  class ServiceBreakdownRow {
    private String serviceType;
    private Integer pipelineCount;

    public ServiceBreakdownRow() {}

    public ServiceBreakdownRow(String serviceType, Integer pipelineCount) {
      this.serviceType = serviceType;
      this.pipelineCount = pipelineCount;
    }

    public String getServiceType() {
      return serviceType;
    }

    public void setServiceType(String serviceType) {
      this.serviceType = serviceType;
    }

    public Integer getPipelineCount() {
      return pipelineCount;
    }

    public void setPipelineCount(Integer pipelineCount) {
      this.pipelineCount = pipelineCount;
    }
  }

  class ServiceBreakdownRowMapper implements RowMapper<ServiceBreakdownRow> {
    @Override
    public ServiceBreakdownRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      ServiceBreakdownRow row = new ServiceBreakdownRow();
      row.setServiceType(rs.getString("service_type"));
      row.setPipelineCount(rs.getInt("pipeline_count"));
      return row;
    }
  }

  class PipelineMetricsRow {
    private Integer totalPipelines;
    private Integer activePipelines;
    private Integer successfulPipelines;
    private Integer failedPipelines;

    public PipelineMetricsRow() {}

    public PipelineMetricsRow(
        Integer totalPipelines,
        Integer activePipelines,
        Integer successfulPipelines,
        Integer failedPipelines) {
      this.totalPipelines = totalPipelines;
      this.activePipelines = activePipelines;
      this.successfulPipelines = successfulPipelines;
      this.failedPipelines = failedPipelines;
    }

    public Integer getTotalPipelines() {
      return totalPipelines;
    }

    public void setTotalPipelines(Integer totalPipelines) {
      this.totalPipelines = totalPipelines;
    }

    public Integer getActivePipelines() {
      return activePipelines;
    }

    public void setActivePipelines(Integer activePipelines) {
      this.activePipelines = activePipelines;
    }

    public Integer getSuccessfulPipelines() {
      return successfulPipelines;
    }

    public void setSuccessfulPipelines(Integer successfulPipelines) {
      this.successfulPipelines = successfulPipelines;
    }

    public Integer getFailedPipelines() {
      return failedPipelines;
    }

    public void setFailedPipelines(Integer failedPipelines) {
      this.failedPipelines = failedPipelines;
    }
  }

  class PipelineMetricsRowMapper implements RowMapper<PipelineMetricsRow> {
    @Override
    public PipelineMetricsRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      PipelineMetricsRow row = new PipelineMetricsRow();
      row.setTotalPipelines(rs.getInt("total_pipelines"));
      row.setActivePipelines(rs.getInt("active_pipelines"));
      row.setSuccessfulPipelines(rs.getInt("successful_pipelines"));
      row.setFailedPipelines(rs.getInt("failed_pipelines"));
      return row;
    }
  }

  class PipelineSummaryRow {
    private String id;
    private String json;
    private String latestStatus;

    public PipelineSummaryRow() {}

    public PipelineSummaryRow(String id, String json, String latestStatus) {
      this.id = id;
      this.json = json;
      this.latestStatus = latestStatus;
    }

    public String getId() {
      return id;
    }

    public void setId(String id) {
      this.id = id;
    }

    public String getJson() {
      return json;
    }

    public void setJson(String json) {
      this.json = json;
    }

    public String getLatestStatus() {
      return latestStatus;
    }

    public void setLatestStatus(String latestStatus) {
      this.latestStatus = latestStatus;
    }
  }

  class PipelineSummaryRowMapper implements RowMapper<PipelineSummaryRow> {
    @Override
    public PipelineSummaryRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      PipelineSummaryRow row = new PipelineSummaryRow();
      row.setId(rs.getString("id"));
      row.setJson(rs.getString("json"));
      row.setLatestStatus(rs.getString("latest_status"));
      return row;
    }
  }

  interface IntakeFormDAO extends EntityDAO<IntakeForm> {
    @Override
    default String getTableName() {
      return "intake_form_entity";
    }

    @Override
    default Class<IntakeForm> getEntityClass() {
      return IntakeForm.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM intake_form_entity WHERE JSON_EXTRACT(json, '$.entityType') = :entityType LIMIT 1",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM intake_form_entity WHERE json->>'entityType' = :entityType LIMIT 1",
        connectionType = POSTGRES)
    String findByEntityType(@Bind("entityType") String entityType);
  }

  interface AssetDAO {
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO asset_entity (json, fqnHash) VALUES (:json, :fqnHash)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO asset_entity (json, fqnHash) VALUES (:json :: jsonb, :fqnHash)",
        connectionType = POSTGRES)
    void insert(@BindFQN("fqnHash") String fqnHash, @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE asset_entity SET json = :json WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE asset_entity SET json = :json::jsonb WHERE id = :id",
        connectionType = POSTGRES)
    void update(@Bind("json") String json, @Bind("id") String id);

    @SqlQuery("SELECT json FROM asset_entity WHERE id = :id")
    String getById(@Bind("id") String id);

    @SqlQuery(
        "SELECT json FROM asset_entity WHERE LOWER(assetType) = LOWER(:assetType) AND fqnHash = :fqnHash")
    List<String> getByFqnExact(
        @Bind("assetType") String assetType, @BindFQN("fqnHash") String fullyQualifiedName);

    @SqlQuery(
        "SELECT json FROM asset_entity WHERE LOWER(assetType) = LOWER(:assetType) AND fqnHash LIKE :concatFqnPrefixHash")
    List<String> getByFqnPrefix(
        @Bind("assetType") String assetType,
        @org.openmetadata.service.util.jdbi.BindConcat(
                value = "concatFqnPrefixHash",
                parts = {":fqnPrefixHash", "%"},
                hash = true)
            String fqnPrefixHash);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE asset_entity SET json = JSON_SET(json, '$.deleted', true) "
                + "WHERE fqnHash LIKE :prefix",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE asset_entity SET json = jsonb_set(json, '{deleted}', 'true') "
                + "WHERE fqnHash LIKE :prefix",
        connectionType = POSTGRES)
    void markDeletedByFqnPrefix(@BindFQN("prefix") String prefix);

    @SqlUpdate("DELETE FROM asset_entity WHERE fqnHash LIKE :prefix")
    void deleteByFqnPrefix(@BindFQN("prefix") String prefix);

    @SqlUpdate("DELETE FROM asset_entity WHERE id = :id")
    void delete(@Bind("id") String id);
  }
}
