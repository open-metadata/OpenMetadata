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
import java.util.Map;
import java.util.UUID;
import lombok.Builder;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.BindMap;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.BatchChunkSize;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.entity.feed.ConversationReply;
import org.openmetadata.schema.entity.feed.TaskFormSchema;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.Reaction;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlBatch;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindFQN;
import org.openmetadata.service.util.jdbi.BindJson;

public interface FeedDAOs {
  @CreateSqlObject
  ConversationDAO conversationDAO();

  @CreateSqlObject
  TaskDAO taskDAO();

  @CreateSqlObject
  AnnouncementDAO announcementDAO();

  @CreateSqlObject
  TaskFormSchemaDAO taskFormSchemaDAO();

  interface TaskDAO extends EntityDAO<Task> {
    class TaskCountSummary {
      private final int total;
      private final int open;
      private final int completed;
      private final int inProgress;
      private final int approved;
      private final int granted;

      public TaskCountSummary(
          int total, int open, int completed, int inProgress, int approved, int granted) {
        this.total = total;
        this.open = open;
        this.completed = completed;
        this.inProgress = inProgress;
        this.approved = approved;
        this.granted = granted;
      }

      public int getTotal() {
        return total;
      }

      public int getOpen() {
        return open;
      }

      public int getCompleted() {
        return completed;
      }

      public int getInProgress() {
        return inProgress;
      }

      public int getApproved() {
        return approved;
      }

      public int getGranted() {
        return granted;
      }
    }

    class TaskCountSummaryMapper implements RowMapper<TaskCountSummary> {
      @Override
      public TaskCountSummary map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new TaskCountSummary(
            rs.getInt("total"),
            rs.getInt("openCount"),
            rs.getInt("completedCount"),
            rs.getInt("inProgressCount"),
            rs.getInt("approvedCount"),
            rs.getInt("grantedCount"));
      }
    }

    @Override
    default String getTableName() {
      return "task_entity";
    }

    @Override
    default Class<Task> getEntityClass() {
      return Task.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO task_entity (id, json, fqnHash) VALUES (:id, :json, :fqnHash)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO task_entity (id, json, fqnHash) VALUES (:id, :json :: jsonb, :fqnHash)",
        connectionType = POSTGRES)
    void insertTask(
        @Bind("id") String id, @BindJson("json") String json, @BindFQN("fqnHash") String fqn);

    @Override
    default void insert(org.openmetadata.schema.EntityInterface entity, String fqn) {
      Task task = (Task) entity;
      insertTask(task.getId().toString(), JsonUtils.pojoToJson(task), task.getFullyQualifiedName());
    }

    @ConnectionAwareSqlUpdate(
        value = "UPDATE task_entity SET json = :json WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE task_entity SET json = (:json :: jsonb) WHERE id = :id",
        connectionType = POSTGRES)
    void updateTask(@Bind("id") String id, @BindJson("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE task_entity SET json = JSON_SET(json, '$.aboutFqnHash', :newFqnHash) "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.aboutFqnHash')) = :oldFqnHash",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE task_entity SET json = jsonb_set(json, '{aboutFqnHash}', "
                + "to_jsonb(:newFqnHash::text)) WHERE json->>'aboutFqnHash' = :oldFqnHash",
        connectionType = POSTGRES)
    int updateAboutFqnHash(
        @Bind("oldFqnHash") String oldFqnHash, @Bind("newFqnHash") String newFqnHash);

    @Transaction
    @ConnectionAwareSqlBatch(
        value =
            "UPDATE task_entity SET json = JSON_SET(json, '$.aboutFqnHash', :newFqnHash) "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.aboutFqnHash')) = :oldFqnHash",
        connectionType = MYSQL)
    @ConnectionAwareSqlBatch(
        value =
            "UPDATE task_entity SET json = jsonb_set(json, '{aboutFqnHash}', "
                + "to_jsonb(:newFqnHash::text)) WHERE json->>'aboutFqnHash' = :oldFqnHash",
        connectionType = POSTGRES)
    @BatchChunkSize(100)
    int[] updateAboutFqnHashBatch(
        @Bind("oldFqnHash") List<String> oldFqnHashes,
        @Bind("newFqnHash") List<String> newFqnHashes);

    @Override
    default void update(UUID id, String fqn, String json) {
      updateTask(id.toString(), json);
    }

    @SqlUpdate("UPDATE new_task_sequence SET id = LAST_INSERT_ID(id + 1)")
    int incrementSequenceMysql();

    @SqlQuery("SELECT LAST_INSERT_ID()")
    long getLastInsertIdMysql();

    @SqlQuery("UPDATE new_task_sequence SET id = id + 1 RETURNING id")
    long getNextTaskIdPostgres();

    @SqlUpdate("DELETE FROM entity_relationship WHERE fromEntity = 'task' OR toEntity = 'task'")
    void deleteTaskRelationships();

    @SqlUpdate("DELETE FROM task_entity")
    void deleteAll();

    @SqlUpdate("UPDATE new_task_sequence SET id = 0")
    void resetSequence();

    @SqlUpdate(
        "DELETE FROM entity_relationship WHERE fromEntity = 'domain' AND toEntity = 'task' "
            + "AND relation = 10 AND toId IN (<taskIds>)")
    void bulkRemoveDomainRelationships(@BindList("taskIds") List<String> taskIds);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM task_entity "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.payload.testCaseResolutionStatusId')) = :stateId "
                + "AND (JSON_EXTRACT(json, '$.deleted') = false OR JSON_EXTRACT(json, '$.deleted') IS NULL)",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM task_entity "
                + "WHERE json->'payload'->>'testCaseResolutionStatusId' = :stateId "
                + "AND ((json->>'deleted')::boolean = false OR json->>'deleted' IS NULL)",
        connectionType = POSTGRES)
    String fetchTaskByTestCaseResolutionStatusId(@Bind("stateId") String stateId);

    @SqlQuery(
        "SELECT json FROM task_entity "
            + "WHERE aboutFqnHash = :aboutFqnHash AND type = :type "
            + "AND status IN (<statuses>) "
            + "AND (deleted = false OR deleted IS NULL) "
            + "ORDER BY createdAt DESC LIMIT 1")
    String findByAboutAndTypeAndStatuses(
        @BindFQN("aboutFqnHash") String aboutFqn,
        @Bind("type") String type,
        @BindList("statuses") List<String> statuses);

    @SqlQuery(
        "SELECT json FROM task_entity "
            + "WHERE aboutFqnHash = :aboutFqnHash AND type = :type AND status = :status "
            + "AND (deleted = false OR deleted IS NULL) "
            + "LIMIT 1")
    String findByAboutAndTypeAndStatus(
        @BindFQN("aboutFqnHash") String aboutFqn,
        @Bind("type") String type,
        @Bind("status") String status);

    @SqlQuery(
        "SELECT json FROM task_entity "
            + "WHERE aboutFqnHash = :aboutFqnHash AND type = :type AND createdById = :createdById "
            + "AND status IN (<activeStatuses>) "
            + "AND (deleted = false OR deleted IS NULL) "
            + "ORDER BY createdAt DESC LIMIT 1")
    String findActiveByAboutTypeAndCreator(
        @BindFQN("aboutFqnHash") String aboutFqn,
        @Bind("type") String type,
        @Bind("createdById") String createdById,
        @BindList("activeStatuses") List<String> activeStatuses);

    @SqlQuery(
        "SELECT json FROM task_entity "
            + "WHERE aboutFqnHash = :aboutFqnHash AND category = :category AND status = :status "
            + "AND (deleted = false OR deleted IS NULL) "
            + "LIMIT 1")
    String findByAboutAndCategoryAndStatus(
        @BindFQN("aboutFqnHash") String aboutFqn,
        @Bind("category") String category,
        @Bind("status") String status);

    @SqlQuery(
        "SELECT json FROM task_entity "
            + "WHERE aboutFqnHash = :aboutFqnHash AND category = :category "
            + "AND status IN (<statuses>) "
            + "AND (deleted = false OR deleted IS NULL) "
            + "ORDER BY createdAt DESC")
    List<String> listByAboutAndCategoryAndStatuses(
        @BindFQN("aboutFqnHash") String aboutFqn,
        @Bind("category") String category,
        @BindList("statuses") List<String> statuses);

    @SqlUpdate(
        "DELETE FROM task_entity " + "WHERE createdById = :createdById AND category = :category")
    void deleteByCreatorAndCategory(
        @Bind("createdById") String createdById, @Bind("category") String category);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT id, json_unquote(json_extract(json, '$.fullyQualifiedName')) AS fqn "
                + "FROM task_entity WHERE createdById = :createdById AND category = :category",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT id, json->>'fullyQualifiedName' AS fqn "
                + "FROM task_entity WHERE createdById = :createdById AND category = :category",
        connectionType = POSTGRES)
    @RegisterRowMapper(EntityDAO.EntityIdFqnPairMapper.class)
    List<EntityDAO.EntityIdFqnPair> listIdAndFqnByCreatorAndCategory(
        @Bind("createdById") String createdById, @Bind("category") String category);

    @RegisterRowMapper(TaskCountSummaryMapper.class)
    @SqlQuery(
        // Row-aware bucketing so openCount + completedCount = total across mixed task types.
        // Bucket predicates and status/type literals are shared with ListFilter via
        // TaskBucketSql — see that class for the invariant + drift-guard test.
        "SELECT "
            + "COUNT(id) AS total, "
            + "COALESCE(SUM(CASE"
            + " WHEN status IN ("
            + TaskBucketSql.SHARED_OPEN_STATUSES
            + ") THEN 1"
            + " WHEN type = '"
            + TaskBucketSql.TASK_TYPE_DAR
            + "' AND status = '"
            + TaskBucketSql.STATUS_APPROVED
            + "' THEN 1"
            + " ELSE 0 END), 0) AS openCount, "
            + "COALESCE(SUM(CASE"
            + " WHEN status IN ("
            + TaskBucketSql.SHARED_TERMINAL_STATUSES
            + ") THEN 1"
            + " WHEN type <> '"
            + TaskBucketSql.TASK_TYPE_DAR
            + "' AND status = '"
            + TaskBucketSql.STATUS_APPROVED
            + "' THEN 1"
            + " ELSE 0 END), 0) AS completedCount, "
            + "COALESCE(SUM(CASE WHEN status = '"
            + TaskBucketSql.STATUS_IN_PROGRESS
            + "' THEN 1 ELSE 0 END), 0) AS inProgressCount, "
            + "COALESCE(SUM(CASE WHEN status = '"
            + TaskBucketSql.STATUS_APPROVED
            + "' THEN 1 ELSE 0 END), 0) AS approvedCount, "
            + "COALESCE(SUM(CASE WHEN status = '"
            + TaskBucketSql.STATUS_GRANTED
            + "' THEN 1 ELSE 0 END), 0) AS grantedCount "
            + "FROM task_entity <condition>")
    TaskCountSummary getTaskCountSummary(
        @Define("condition") String condition, @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT json FROM task_entity <cond> "
            + "ORDER BY createdAt <sortOrder>, id <sortOrder> "
            + "LIMIT :limit OFFSET :offset")
    List<String> listTasksByCreatedAt(
        @Define("cond") String cond,
        @BindMap Map<String, ?> params,
        @Define("sortOrder") String sortOrder,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    @SqlQuery("SELECT count(*) FROM task_entity <cond>")
    int listTasksByCreatedAtCount(@Define("cond") String cond, @BindMap Map<String, ?> params);
  }

  interface AnnouncementDAO extends EntityDAO<Announcement> {
    @Override
    default String getTableName() {
      return "announcement_entity";
    }

    @Override
    default Class<Announcement> getEntityClass() {
      return Announcement.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO announcement_entity (id, json, fqnHash) VALUES (:id, :json, :fqnHash)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO announcement_entity (id, json, fqnHash) VALUES (:id, :json :: jsonb, :fqnHash)",
        connectionType = POSTGRES)
    void insertAnnouncement(
        @Bind("id") String id, @BindJson("json") String json, @BindFQN("fqnHash") String fqn);

    @Override
    default void insert(org.openmetadata.schema.EntityInterface entity, String fqn) {
      Announcement announcement = (Announcement) entity;
      insertAnnouncement(
          announcement.getId().toString(),
          JsonUtils.pojoToJson(announcement),
          announcement.getFullyQualifiedName());
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM announcement_entity "
                + "WHERE <condition> "
                + "AND (:entityLink IS NULL OR entityLink = :entityLink) "
                + "AND (:status IS NULL OR status = :status) "
                + "AND ((:active IS NULL) "
                + "OR (:active = TRUE AND startTime <= :currentTs AND endTime >= :currentTs) "
                + "OR (:active = FALSE AND (startTime > :currentTs OR endTime < :currentTs)))",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM announcement_entity "
                + "WHERE <condition> "
                + "AND (:entityLink IS NULL OR entityLink = :entityLink) "
                + "AND (:status IS NULL OR status = :status) "
                + "AND ((:active IS NULL) "
                + "OR (:active = TRUE AND startTime <= :currentTs AND endTime >= :currentTs) "
                + "OR (:active = FALSE AND (startTime > :currentTs OR endTime < :currentTs)))",
        connectionType = POSTGRES)
    int listAnnouncementCount(
        @Define("condition") String condition,
        @Bind("entityLink") String entityLink,
        @Bind("status") String status,
        @Bind("active") Boolean active,
        @Bind("currentTs") long currentTs);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM announcement_entity "
                + "WHERE <condition> "
                + "AND (:entityLink IS NULL OR entityLink = :entityLink) "
                + "AND (:status IS NULL OR status = :status) "
                + "AND ((:active IS NULL) "
                + "OR (:active = TRUE AND startTime <= :currentTs AND endTime >= :currentTs) "
                + "OR (:active = FALSE AND (startTime > :currentTs OR endTime < :currentTs))) "
                + "ORDER BY name, id LIMIT :limit OFFSET :offset",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM announcement_entity "
                + "WHERE <condition> "
                + "AND (:entityLink IS NULL OR entityLink = :entityLink) "
                + "AND (:status IS NULL OR status = :status) "
                + "AND ((:active IS NULL) "
                + "OR (:active = TRUE AND startTime <= :currentTs AND endTime >= :currentTs) "
                + "OR (:active = FALSE AND (startTime > :currentTs OR endTime < :currentTs))) "
                + "ORDER BY name, id LIMIT :limit OFFSET :offset",
        connectionType = POSTGRES)
    List<String> listAnnouncementsWithOffset(
        @Define("condition") String condition,
        @Bind("entityLink") String entityLink,
        @Bind("status") String status,
        @Bind("active") Boolean active,
        @Bind("currentTs") long currentTs,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT announcement_entity.name, announcement_entity.id, announcement_entity.json "
                + "FROM announcement_entity "
                + "WHERE <condition> "
                + "AND (:entityLink IS NULL OR entityLink = :entityLink) "
                + "AND (:status IS NULL OR status = :status) "
                + "AND ((:active IS NULL) "
                + "OR (:active = TRUE AND startTime <= :currentTs AND endTime >= :currentTs) "
                + "OR (:active = FALSE AND (startTime > :currentTs OR endTime < :currentTs))) "
                + "AND (announcement_entity.name < :beforeName "
                + "OR (announcement_entity.name = :beforeName AND announcement_entity.id < :beforeId)) "
                + "ORDER BY announcement_entity.name DESC, announcement_entity.id DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name, id",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT announcement_entity.name, announcement_entity.id, announcement_entity.json "
                + "FROM announcement_entity "
                + "WHERE <condition> "
                + "AND (:entityLink IS NULL OR entityLink = :entityLink) "
                + "AND (:status IS NULL OR status = :status) "
                + "AND ((:active IS NULL) "
                + "OR (:active = TRUE AND startTime <= :currentTs AND endTime >= :currentTs) "
                + "OR (:active = FALSE AND (startTime > :currentTs OR endTime < :currentTs))) "
                + "AND (announcement_entity.name < :beforeName "
                + "OR (announcement_entity.name = :beforeName AND announcement_entity.id < :beforeId)) "
                + "ORDER BY announcement_entity.name DESC, announcement_entity.id DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name, id",
        connectionType = POSTGRES)
    List<String> listAnnouncementsBefore(
        @Define("condition") String condition,
        @Bind("entityLink") String entityLink,
        @Bind("status") String status,
        @Bind("active") Boolean active,
        @Bind("currentTs") long currentTs,
        @Bind("limit") int limit,
        @Bind("beforeName") String beforeName,
        @Bind("beforeId") String beforeId);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT announcement_entity.json FROM announcement_entity "
                + "WHERE <condition> "
                + "AND (:entityLink IS NULL OR entityLink = :entityLink) "
                + "AND (:status IS NULL OR status = :status) "
                + "AND ((:active IS NULL) "
                + "OR (:active = TRUE AND startTime <= :currentTs AND endTime >= :currentTs) "
                + "OR (:active = FALSE AND (startTime > :currentTs OR endTime < :currentTs))) "
                + "AND (announcement_entity.name > :afterName "
                + "OR (announcement_entity.name = :afterName AND announcement_entity.id > :afterId)) "
                + "ORDER BY announcement_entity.name, announcement_entity.id "
                + "LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT announcement_entity.json FROM announcement_entity "
                + "WHERE <condition> "
                + "AND (:entityLink IS NULL OR entityLink = :entityLink) "
                + "AND (:status IS NULL OR status = :status) "
                + "AND ((:active IS NULL) "
                + "OR (:active = TRUE AND startTime <= :currentTs AND endTime >= :currentTs) "
                + "OR (:active = FALSE AND (startTime > :currentTs OR endTime < :currentTs))) "
                + "AND (announcement_entity.name > :afterName "
                + "OR (announcement_entity.name = :afterName AND announcement_entity.id > :afterId)) "
                + "ORDER BY announcement_entity.name, announcement_entity.id "
                + "LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listAnnouncementsAfter(
        @Define("condition") String condition,
        @Bind("entityLink") String entityLink,
        @Bind("status") String status,
        @Bind("active") Boolean active,
        @Bind("currentTs") long currentTs,
        @Bind("limit") int limit,
        @Bind("afterName") String afterName,
        @Bind("afterId") String afterId);

    private String getAnnouncementBaseCondition(ListFilter filter) {
      String includeCondition = filter.getIncludeCondition(getTableName());
      return includeCondition.isEmpty() ? "TRUE" : includeCondition;
    }

    private Boolean getActiveFlag(ListFilter filter) {
      String active = filter.getQueryParam("active");
      return active == null ? null : Boolean.parseBoolean(active);
    }

    private String getAnnouncementStatus(ListFilter filter) {
      return filter.getQueryParam("status");
    }

    private String getAnnouncementEntityLink(ListFilter filter) {
      return filter.getQueryParam("entityLink");
    }

    @Override
    default int listCount(ListFilter filter) {
      if (filter.getQueryParam("active") == null) {
        return EntityDAO.super.listCount(filter);
      }

      return listAnnouncementCount(
          getAnnouncementBaseCondition(filter),
          getAnnouncementEntityLink(filter),
          getAnnouncementStatus(filter),
          getActiveFlag(filter),
          System.currentTimeMillis());
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      if (filter.getQueryParam("active") == null) {
        return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
      }

      return listAnnouncementsBefore(
          getAnnouncementBaseCondition(filter),
          getAnnouncementEntityLink(filter),
          getAnnouncementStatus(filter),
          getActiveFlag(filter),
          System.currentTimeMillis(),
          limit,
          beforeName,
          beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      if (filter.getQueryParam("active") == null) {
        return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
      }

      return listAnnouncementsAfter(
          getAnnouncementBaseCondition(filter),
          getAnnouncementEntityLink(filter),
          getAnnouncementStatus(filter),
          getActiveFlag(filter),
          System.currentTimeMillis(),
          limit,
          afterName,
          afterId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, int offset) {
      if (filter.getQueryParam("active") == null) {
        return EntityDAO.super.listAfter(filter, limit, offset);
      }

      return listAnnouncementsWithOffset(
          getAnnouncementBaseCondition(filter),
          getAnnouncementEntityLink(filter),
          getAnnouncementStatus(filter),
          getActiveFlag(filter),
          System.currentTimeMillis(),
          limit,
          offset);
    }
  }

  interface TaskFormSchemaDAO extends EntityDAO<TaskFormSchema> {
    @Override
    default String getTableName() {
      return "task_form_schema_entity";
    }

    @Override
    default Class<TaskFormSchema> getEntityClass() {
      return TaskFormSchema.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO task_form_schema_entity (id, json, fqnHash) VALUES (:id, :json, :fqnHash)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO task_form_schema_entity (id, json, fqnHash) VALUES (:id, :json :: jsonb, :fqnHash)",
        connectionType = POSTGRES)
    void insertTaskFormSchema(
        @Bind("id") String id, @BindJson("json") String json, @BindFQN("fqnHash") String fqn);

    @Override
    default void insert(org.openmetadata.schema.EntityInterface entity, String fqn) {
      TaskFormSchema schema = (TaskFormSchema) entity;
      insertTaskFormSchema(
          schema.getId().toString(), JsonUtils.pojoToJson(schema), schema.getFullyQualifiedName());
    }
  }

  interface ConversationDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO conversation_entity(entityFqnHash, aboutFqnHash, json) "
                + "VALUES (:entityFqnHash, :aboutFqnHash, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO conversation_entity(entityFqnHash, aboutFqnHash, json) "
                + "VALUES (:entityFqnHash, :aboutFqnHash, :json::jsonb)",
        connectionType = POSTGRES)
    int insert(
        @Bind("entityFqnHash") String entityFqnHash,
        @Bind("aboutFqnHash") String aboutFqnHash,
        @BindJson("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO conversation_entity(entityFqnHash, aboutFqnHash, json) "
                + "VALUES (:entityFqnHash, :aboutFqnHash, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO conversation_entity(entityFqnHash, aboutFqnHash, json) "
                + "VALUES (:entityFqnHash, :aboutFqnHash, :json::jsonb) "
                + "ON CONFLICT DO NOTHING",
        connectionType = POSTGRES)
    int insertIfAbsent(
        @Bind("entityFqnHash") String entityFqnHash,
        @Bind("aboutFqnHash") String aboutFqnHash,
        @BindJson("json") String json);

    @SqlQuery("SELECT json FROM conversation_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT EXISTS (SELECT 1 FROM conversation_entity WHERE id = :id)")
    boolean exists(@Bind("id") String id);

    @SqlQuery("SELECT json FROM conversation_entity WHERE id = :id FOR UPDATE")
    String findByIdForUpdate(@Bind("id") String id);

    @SqlQuery(
        "SELECT c.json FROM conversation_entity c <condition> " + "ORDER BY <orderBy> LIMIT :limit")
    List<String> list(
        @Define("condition") String condition,
        @Define("orderBy") String orderBy,
        @BindMap Map<String, Object> params,
        @Bind("limit") int limit);

    @SqlQuery("SELECT count(*) FROM conversation_entity c <condition>")
    int count(@Define("condition") String condition, @BindMap Map<String, Object> params);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE conversation_entity SET json = :json WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE conversation_entity SET json = :json::jsonb WHERE id = :id",
        connectionType = POSTGRES)
    int update(@Bind("id") String id, @BindJson("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE conversation_entity SET entityFqnHash = :entityFqnHash, "
                + "aboutFqnHash = :entityFqnHash, json = JSON_SET(json, '$.entityRef', "
                + "CAST(:entityRef AS JSON), '$.about', REPLACE(JSON_UNQUOTE(JSON_EXTRACT(json, "
                + "'$.about')), :oldFqn, :newFqn)) WHERE entityType = :entityType "
                + "AND entityId = :entityId",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE conversation_entity SET entityFqnHash = :entityFqnHash, "
                + "aboutFqnHash = :entityFqnHash, json = jsonb_set(jsonb_set(json, "
                + "'{entityRef}', :entityRef::jsonb), '{about}', "
                + "to_jsonb(REPLACE(json->>'about', :oldFqn, :newFqn))) "
                + "WHERE entityType = :entityType AND entityId = :entityId",
        connectionType = POSTGRES)
    int updateEntityReference(
        @Bind("entityType") String entityType,
        @Bind("entityId") String entityId,
        @Bind("oldFqn") String oldFqn,
        @Bind("newFqn") String newFqn,
        @Bind("entityFqnHash") String entityFqnHash,
        @Bind("entityRef") String entityRef);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE conversation_entity SET entityFqnHash = :entityFqnHash, "
                + "aboutFqnHash = :entityFqnHash, json = JSON_SET(json, "
                + "'$.entityRef.fullyQualifiedName', :newFqn, '$.about', "
                + "REPLACE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.about')), :oldFqn, :newFqn)) "
                + "WHERE entityType = :entityType AND entityId = :entityId",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE conversation_entity SET entityFqnHash = :entityFqnHash, "
                + "aboutFqnHash = :entityFqnHash, json = jsonb_set(jsonb_set(json, "
                + "'{entityRef,fullyQualifiedName}', to_jsonb(CAST(:newFqn AS text))), "
                + "'{about}', to_jsonb(REPLACE(json->>'about', :oldFqn, :newFqn))) "
                + "WHERE entityType = :entityType AND entityId = :entityId",
        connectionType = POSTGRES)
    int updateEntityFqn(
        @Bind("entityType") String entityType,
        @Bind("entityId") String entityId,
        @Bind("oldFqn") String oldFqn,
        @Bind("newFqn") String newFqn,
        @Bind("entityFqnHash") String entityFqnHash);

    @SqlQuery(
        "SELECT id FROM conversation_entity WHERE entityType = :entityType AND entityId = :entityId")
    List<String> listIdsByEntity(
        @Bind("entityType") String entityType, @Bind("entityId") String entityId);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE conversation_entity SET json = JSON_SET(json, '$.domains', "
                + "CAST(:domains AS JSON)) WHERE entityType = :entityType AND entityId = :entityId",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE conversation_entity SET json = jsonb_set(json, '{domains}', :domains::jsonb) "
                + "WHERE entityType = :entityType AND entityId = :entityId",
        connectionType = POSTGRES)
    int updateDomainsByEntity(
        @Bind("entityType") String entityType,
        @Bind("entityId") String entityId,
        @Bind("domains") String domains);

    @SqlUpdate("DELETE FROM conversation_entity WHERE id = :id")
    int delete(@Bind("id") String id);

    @SqlUpdate(
        "DELETE FROM conversation_entity WHERE source = 'User' AND entityType = :entityType "
            + "AND entityId IN (<entityIds>)")
    int deleteByEntity(
        @Bind("entityType") String entityType, @BindList("entityIds") List<String> entityIds);

    @SqlQuery(
        "SELECT id FROM conversation_entity WHERE source = 'User' AND createdAt < :cutoff "
            + "ORDER BY createdAt, id LIMIT :limit")
    List<String> listExpiredUserConversationIds(
        @Bind("cutoff") long cutoff, @Bind("limit") int limit);

    @SqlUpdate("DELETE FROM conversation_entity WHERE id IN (<conversationIds>)")
    int deleteByIds(@BindList("conversationIds") List<String> conversationIds);

    @SqlQuery(
        "SELECT id FROM conversation_entity WHERE source = 'Activity' "
            + "AND updatedAt < :cutoff ORDER BY updatedAt, id LIMIT :limit")
    List<String> listExpiredActivityConversationIds(
        @Bind("cutoff") long cutoff, @Bind("limit") int limit);

    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO conversation_reply(json) VALUES (:json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO conversation_reply(json) VALUES (:json::jsonb)",
        connectionType = POSTGRES)
    int insertReply(@BindJson("json") String json);

    @SqlQuery(
        "SELECT json FROM conversation_reply WHERE id = :id AND conversationId = :conversationId")
    @RegisterRowMapper(ConversationReplyMapper.class)
    ConversationReplyRow findReply(
        @Bind("conversationId") String conversationId, @Bind("id") String id);

    @SqlQuery(
        "SELECT json FROM conversation_reply WHERE id = :id AND conversationId = :conversationId "
            + "FOR UPDATE")
    @RegisterRowMapper(ConversationReplyMapper.class)
    ConversationReplyRow findReplyForUpdate(
        @Bind("conversationId") String conversationId, @Bind("id") String id);

    @SqlQuery(
        "SELECT json FROM (SELECT r.json, r.conversationId, r.createdAt, r.id, "
            + "ROW_NUMBER() OVER (PARTITION BY conversationId "
            + "ORDER BY createdAt DESC, id DESC) AS rowNumber FROM conversation_reply r "
            + "WHERE conversationId IN (<conversationIds>)) recent WHERE rowNumber <= :replyLimit "
            + "ORDER BY conversationId, createdAt ASC, id ASC")
    @RegisterRowMapper(ConversationReplyMapper.class)
    List<ConversationReplyRow> listRecentReplies(
        @BindList("conversationIds") List<String> conversationIds,
        @Bind("replyLimit") int replyLimit);

    @SqlQuery(
        "SELECT json FROM conversation_reply WHERE conversationId = :conversationId <cursorCondition> "
            + "ORDER BY <orderBy> LIMIT :limit")
    @RegisterRowMapper(ConversationReplyMapper.class)
    List<ConversationReplyRow> listReplies(
        @Bind("conversationId") String conversationId,
        @Define("cursorCondition") String cursorCondition,
        @Define("orderBy") String orderBy,
        @BindMap Map<String, Object> params,
        @Bind("limit") int limit);

    @SqlQuery("SELECT count(*) FROM conversation_reply WHERE conversationId = :conversationId")
    int countReplies(@Bind("conversationId") String conversationId);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE conversation_reply SET json = :json "
                + "WHERE id = :id AND conversationId = :conversationId",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE conversation_reply SET json = :json::jsonb "
                + "WHERE id = :id AND conversationId = :conversationId",
        connectionType = POSTGRES)
    int updateReply(
        @Bind("conversationId") String conversationId,
        @Bind("id") String id,
        @BindJson("json") String json);

    @SqlUpdate("DELETE FROM conversation_reply WHERE id = :id AND conversationId = :conversationId")
    int deleteReply(@Bind("conversationId") String conversationId, @Bind("id") String id);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE conversation_entity SET json = JSON_SET(json, '$.replyCount', "
                + "GREATEST(0, replyCount + :delta), '$.updatedAt', :updatedAt) "
                + "WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE conversation_entity SET json = jsonb_set(jsonb_set(json, '{replyCount}', "
                + "to_jsonb(GREATEST(0, replyCount + :delta))), '{updatedAt}', "
                + "to_jsonb(CAST(:updatedAt AS bigint))) WHERE id = :id",
        connectionType = POSTGRES)
    int updateReplyCount(
        @Bind("id") String id, @Bind("delta") int delta, @Bind("updatedAt") long updatedAt);

    @SqlUpdate(
        "DELETE FROM conversation_mention WHERE targetType = :targetType AND targetId = :targetId")
    int deleteMentions(@Bind("targetType") String targetType, @Bind("targetId") String targetId);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO conversation_mention(conversationId, targetType, targetId, "
                + "mentionedEntityType, mentionedEntityId, createdAt) VALUES (:conversationId, "
                + ":targetType, :targetId, :mentionedEntityType, :mentionedEntityId, :createdAt)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO conversation_mention(conversationId, targetType, targetId, "
                + "mentionedEntityType, mentionedEntityId, createdAt) VALUES (:conversationId, "
                + ":targetType, :targetId, :mentionedEntityType, :mentionedEntityId, :createdAt) "
                + "ON CONFLICT DO NOTHING",
        connectionType = POSTGRES)
    int insertMention(
        @Bind("conversationId") String conversationId,
        @Bind("targetType") String targetType,
        @Bind("targetId") String targetId,
        @Bind("mentionedEntityType") String mentionedEntityType,
        @Bind("mentionedEntityId") String mentionedEntityId,
        @Bind("createdAt") long createdAt);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO conversation_domain(conversationId, domainId) "
                + "VALUES (:conversationId, :domainId)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO conversation_domain(conversationId, domainId) "
                + "VALUES (:conversationId, :domainId) ON CONFLICT DO NOTHING",
        connectionType = POSTGRES)
    int insertDomain(
        @Bind("conversationId") String conversationId, @Bind("domainId") String domainId);

    @SqlUpdate("DELETE FROM conversation_domain WHERE conversationId IN (<conversationIds>)")
    int deleteDomains(@BindList("conversationIds") List<String> conversationIds);

    @SqlQuery(
        "SELECT conversationId, domainId FROM conversation_domain "
            + "WHERE conversationId IN (<conversationIds>)")
    @RegisterRowMapper(ConversationDomainMapper.class)
    List<ConversationDomainRow> listDomains(
        @BindList("conversationIds") List<String> conversationIds);
  }

  class ConversationDomainMapper implements RowMapper<ConversationDomainRow> {
    @Override
    public ConversationDomainRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      return ConversationDomainRow.builder()
          .conversationId(rs.getString("conversationId"))
          .domainId(rs.getString("domainId"))
          .build();
    }
  }

  @Builder
  record ConversationDomainRow(String conversationId, String domainId) {}

  class ConversationReplyMapper implements RowMapper<ConversationReplyRow> {
    @Override
    public ConversationReplyRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      ConversationReply reply = JsonUtils.readValue(rs.getString("json"), ConversationReply.class);
      return ConversationReplyRow.builder()
          .id(reply.getId().toString())
          .conversationId(reply.getConversationId().toString())
          .authorId(reply.getAuthor().getId().toString())
          .message(reply.getMessage())
          .createdAt(reply.getCreatedAt())
          .updatedAt(reply.getUpdatedAt())
          .updatedBy(reply.getUpdatedBy())
          .impersonatedBy(reply.getImpersonatedBy())
          .reactions(reply.getReactions())
          .build();
    }
  }

  @Builder
  record ConversationReplyRow(
      String id,
      String conversationId,
      String authorId,
      String message,
      long createdAt,
      long updatedAt,
      String updatedBy,
      String impersonatedBy,
      List<Reaction> reactions) {}
}
