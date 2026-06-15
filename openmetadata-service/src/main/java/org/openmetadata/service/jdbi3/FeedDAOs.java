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

import static org.openmetadata.schema.type.Relationship.MENTIONED_IN;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.entity.feed.TaskFormSchema;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.FeedRepository.FilterType;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.jdbi.BindConcat;
import org.openmetadata.service.util.jdbi.BindFQN;
import org.openmetadata.service.util.jdbi.BindUUID;

public interface FeedDAOs {
  @CreateSqlObject
  FeedDAO feedDAO();

  @CreateSqlObject
  TaskDAO taskDAO();

  @CreateSqlObject
  AnnouncementDAO announcementDAO();

  @CreateSqlObject
  TaskFormSchemaDAO taskFormSchemaDAO();

  interface FeedDAO {
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO <tableName>(json) VALUES (:json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO <tableName>(json) VALUES (:json :: jsonb)",
        connectionType = POSTGRES)
    void insert(@Define("tableName") String tableName, @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO thread_entity(json) VALUES (:json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO thread_entity(json) VALUES (:json :: jsonb)",
        connectionType = POSTGRES)
    void insert(@Bind("json") String json);

    @SqlQuery("SELECT json FROM <tableName> WHERE id = :id")
    String findById(@Define("tableName") String tableName, @BindUUID("id") UUID id);

    @SqlQuery("SELECT json FROM thread_entity WHERE id = :id")
    String findById(@BindUUID("id") UUID id);

    @SqlQuery("SELECT json FROM <tableName> ORDER BY createdAt DESC")
    List<String> list(@Define("tableName") String tableName);

    @SqlQuery("SELECT json FROM thread_entity ORDER BY createdAt DESC")
    List<String> list();

    @SqlQuery("SELECT count(id) FROM <tableName> <condition>")
    int listCount(
        @Define("tableName") String tableName,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery("SELECT count(id) FROM thread_entity <condition>")
    int listCount(@Define("condition") String condition, @BindMap Map<String, String> params);

    @SqlUpdate("DELETE FROM <tableName> WHERE id = :id")
    void delete(@Define("tableName") String tableName, @BindUUID("id") UUID id);

    @SqlUpdate("DELETE FROM thread_entity WHERE id = :id")
    void delete(@BindUUID("id") UUID id);

    @SqlUpdate("DELETE FROM <tableName> WHERE id IN (<ids>)")
    int deleteByIds(@Define("tableName") String tableName, @BindList("ids") List<String> ids);

    @SqlUpdate("DELETE FROM thread_entity WHERE id IN (<ids>)")
    int deleteByIds(@BindList("ids") List<String> ids);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE task_sequence SET id=LAST_INSERT_ID(id+1)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE task_sequence SET id=(id+1) RETURNING id",
        connectionType = POSTGRES)
    void updateTaskId();

    @ConnectionAwareSqlQuery(value = "SELECT LAST_INSERT_ID()", connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT id FROM task_sequence LIMIT 1",
        connectionType = POSTGRES)
    int getTaskId();

    @SqlQuery("SELECT json FROM <tableName> WHERE taskId = :id")
    String findByTaskId(@Define("tableName") String tableName, @Bind("id") int id);

    @SqlQuery("SELECT json FROM thread_entity WHERE taskId = :id")
    String findByTaskId(@Bind("id") int id);

    @SqlQuery("SELECT json FROM <tableName> <condition> ORDER BY createdAt DESC LIMIT :limit")
    List<String> list(
        @Define("tableName") String tableName,
        @Bind("limit") int limit,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery("SELECT json FROM thread_entity <condition> ORDER BY createdAt DESC LIMIT :limit")
    List<String> list(
        @Bind("limit") int limit,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT json FROM <tableName> "
            + "WHERE type='Announcement' AND (:threadId IS NULL OR id != :threadId) "
            + "AND entityId = :entityId "
            + "AND (( :startTs >= announcementStart AND :startTs < announcementEnd) "
            + "OR (:endTs > announcementStart AND :endTs < announcementEnd) "
            + "OR (:startTs <= announcementStart AND :endTs >= announcementEnd))")
    List<String> listAnnouncementBetween(
        @Define("tableName") String tableName,
        @BindUUID("threadId") UUID threadId,
        @BindUUID("entityId") UUID entityId,
        @Bind("startTs") long startTs,
        @Bind("endTs") long endTs);

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
            "SELECT json FROM <tableName> <condition> AND "
                + "to_tsvector('simple', taskAssigneesIds) @@ to_tsquery('simple', :userTeamJsonPostgres) "
                + "ORDER BY createdAt DESC "
                + "LIMIT :limit",
        connectionType = POSTGRES)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM <tableName> <condition> AND "
                + "MATCH(taskAssigneesIds) AGAINST (:userTeamJsonMysql IN BOOLEAN MODE) "
                + "ORDER BY createdAt DESC "
                + "LIMIT :limit",
        connectionType = MYSQL)
    List<String> listTasksAssigned(
        @Define("tableName") String tableName,
        @Bind("userTeamJsonPostgres") String userTeamJsonPostgres,
        @Bind("userTeamJsonMysql") String userTeamJsonMysql,
        @Bind("limit") int limit,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(id) FROM <tableName> <condition> AND "
                + "to_tsvector('simple', taskAssigneesIds) @@ to_tsquery('simple', :userTeamJsonPostgres) ",
        connectionType = POSTGRES)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(id) FROM <tableName> <condition> AND "
                + "MATCH(taskAssigneesIds) AGAINST (:userTeamJsonMysql IN BOOLEAN MODE) ",
        connectionType = MYSQL)
    int listCountTasksAssignedTo(
        @Define("tableName") String tableName,
        @Bind("userTeamJsonPostgres") String userTeamJsonPostgres,
        @Bind("userTeamJsonMysql") String userTeamJsonMysql,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM <tableName> <condition> "
                + "AND (to_tsvector('simple', taskAssigneesIds) @@ to_tsquery('simple', :userTeamJsonPostgres) OR createdBy = :username) "
                + "ORDER BY createdAt DESC "
                + "LIMIT :limit",
        connectionType = POSTGRES)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM <tableName> <condition> "
                + "AND (MATCH(taskAssigneesIds) AGAINST (:userTeamJsonMysql IN BOOLEAN MODE) OR createdBy = :username) "
                + "ORDER BY createdAt DESC "
                + "LIMIT :limit",
        connectionType = MYSQL)
    List<String> listTasksOfUser(
        @Define("tableName") String tableName,
        @Bind("userTeamJsonPostgres") String userTeamJsonPostgres,
        @Bind("userTeamJsonMysql") String userTeamJsonMysql,
        @Bind("username") String username,
        @Bind("limit") int limit,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT id FROM <tableName> WHERE type = 'Conversation' AND createdAt < :cutoffMillis LIMIT :batchSize")
    List<UUID> fetchConversationThreadIdsOlderThan(
        @Define("tableName") String tableName,
        @Bind("cutoffMillis") long cutoffMillis,
        @Bind("batchSize") int batchSize);

    @SqlQuery(
        "SELECT id FROM thread_entity WHERE type = 'Conversation' AND createdAt < :cutoffMillis LIMIT :batchSize")
    List<UUID> fetchConversationThreadIdsOlderThan(
        @Bind("cutoffMillis") long cutoffMillis, @Bind("batchSize") int batchSize);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(id) FROM <tableName> <condition> "
                + "AND (to_tsvector('simple', taskAssigneesIds) @@ to_tsquery('simple', :userTeamJsonPostgres)  OR createdBy = :username) ",
        connectionType = POSTGRES)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(id) FROM <tableName> <condition> "
                + "AND (MATCH(taskAssigneesIds) AGAINST (:userTeamJsonMysql IN BOOLEAN MODE) OR createdBy = :username) ",
        connectionType = MYSQL)
    int listCountTasksOfUser(
        @Define("tableName") String tableName,
        @Bind("userTeamJsonPostgres") String userTeamJsonPostgres,
        @Bind("userTeamJsonMysql") String userTeamJsonMysql,
        @Bind("username") String username,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT json FROM <tableName> <condition> AND createdBy = :username ORDER BY createdAt DESC LIMIT :limit")
    List<String> listTasksAssignedByUser(
        @Define("tableName") String tableName,
        @Bind("username") String username,
        @Bind("limit") int limit,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT json FROM thread_entity <condition> AND createdBy = :username ORDER BY createdAt DESC LIMIT :limit")
    List<String> listTasksAssigned(
        @Bind("username") String username,
        @Bind("limit") int limit,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery("SELECT count(id) FROM <tableName> <condition> AND createdBy = :username")
    int listCountTasksAssignedBy(
        @Define("tableName") String tableName,
        @Bind("username") String username,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery("SELECT count(id) FROM thread_entity <condition> AND createdBy = :username")
    int listCountTasksAssignedBy(
        @Bind("username") String username,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        "SELECT json FROM <tableName> <condition> AND "
            // Entity for which the thread is about is owned by the user or his teams
            + "(entityId in (SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation=8) OR "
            + "id in (SELECT toId FROM entity_relationship WHERE (fromEntity='user' AND fromId= :userId AND toEntity='THREAD' AND relation IN (1,2)))) "
            + "ORDER BY createdAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByOwner(
        @Define("tableName") String tableName,
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("limit") int limit,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT count(id) FROM <tableName> <condition> AND "
            + "(entityId in (SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation=8) OR "
            + "id in (SELECT toId FROM entity_relationship WHERE (fromEntity='user' AND fromId= :userId AND toEntity='THREAD' AND relation IN (1,2)))) ")
    int listCountThreadsByOwner(
        @Define("tableName") String tableName,
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT count(id) FROM thread_entity <condition> AND "
            + "(entityId in (SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation=8) OR "
            + "id in (SELECT toId FROM entity_relationship WHERE (fromEntity='user' AND fromId= :userId AND toEntity='THREAD' AND relation IN (1,2)))) ")
    int listCountThreadsByOwner(
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery(
        value =
            "SELECT json "
                + " FROM <tableName> "
                + " WHERE testCaseResolutionStatusId = :testCaseResolutionStatusId")
    String fetchThreadByTestCaseResolutionStatusId(
        @Define("tableName") String tableName,
        @BindUUID("testCaseResolutionStatusId") UUID testCaseResolutionStatusId);

    @SqlQuery(
        value =
            "SELECT json "
                + " FROM thread_entity "
                + " WHERE testCaseResolutionStatusId = :testCaseResolutionStatusId")
    String fetchThreadByTestCaseResolutionStatusId(
        @BindUUID("testCaseResolutionStatusId") UUID testCaseResolutionStatusId);

    default List<String> listThreadsByEntityLink(
        String tableName,
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
          tableName,
          entityLink.getFullyQualifiedFieldValue(),
          entityLink.getFullyQualifiedFieldType(),
          limit,
          relation,
          userName,
          teamNames,
          filterRelation,
          filter.getCondition(),
          filter.getQueryParams());
    }

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
          filter.getCondition(),
          filter.getQueryParams());
    }

    @SqlQuery(
        "SELECT json FROM <tableName> <condition> "
            + "AND hash_id in (SELECT fromFQNHash FROM field_relationship WHERE "
            + "(:fqnPrefixHash IS NULL OR toFQNHash LIKE :concatFqnPrefixHash OR toFQNHash=:fqnPrefixHash) AND fromType='THREAD' AND "
            + "(:toType IS NULL OR toType LIKE :concatToType OR toType=:toType) AND relation= :relation) "
            + "AND (:userName IS NULL OR MD5(id) in (SELECT toFQNHash FROM field_relationship WHERE "
            + " ((fromType='user' AND fromFQNHash= :userName) OR"
            + " (fromType='team' AND fromFQNHash IN (<teamNames>))) AND toType='THREAD' AND relation= :filterRelation) )"
            + "ORDER BY createdAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByEntityLink(
        @Define("tableName") String tableName,
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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    default int listCountThreadsByEntityLink(
        String tableName,
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
          tableName,
          entityLink.getFullyQualifiedFieldValue(),
          entityLink.getFullyQualifiedFieldType(),
          relation,
          userName,
          teamNames,
          filterRelation,
          filter.getCondition(false),
          filter.getQueryParams());
    }

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
          filter.getCondition(false),
          filter.getQueryParams());
    }

    @SqlQuery(
        "SELECT count(id) FROM <tableName> <condition> "
            + "AND hash_id in (SELECT fromFQNHash FROM field_relationship WHERE "
            + "(:fqnPrefixHash IS NULL OR toFQNHash LIKE :concatFqnPrefixHash OR toFQNHash=:fqnPrefixHash) AND fromType='THREAD' AND "
            + "(:toType IS NULL OR toType LIKE :concatToType OR toType=:toType) AND relation= :relation) "
            + "AND (:userName IS NULL OR id in (SELECT toFQNHash FROM field_relationship WHERE "
            + " ((fromType='user' AND fromFQNHash= :userName) OR"
            + " (fromType='team' AND fromFQNHash IN (<teamNames>))) AND toType='THREAD' AND relation= :filterRelation) )")
    int listCountThreadsByEntityLink(
        @Define("tableName") String tableName,
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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE <tableName> SET json = :json where id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE <tableName> SET json = (:json :: jsonb) where id = :id",
        connectionType = POSTGRES)
    void update(
        @Define("tableName") String tableName, @BindUUID("id") UUID id, @Bind("json") String json);

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
            + "    FROM <tableName> te "
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
            + "    FROM <tableName> te "
            + "    WHERE te.entityId = :entityId "
            + ") AS combined WHERE combined.type IS NOT NULL "
            + "GROUP BY type, taskStatus, entityLink")
    @RegisterRowMapper(ThreadCountFieldMapper.class)
    List<List<String>> listCountByEntityLink(
        @Define("tableName") String tableName,
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
                + "FROM <tableName> te "
                + "WHERE te.type = 'Announcement' "
                + "  AND te.entityLink = :entityLink "
                + "  AND CAST(JSON_EXTRACT(te.json, '$.announcement.startTime') AS UNSIGNED) <= UNIX_TIMESTAMP()*1000 "
                + "  AND CAST(JSON_EXTRACT(te.json, '$.announcement.endTime') AS UNSIGNED) >= UNIX_TIMESTAMP()*1000",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(te.id) AS count "
                + "FROM <tableName> te "
                + "WHERE te.type = 'Announcement' "
                + "  AND te.entityLink = :entityLink "
                + "  AND (te.json->'announcement'->>'startTime')::numeric <= EXTRACT(EPOCH FROM NOW()) * 1000 "
                + "  AND (te.json->'announcement'->>'endTime')::numeric >= EXTRACT(EPOCH FROM NOW()) * 1000",
        connectionType = POSTGRES)
    int countActiveAnnouncement(
        @Define("tableName") String tableName, @Bind("entityLink") String entityLink);

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
                + "    FROM <tableName> te "
                + "    JOIN entity_relationship er ON te.entityId = er.toId "
                + "    WHERE "
                + "        (er.fromEntity = 'user' AND er.fromId = :userId AND er.relation = 8 AND te.type <> 'Task') "
                + "        OR (er.fromEntity = 'team' AND er.fromId IN (<teamIds>) AND er.relation = 8  AND te.type <> 'Task') "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM <tableName> te "
                + "    JOIN entity_relationship er ON te.id = er.toId "
                + "    WHERE "
                + "        er.fromEntity = 'user' AND er.fromId = :userId AND er.toEntity = 'THREAD' AND er.relation IN (1, 2) "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM <tableName> te "
                + "    JOIN entity_relationship er ON te.id = er.toId "
                + "    WHERE "
                + "        (er.fromEntity = 'user' AND er.fromId = :userId AND er.relation = 11) "
                + "        OR (er.fromEntity = 'team' AND er.fromId IN (<teamIds>) AND er.relation = 11) "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM <tableName> te "
                + "    WHERE te.createdBy = :username "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM <tableName> te "
                + "    WHERE MATCH(te.taskAssigneesIds) AGAINST (:userTeamJsonMysql IN BOOLEAN MODE) "
                + ") AS combined WHERE combined.type is not NULL "
                + "GROUP BY combined.type, combined.taskStatus;",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT combined.type, combined.taskStatus, COUNT(combined.id) AS count "
                + "FROM ( "
                + "    SELECT te.type, te.taskStatus, te.id  "
                + "    FROM <tableName> te "
                + "    JOIN entity_relationship er ON te.entityId = er.toId "
                + "    WHERE "
                + "        (er.fromEntity = 'user' AND er.fromId = :userId AND er.relation = 8 AND te.type <> 'Task') "
                + "        OR (er.fromEntity = 'team' AND er.fromId IN (<teamIds>) AND er.relation = 8 AND te.type <> 'Task') "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM <tableName> te "
                + "    JOIN entity_relationship er ON te.id = er.toId "
                + "    WHERE "
                + "        er.fromEntity = 'user' AND er.fromId = :userId AND er.toEntity = 'THREAD' AND er.relation IN (1, 2) "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM <tableName> te "
                + "    JOIN entity_relationship er ON te.id = er.toId "
                + "    WHERE "
                + "        (er.fromEntity = 'user' AND er.fromId = :userId AND er.relation = 11) "
                + "        OR (er.fromEntity = 'team' AND er.fromId IN (<teamIds>) AND er.relation = 11) "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM <tableName> te "
                + "    WHERE te.createdBy = :username "
                + "    UNION "
                + "    SELECT te.type, te.taskStatus, te.id "
                + "    FROM <tableName> te "
                + "    WHERE to_tsvector('simple', taskAssigneesIds) @@ to_tsquery('simple', :userTeamJsonPostgres) "
                + ") AS combined WHERE combined.type is not NULL "
                + "GROUP BY combined.type, combined.taskStatus;",
        connectionType = POSTGRES)
    @RegisterRowMapper(OwnerCountFieldMapper.class)
    List<List<String>> listCountByOwner(
        @Define("tableName") String tableName,
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("username") String username,
        @Bind("userTeamJsonMysql") String userTeamJsonMysql,
        @Bind("userTeamJsonPostgres") String userTeamJsonPostgres);

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
        "SELECT json FROM <tableName> <condition> AND "
            + "entityId in ("
            + "SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation= :relation) "
            + "ORDER BY createdAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByFollows(
        @Define("tableName") String tableName,
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("limit") int limit,
        @Bind("relation") int relation,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT count(id) FROM <tableName> <condition> AND "
            + "entityId in ("
            + "SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation= :relation)")
    int listCountThreadsByFollows(
        @Define("tableName") String tableName,
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("relation") int relation,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT json FROM ( "
            + "    SELECT json, createdAt FROM <tableName> te "
            + "     <condition> AND entityId IN ( "
            + "        SELECT toId FROM entity_relationship er "
            + "        WHERE er.relation = 8 "
            + "        AND ( "
            + "            (er.fromEntity = 'user' AND er.fromId = :userId) "
            + "            OR (er.fromEntity = 'team' AND er.fromId IN (<teamIds>)) "
            + "        ) "
            + "    )  "
            + "    UNION   "
            + "    SELECT json, createdAt FROM <tableName> te  "
            + "     <condition> AND id IN ( "
            + "        SELECT toId FROM entity_relationship er  "
            + "        WHERE er.toEntity = 'THREAD'  "
            + "        AND er.relation IN (1, 2)  "
            + "        AND er.fromEntity = 'user'  "
            + "        AND er.fromId = :userId  "
            + "    )  "
            + "    UNION   "
            + "    SELECT json, createdAt FROM <tableName> te  "
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
        @Define("tableName") String tableName,
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("limit") int limit,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT COUNT(id) FROM ( "
            + "    SELECT te.id FROM <tableName> te  "
            + "     <condition> AND entityId IN ( "
            + "        SELECT toId FROM entity_relationship er  "
            + "        WHERE er.relation = 8  "
            + "        AND ( "
            + "            (er.fromEntity = 'user' AND er.fromId = :userId) "
            + "            OR (er.fromEntity = 'team' AND er.fromId IN (<teamIds>)) "
            + "        ) "
            + "    )  "
            + "    UNION   "
            + "    SELECT te.id FROM <tableName> te  "
            + "     <condition> AND id IN ( "
            + "        SELECT toId FROM entity_relationship er  "
            + "        WHERE er.toEntity = 'THREAD'  "
            + "        AND er.relation IN (1, 2)  "
            + "        AND er.fromEntity = 'user'  "
            + "        AND er.fromId = :userId  "
            + "    )  "
            + "    UNION   "
            + "    SELECT te.id FROM <tableName> te  "
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
        @Define("tableName") String tableName,
        @BindUUID("userId") UUID userId,
        @BindList("teamIds") List<String> teamIds,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT json FROM <tableName> <condition> AND "
            + "hash_id in ("
            + "SELECT toFQNHash FROM field_relationship WHERE "
            + "((fromType='user' AND fromFQNHash= :userName) OR "
            + "(fromType='team' AND fromFQNHash IN (<teamNames>)))  AND toType='THREAD' AND relation= :relation) "
            + "ORDER BY createdAt DESC "
            + "LIMIT :limit")
    List<String> listThreadsByMentions(
        @Define("tableName") String tableName,
        @Bind("userName") String userName,
        @BindList("teamNames") List<String> teamNames,
        @Bind("limit") int limit,
        @Bind("relation") int relation,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT count(id) FROM <tableName> <condition> AND "
            + "hash_id in ("
            + "SELECT toFQNHash FROM field_relationship WHERE "
            + "((fromType='user' AND fromFQNHash= :userName) OR "
            + "(fromType='team' AND fromFQNHash IN (<teamNames>)))  AND toType='THREAD' AND relation= :relation) ")
    int listCountThreadsByMentions(
        @Define("tableName") String tableName,
        @Bind("userName") String userName,
        @BindList("teamNames") List<String> teamNames,
        @Bind("relation") int relation,
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT json FROM <tableName> <condition> "
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
        @Define("tableName") String tableName,
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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

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
        @Define("condition") String condition,
        @BindMap Map<String, String> params);

    default List<List<String>> listCountThreadsByGlossaryAndTerms(
        String tableName, EntityLink entityLink, EntityReference reference) {
      EntityLink glossaryTermLink =
          new EntityLink(GLOSSARY_TERM, entityLink.getFullyQualifiedFieldValue());
      return listCountThreadsByGlossaryAndTerms(
          tableName,
          reference.getId(),
          reference.getFullyQualifiedName(),
          entityLink.getFullyQualifiedFieldType(),
          glossaryTermLink.getFullyQualifiedFieldType());
    }

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
      return listThreadsByTaskAssigneesId("%" + taskAssigneesId + "%");
    }

    @SqlQuery("SELECT json FROM <tableName> WHERE taskAssigneesIds LIKE :taskAssigneesPattern")
    List<String> listThreadsByTaskAssigneesId(
        @Define("tableName") String tableName,
        @Bind("taskAssigneesPattern") String taskAssigneesPattern);

    @SqlQuery("SELECT json FROM thread_entity WHERE taskAssigneesIds LIKE :taskAssigneesPattern")
    List<String> listThreadsByTaskAssigneesId(
        @Bind("taskAssigneesPattern") String taskAssigneesPattern);

    @SqlQuery(
        "SELECT entityLink, type, taskStatus, COUNT(id) as count "
            + "FROM ( "
            + "    SELECT te.entityLink, te.type, te.taskStatus, te.id "
            + "    FROM <tableName> te "
            + "    WHERE te.entityId = :entityId "
            + "    UNION "
            + "    SELECT te.entityLink, te.type, te.taskStatus, te.id "
            + "    FROM <tableName> te "
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
            + "    FROM <tableName> te "
            + "    WHERE te.type = 'Task' "
            + "    AND te.hash_id IN ( "
            + "        SELECT fr.fromFQNHash "
            + "        FROM field_relationship fr "
            + "        JOIN <tableName> te2 ON te2.hash_id = fr.fromFQNHash WHERE fr.fromFQNHash = te.hash_id AND te2.type = 'Task' "
            + "        AND (:fqnPrefixHash IS NULL OR fr.toFQNHash LIKE :concatFqnPrefixHash OR fr.toFQNHash = :fqnPrefixHash) "
            + "        AND fr.fromType = 'THREAD' "
            + "        AND (:toType2 IS NULL OR fr.toType LIKE :concatToType2 OR fr.toType = :toType2) "
            + "        AND fr.relation = 3 "
            + "    ) "
            + ") AS combined_results WHERE combined_results.type is not NULL "
            + "GROUP BY entityLink, type, taskStatus ")
    @RegisterRowMapper(ThreadCountFieldMapper.class)
    List<List<String>> listCountThreadsByGlossaryAndTerms(
        @Define("tableName") String tableName,
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

    @SqlQuery("select id from <tableName> where entityId = :entityId")
    List<String> findByEntityId(
        @Define("tableName") String tableName, @Bind("entityId") String entityId);

    @SqlQuery("select id from thread_entity where entityId = :entityId")
    List<String> findByEntityId(@Bind("entityId") String entityId);

    // DISTINCT is defence-in-depth: thread_entity.id is a primary key, and entityId is a
    // single-valued column per row, so a single matching scan can't physically return the
    // same id twice. The DISTINCT survives a future schema where a thread row picks up
    // multiple entity references (or a join is added) — keeping the consumer code in
    // deleteByAbout from re-issuing redundant relationship / extension / feed deletes for
    // the same id under chunking.
    @SqlQuery("select DISTINCT id from <tableName> where entityId IN (<entityIds>)")
    List<String> findByEntityIds(
        @Define("tableName") String tableName, @BindList("entityIds") List<String> entityIds);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE <tableName> SET json = JSON_SET(json, '$.about', :newEntityLink)\n"
                + "WHERE entityId = :entityId",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE <tableName> SET json = jsonb_set(json, '{about}', to_jsonb(:newEntityLink::text), false)\n"
                + "WHERE entityId = :entityId",
        connectionType = POSTGRES)
    void updateByEntityId(
        @Define("tableName") String tableName,
        @Bind("newEntityLink") String newEntityLink,
        @Bind("entityId") String entityId);

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
        @Bind("id") String id, @Bind("json") String json, @BindFQN("fqnHash") String fqn);

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
    void updateTask(@Bind("id") String id, @Bind("json") String json);

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
        // 'Approved' double-counts in `completedCount` AND `approvedCount` because the
        // same status means different things across task types: terminal for
        // Glossary/DescriptionUpdate (legacy dashboards expect it under "completed") and
        // non-terminal for Data Access Requests (the dedicated DAR list uses
        // `approvedCount` / `grantedCount` and the `active` status group instead).
        // See ListFilter.getTaskStatusCondition for the matching status-group semantics.
        "SELECT "
            + "COUNT(id) AS total, "
            + "COALESCE(SUM(CASE WHEN status IN ('Open', 'InProgress', 'Pending') THEN 1 ELSE 0 END), 0) AS openCount, "
            + "COALESCE(SUM(CASE WHEN status IN ('Approved', 'Rejected', 'Completed', 'Cancelled', 'Failed', 'Revoked') THEN 1 ELSE 0 END), 0) AS completedCount, "
            + "COALESCE(SUM(CASE WHEN status = 'InProgress' THEN 1 ELSE 0 END), 0) AS inProgressCount, "
            + "COALESCE(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END), 0) AS approvedCount, "
            + "COALESCE(SUM(CASE WHEN status = 'Granted' THEN 1 ELSE 0 END), 0) AS grantedCount "
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
        @Bind("id") String id, @Bind("json") String json, @BindFQN("fqnHash") String fqn);

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
        @Bind("id") String id, @Bind("json") String json, @BindFQN("fqnHash") String fqn);

    @Override
    default void insert(org.openmetadata.schema.EntityInterface entity, String fqn) {
      TaskFormSchema schema = (TaskFormSchema) entity;
      insertTaskFormSchema(
          schema.getId().toString(), JsonUtils.pojoToJson(schema), schema.getFullyQualifiedName());
    }
  }
}
