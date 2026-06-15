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
import java.util.UUID;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindFQN;
import org.openmetadata.service.util.jdbi.BindUUID;

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

  @CreateSqlObject
  McpConversationDAO mcpConversationDAO();

  @CreateSqlObject
  McpMessageDAO mcpMessageDAO();

  interface McpConversationDAO {
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO mcp_conversation (json) VALUES (:json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO mcp_conversation (json) VALUES (:json::jsonb)",
        connectionType = POSTGRES)
    void insert(@Bind("json") String json);

    @SqlQuery("SELECT json FROM mcp_conversation WHERE id = :id")
    String getById(@BindUUID("id") UUID id);

    @SqlQuery(
        "SELECT json FROM mcp_conversation WHERE userId = :userId "
            + "ORDER BY updatedAt DESC LIMIT :limit OFFSET :offset")
    List<String> listByUser(
        @BindUUID("userId") UUID userId, @Bind("limit") int limit, @Bind("offset") int offset);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE mcp_conversation SET json = :json WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE mcp_conversation SET json = :json::jsonb WHERE id = :id",
        connectionType = POSTGRES)
    void update(@BindUUID("id") UUID id, @Bind("json") String json);

    @SqlQuery("SELECT COUNT(*) FROM mcp_conversation WHERE userId = :userId")
    int countByUser(@BindUUID("userId") UUID userId);

    @SqlUpdate("DELETE FROM mcp_conversation WHERE id = :id")
    void delete(@BindUUID("id") UUID id);
  }

  interface McpMessageDAO {
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO mcp_message (json) VALUES (:json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO mcp_message (json) VALUES (:json::jsonb)",
        connectionType = POSTGRES)
    void insert(@Bind("json") String json);

    @SqlQuery(
        "SELECT json FROM mcp_message WHERE conversationId = :conversationId "
            + "ORDER BY messageIndex ASC LIMIT :limit OFFSET :offset")
    List<String> listByConversation(
        @BindUUID("conversationId") UUID conversationId,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    @SqlQuery(
        "SELECT json FROM mcp_message WHERE conversationId = :conversationId "
            + "ORDER BY messageIndex DESC LIMIT :limit")
    List<String> listRecentByConversation(
        @BindUUID("conversationId") UUID conversationId, @Bind("limit") int limit);

    @SqlQuery("SELECT COUNT(*) FROM mcp_message WHERE conversationId = :conversationId")
    int countByConversation(@BindUUID("conversationId") UUID conversationId);

    @SqlUpdate("DELETE FROM mcp_message WHERE id = :id")
    void delete(@BindUUID("id") UUID id);

    @SqlUpdate("DELETE FROM mcp_message WHERE conversationId = :conversationId")
    void deleteByConversation(@BindUUID("conversationId") UUID conversationId);
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
