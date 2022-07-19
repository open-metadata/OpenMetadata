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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.catalog.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import org.apache.commons.lang3.tuple.Triple;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.Bot;
import org.openmetadata.catalog.entity.Type;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.DatabaseSchema;
import org.openmetadata.catalog.entity.data.Glossary;
import org.openmetadata.catalog.entity.data.GlossaryTerm;
import org.openmetadata.catalog.entity.data.Location;
import org.openmetadata.catalog.entity.data.Metrics;
import org.openmetadata.catalog.entity.data.MlModel;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.Report;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.entity.services.MlModelService;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.catalog.entity.tags.Tag;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.jdbi3.CollectionDAO.TagUsageDAO.TagLabelMapper;
import org.openmetadata.catalog.jdbi3.CollectionDAO.UsageDAO.UsageDetailsMapper;
import org.openmetadata.catalog.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.catalog.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.TagCategory;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TaskStatus;
import org.openmetadata.catalog.type.ThreadType;
import org.openmetadata.catalog.type.UsageDetails;
import org.openmetadata.catalog.type.UsageStats;
import org.openmetadata.catalog.type.Webhook;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.common.utils.CommonUtil;

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
  RoleDAO roleDAO();

  @CreateSqlObject
  UserDAO userDAO();

  @CreateSqlObject
  TeamDAO teamDAO();

  @CreateSqlObject
  TagUsageDAO tagUsageDAO();

  @CreateSqlObject
  TagDAO tagDAO();

  @CreateSqlObject
  TagCategoryDAO tagCategoryDAO();

  @CreateSqlObject
  TableDAO tableDAO();

  @CreateSqlObject
  UsageDAO usageDAO();

  @CreateSqlObject
  MetricsDAO metricsDAO();

  @CreateSqlObject
  ChartDAO chartDAO();

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
  DatabaseServiceDAO dbServiceDAO();

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
  FeedDAO feedDAO();

  @CreateSqlObject
  LocationDAO locationDAO();

  @CreateSqlObject
  ChangeEventDAO changeEventDAO();

  @CreateSqlObject
  WebhookDAO webhookDAO();

  @CreateSqlObject
  TypeEntityDAO typeEntityDAO();

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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }
  }

  interface DashboardServiceDAO extends EntityDAO<DashboardService> {
    @Override
    default String getTableName() {
      return "dashboard_service_entity";
    }

    @Override
    default String getNameColumn() {
      return "name";
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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }
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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }
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
    default String getNameColumn() {
      return "name";
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
    default String getNameColumn() {
      return "name";
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
        @Bind("id") String id,
        @Bind("extension") String extension,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @SqlQuery("SELECT json FROM entity_extension WHERE id = :id AND extension = :extension")
    String getExtension(@Bind("id") String id, @Bind("extension") String extension);

    @RegisterRowMapper(ExtensionMapper.class)
    @SqlQuery(
        "SELECT extension, json FROM entity_extension WHERE id = :id AND extension "
            + "LIKE CONCAT (:extensionPrefix, '.%') "
            + "ORDER BY extension")
    List<ExtensionRecord> getExtensions(@Bind("id") String id, @Bind("extensionPrefix") String extensionPrefix);

    @SqlUpdate("DELETE FROM entity_extension WHERE id = :id AND extension = :extension")
    void delete(@Bind("id") String id, @Bind("extension") String extension);

    @SqlUpdate("DELETE FROM entity_extension WHERE id = :id")
    void deleteAll(@Bind("id") String id);
  }

  class EntityVersionPair {
    @Getter private final Double version;
    @Getter private final String entityJson;

    public EntityVersionPair(ExtensionRecord record) {
      this.version = EntityUtil.getVersion(record.getExtensionName());
      this.entityJson = record.getExtensionJson();
    }
  }

  class ExtensionRecord {
    @Getter private final String extensionName;
    @Getter private final String extensionJson;

    public ExtensionRecord(String extensionName, String extensionJson) {
      this.extensionName = extensionName;
      this.extensionJson = extensionJson;
    }
  }

  class ExtensionMapper implements RowMapper<ExtensionRecord> {
    @Override
    public ExtensionRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new ExtensionRecord(rs.getString("extension"), rs.getString("json"));
    }
  }

  @Getter
  @Builder
  class EntityRelationshipRecord {
    private UUID id;
    private String type;
    private String json;
  }

  interface EntityRelationshipDAO {
    default void insert(UUID fromId, UUID toId, String fromEntity, String toEntity, int relation) {
      insert(fromId, toId, fromEntity, toEntity, relation, null);
    }

    default void insert(UUID fromId, UUID toId, String fromEntity, String toEntity, int relation, String json) {
      insert(fromId.toString(), toId.toString(), fromEntity, toEntity, relation, json);
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
        @Bind("fromId") String fromId,
        @Bind("toId") String toId,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("json") String json);

    //
    // Find to operations
    //
    @SqlQuery(
        "SELECT toId, toEntity, json FROM entity_relationship "
            + "WHERE fromId = :fromId AND fromEntity = :fromEntity AND relation = :relation "
            + "ORDER BY toId")
    @RegisterRowMapper(ToRelationshipMapper.class)
    List<EntityRelationshipRecord> findTo(
        @Bind("fromId") String fromId, @Bind("fromEntity") String fromEntity, @Bind("relation") int relation);

    // TODO delete this
    @SqlQuery(
        "SELECT toId, toEntity, json FROM entity_relationship "
            + "WHERE fromId = :fromId AND fromEntity = :fromEntity AND relation = :relation AND toEntity = :toEntity "
            + "ORDER BY toId")
    @RegisterRowMapper(ToRelationshipMapper.class)
    List<EntityRelationshipRecord> findTo(
        @Bind("fromId") String fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity);

    @SqlQuery(
        "SELECT count(*) FROM entity_relationship "
            + "WHERE fromId = :fromId AND fromEntity = :fromEntity AND relation = :relation "
            + "AND (toEntity = :toEntity OR :toEntity IS NULL) "
            + "ORDER BY fromId")
    int findToCount(
        @Bind("fromId") String fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity);

    //
    // Find from operations
    //
    @SqlQuery(
        "SELECT fromId, fromEntity, json FROM entity_relationship "
            + "WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation AND fromEntity = :fromEntity "
            + "ORDER BY fromId")
    @RegisterRowMapper(FromRelationshipMapper.class)
    List<EntityRelationshipRecord> findFrom(
        @Bind("toId") String toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("fromEntity") String fromEntity);

    @SqlQuery(
        "SELECT fromId, fromEntity, json FROM entity_relationship "
            + "WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation "
            + "ORDER BY fromId")
    @RegisterRowMapper(FromRelationshipMapper.class)
    List<EntityRelationshipRecord> findFrom(
        @Bind("toId") String toId, @Bind("toEntity") String toEntity, @Bind("relation") int relation);

    //
    // Delete Operations
    //
    @SqlUpdate(
        "DELETE from entity_relationship WHERE fromId = :fromId "
            + "AND fromEntity = :fromEntity AND toId = :toId AND toEntity = :toEntity "
            + "AND relation = :relation")
    int delete(
        @Bind("fromId") String fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("toId") String toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    // Delete all the entity relationship fromID --- relation --> entity of type toEntity
    @SqlUpdate(
        "DELETE from entity_relationship WHERE fromId = :fromId AND fromEntity = :fromEntity "
            + "AND relation = :relation AND toEntity = :toEntity")
    void deleteFrom(
        @Bind("fromId") String fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity);

    // Delete all the entity relationship toId <-- relation --  entity of type fromEntity
    @SqlUpdate(
        "DELETE from entity_relationship WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation "
            + "AND fromEntity = :fromEntity")
    void deleteTo(
        @Bind("toId") String toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("fromEntity") String fromEntity);

    @SqlUpdate(
        "DELETE from entity_relationship WHERE (toId = :id AND toEntity = :entity) OR "
            + "(fromId = :id AND fromEntity = :entity)")
    void deleteAll(@Bind("id") String id, @Bind("entity") String entity);

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
  }

  interface FeedDAO {
    @ConnectionAwareSqlUpdate(value = "INSERT INTO thread_entity(json) VALUES (:json)", connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO thread_entity(json) VALUES (:json :: jsonb)",
        connectionType = POSTGRES)
    void insert(@Bind("json") String json);

    @SqlQuery("SELECT json FROM thread_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT json FROM thread_entity ORDER BY updatedAt DESC")
    List<String> list();

    @SqlQuery(
        "SELECT count(id) FROM thread_entity WHERE resolved = :resolved "
            + "AND (:type IS NULL OR type = :type) AND (:status IS NULL OR taskStatus = :status)")
    int listCount(@Bind("status") TaskStatus status, @Bind("resolved") boolean resolved, @Bind("type") ThreadType type);

    @ConnectionAwareSqlUpdate(value = "UPDATE task_sequence SET id=LAST_INSERT_ID(id+1)", connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(value = "UPDATE task_sequence SET id=(id+1) RETURNING id", connectionType = POSTGRES)
    void updateTaskId();

    @SqlQuery("SELECT id FROM task_sequence LIMIT 1")
    int getTaskId();

    @SqlQuery("SELECT json FROM thread_entity WHERE taskId = :id")
    String findByTaskId(@Bind("id") int id);

    @SqlQuery(
        "SELECT json FROM thread_entity "
            + "WHERE updatedAt > :before AND resolved = :resolved "
            + "AND (:type IS NULL OR type = :type) AND (:status IS NULL OR taskStatus = :status) "
            + "ORDER BY updatedAt DESC "
            + "LIMIT :limit")
    List<String> listBefore(
        @Bind("limit") int limit,
        @Bind("before") long before,
        @Bind("status") TaskStatus status,
        @Bind("resolved") boolean resolved,
        @Bind("type") ThreadType type);

    @SqlQuery(
        "SELECT json FROM thread_entity "
            + "WHERE updatedAt < :after AND resolved = :resolved "
            + "AND (:type IS NULL OR type = :type) AND (:status IS NULL OR taskStatus = :status) "
            + "ORDER BY updatedAt DESC "
            + "LIMIT :limit")
    List<String> listAfter(
        @Bind("limit") int limit,
        @Bind("after") long after,
        @Bind("status") TaskStatus status,
        @Bind("resolved") boolean resolved,
        @Bind("type") ThreadType type);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM thread_entity WHERE type='Task' AND updatedAt > :before AND taskStatus = :status AND "
                + "taskAssignees @> ANY (ARRAY[<userTeamJsonPostgres>]::jsonb[]) "
                + "ORDER BY updatedAt DESC "
                + "LIMIT :limit",
        connectionType = POSTGRES)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM thread_entity WHERE type='Task' AND updatedAt > :before AND taskStatus = :status AND "
                + "JSON_OVERLAPS(taskAssignees, :userTeamJsonMysql) "
                + "ORDER BY updatedAt DESC "
                + "LIMIT :limit",
        connectionType = MYSQL)
    List<String> listTasksAssignedToBefore(
        @BindList("userTeamJsonPostgres") List<String> userTeamJsonPostgres,
        @Bind("userTeamJsonMysql") String userTeamJsonMysql,
        @Bind("limit") int limit,
        @Bind("before") long before,
        @Bind("status") TaskStatus status);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM thread_entity WHERE type='Task' AND updatedAt < :after "
                + "AND (:status IS NULL OR taskStatus = :status) "
                + "AND taskAssignees @> ANY (ARRAY[<userTeamJsonPostgres>]::jsonb[]) "
                + "ORDER BY updatedAt DESC "
                + "LIMIT :limit",
        connectionType = POSTGRES)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM thread_entity WHERE type='Task' AND updatedAt < :after "
                + "AND (:status IS NULL OR taskStatus = :status) "
                + "AND JSON_OVERLAPS(taskAssignees, :userTeamJsonMysql) "
                + "ORDER BY updatedAt DESC "
                + "LIMIT :limit",
        connectionType = MYSQL)
    List<String> listTasksAssignedToAfter(
        @BindList("userTeamJsonPostgres") List<String> userTeamJsonPostgres,
        @Bind("userTeamJsonMysql") String userTeamJsonMysql,
        @Bind("limit") int limit,
        @Bind("after") long after,
        @Bind("status") TaskStatus status);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(id) FROM thread_entity WHERE type='Task' AND "
                + "(:status IS NULL OR taskStatus = :status) AND "
                + "taskAssignees @> ANY (ARRAY[<userTeamJsonPostgres>]::jsonb[])",
        connectionType = POSTGRES)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(id) FROM thread_entity WHERE "
                + "(:status IS NULL OR taskStatus = :status) AND "
                + "JSON_OVERLAPS(taskAssignees, :userTeamJsonMysql) ",
        connectionType = MYSQL)
    int listCountTasksAssignedTo(
        @BindList("userTeamJsonPostgres") List<String> userTeamJsonPostgres,
        @Bind("userTeamJsonMysql") String userTeamJsonMysql,
        @Bind("status") TaskStatus status);

    @SqlQuery(
        "SELECT json FROM thread_entity WHERE type='Task' AND updatedAt > :before "
            + "AND (:status IS NULL OR taskStatus = :status) "
            + "AND createdBy = :username "
            + "ORDER BY updatedAt DESC "
            + "LIMIT :limit")
    List<String> listTasksAssignedByBefore(
        @Bind("username") String username,
        @Bind("limit") int limit,
        @Bind("before") long before,
        @Bind("status") TaskStatus status);

    @SqlQuery(
        "SELECT json FROM thread_entity WHERE type='Task' AND updatedAt < :after "
            + "AND (:status IS NULL OR taskStatus = :status) "
            + "AND createdBy = :username "
            + "ORDER BY updatedAt DESC "
            + "LIMIT :limit")
    List<String> listTasksAssignedByAfter(
        @Bind("username") String username,
        @Bind("limit") int limit,
        @Bind("after") long after,
        @Bind("status") TaskStatus status);

    @SqlQuery(
        "SELECT count(id) FROM thread_entity WHERE type='Task' "
            + "AND (:status IS NULL OR taskStatus = :status) AND createdBy = :username")
    int listCountTasksAssignedBy(@Bind("username") String username, @Bind("status") TaskStatus status);

    @SqlQuery(
        "SELECT json FROM thread_entity WHERE updatedAt > :before AND resolved = :resolved AND (:type IS NULL OR type = :type) AND "
            + "(entityId in (SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation=8) OR "
            + "id in (SELECT toId FROM entity_relationship WHERE (fromEntity='user' AND fromId= :userId AND toEntity='THREAD' AND relation IN (1,2)))) "
            + "ORDER BY updatedAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByOwnerBefore(
        @Bind("userId") String userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("limit") int limit,
        @Bind("before") long before,
        @Bind("type") ThreadType type,
        @Bind("resolved") boolean resolved);

    @SqlQuery(
        "SELECT json FROM thread_entity WHERE updatedAt < :after AND resolved = :resolved AND (:type IS NULL OR type = :type) AND "
            + "(entityId in (SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation=8) OR "
            + "id in (SELECT toId FROM entity_relationship WHERE (fromEntity='user' AND fromId= :userId AND toEntity='THREAD' AND relation IN (1,2)))) "
            + "ORDER BY updatedAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByOwnerAfter(
        @Bind("userId") String userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("limit") int limit,
        @Bind("after") long after,
        @Bind("type") ThreadType type,
        @Bind("resolved") boolean resolved);

    @SqlQuery(
        "SELECT count(id) FROM thread_entity WHERE resolved = :resolved AND (:type IS NULL OR type = :type) AND "
            + "(entityId in (SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation=8) OR "
            + "id in (SELECT toId FROM entity_relationship WHERE (fromEntity='user' AND fromId= :userId AND toEntity='THREAD' AND relation IN (1,2)))) ")
    int listCountThreadsByOwner(
        @Bind("userId") String userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("type") ThreadType type,
        @Bind("resolved") boolean resolved);

    @SqlQuery(
        "SELECT json FROM thread_entity WHERE updatedAt > :before AND resolved = :resolved "
            + "AND (:type IS NULL OR type = :type) "
            + "AND id in (SELECT fromFQN FROM field_relationship WHERE "
            + "(:fqnPrefix IS NULL OR toFQN LIKE CONCAT(:fqnPrefix, '.%') OR toFQN=:fqnPrefix) AND fromType='THREAD' AND "
            + "(:toType IS NULL OR toType LIKE CONCAT(:toType, '.%') OR toType=:toType) AND relation= :relation) "
            + "ORDER BY updatedAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByEntityLinkBefore(
        @Bind("fqnPrefix") String fqnPrefix,
        @Bind("toType") String toType,
        @Bind("limit") int limit,
        @Bind("before") long before,
        @Bind("type") ThreadType type,
        @Bind("status") TaskStatus status,
        @Bind("resolved") boolean resolved,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT json FROM thread_entity WHERE updatedAt < :after AND resolved = :resolved "
            + "AND (:status IS NULL OR taskStatus = :status) "
            + "AND (:type IS NULL OR type = :type) "
            + "AND id in (SELECT fromFQN FROM field_relationship WHERE "
            + "(:fqnPrefix IS NULL OR toFQN LIKE CONCAT(:fqnPrefix, '.%') OR toFQN=:fqnPrefix) AND fromType='THREAD' AND "
            + "(:toType IS NULL OR toType LIKE CONCAT(:toType, '.%') OR toType=:toType) AND relation= :relation) "
            + "ORDER BY updatedAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByEntityLinkAfter(
        @Bind("fqnPrefix") String fqnPrefix,
        @Bind("toType") String toType,
        @Bind("limit") int limit,
        @Bind("after") long after,
        @Bind("type") ThreadType type,
        @Bind("status") TaskStatus status,
        @Bind("resolved") boolean resolved,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT count(id) FROM thread_entity WHERE resolved = :resolved "
            + "AND (:status IS NULL OR taskStatus = :status) "
            + "AND (:type IS NULL OR type = :type) "
            + "AND id in (SELECT fromFQN FROM field_relationship WHERE "
            + "(:fqnPrefix IS NULL OR toFQN LIKE CONCAT(:fqnPrefix, '.%') OR toFQN=:fqnPrefix) AND fromType='THREAD' AND "
            + "(:toType IS NULL OR toType LIKE CONCAT(:toType, '.%') OR toType=:toType) AND relation= :relation)")
    int listCountThreadsByEntityLink(
        @Bind("fqnPrefix") String fqnPrefix,
        @Bind("toType") String toType,
        @Bind("type") ThreadType type,
        @Bind("status") TaskStatus status,
        @Bind("resolved") boolean resolved,
        @Bind("relation") int relation);

    @ConnectionAwareSqlUpdate(value = "UPDATE thread_entity SET json = :json where id = :id", connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE thread_entity SET json = (:json :: jsonb) where id = :id",
        connectionType = POSTGRES)
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery(
        "SELECT entityLink, COUNT(id) count FROM field_relationship fr INNER JOIN thread_entity te ON fr.fromFQN=te.id "
            + "WHERE (:fqnPrefix IS NULL OR fr.toFQN LIKE CONCAT(:fqnPrefix, '.%') OR fr.toFQN=:fqnPrefix) AND "
            + "(:toType IS NULL OR fr.toType like concat(:toType, '.%') OR fr.toType=:toType) AND fr.fromType = :fromType "
            + "AND fr.relation = :relation AND te.resolved= :isResolved AND (:status IS NULL OR te.taskStatus = :status) "
            + "AND (:type IS NULL OR te.type = :type) "
            + "GROUP BY entityLink")
    @RegisterRowMapper(CountFieldMapper.class)
    List<List<String>> listCountByEntityLink(
        @Bind("fqnPrefix") String fqnPrefix,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation,
        @Bind("type") ThreadType type,
        @Bind("status") TaskStatus status,
        @Bind("isResolved") boolean isResolved);

    @SqlQuery(
        "SELECT entityLink, COUNT(id) count FROM thread_entity WHERE resolved = :resolved AND "
            + "(:type IS NULL OR type = :type) AND id in (SELECT toId FROM entity_relationship WHERE "
            + "(((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation=8) OR "
            + "(fromEntity='user' AND fromId= :userId AND toEntity='THREAD' AND relation IN (1,2))) "
            + "GROUP BY entityLink")
    @RegisterRowMapper(CountFieldMapper.class)
    List<List<String>> listCountByOwner(
        @Bind("userId") String userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("type") ThreadType type,
        @Bind("resolved") boolean resolved);

    @SqlQuery(
        "SELECT entityLink, COUNT(id) count FROM thread_entity WHERE (id IN (<threadIds>)) "
            + "AND resolved= :isResolved AND (:type IS NULL OR type = :type) "
            + "AND (:status IS NULL OR taskStatus = :status) GROUP BY entityLink")
    @RegisterRowMapper(CountFieldMapper.class)
    List<List<String>> listCountByThreads(
        @BindList("threadIds") List<String> threadIds,
        @Bind("type") ThreadType type,
        @Bind("status") TaskStatus status,
        @Bind("isResolved") boolean isResolved);

    @SqlQuery(
        "SELECT json FROM thread_entity WHERE updatedAt > :before AND resolved = :resolved AND "
            + "(:type IS NULL OR type = :type) AND entityId in ("
            + "SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation= :relation) "
            + "ORDER BY updatedAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByFollowsBefore(
        @Bind("userId") String userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("limit") int limit,
        @Bind("before") long before,
        @Bind("type") ThreadType type,
        @Bind("resolved") boolean resolved,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT json FROM thread_entity WHERE updatedAt < :after AND resolved = :resolved AND "
            + "(:type IS NULL OR type = :type) AND entityId in ("
            + "SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation= :relation) "
            + "ORDER BY updatedAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByFollowsAfter(
        @Bind("userId") String userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("limit") int limit,
        @Bind("after") long after,
        @Bind("type") ThreadType type,
        @Bind("resolved") boolean resolved,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT count(id) FROM thread_entity WHERE resolved = :resolved AND "
            + "(:type IS NULL OR type = :type) AND entityId in ("
            + "SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation= :relation)")
    int listCountThreadsByFollows(
        @Bind("userId") String userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("type") ThreadType type,
        @Bind("resolved") boolean resolved,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT json FROM thread_entity WHERE updatedAt > :before AND resolved = :resolved AND "
            + "(:type IS NULL OR type = :type) AND id in ("
            + "SELECT toFQN FROM field_relationship WHERE "
            + "((fromType='user' AND fromFQN= :userName) OR "
            + "(fromType='team' AND fromFQN IN (<teamNames>)))  AND toType='THREAD' AND relation= :relation) "
            + "ORDER BY updatedAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByMentionsBefore(
        @Bind("userName") String userName,
        @BindList("teamNames") List<String> teamNames,
        @Bind("limit") int limit,
        @Bind("before") long before,
        @Bind("type") ThreadType type,
        @Bind("resolved") boolean resolved,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT json FROM thread_entity WHERE updatedAt < :after AND resolved = :resolved AND "
            + "(:type IS NULL OR type = :type) AND id in ("
            + "SELECT toFQN FROM field_relationship WHERE "
            + "((fromType='user' AND fromFQN= :userName) OR "
            + "(fromType='team' AND fromFQN IN (<teamNames>)))  AND toType='THREAD' AND relation= :relation) "
            + "ORDER BY updatedAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByMentionsAfter(
        @Bind("userName") String userName,
        @BindList("teamNames") List<String> teamNames,
        @Bind("limit") int limit,
        @Bind("after") long after,
        @Bind("type") ThreadType type,
        @Bind("resolved") boolean resolved,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT count(id) FROM thread_entity WHERE resolved = :resolved AND (:type IS NULL OR type = :type) AND id in ("
            + "SELECT toFQN FROM field_relationship WHERE "
            + "((fromType='user' AND fromFQN= :userName) OR "
            + "(fromType='team' AND fromFQN IN (<teamNames>)))  AND toType='THREAD' AND relation= :relation) ")
    int listCountThreadsByMentions(
        @Bind("userName") String userName,
        @BindList("teamNames") List<String> teamNames,
        @Bind("type") ThreadType type,
        @Bind("resolved") boolean resolved,
        @Bind("relation") int relation);

    class CountFieldMapper implements RowMapper<List<String>> {
      @Override
      public List<String> map(ResultSet rs, StatementContext ctx) throws SQLException {
        return Arrays.asList(rs.getString("entityLink"), rs.getString("count"));
      }
    }
  }

  interface FieldRelationshipDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO field_relationship(fromFQN, toFQN, fromType, toType, relation, json) "
                + "VALUES (:fromFQN, :toFQN, :fromType, :toType, :relation, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO field_relationship(fromFQN, toFQN, fromType, toType, relation, json) "
                + "VALUES (:fromFQN, :toFQN, :fromType, :toType, :relation, (:json :: jsonb)) "
                + "ON CONFLICT (fromFQN, toFQN, relation) DO NOTHING",
        connectionType = POSTGRES)
    void insert(
        @Bind("fromFQN") String fromFQN,
        @Bind("toFQN") String toFQN,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation,
        @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO field_relationship(fromFQN, toFQN, fromType, toType, relation, jsonSchema, json) "
                + "VALUES (:fromFQN, :toFQN, :fromType, :toType, :relation, :jsonSchema, :json) "
                + "ON DUPLICATE KEY UPDATE json = :json",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO field_relationship(fromFQN, toFQN, fromType, toType, relation, jsonSchema, json) "
                + "VALUES (:fromFQN, :toFQN, :fromType, :toType, :relation, :jsonSchema, (:json :: jsonb)) "
                + "ON CONFLICT (fromFQN, toFQN, relation) DO UPDATE SET json = EXCLUDED.json",
        connectionType = POSTGRES)
    void upsert(
        @Bind("fromFQN") String fromFQN,
        @Bind("toFQN") String toFQN,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @SqlQuery(
        "SELECT json FROM field_relationship WHERE "
            + "fromFQN = :fromFQN AND toFQN = :toFQN AND fromType = :fromType "
            + "AND toType = :toType AND relation = :relation")
    String find(
        @Bind("fromFQN") String fromFQN,
        @Bind("toFQN") String toFQN,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromFQN, toFQN, json FROM field_relationship WHERE "
            + "toFQN LIKE CONCAT(:fqnPrefix, '%') AND fromType = :fromType AND toType = :toType AND relation = :relation")
    @RegisterRowMapper(FromFieldMapper.class)
    List<Triple<String, String, String>> listFromByPrefix(
        @Bind("fqnPrefix") String fqnPrefix,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromFQN, toFQN, json FROM field_relationship WHERE "
            + "toFQN LIKE CONCAT(:fqnPrefix, '%') AND fromType = :fromType AND toType LIKE CONCAT(:toType, '%') AND relation = :relation")
    @RegisterRowMapper(FromFieldMapper.class)
    List<Triple<String, String, String>> listFromByAllPrefix(
        @Bind("fqnPrefix") String fqnPrefix,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromFQN, toFQN, json FROM field_relationship WHERE "
            + "fromFQN LIKE CONCAT(:fqnPrefix, '%') AND fromType = :fromType AND toType = :toType "
            + "AND relation = :relation")
    @RegisterRowMapper(ToFieldMapper.class)
    List<Triple<String, String, String>> listToByPrefix(
        @Bind("fqnPrefix") String fqnPrefix,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromFQN, toFQN, json FROM field_relationship WHERE "
            + "fromFQN = :fqn AND fromType = :type AND toType = :otherType AND relation = :relation "
            + "UNION "
            + "SELECT toFQN, fromFQN, json FROM field_relationship WHERE "
            + "toFQN = :fqn AND toType = :type AND fromType = :otherType AND relation = :relation")
    @RegisterRowMapper(ToFieldMapper.class)
    List<Triple<String, String, String>> listBidirectional(
        @Bind("fqn") String fqn,
        @Bind("type") String type,
        @Bind("otherType") String otherType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromFQN, toFQN, json FROM field_relationship WHERE "
            + "fromFQN LIKE CONCAT(:fqnPrefix, '%') AND fromType = :type AND toType = :otherType AND relation = :relation "
            + "UNION "
            + "SELECT toFQN, fromFQN, json FROM field_relationship WHERE "
            + "toFQN LIKE CONCAT(:fqnPrefix, '%') AND toType = :type AND fromType = :otherType AND relation = :relation")
    @RegisterRowMapper(ToFieldMapper.class)
    List<Triple<String, String, String>> listBidirectionalByPrefix(
        @Bind("fqnPrefix") String fqnPrefix,
        @Bind("type") String type,
        @Bind("otherType") String otherType,
        @Bind("relation") int relation);

    default void deleteAllByPrefix(String fqnPrefix) {
      String prefix = String.format("%s%s%%", fqnPrefix, Entity.SEPARATOR);
      String cond = String.format("WHERE (toFQN LIKE '%s' OR fromFQN LIKE '%s')", prefix, prefix);
      deleteAllByPrefixInternal(cond);
    }

    @SqlUpdate("DELETE from field_relationship <cond>")
    void deleteAllByPrefixInternal(@Define("cond") String cond);

    @SqlUpdate(
        "DELETE from field_relationship WHERE fromFQN = :fromFQN AND toFQN = :toFQN AND fromType = :fromType "
            + "AND toType = :toType AND relation = :relation")
    void delete(
        @Bind("fromFQN") String fromFQN,
        @Bind("toFQN") String toFQN,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    class ToFieldMapper implements RowMapper<Triple<String, String, String>> {
      @Override
      public Triple<String, String, String> map(ResultSet rs, StatementContext ctx) throws SQLException {
        return Triple.of(rs.getString("fromFQN"), rs.getString("toFQN"), rs.getString("json"));
      }
    }

    class FromFieldMapper implements RowMapper<Triple<String, String, String>> {
      @Override
      public Triple<String, String, String> map(ResultSet rs, StatementContext ctx) throws SQLException {
        return Triple.of(rs.getString("toFQN"), rs.getString("fromFQN"), rs.getString("json"));
      }
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
    default String getNameColumn() {
      return "name";
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
    default String getNameColumn() {
      return "fullyQualifiedName";
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
    default String getNameColumn() {
      return "name";
    }
  }

  interface MetricsDAO extends EntityDAO<Metrics> {
    @Override
    default String getTableName() {
      return "metrics_entity";
    }

    @Override
    default Class<Metrics> getEntityClass() {
      return Metrics.class;
    }

    @Override
    default String getNameColumn() {
      return "fullyQualifiedName";
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
    default String getNameColumn() {
      return "fullyQualifiedName";
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
    default String getNameColumn() {
      return "name";
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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }
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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }
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
    default String getNameColumn() {
      return "name";
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
    default String getNameColumn() {
      return "name";
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
    default String getNameColumn() {
      return "fullyQualifiedName";
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
    default String getNameColumn() {
      return "fullyQualifiedName";
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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }
  }

  interface LocationDAO extends EntityDAO<Location> {
    @Override
    default String getTableName() {
      return "location_entity";
    }

    @Override
    default Class<Location> getEntityClass() {
      return Location.class;
    }

    @Override
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    default int listPrefixesCount(String table, String nameColumn, String fqn, String service) {
      return listPrefixesCountInternal(table, nameColumn, fqn, service + Entity.SEPARATOR);
    }

    @SqlQuery(
        "SELECT count(*) FROM <table> WHERE "
            + "LEFT(:fqn, LENGTH(<nameColumn>)) = <nameColumn> AND "
            + "<nameColumn> >= :servicePrefix AND "
            + "<nameColumn> <= :fqn")
    int listPrefixesCountInternal(
        @Define("table") String table,
        @Define("nameColumn") String nameColumn,
        @Bind("fqn") String fqn,
        @Bind("servicePrefix") String service);

    default List<String> listPrefixesBefore(
        String table, String nameColumn, String fqn, String service, int limit, String before) {
      return listPrefixesBeforeInternal(table, nameColumn, fqn, service + Entity.SEPARATOR, limit, before);
    }

    @SqlQuery(
        "SELECT json FROM ("
            + "SELECT <nameColumn>, json FROM <table> WHERE "
            + "LEFT(:fqn, LENGTH(<nameColumn>)) = <nameColumn> AND "
            + "<nameColumn> >= servicePrefix AND "
            + "<nameColumn> <= :fqn AND "
            + "<nameColumn> < :before "
            + "ORDER BY <nameColumn> DESC "
            + // Pagination ordering by chart fullyQualifiedName
            "LIMIT :limit"
            + ") last_rows_subquery ORDER BY <nameColumn>")
    List<String> listPrefixesBeforeInternal(
        @Define("table") String table,
        @Define("nameColumn") String nameColumn,
        @Bind("fqn") String fqn,
        @Bind("servicePrefix") String servicePrefix,
        @Bind("limit") int limit,
        @Bind("before") String before);

    default List<String> listPrefixesAfter(
        String table, String nameColumn, String fqn, String service, int limit, String after) {
      return listPrefixesAfterInternal(table, nameColumn, fqn, service + Entity.SEPARATOR, limit, after);
    }

    @SqlQuery(
        "SELECT json FROM <table> WHERE "
            + "LEFT(:fqn, LENGTH(<nameColumn>)) = <nameColumn> AND "
            + "<nameColumn> >= :servicePrefix AND "
            + "<nameColumn> <= :fqn AND "
            + "<nameColumn> > :after "
            + "ORDER BY <nameColumn> "
            + "LIMIT :limit")
    List<String> listPrefixesAfterInternal(
        @Define("table") String table,
        @Define("nameColumn") String nameColumn,
        @Bind("fqn") String fqn,
        @Bind("servicePrefix") String servicePrefix,
        @Bind("limit") int limit,
        @Bind("after") String after);
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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }
  }

  interface WebhookDAO extends EntityDAO<Webhook> {
    @Override
    default String getTableName() {
      return "webhook_entity";
    }

    @Override
    default Class<Webhook> getEntityClass() {
      return Webhook.class;
    }

    @Override
    default String getNameColumn() {
      return "name";
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }
  }

  interface TagCategoryDAO extends EntityDAO<TagCategory> {
    @Override
    default String getTableName() {
      return "tag_category";
    }

    @Override
    default Class<TagCategory> getEntityClass() {
      return TagCategory.class;
    }

    @Override
    default String getNameColumn() {
      return "name";
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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @SqlUpdate("DELETE FROM tag where fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%')")
    void deleteTagsByPrefix(@Bind("fqnPrefix") String fqnPrefix);
  }

  @RegisterRowMapper(TagLabelMapper.class)
  interface TagUsageDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO tag_usage (source, tagFQN, targetFQN, labelType, state) VALUES (:source, :tagFQN, :targetFQN, :labelType, :state)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO tag_usage (source, tagFQN, targetFQN, labelType, state) VALUES (:source, :tagFQN, :targetFQN, :labelType, :state) ON CONFLICT (source, tagFQN, targetFQN) DO NOTHING",
        connectionType = POSTGRES)
    void applyTag(
        @Bind("source") int source,
        @Bind("tagFQN") String tagFQN,
        @Bind("targetFQN") String targetFQN,
        @Bind("labelType") int labelType,
        @Bind("state") int state);

    @SqlQuery("SELECT targetFQN FROM tag_usage WHERE tagFQN = :tagFQN")
    List<String> tagTargetFQN(@Bind("tagFQN") String tagFQN);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT tu.source, tu.tagFQN, tu.labelType, tu.state, "
                + "t.json ->> '$.description' AS description1, "
                + "g.json ->> '$.description' AS description2 "
                + "FROM tag_usage tu "
                + "LEFT JOIN tag t ON tu.tagFQN = t.fullyQualifiedName AND tu.source = 0 "
                + "LEFT JOIN glossary_term_entity g ON tu.tagFQN = g.fullyQualifiedName AND tu.source = 1 "
                + "WHERE tu.targetFQN = :targetFQN ORDER BY tu.tagFQN",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT tu.source, tu.tagFQN, tu.labelType, tu.state, "
                + "t.json ->> 'description' AS description1, "
                + "g.json ->> 'description' AS description2 "
                + "FROM tag_usage tu "
                + "LEFT JOIN tag t ON tu.tagFQN = t.fullyQualifiedName AND tu.source = 0 "
                + "LEFT JOIN glossary_term_entity g ON tu.tagFQN = g.fullyQualifiedName AND tu.source = 1 "
                + "WHERE tu.targetFQN = :targetFQN ORDER BY tu.tagFQN",
        connectionType = POSTGRES)
    List<TagLabel> getTags(@Bind("targetFQN") String targetFQN);

    @SqlQuery("SELECT COUNT(*) FROM tag_usage WHERE tagFQN LIKE CONCAT(:fqnPrefix, '%') AND source = :source")
    int getTagCount(@Bind("source") int source, @Bind("fqnPrefix") String fqnPrefix);

    @SqlUpdate("DELETE FROM tag_usage where targetFQN = :targetFQN")
    void deleteTagsByTarget(@Bind("targetFQN") String targetFQN);

    @SqlUpdate("DELETE FROM tag_usage where tagFQN = :tagFQN AND source = :source")
    void deleteTagLabels(@Bind("source") int source, @Bind("tagFQN") String tagFQN);

    @SqlUpdate("DELETE FROM tag_usage where tagFQN LIKE CONCAT(:tagFQN, '.%') AND source = :source")
    void deleteTagLabelsByPrefix(@Bind("source") int source, @Bind("tagFQN") String tagFQN);

    @SqlUpdate("DELETE FROM tag_usage where targetFQN LIKE CONCAT(:targetFQN, '%')")
    void deleteTagLabelsByTargetPrefix(@Bind("targetFQN") String targetFQN);

    class TagLabelMapper implements RowMapper<TagLabel> {
      @Override
      public TagLabel map(ResultSet r, StatementContext ctx) throws SQLException {
        String description1 = r.getString("description1");
        String description2 = r.getString("description2");
        return new TagLabel()
            .withSource(TagLabel.TagSource.values()[r.getInt("source")])
            .withLabelType(TagLabel.LabelType.values()[r.getInt("labelType")])
            .withState(TagLabel.State.values()[r.getInt("state")])
            .withTagFQN(r.getString("tagFQN"))
            .withDescription(description1 == null ? description2 : description1);
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
    default String getNameColumn() {
      return "name";
    }

    @SqlQuery("SELECT id FROM role_entity WHERE defaultRole = TRUE")
    List<String> getDefaultRolesIds();

    @SqlQuery("SELECT json FROM role_entity WHERE defaultRole = TRUE")
    List<String> getDefaultRoles();
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
    default String getNameColumn() {
      return "name";
    }
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
    default String getNameColumn() {
      return "fullyQualifiedName";
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
                + "INTERVAL 29 DAY))",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_usage (usageDate, id, entityType, count1, count7, count30) "
                + "SELECT (:date :: date), :id, :entityType, :count1, "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= (:date :: date) - INTERVAL '6 days')), "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= (:date :: date) - INTERVAL '29 days'))",
        connectionType = POSTGRES)
    void insert(
        @Bind("date") String date,
        @Bind("id") String id,
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
        @Bind("id") String id,
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
    List<UsageDetails> getUsageById(@Bind("id") String id, @Bind("date") String date, @Bind("days") int days);

    /** Get latest usage record */
    @SqlQuery(
        "SELECT id, usageDate, entityType, count1, count7, count30, "
            + "percentile1, percentile7, percentile30 FROM entity_usage "
            + "WHERE usageDate IN (SELECT MAX(usageDate) FROM entity_usage WHERE id = :id) AND id = :id")
    UsageDetails getLatestUsage(@Bind("id") String id);

    @SqlUpdate("DELETE FROM entity_usage WHERE id = :id")
    void delete(@Bind("id") String id);

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
            new UsageStats().withCount(r.getInt("count1")).withPercentileRank(r.getDouble("percentile1"));
        UsageStats weeklyStats =
            new UsageStats().withCount(r.getInt("count7")).withPercentileRank(r.getDouble("percentile7"));
        UsageStats monthlyStats =
            new UsageStats().withCount(r.getInt("count30")).withPercentileRank(r.getDouble("percentile30"));
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
    default String getNameColumn() {
      return "name";
    }

    @Override
    default int listCount(ListFilter filter) {
      String team = filter.getQueryParam("team");
      Boolean isAdmin = null;
      Boolean isBot = null;
      String isBotStr = filter.getQueryParam("isBot");
      String isAdminStr = filter.getQueryParam("isAdmin");
      String mySqlCondition = filter.getCondition("ue");
      String postgresCondition = filter.getCondition("ue");
      if (isAdminStr != null) {
        isAdmin = Boolean.parseBoolean(isAdminStr);
        if (isAdmin) {
          mySqlCondition = String.format("%s AND JSON_EXTRACT(ue.json, '$.isAdmin') = TRUE ", mySqlCondition);
          postgresCondition = String.format("%s AND ((ue.json#>'{isAdmin}')::boolean)  = TRUE ", postgresCondition);
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
        isBot = Boolean.parseBoolean(isBotStr);
        if (isBot) {
          mySqlCondition = String.format("%s AND JSON_EXTRACT(ue.json, '$.isBot') = TRUE ", mySqlCondition);
          postgresCondition = String.format("%s AND ((ue.json#>'{isBot}')::boolean) = TRUE ", postgresCondition);
        } else {
          mySqlCondition =
              String.format(
                  "%s AND (JSON_EXTRACT(ue.json, '$.isBot') IS NULL OR JSON_EXTRACT(ue.json, '$.isBot') = FALSE ) ",
                  mySqlCondition);
          postgresCondition =
              String.format(
                  "%s AND ue.json#>'{isBot}' IS NULL OR ((ue.json#>'{isBot}')::boolean) = FALSE ) ", postgresCondition);
        }
      }
      if (team == null && isAdmin == null && isBot == null) {
        return EntityDAO.super.listCount(filter);
      }
      return listCount(
          getTableName(), getNameColumn(), mySqlCondition, postgresCondition, team, Relationship.HAS.ordinal());
    }

    @Override
    default List<String> listBefore(ListFilter filter, int limit, String before) {
      String team = filter.getQueryParam("team");
      Boolean isAdmin = null;
      Boolean isBot = null;
      String isBotStr = filter.getQueryParam("isBot");
      String isAdminStr = filter.getQueryParam("isAdmin");
      String mySqlCondition = filter.getCondition("ue");
      String postgresCondition = filter.getCondition("ue");
      if (isAdminStr != null) {
        isAdmin = Boolean.parseBoolean(isAdminStr);
        if (isAdmin) {
          mySqlCondition = String.format("%s AND JSON_EXTRACT(ue.json, '$.isAdmin') = TRUE ", mySqlCondition);
          postgresCondition = String.format("%s AND ((ue.json#>'{isAdmin}')::boolean) = TRUE ", postgresCondition);
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
        isBot = Boolean.parseBoolean(isBotStr);
        if (isBot) {
          mySqlCondition = String.format("%s AND JSON_EXTRACT(ue.json, '$.isBot') = TRUE ", mySqlCondition);
          postgresCondition = String.format("%s AND ((ue.json#>'{isBot}')::boolean) = TRUE ", postgresCondition);
        } else {
          mySqlCondition =
              String.format(
                  "%s AND (JSON_EXTRACT(ue.json, '$.isBot') IS NULL OR JSON_EXTRACT(ue.json, '$.isBot') = FALSE ) ",
                  mySqlCondition);
          postgresCondition =
              String.format(
                  "%s AND ue.json#>'{isBot}' IS NULL OR ((ue.json#>'{isBot}')::boolean) = FALSE ) ", postgresCondition);
        }
      }
      if (team == null && isAdmin == null && isBot == null) {
        return EntityDAO.super.listBefore(filter, limit, before);
      }
      return listBefore(
          getTableName(),
          getNameColumn(),
          mySqlCondition,
          postgresCondition,
          team,
          limit,
          before,
          Relationship.HAS.ordinal());
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String after) {
      String team = filter.getQueryParam("team");
      Boolean isAdmin = null;
      Boolean isBot = null;
      String isBotStr = filter.getQueryParam("isBot");
      String isAdminStr = filter.getQueryParam("isAdmin");
      String mySqlCondition = filter.getCondition("ue");
      String postgresCondition = filter.getCondition("ue");
      if (isAdminStr != null) {
        isAdmin = Boolean.parseBoolean(isAdminStr);
        if (isAdmin) {
          mySqlCondition = String.format("%s AND JSON_EXTRACT(ue.json, '$.isAdmin') = TRUE ", mySqlCondition);
          postgresCondition = String.format("%s AND ((ue.json#>'{isAdmin}')::boolean) = TRUE ", postgresCondition);
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
        isBot = Boolean.parseBoolean(isBotStr);
        if (isBot) {
          mySqlCondition = String.format("%s AND JSON_EXTRACT(ue.json, '$.isBot') = TRUE ", mySqlCondition);
          postgresCondition = String.format("%s AND ((ue.json#>'{isBot}')::boolean) = TRUE ", postgresCondition);
        } else {
          mySqlCondition =
              String.format(
                  "%s AND (JSON_EXTRACT(ue.json, '$.isBot') IS NULL OR JSON_EXTRACT(ue.json, '$.isBot') = FALSE ) ",
                  mySqlCondition);
          postgresCondition =
              String.format(
                  "%s AND ue.json#>'{isBot}' IS NULL OR ((ue.json#>'{isBot}')::boolean) = FALSE ) ", postgresCondition);
        }
      }
      if (team == null && isAdmin == null && isBot == null) {
        return EntityDAO.super.listAfter(filter, limit, after);
      }
      return listAfter(
          getTableName(),
          getNameColumn(),
          mySqlCondition,
          postgresCondition,
          team,
          limit,
          after,
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
                + " AND (:team IS NULL OR te.name = :team) "
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
                + " AND (:team IS NULL OR te.name = :team) "
                + "GROUP BY ue.id) subquery",
        connectionType = POSTGRES)
    int listCount(
        @Define("table") String table,
        @Define("nameColumn") String nameColumn,
        @Define("mysqlCond") String mysqlCond,
        @Define("postgresCond") String postgresCond,
        @Bind("team") String team,
        @Bind("relation") int relation);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT ue.<nameColumn>, ue.json "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <mysqlCond> "
                + "AND (:team IS NULL OR te.name = :team) "
                + "AND ue.<nameColumn> < :before "
                + "GROUP BY ue.<nameColumn>, ue.json "
                + "ORDER BY ue.<nameColumn> DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY <nameColumn>",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT ue.<nameColumn>, ue.json "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <postgresCond> "
                + "AND (:team IS NULL OR te.name = :team) "
                + "AND ue.<nameColumn> < :before "
                + "GROUP BY ue.<nameColumn>, ue.json "
                + "ORDER BY ue.<nameColumn> DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY <nameColumn>",
        connectionType = POSTGRES)
    List<String> listBefore(
        @Define("table") String table,
        @Define("nameColumn") String nameColumn,
        @Define("mysqlCond") String mysqlCond,
        @Define("postgresCond") String postgresCond,
        @Bind("team") String team,
        @Bind("limit") int limit,
        @Bind("before") String before,
        @Bind("relation") int relation);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT ue.json "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <mysqlCond> "
                + "AND (:team IS NULL OR te.name = :team) "
                + "AND ue.<nameColumn> > :after "
                + "GROUP BY ue.<nameColumn>, ue.json "
                + "ORDER BY ue.<nameColumn> "
                + "LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT ue.json "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <postgresCond> "
                + "AND (:team IS NULL OR te.name = :team) "
                + "AND ue.<nameColumn> > :after "
                + "GROUP BY ue.<nameColumn>, ue.json "
                + "ORDER BY ue.<nameColumn> "
                + "LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listAfter(
        @Define("table") String table,
        @Define("nameColumn") String nameColumn,
        @Define("mysqlCond") String mysqlCond,
        @Define("postgresCond") String postgresCond,
        @Bind("team") String team,
        @Bind("limit") int limit,
        @Bind("after") String after,
        @Bind("relation") int relation);
  }

  interface ChangeEventDAO {
    @ConnectionAwareSqlUpdate(value = "INSERT INTO change_event (json) VALUES (:json)", connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO change_event (json) VALUES (:json :: jsonb)",
        connectionType = POSTGRES)
    void insert(@Bind("json") String json);

    default List<String> list(String eventType, List<String> entityTypes, long timestamp) {
      if (CommonUtil.nullOrEmpty(entityTypes)) {
        return Collections.emptyList();
      }
      if (entityTypes.get(0).equals("*")) {
        return listWithoutEntityFilter(eventType, timestamp);
      }
      return listWithEntityFilter(eventType, entityTypes, timestamp);
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
    List<String> listWithoutEntityFilter(@Bind("eventType") String eventType, @Bind("timestamp") long timestamp);
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
    default String getNameColumn() {
      return "name";
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }
  }
}
