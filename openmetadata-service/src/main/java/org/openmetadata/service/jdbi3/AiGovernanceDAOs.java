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
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindFQN;

public interface AiGovernanceDAOs {
  @CreateSqlObject
  AIApplicationDAO aiApplicationDAO();

  @CreateSqlObject
  LLMModelDAO llmModelDAO();

  @CreateSqlObject
  PromptTemplateDAO promptTemplateDAO();

  @CreateSqlObject
  AgentExecutionDAO agentExecutionDAO();

  @CreateSqlObject
  AIGovernancePolicyDAO aiGovernancePolicyDAO();

  @CreateSqlObject
  McpServerDAO mcpServerDAO();

  @CreateSqlObject
  McpExecutionDAO mcpExecutionDAO();

  @CreateSqlObject
  LLMServiceDAO llmServiceDAO();

  @CreateSqlObject
  McpServiceDAO mcpServiceDAO();

  interface AIApplicationDAO extends EntityDAO<org.openmetadata.schema.entity.ai.AIApplication> {
    @Override
    default String getTableName() {
      return "ai_application_entity";
    }

    @Override
    default Class<org.openmetadata.schema.entity.ai.AIApplication> getEntityClass() {
      return org.openmetadata.schema.entity.ai.AIApplication.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface LLMModelDAO extends EntityDAO<org.openmetadata.schema.entity.ai.LLMModel> {
    @Override
    default String getTableName() {
      return "llm_model_entity";
    }

    @Override
    default Class<org.openmetadata.schema.entity.ai.LLMModel> getEntityClass() {
      return org.openmetadata.schema.entity.ai.LLMModel.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface PromptTemplateDAO extends EntityDAO<org.openmetadata.schema.entity.ai.PromptTemplate> {
    @Override
    default String getTableName() {
      return "prompt_template_entity";
    }

    @Override
    default Class<org.openmetadata.schema.entity.ai.PromptTemplate> getEntityClass() {
      return org.openmetadata.schema.entity.ai.PromptTemplate.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface AgentExecutionDAO extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "agent_execution_entity";
    }

    @Override
    default String getPartitionFieldName() {
      return "agentId";
    }

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO agent_execution_entity(json) VALUES (:json) AS new_data ON DUPLICATE KEY UPDATE json = new_data.json",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO agent_execution_entity(json) VALUES (:json::jsonb) ON CONFLICT (id) DO UPDATE SET json = EXCLUDED.json",
        connectionType = POSTGRES)
    void insertWithoutExtension(
        @Define("table") String table,
        @BindFQN("entityFQNHash") String entityFQNHash,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO agent_execution_entity(json) VALUES (:json) AS new_data ON DUPLICATE KEY UPDATE json = new_data.json",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO agent_execution_entity(json) VALUES (:json::jsonb) ON CONFLICT (id) DO UPDATE SET json = EXCLUDED.json",
        connectionType = POSTGRES)
    void insert(
        @Define("table") String table,
        @BindFQN("entityFQNHash") String entityFQNHash,
        @Bind("extension") String extension,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM agent_execution_entity WHERE agentId = :agentId AND timestamp = :timestamp",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM agent_execution_entity WHERE agentId = :agentId AND timestamp = :timestamp",
        connectionType = POSTGRES)
    void deleteAtTimestamp(
        @BindFQN("agentId") String agentId,
        @Bind("extension") String extension,
        @Bind("timestamp") Long timestamp);

    @SqlQuery("SELECT count(*) FROM agent_execution_entity <cond>")
    int listCount(@Define("cond") String condition);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM agent_execution_entity "
                + "WHERE id IN ("
                + "  SELECT id FROM ("
                + "    SELECT ae.id FROM agent_execution_entity ae "
                + "    LEFT JOIN ai_application_entity ai ON ae.agentId = ai.id "
                + "    WHERE ai.id IS NULL "
                + "    LIMIT :limit"
                + "  ) sub"
                + ")",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM agent_execution_entity "
                + "WHERE id IN ("
                + "  SELECT ae.id FROM agent_execution_entity ae "
                + "  LEFT JOIN ai_application_entity ai ON ae.agentId = ai.id "
                + "  WHERE ai.id IS NULL "
                + "  LIMIT :limit"
                + ")",
        connectionType = POSTGRES)
    int deleteOrphanedRecords(@Bind("limit") int limit);
  }

  interface AIGovernancePolicyDAO
      extends EntityDAO<org.openmetadata.schema.entity.ai.AIGovernancePolicy> {
    @Override
    default String getTableName() {
      return "ai_governance_policy_entity";
    }

    @Override
    default Class<org.openmetadata.schema.entity.ai.AIGovernancePolicy> getEntityClass() {
      return org.openmetadata.schema.entity.ai.AIGovernancePolicy.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface McpServerDAO extends EntityDAO<org.openmetadata.schema.entity.ai.McpServer> {
    @Override
    default String getTableName() {
      return "mcp_server_entity";
    }

    @Override
    default Class<org.openmetadata.schema.entity.ai.McpServer> getEntityClass() {
      return org.openmetadata.schema.entity.ai.McpServer.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface McpExecutionDAO extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "mcp_execution_entity";
    }

    @Override
    default String getPartitionFieldName() {
      return "serverId";
    }

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO <table>(json) VALUES (:json) AS new_data ON DUPLICATE KEY UPDATE json = new_data.json",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO <table>(json) VALUES (:json::jsonb) ON CONFLICT (id) DO UPDATE SET json = EXCLUDED.json",
        connectionType = POSTGRES)
    void insertWithoutExtension(
        @Define("table") String table,
        @BindFQN("entityFQNHash") String entityFQNHash,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO <table>(json) VALUES (:json) AS new_data ON DUPLICATE KEY UPDATE json = new_data.json",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO <table>(json) VALUES (:json::jsonb) ON CONFLICT (id) DO UPDATE SET json = EXCLUDED.json",
        connectionType = POSTGRES)
    void insert(
        @Define("table") String table,
        @BindFQN("entityFQNHash") String entityFQNHash,
        @Bind("extension") String extension,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value = "DELETE FROM <table> WHERE serverId = :serverId AND timestamp = :timestamp",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "DELETE FROM <table> WHERE serverId = :serverId AND timestamp = :timestamp",
        connectionType = POSTGRES)
    void deleteAtTimestamp(
        @Define("table") String table,
        @Bind("serverId") String serverId,
        @Bind("extension") String extension,
        @Bind("timestamp") Long timestamp);

    @SqlQuery(
        "SELECT json FROM <table> WHERE serverId = :serverId ORDER BY timestamp DESC LIMIT :limit")
    List<String> listByServerId(
        @Define("table") String table, @Bind("serverId") String serverId, @Bind("limit") int limit);

    @SqlQuery("SELECT count(*) FROM <table> <cond>")
    int listCount(@Define("table") String table, @Define("cond") String condition);

    @ConnectionAwareSqlUpdate(
        value = "DELETE FROM <table> WHERE serverId = :serverId",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "DELETE FROM <table> WHERE serverId = :serverId",
        connectionType = POSTGRES)
    void deleteByServerId(@Define("table") String table, @Bind("serverId") String serverId);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM mcp_execution_entity "
                + "WHERE id IN ("
                + "  SELECT id FROM ("
                + "    SELECT me.id FROM mcp_execution_entity me "
                + "    LEFT JOIN mcp_server_entity ms ON me.serverId = ms.id "
                + "    WHERE ms.id IS NULL "
                + "    LIMIT :limit"
                + "  ) sub"
                + ")",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM mcp_execution_entity "
                + "WHERE id IN ("
                + "  SELECT me.id FROM mcp_execution_entity me "
                + "  LEFT JOIN mcp_server_entity ms ON me.serverId = ms.id "
                + "  WHERE ms.id IS NULL "
                + "  LIMIT :limit"
                + ")",
        connectionType = POSTGRES)
    int deleteOrphanedRecords(@Bind("limit") int limit);
  }

  interface LLMServiceDAO extends EntityDAO<org.openmetadata.schema.entity.services.LLMService> {
    @Override
    default String getTableName() {
      return "llm_service_entity";
    }

    @Override
    default Class<org.openmetadata.schema.entity.services.LLMService> getEntityClass() {
      return org.openmetadata.schema.entity.services.LLMService.class;
    }
  }

  interface McpServiceDAO extends EntityDAO<org.openmetadata.schema.entity.services.McpService> {
    @Override
    default String getTableName() {
      return "mcp_service_entity";
    }

    @Override
    default Class<org.openmetadata.schema.entity.services.McpService> getEntityClass() {
      return org.openmetadata.schema.entity.services.McpService.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }
  }
}
