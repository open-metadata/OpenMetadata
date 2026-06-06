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
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindBean;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.BindMethods;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.service.audit.AuditLogRecord;
import org.openmetadata.service.audit.AuditLogRecordMapper;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlBatch;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;

public interface ActivityAuditDAOs {
  @CreateSqlObject
  ActivityStreamDAO activityStreamDAO();

  @CreateSqlObject
  ActivityStreamConfigDAO activityStreamConfigDAO();

  @CreateSqlObject
  AuditLogDAO auditLogDAO();

  interface ActivityStreamDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO activity_stream(id, eventType, entityType, entityId, entityFqnHash, "
                + "about, aboutFqnHash, actorId, actorName, timestamp, summary, fieldName, oldValue, newValue, domains, json) "
                + "VALUES (:id, :eventType, :entityType, :entityId, :entityFqnHash, "
                + ":about, :aboutFqnHash, :actorId, :actorName, :timestamp, :summary, :fieldName, :oldValue, :newValue, :domains, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO activity_stream(id, eventtype, entitytype, entityid, entityfqnhash, "
                + "about, aboutfqnhash, actorid, actorname, timestamp, summary, fieldname, oldvalue, newvalue, domains, json) "
                + "VALUES (:id, :eventType, :entityType, :entityId, :entityFqnHash, "
                + ":about, :aboutFqnHash, :actorId, :actorName, :timestamp, :summary, :fieldName, :oldValue, :newValue, :domains::jsonb, :json::jsonb)",
        connectionType = POSTGRES)
    void insert(
        @Bind("id") String id,
        @Bind("eventType") String eventType,
        @Bind("entityType") String entityType,
        @Bind("entityId") String entityId,
        @Bind("entityFqnHash") String entityFqnHash,
        @Bind("about") String about,
        @Bind("aboutFqnHash") String aboutFqnHash,
        @Bind("actorId") String actorId,
        @Bind("actorName") String actorName,
        @Bind("timestamp") long timestamp,
        @Bind("summary") String summary,
        @Bind("fieldName") String fieldName,
        @Bind("oldValue") String oldValue,
        @Bind("newValue") String newValue,
        @Bind("domains") String domains,
        @Bind("json") String json);

    // Batch insert for activity events - one round-trip per change event instead of one per row
    @Transaction
    @ConnectionAwareSqlBatch(
        value =
            "INSERT INTO activity_stream(id, eventType, entityType, entityId, entityFqnHash, "
                + "about, aboutFqnHash, actorId, actorName, timestamp, summary, fieldName, oldValue, newValue, domains, json) "
                + "VALUES (:id, :eventType, :entityType, :entityId, :entityFqnHash, "
                + ":about, :aboutFqnHash, :actorId, :actorName, :timestamp, :summary, :fieldName, :oldValue, :newValue, :domains, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlBatch(
        value =
            "INSERT INTO activity_stream(id, eventtype, entitytype, entityid, entityfqnhash, "
                + "about, aboutfqnhash, actorid, actorname, timestamp, summary, fieldname, oldvalue, newvalue, domains, json) "
                + "VALUES (:id, :eventType, :entityType, :entityId, :entityFqnHash, "
                + ":about, :aboutFqnHash, :actorId, :actorName, :timestamp, :summary, :fieldName, :oldValue, :newValue, :domains::jsonb, :json::jsonb)",
        connectionType = POSTGRES)
    void insertBatch(@BindMethods List<SearchReindexDAOs.ActivityStreamRow> rows);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE timestamp >= :after "
                + "ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE timestamp >= :after "
                + "ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = POSTGRES)
    List<String> list(@Bind("after") long after, @Bind("limit") int limit);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE entityType = :entityType AND entityId = :entityId "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE entitytype = :entityType AND entityid = :entityId "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listByEntity(
        @Bind("entityType") String entityType,
        @Bind("entityId") String entityId,
        @Bind("after") long after,
        @Bind("limit") int limit);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE entityType = :entityType "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE entitytype = :entityType "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listByEntityType(
        @Bind("entityType") String entityType, @Bind("after") long after, @Bind("limit") int limit);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE actorId = :actorId "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE actorid = :actorId "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listByActor(
        @Bind("actorId") String actorId, @Bind("after") long after, @Bind("limit") int limit);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE actorId = :actorId "
                + "AND JSON_OVERLAPS(domains, :domainJson) "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE actorid = :actorId "
                + "AND EXISTS ("
                + "SELECT 1 FROM jsonb_array_elements_text(domains) AS domain_id "
                + "WHERE domain_id IN (<domainIds>)) "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listByActorAndDomains(
        @Bind("actorId") String actorId,
        @Bind("domainJson") String domainJson,
        @BindList("domainIds") List<String> domainIds,
        @Bind("after") long after,
        @Bind("limit") int limit);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE JSON_OVERLAPS(domains, :domainJson) "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE EXISTS ("
                + "SELECT 1 FROM jsonb_array_elements_text(domains) AS domain_id "
                + "WHERE domain_id IN (<domainIds>)) "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listByDomains(
        @Bind("domainJson") String domainJson,
        @BindList("domainIds") List<String> domainIds,
        @Bind("after") long after,
        @Bind("limit") int limit);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE entityType = :entityType AND entityId = :entityId "
                + "AND JSON_OVERLAPS(domains, :domainJson) "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE entitytype = :entityType AND entityid = :entityId "
                + "AND EXISTS ("
                + "SELECT 1 FROM jsonb_array_elements_text(domains) AS domain_id "
                + "WHERE domain_id IN (<domainIds>)) "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listByEntityAndDomains(
        @Bind("entityType") String entityType,
        @Bind("entityId") String entityId,
        @Bind("domainJson") String domainJson,
        @BindList("domainIds") List<String> domainIds,
        @Bind("after") long after,
        @Bind("limit") int limit);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE entityType = :entityType "
                + "AND JSON_OVERLAPS(domains, :domainJson) "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE entitytype = :entityType "
                + "AND EXISTS ("
                + "SELECT 1 FROM jsonb_array_elements_text(domains) AS domain_id "
                + "WHERE domain_id IN (<domainIds>)) "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listByEntityTypeAndDomains(
        @Bind("entityType") String entityType,
        @Bind("domainJson") String domainJson,
        @BindList("domainIds") List<String> domainIds,
        @Bind("after") long after,
        @Bind("limit") int limit);

    @ConnectionAwareSqlQuery(
        value = "SELECT count(*) FROM activity_stream WHERE timestamp >= :after",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT count(*) FROM activity_stream WHERE timestamp >= :after",
        connectionType = POSTGRES)
    int count(@Bind("after") long after);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM activity_stream WHERE JSON_OVERLAPS(domains, :domainJson) "
                + "AND timestamp >= :after",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM activity_stream WHERE EXISTS ("
                + "SELECT 1 FROM jsonb_array_elements_text(domains) AS domain_id "
                + "WHERE domain_id IN (<domainIds>)) "
                + "AND timestamp >= :after",
        connectionType = POSTGRES)
    int countByDomains(
        @Bind("domainJson") String domainJson,
        @BindList("domainIds") List<String> domainIds,
        @Bind("after") long after);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM activity_stream WHERE entityType = :entityType AND entityId = :entityId "
                + "AND timestamp >= :after",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM activity_stream WHERE entitytype = :entityType AND entityid = :entityId "
                + "AND timestamp >= :after",
        connectionType = POSTGRES)
    int countByEntity(
        @Bind("entityType") String entityType,
        @Bind("entityId") String entityId,
        @Bind("after") long after);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM activity_stream WHERE entityType = :entityType AND entityId = :entityId "
                + "AND JSON_OVERLAPS(domains, :domainJson) "
                + "AND timestamp >= :after",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM activity_stream WHERE entitytype = :entityType AND entityid = :entityId "
                + "AND EXISTS ("
                + "SELECT 1 FROM jsonb_array_elements_text(domains) AS domain_id "
                + "WHERE domain_id IN (<domainIds>)) "
                + "AND timestamp >= :after",
        connectionType = POSTGRES)
    int countByEntityAndDomains(
        @Bind("entityType") String entityType,
        @Bind("entityId") String entityId,
        @Bind("domainJson") String domainJson,
        @BindList("domainIds") List<String> domainIds,
        @Bind("after") long after);

    @SqlUpdate("DELETE FROM activity_stream WHERE timestamp < :cutoff")
    int deleteOlderThan(@Bind("cutoff") long cutoffTimestamp);

    @SqlQuery("SELECT json FROM activity_stream WHERE id = :id")
    String findById(@Bind("id") String id);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE activity_stream SET json = :json WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE activity_stream SET json = :json::jsonb WHERE id = :id",
        connectionType = POSTGRES)
    void updateJson(@Bind("id") String id, @Bind("json") String json);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE entityId IN ("
                + "SELECT toId FROM entity_relationship WHERE relation = 8 "
                + "AND ((fromEntity = 'user' AND fromId = :userId) "
                + "OR (fromEntity = 'team' AND fromId IN (<teamIds>)))) "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE entityid IN ("
                + "SELECT toid FROM entity_relationship WHERE relation = 8 "
                + "AND ((fromentity = 'user' AND fromid = :userId) "
                + "OR (fromentity = 'team' AND fromid IN (<teamIds>)))) "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listByOwners(
        @Bind("userId") String userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("after") long after,
        @Bind("limit") int limit);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE entityId IN ("
                + "SELECT toId FROM entity_relationship WHERE relation = 8 "
                + "AND ((fromEntity = 'user' AND fromId = :userId) "
                + "OR (fromEntity = 'team' AND fromId IN (<teamIds>)))) "
                + "AND JSON_OVERLAPS(domains, :domainJson) "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE entityid IN ("
                + "SELECT toid FROM entity_relationship WHERE relation = 8 "
                + "AND ((fromentity = 'user' AND fromid = :userId) "
                + "OR (fromentity = 'team' AND fromid IN (<teamIds>)))) "
                + "AND EXISTS ("
                + "SELECT 1 FROM jsonb_array_elements_text(domains) AS domain_id "
                + "WHERE domain_id IN (<domainIds>)) "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listByOwnersAndDomains(
        @Bind("userId") String userId,
        @BindList("teamIds") List<String> teamIds,
        @Bind("domainJson") String domainJson,
        @BindList("domainIds") List<String> domainIds,
        @Bind("after") long after,
        @Bind("limit") int limit);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE aboutFqnHash = :aboutFqnHash "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE aboutfqnhash = :aboutFqnHash "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listByAbout(
        @Bind("aboutFqnHash") String aboutFqnHash,
        @Bind("after") long after,
        @Bind("limit") int limit);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE aboutFqnHash = :aboutFqnHash "
                + "AND JSON_OVERLAPS(domains, :domainJson) "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM activity_stream WHERE aboutfqnhash = :aboutFqnHash "
                + "AND EXISTS ("
                + "SELECT 1 FROM jsonb_array_elements_text(domains) AS domain_id "
                + "WHERE domain_id IN (<domainIds>)) "
                + "AND timestamp >= :after ORDER BY timestamp DESC, id DESC LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listByAboutAndDomains(
        @Bind("aboutFqnHash") String aboutFqnHash,
        @Bind("domainJson") String domainJson,
        @BindList("domainIds") List<String> domainIds,
        @Bind("after") long after,
        @Bind("limit") int limit);
  }

  interface ActivityStreamConfigDAO {
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO activity_stream_config(id, json) VALUES (:id, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO activity_stream_config(id, json) VALUES (:id, :json::jsonb)",
        connectionType = POSTGRES)
    void insert(@Bind("id") String id, @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE activity_stream_config SET json = :json WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE activity_stream_config SET json = :json::jsonb WHERE id = :id",
        connectionType = POSTGRES)
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM activity_stream_config WHERE id = :id")
    String findById(@Bind("id") String id);

    @ConnectionAwareSqlQuery(
        value = "SELECT json FROM activity_stream_config WHERE domainId = :domainId",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT json FROM activity_stream_config WHERE domainid = :domainId",
        connectionType = POSTGRES)
    String findByDomainId(@Bind("domainId") String domainId);

    @SqlQuery("SELECT json FROM activity_stream_config WHERE scope = 'global' LIMIT 1")
    String findGlobalConfig();

    @SqlQuery("SELECT json FROM activity_stream_config")
    List<String> listAll();

    @SqlUpdate("DELETE FROM activity_stream_config WHERE id = :id")
    void delete(@Bind("id") String id);
  }

  @RegisterRowMapper(AuditLogRecordMapper.class)
  interface AuditLogDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO audit_log_event(change_event_id, event_ts, event_type, user_name, "
                + "actor_type, impersonated_by, service_name, "
                + "entity_type, entity_id, entity_fqn, entity_fqn_hash, event_json, search_text, created_at) "
                + "VALUES (:changeEventId::uuid, :eventTs, :eventType, :userName, "
                + ":actorType, :impersonatedBy, :serviceName, "
                + ":entityType, :entityId::uuid, :entityFQN, :entityFQNHash, :eventJson, :searchText, :createdAt) "
                + "ON CONFLICT (change_event_id) DO NOTHING",
        connectionType = POSTGRES)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO audit_log_event(change_event_id, event_ts, event_type, user_name, "
                + "actor_type, impersonated_by, service_name, "
                + "entity_type, entity_id, entity_fqn, entity_fqn_hash, event_json, search_text, created_at) "
                + "VALUES (:changeEventId, :eventTs, :eventType, :userName, "
                + ":actorType, :impersonatedBy, :serviceName, "
                + ":entityType, :entityId, :entityFQN, :entityFQNHash, :eventJson, :searchText, :createdAt)",
        connectionType = MYSQL)
    void insert(@BindBean AuditLogRecord record);

    @SqlQuery(
        "SELECT id, change_event_id, event_ts, event_type, user_name, "
            + "actor_type, impersonated_by, service_name, "
            + "entity_type, entity_id, entity_fqn, entity_fqn_hash, event_json, search_text, created_at "
            + "FROM audit_log_event <condition> <orderClause> LIMIT :limit")
    List<AuditLogRecord> list(
        @Define("condition") String condition,
        @Define("orderClause") String orderClause,
        @Bind("userName") String userName,
        @Bind("actorType") String actorType,
        @Bind("serviceName") String serviceName,
        @Bind("entityType") String entityType,
        @Bind("entityFQN") String entityFQN,
        @Bind("entityFQNHASH") String entityFqnHash,
        @Bind("eventType") String eventType,
        @Bind("startTs") Long startTs,
        @Bind("endTs") Long endTs,
        @Bind("searchTerm") String searchTerm,
        @Bind("afterEventTs") Long afterEventTs,
        @Bind("afterId") Long afterId,
        @Bind("limit") int limit);

    @SqlQuery("SELECT COUNT(id) FROM audit_log_event <condition>")
    int count(
        @Define("condition") String condition,
        @Bind("userName") String userName,
        @Bind("actorType") String actorType,
        @Bind("serviceName") String serviceName,
        @Bind("entityType") String entityType,
        @Bind("entityFQN") String entityFQN,
        @Bind("entityFQNHASH") String entityFqnHash,
        @Bind("eventType") String eventType,
        @Bind("startTs") Long startTs,
        @Bind("endTs") Long endTs,
        @Bind("searchTerm") String searchTerm);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM audit_log_event "
                + "WHERE created_at < :cutoffTs ORDER BY created_at LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM audit_log_event "
                + "WHERE ctid IN ( "
                + "  SELECT ctid FROM audit_log_event "
                + "  WHERE created_at < :cutoffTs ORDER BY created_at LIMIT :limit "
                + ")",
        connectionType = POSTGRES)
    int deleteInBatches(@Bind("cutoffTs") long cutoffTs, @Bind("limit") int limit);
  }

  // OAuth 2.0 DAOs for MCP Server
}
