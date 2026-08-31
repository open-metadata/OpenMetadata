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
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindBean;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.statement.SqlBatch;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindJson;
import org.openmetadata.service.util.jdbi.BindUUID;

public interface RdfInfraDAOs {
  @CreateSqlObject
  OntologyStudioDAO ontologyStudioDAO();

  @CreateSqlObject
  RelationshipTypeDAO relationshipTypeDAO();

  @CreateSqlObject
  OntologyAxiomDAO ontologyAxiomDAO();

  @CreateSqlObject
  OntologyChangeSetDAO ontologyChangeSetDAO();

  @CreateSqlObject
  OntologyAnnexDAO ontologyAnnexDAO();

  @CreateSqlObject
  OntologyEditLockDAO ontologyEditLockDAO();

  @CreateSqlObject
  RdfInferenceRuleDAO rdfInferenceRuleDAO();

  @CreateSqlObject
  RdfCustomOntologyDAO rdfCustomOntologyDAO();

  @CreateSqlObject
  RdfIndexJobDAO rdfIndexJobDAO();

  @CreateSqlObject
  RdfIndexPartitionDAO rdfIndexPartitionDAO();

  @CreateSqlObject
  RdfReindexLockDAO rdfReindexLockDAO();

  @CreateSqlObject
  RdfIndexServerStatsDAO rdfIndexServerStatsDAO();

  @CreateSqlObject
  RdfIndexFailureDAO rdfIndexFailureDAO();

  @CreateSqlObject
  RdfActiveDatasetDAO rdfActiveDatasetDAO();

  record OntologyAnnexRow(
      UUID glossaryId,
      long revision,
      String canonicalNQuads,
      String checksum,
      String source,
      String createdBy,
      long createdAt) {}

  record OntologyEditLockRow(
      String resourceType,
      UUID resourceId,
      UUID holderId,
      String sessionId,
      long version,
      long acquiredAt,
      long renewedAt,
      long expiresAt) {}

  interface RelationshipTypeDAO extends EntityDAO<RelationshipType> {
    @Override
    default String getTableName() {
      return "relationship_type_entity";
    }

    @Override
    default Class<RelationshipType> getEntityClass() {
      return RelationshipType.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM relationship_type_entity "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.rdfPredicate')) = :predicate "
                + "AND deleted = FALSE LIMIT 1",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM relationship_type_entity "
                + "WHERE json->>'rdfPredicate' = :predicate AND deleted = FALSE LIMIT 1",
        connectionType = POSTGRES)
    String findByPredicate(@Bind("predicate") String predicate);

    @SqlQuery("SELECT json FROM relationship_type_entity WHERE deleted = FALSE ORDER BY name")
    List<String> listActive();
  }

  interface OntologyAxiomDAO extends EntityDAO<OntologyAxiom> {
    @Override
    default String getTableName() {
      return "ontology_axiom_entity";
    }

    @Override
    default Class<OntologyAxiom> getEntityClass() {
      return OntologyAxiom.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(*) FROM ontology_axiom_entity "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.subjectIri')) = :iri "
                + "AND axiomType IN ('SUBCLASS_OF', 'EQUIVALENT_CLASS', 'DISJOINT_WITH') "
                + "AND deleted = FALSE",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(*) FROM ontology_axiom_entity WHERE json->>'subjectIri' = :iri "
                + "AND axiomType IN ('SUBCLASS_OF', 'EQUIVALENT_CLASS', 'DISJOINT_WITH') "
                + "AND deleted = FALSE",
        connectionType = POSTGRES)
    int countClassSubjects(@Bind("iri") String iri);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(*) FROM ontology_axiom_entity "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.subjectIri')) = :iri "
                + "AND axiomType = 'CLASS_ASSERTION' AND deleted = FALSE",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(*) FROM ontology_axiom_entity WHERE json->>'subjectIri' = :iri "
                + "AND axiomType = 'CLASS_ASSERTION' AND deleted = FALSE",
        connectionType = POSTGRES)
    int countIndividualSubjects(@Bind("iri") String iri);
  }

  interface OntologyChangeSetDAO extends EntityDAO<OntologyChangeSet> {
    @Override
    default String getTableName() {
      return "ontology_change_set_entity";
    }

    @Override
    default Class<OntologyChangeSet> getEntityClass() {
      return OntologyChangeSet.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface OntologyAnnexDAO {
    @SqlUpdate(
        "INSERT INTO ontology_annex(glossaryId, revision, canonicalNQuads, checksum, source, "
            + "createdBy, createdAt) VALUES (:glossaryId, :revision, :canonicalNQuads, "
            + ":checksum, :source, :createdBy, :createdAt)")
    void insert(
        @BindUUID("glossaryId") UUID glossaryId,
        @Bind("revision") long revision,
        @Bind("canonicalNQuads") String canonicalNQuads,
        @Bind("checksum") String checksum,
        @Bind("source") String source,
        @Bind("createdBy") String createdBy,
        @Bind("createdAt") long createdAt);

    default void insert(OntologyAnnexRow revision) {
      insert(
          revision.glossaryId(),
          revision.revision(),
          revision.canonicalNQuads(),
          revision.checksum(),
          revision.source(),
          revision.createdBy(),
          revision.createdAt());
    }

    @SqlQuery(
        "SELECT glossaryId, revision, canonicalNQuads, checksum, source, createdBy, createdAt "
            + "FROM ontology_annex WHERE glossaryId = :glossaryId ORDER BY revision DESC LIMIT 1")
    @RegisterRowMapper(OntologyAnnexRowMapper.class)
    OntologyAnnexRow findLatest(@BindUUID("glossaryId") UUID glossaryId);

    @SqlQuery(
        "SELECT glossaryId, revision, canonicalNQuads, checksum, source, createdBy, createdAt "
            + "FROM ontology_annex WHERE glossaryId = :glossaryId AND checksum = :checksum")
    @RegisterRowMapper(OntologyAnnexRowMapper.class)
    OntologyAnnexRow findByChecksum(
        @BindUUID("glossaryId") UUID glossaryId, @Bind("checksum") String checksum);

    @SqlQuery(
        "SELECT COALESCE(MAX(revision), 0) + 1 FROM ontology_annex "
            + "WHERE glossaryId = :glossaryId")
    long nextRevision(@BindUUID("glossaryId") UUID glossaryId);

    @SqlQuery(
        "SELECT glossaryId, revision, canonicalNQuads, checksum, source, createdBy, createdAt "
            + "FROM ontology_annex WHERE glossaryId = :glossaryId ORDER BY revision DESC "
            + "LIMIT :limit")
    @RegisterRowMapper(OntologyAnnexRowMapper.class)
    List<OntologyAnnexRow> list(@BindUUID("glossaryId") UUID glossaryId, @Bind("limit") int limit);

    class OntologyAnnexRowMapper implements RowMapper<OntologyAnnexRow> {
      @Override
      public OntologyAnnexRow map(ResultSet resultSet, StatementContext context)
          throws SQLException {
        return new OntologyAnnexRow(
            UUID.fromString(resultSet.getString("glossaryId")),
            resultSet.getLong("revision"),
            resultSet.getString("canonicalNQuads"),
            resultSet.getString("checksum"),
            resultSet.getString("source"),
            resultSet.getString("createdBy"),
            resultSet.getLong("createdAt"));
      }
    }
  }

  interface OntologyEditLockDAO {
    @SqlQuery(
        "SELECT resourceType, resourceId, holderId, sessionId, version, acquiredAt, renewedAt, "
            + "expiresAt FROM ontology_edit_lock WHERE resourceType = :resourceType "
            + "AND resourceId = :resourceId FOR UPDATE")
    @RegisterRowMapper(OntologyEditLockRowMapper.class)
    OntologyEditLockRow findForUpdate(
        @Bind("resourceType") String resourceType, @BindUUID("resourceId") UUID resourceId);

    @SqlQuery(
        "SELECT resourceType, resourceId, holderId, sessionId, version, acquiredAt, renewedAt, "
            + "expiresAt FROM ontology_edit_lock WHERE resourceType = :resourceType "
            + "AND resourceId = :resourceId")
    @RegisterRowMapper(OntologyEditLockRowMapper.class)
    OntologyEditLockRow find(
        @Bind("resourceType") String resourceType, @BindUUID("resourceId") UUID resourceId);

    @SqlUpdate(
        "INSERT INTO ontology_edit_lock(resourceType, resourceId, holderId, sessionId, version, "
            + "acquiredAt, renewedAt, expiresAt) VALUES (:resourceType, :resourceId, :holderId, "
            + ":sessionId, :version, :acquiredAt, :renewedAt, :expiresAt)")
    void insert(
        @Bind("resourceType") String resourceType,
        @BindUUID("resourceId") UUID resourceId,
        @BindUUID("holderId") UUID holderId,
        @Bind("sessionId") String sessionId,
        @Bind("version") long version,
        @Bind("acquiredAt") long acquiredAt,
        @Bind("renewedAt") long renewedAt,
        @Bind("expiresAt") long expiresAt);

    default void insert(OntologyEditLockRow lock) {
      insert(
          lock.resourceType(),
          lock.resourceId(),
          lock.holderId(),
          lock.sessionId(),
          lock.version(),
          lock.acquiredAt(),
          lock.renewedAt(),
          lock.expiresAt());
    }

    @SqlUpdate(
        "UPDATE ontology_edit_lock SET holderId = :holderId, sessionId = :sessionId, "
            + "version = :version, acquiredAt = :acquiredAt, renewedAt = :renewedAt, "
            + "expiresAt = :expiresAt WHERE resourceType = :resourceType "
            + "AND resourceId = :resourceId")
    void update(
        @Bind("resourceType") String resourceType,
        @BindUUID("resourceId") UUID resourceId,
        @BindUUID("holderId") UUID holderId,
        @Bind("sessionId") String sessionId,
        @Bind("version") long version,
        @Bind("acquiredAt") long acquiredAt,
        @Bind("renewedAt") long renewedAt,
        @Bind("expiresAt") long expiresAt);

    default void update(OntologyEditLockRow lock) {
      update(
          lock.resourceType(),
          lock.resourceId(),
          lock.holderId(),
          lock.sessionId(),
          lock.version(),
          lock.acquiredAt(),
          lock.renewedAt(),
          lock.expiresAt());
    }

    @SqlUpdate(
        "DELETE FROM ontology_edit_lock WHERE resourceType = :resourceType "
            + "AND resourceId = :resourceId AND holderId = :holderId AND sessionId = :sessionId")
    int delete(
        @Bind("resourceType") String resourceType,
        @BindUUID("resourceId") UUID resourceId,
        @BindUUID("holderId") UUID holderId,
        @Bind("sessionId") String sessionId);

    @SqlUpdate("DELETE FROM ontology_edit_lock WHERE expiresAt < :now")
    int deleteExpired(@Bind("now") long now);

    class OntologyEditLockRowMapper implements RowMapper<OntologyEditLockRow> {
      @Override
      public OntologyEditLockRow map(ResultSet resultSet, StatementContext context)
          throws SQLException {
        return new OntologyEditLockRow(
            resultSet.getString("resourceType"),
            UUID.fromString(resultSet.getString("resourceId")),
            UUID.fromString(resultSet.getString("holderId")),
            resultSet.getString("sessionId"),
            resultSet.getLong("version"),
            resultSet.getLong("acquiredAt"),
            resultSet.getLong("renewedAt"),
            resultSet.getLong("expiresAt"));
      }
    }
  }

  interface RdfInferenceRuleDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_inference_rule "
                + "(name, json, systemRule, dirty, deleted, updatedAt) "
                + "VALUES (:name, :json, :systemRule, TRUE, FALSE, :updatedAt) "
                + "ON DUPLICATE KEY UPDATE name = VALUES(name)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_inference_rule "
                + "(name, json, systemRule, dirty, deleted, updatedAt) "
                + "VALUES (:name, :json::jsonb, :systemRule, TRUE, FALSE, :updatedAt) "
                + "ON CONFLICT (name) DO NOTHING",
        connectionType = POSTGRES)
    void insertIfAbsent(
        @Bind("name") String name,
        @Bind("json") String json,
        @Bind("systemRule") boolean systemRule,
        @Bind("updatedAt") long updatedAt);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_inference_rule "
                + "(name, json, systemRule, dirty, deleted, updatedAt) "
                + "VALUES (:name, :json, FALSE, TRUE, FALSE, :updatedAt) "
                + "ON DUPLICATE KEY UPDATE json = VALUES(json), dirty = TRUE, deleted = FALSE, "
                + "updatedAt = VALUES(updatedAt), lastError = NULL",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_inference_rule "
                + "(name, json, systemRule, dirty, deleted, updatedAt) "
                + "VALUES (:name, :json::jsonb, FALSE, TRUE, FALSE, :updatedAt) "
                + "ON CONFLICT (name) DO UPDATE SET json = EXCLUDED.json, dirty = TRUE, "
                + "deleted = FALSE, updatedAt = EXCLUDED.updatedAt, lastError = NULL",
        connectionType = POSTGRES)
    void upsert(
        @Bind("name") String name, @Bind("json") String json, @Bind("updatedAt") long updatedAt);

    @SqlUpdate(
        "UPDATE rdf_inference_rule SET deleted = TRUE, dirty = FALSE, updatedAt = :updatedAt "
            + "WHERE name = :name")
    void softDelete(@Bind("name") String name, @Bind("updatedAt") long updatedAt);

    @SqlUpdate(
        "UPDATE rdf_inference_rule SET dirty = FALSE, lastMaterializedAt = :completedAt, "
            + "lastTripleCount = :tripleCount, lastError = NULL WHERE name = :name")
    void markMaterialized(
        @Bind("name") String name,
        @Bind("completedAt") long completedAt,
        @Bind("tripleCount") long tripleCount);

    @SqlUpdate(
        "UPDATE rdf_inference_rule SET dirty = TRUE, lastError = :lastError WHERE name = :name")
    void markFailed(@Bind("name") String name, @Bind("lastError") String lastError);

    @SqlUpdate("UPDATE rdf_inference_rule SET dirty = TRUE WHERE deleted = FALSE")
    void markAllDirty();

    @SqlQuery("SELECT * FROM rdf_inference_rule WHERE deleted = FALSE ORDER BY name")
    @RegisterRowMapper(RdfInferenceRuleRowMapper.class)
    List<RdfInferenceRuleRow> listActive();

    @SqlQuery("SELECT * FROM rdf_inference_rule WHERE name = :name AND deleted = FALSE")
    @RegisterRowMapper(RdfInferenceRuleRowMapper.class)
    RdfInferenceRuleRow findActive(@Bind("name") String name);

    class RdfInferenceRuleRowMapper implements RowMapper<RdfInferenceRuleRow> {
      @Override
      public RdfInferenceRuleRow map(final ResultSet resultSet, final StatementContext context)
          throws SQLException {
        return new RdfInferenceRuleRow(
            resultSet.getString("name"),
            resultSet.getString("json"),
            resultSet.getBoolean("systemRule"),
            resultSet.getBoolean("dirty"),
            resultSet.getLong("updatedAt"),
            (Long) resultSet.getObject("lastMaterializedAt"),
            resultSet.getLong("lastTripleCount"),
            resultSet.getString("lastError"));
      }
    }

    record RdfInferenceRuleRow(
        String name,
        String json,
        boolean systemRule,
        boolean dirty,
        long updatedAt,
        Long lastMaterializedAt,
        long lastTripleCount,
        String lastError) {}
  }

  interface RdfCustomOntologyDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_custom_ontology (name, json, updatedAt) "
                + "VALUES (:name, :json, :updatedAt) "
                + "ON DUPLICATE KEY UPDATE name = VALUES(name)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_custom_ontology (name, json, updatedAt) "
                + "VALUES (:name, :json::jsonb, :updatedAt) ON CONFLICT (name) DO NOTHING",
        connectionType = POSTGRES)
    int insertIfAbsent(
        @Bind("name") String name, @Bind("json") String json, @Bind("updatedAt") long updatedAt);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE rdf_custom_ontology SET json = :json, updatedAt = :updatedAt WHERE name = :name",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE rdf_custom_ontology SET json = :json::jsonb, updatedAt = :updatedAt "
                + "WHERE name = :name",
        connectionType = POSTGRES)
    int update(
        @Bind("name") String name, @Bind("json") String json, @Bind("updatedAt") long updatedAt);

    @SqlQuery("SELECT json FROM rdf_custom_ontology ORDER BY name")
    List<String> list();

    @SqlQuery("SELECT json FROM rdf_custom_ontology WHERE name = :name")
    String findByName(@Bind("name") String name);

    @SqlUpdate("DELETE FROM rdf_custom_ontology WHERE name = :name")
    int delete(@Bind("name") String name);
  }

  /** DAO for distributed RDF index jobs. */
  interface RdfIndexJobDAO {

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_index_job (id, status, jobConfiguration, totalRecords, processedRecords, "
                + "successRecords, failedRecords, stats, createdBy, createdAt, updatedAt) "
                + "VALUES (:id, :status, :jobConfiguration, :totalRecords, :processedRecords, "
                + ":successRecords, :failedRecords, :stats, :createdBy, :createdAt, :updatedAt)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_index_job (id, status, jobConfiguration, totalRecords, processedRecords, "
                + "successRecords, failedRecords, stats, createdBy, createdAt, updatedAt) "
                + "VALUES (:id, :status, :jobConfiguration::jsonb, :totalRecords, :processedRecords, "
                + ":successRecords, :failedRecords, :stats::jsonb, :createdBy, :createdAt, :updatedAt)",
        connectionType = POSTGRES)
    void insert(
        @Bind("id") String id,
        @Bind("status") String status,
        @BindJson("jobConfiguration") String jobConfiguration,
        @Bind("totalRecords") long totalRecords,
        @Bind("processedRecords") long processedRecords,
        @Bind("successRecords") long successRecords,
        @Bind("failedRecords") long failedRecords,
        @BindJson("stats") String stats,
        @Bind("createdBy") String createdBy,
        @Bind("createdAt") long createdAt,
        @Bind("updatedAt") long updatedAt);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE rdf_index_job SET status = :status, processedRecords = :processedRecords, "
                + "successRecords = :successRecords, failedRecords = :failedRecords, stats = :stats, "
                + "startedAt = :startedAt, completedAt = :completedAt, updatedAt = :updatedAt, "
                + "errorMessage = :errorMessage WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE rdf_index_job SET status = :status, processedRecords = :processedRecords, "
                + "successRecords = :successRecords, failedRecords = :failedRecords, stats = :stats::jsonb, "
                + "startedAt = :startedAt, completedAt = :completedAt, updatedAt = :updatedAt, "
                + "errorMessage = :errorMessage WHERE id = :id",
        connectionType = POSTGRES)
    void update(
        @Bind("id") String id,
        @Bind("status") String status,
        @Bind("processedRecords") long processedRecords,
        @Bind("successRecords") long successRecords,
        @Bind("failedRecords") long failedRecords,
        @BindJson("stats") String stats,
        @Bind("startedAt") Long startedAt,
        @Bind("completedAt") Long completedAt,
        @Bind("updatedAt") long updatedAt,
        @Bind("errorMessage") String errorMessage);

    @SqlUpdate("UPDATE rdf_index_job SET updatedAt = :updatedAt WHERE id = :id")
    void touchJob(@Bind("id") String id, @Bind("updatedAt") long updatedAt);

    @SqlQuery("SELECT * FROM rdf_index_job WHERE id = :id")
    @RegisterRowMapper(RdfIndexJobMapper.class)
    RdfIndexJobRecord findById(@Bind("id") String id);

    @SqlQuery("SELECT * FROM rdf_index_job WHERE status IN (<statuses>) ORDER BY createdAt DESC")
    @RegisterRowMapper(RdfIndexJobMapper.class)
    List<RdfIndexJobRecord> findByStatuses(@BindList("statuses") List<String> statuses);

    @SqlQuery(
        "SELECT * FROM rdf_index_job WHERE status IN (<statuses>) ORDER BY createdAt DESC LIMIT :limit")
    @RegisterRowMapper(RdfIndexJobMapper.class)
    List<RdfIndexJobRecord> findByStatusesWithLimit(
        @BindList("statuses") List<String> statuses, @Bind("limit") int limit);

    @SqlQuery("SELECT id FROM rdf_index_job WHERE status IN ('READY', 'RUNNING', 'STOPPING')")
    List<String> getRunningJobIds();

    @SqlUpdate("DELETE FROM rdf_index_job")
    void deleteAll();

    class RdfIndexJobMapper implements RowMapper<RdfIndexJobRecord> {
      @Override
      public RdfIndexJobRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new RdfIndexJobRecord(
            rs.getString("id"),
            rs.getString("status"),
            rs.getString("jobConfiguration"),
            rs.getLong("totalRecords"),
            rs.getLong("processedRecords"),
            rs.getLong("successRecords"),
            rs.getLong("failedRecords"),
            rs.getString("stats"),
            rs.getString("createdBy"),
            rs.getLong("createdAt"),
            (Long) rs.getObject("startedAt"),
            (Long) rs.getObject("completedAt"),
            rs.getLong("updatedAt"),
            rs.getString("errorMessage"));
      }
    }

    record RdfIndexJobRecord(
        String id,
        String status,
        String jobConfiguration,
        long totalRecords,
        long processedRecords,
        long successRecords,
        long failedRecords,
        String stats,
        String createdBy,
        long createdAt,
        Long startedAt,
        Long completedAt,
        long updatedAt,
        String errorMessage) {}
  }

  /** DAO for distributed RDF partitions. */
  interface RdfIndexPartitionDAO {

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_index_partition (id, jobId, entityType, partitionIndex, rangeStart, rangeEnd, "
                + "estimatedCount, workUnits, priority, status, processingCursor, claimableAt) "
                + "VALUES (:id, :jobId, :entityType, :partitionIndex, :rangeStart, :rangeEnd, "
                + ":estimatedCount, :workUnits, :priority, :status, :cursor, :claimableAt)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_index_partition (id, jobId, entityType, partitionIndex, rangeStart, rangeEnd, "
                + "estimatedCount, workUnits, priority, status, processingCursor, claimableAt) "
                + "VALUES (:id, :jobId, :entityType, :partitionIndex, :rangeStart, :rangeEnd, "
                + ":estimatedCount, :workUnits, :priority, :status, :cursor, :claimableAt)",
        connectionType = POSTGRES)
    void insert(
        @Bind("id") String id,
        @Bind("jobId") String jobId,
        @Bind("entityType") String entityType,
        @Bind("partitionIndex") int partitionIndex,
        @Bind("rangeStart") long rangeStart,
        @Bind("rangeEnd") long rangeEnd,
        @Bind("estimatedCount") long estimatedCount,
        @Bind("workUnits") long workUnits,
        @Bind("priority") int priority,
        @Bind("status") String status,
        @Bind("cursor") long cursor,
        @Bind("claimableAt") long claimableAt);

    @SqlUpdate(
        "UPDATE rdf_index_partition SET status = :status, processingCursor = :cursor, "
            + "processedCount = :processedCount, successCount = :successCount, failedCount = :failedCount, "
            + "assignedServer = :assignedServer, claimedAt = :claimedAt, startedAt = :startedAt, "
            + "completedAt = :completedAt, lastUpdateAt = :lastUpdateAt, lastError = :lastError, "
            + "retryCount = :retryCount WHERE id = :id")
    void update(
        @Bind("id") String id,
        @Bind("status") String status,
        @Bind("cursor") long cursor,
        @Bind("processedCount") long processedCount,
        @Bind("successCount") long successCount,
        @Bind("failedCount") long failedCount,
        @Bind("assignedServer") String assignedServer,
        @Bind("claimedAt") Long claimedAt,
        @Bind("startedAt") Long startedAt,
        @Bind("completedAt") Long completedAt,
        @Bind("lastUpdateAt") Long lastUpdateAt,
        @Bind("lastError") String lastError,
        @Bind("retryCount") int retryCount);

    @SqlUpdate(
        "UPDATE rdf_index_partition SET processingCursor = :cursor, processedCount = :processedCount, "
            + "successCount = :successCount, failedCount = :failedCount, "
            + "readerTimeMs = :readerTimeMs, processTimeMs = :processTimeMs, sinkTimeMs = :sinkTimeMs, "
            + "lastUpdateAt = :lastUpdateAt WHERE id = :id")
    void updateProgress(
        @Bind("id") String id,
        @Bind("cursor") long cursor,
        @Bind("processedCount") long processedCount,
        @Bind("successCount") long successCount,
        @Bind("failedCount") long failedCount,
        @Bind("readerTimeMs") long readerTimeMs,
        @Bind("processTimeMs") long processTimeMs,
        @Bind("sinkTimeMs") long sinkTimeMs,
        @Bind("lastUpdateAt") long lastUpdateAt);

    @SqlUpdate("UPDATE rdf_index_partition SET lastUpdateAt = :lastUpdateAt WHERE id = :id")
    void updateHeartbeat(@Bind("id") String id, @Bind("lastUpdateAt") long lastUpdateAt);

    @SqlQuery("SELECT * FROM rdf_index_partition WHERE id = :id")
    @RegisterRowMapper(RdfIndexPartitionMapper.class)
    RdfIndexPartitionRecord findById(@Bind("id") String id);

    @SqlQuery(
        "SELECT * FROM rdf_index_partition WHERE jobId = :jobId ORDER BY priority DESC, entityType, partitionIndex")
    @RegisterRowMapper(RdfIndexPartitionMapper.class)
    List<RdfIndexPartitionRecord> findByJobId(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT COUNT(*) FROM rdf_index_partition WHERE jobId = :jobId AND status = 'PENDING'")
    int countPendingPartitions(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT COUNT(*) FROM rdf_index_partition WHERE jobId = :jobId AND status = 'PROCESSING'")
    int countInFlightPartitions(@Bind("jobId") String jobId);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE rdf_index_partition p "
                + "JOIN (SELECT id FROM rdf_index_partition WHERE jobId = :jobId AND status = 'PENDING' "
                + "AND claimableAt <= :now "
                + "ORDER BY priority DESC, entityType, partitionIndex LIMIT 1 FOR UPDATE SKIP LOCKED) t ON p.id = t.id "
                + "SET p.status = 'PROCESSING', p.assignedServer = :serverId, p.claimedAt = :now, "
                + "p.startedAt = :now, p.lastUpdateAt = :now",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE rdf_index_partition SET status = 'PROCESSING', "
                + "assignedServer = :serverId, claimedAt = :now, startedAt = :now, lastUpdateAt = :now "
                + "WHERE id = (SELECT id FROM rdf_index_partition WHERE jobId = :jobId AND status = 'PENDING' "
                + "AND claimableAt <= :now "
                + "ORDER BY priority DESC, entityType, partitionIndex LIMIT 1 FOR UPDATE SKIP LOCKED)",
        connectionType = POSTGRES)
    int claimNextPartitionAtomic(
        @Bind("jobId") String jobId, @Bind("serverId") String serverId, @Bind("now") long now);

    @SqlQuery(
        "SELECT * FROM rdf_index_partition WHERE jobId = :jobId AND status = 'PROCESSING' "
            + "AND assignedServer = :serverId AND claimedAt = :claimedAt "
            + "ORDER BY priority DESC, entityType, partitionIndex LIMIT 1")
    @RegisterRowMapper(RdfIndexPartitionMapper.class)
    RdfIndexPartitionRecord findLatestClaimedPartition(
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("claimedAt") long claimedAt);

    @SqlUpdate(
        "UPDATE rdf_index_partition SET status = 'PENDING', assignedServer = NULL, claimedAt = NULL, "
            + "retryCount = retryCount + 1, lastError = 'Reclaimed due to stale heartbeat' "
            + "WHERE jobId = :jobId AND status = 'PROCESSING' AND lastUpdateAt < :staleThreshold "
            + "AND retryCount < :maxRetries")
    int reclaimStalePartitionsForRetry(
        @Bind("jobId") String jobId,
        @Bind("staleThreshold") long staleThreshold,
        @Bind("maxRetries") int maxRetries);

    @SqlUpdate(
        "UPDATE rdf_index_partition SET status = 'FAILED', "
            + "lastError = 'Exceeded max retries after stale heartbeat', completedAt = :now "
            + "WHERE jobId = :jobId AND status = 'PROCESSING' AND lastUpdateAt < :staleThreshold "
            + "AND retryCount >= :maxRetries")
    int failStalePartitionsExceedingRetries(
        @Bind("jobId") String jobId,
        @Bind("staleThreshold") long staleThreshold,
        @Bind("maxRetries") int maxRetries,
        @Bind("now") long now);

    @SqlUpdate(
        "UPDATE rdf_index_partition SET status = 'CANCELLED' WHERE jobId = :jobId AND status = 'PENDING'")
    int cancelPendingPartitions(@Bind("jobId") String jobId);

    @SqlUpdate(
        "UPDATE rdf_index_partition SET status = 'CANCELLED', "
            + "lastError = 'Stopped by user', completedAt = :now, lastUpdateAt = :now "
            + "WHERE jobId = :jobId AND status IN ('PENDING','PROCESSING')")
    int cancelInFlightPartitions(@Bind("jobId") String jobId, @Bind("now") long now);

    @SqlQuery(
        "SELECT COUNT(*) FROM rdf_index_partition "
            + "WHERE jobId = :jobId AND status = 'PROCESSING' AND assignedServer = :serverId")
    int countInFlightPartitionsForServer(
        @Bind("jobId") String jobId, @Bind("serverId") String serverId);

    @SqlQuery("SELECT COUNT(*) FROM rdf_index_partition WHERE jobId = :jobId AND status = :status")
    int countPartitionsByStatus(@Bind("jobId") String jobId, @Bind("status") String status);

    /**
     * Status-guarded variant of {@link #update}: only writes if the row is still
     * PROCESSING. Workers use this on completion so that a concurrent Stop
     * (which moves the row to CANCELLED) isn't overwritten back to
     * COMPLETED/FAILED, which would make the Stop button look unreliable.
     * Returns the number of rows updated (0 means the row was no longer
     * PROCESSING and the caller should skip side effects like server-stat
     * increments).
     */
    @SqlUpdate(
        "UPDATE rdf_index_partition SET status = :status, processingCursor = :cursor, "
            + "processedCount = :processedCount, successCount = :successCount, failedCount = :failedCount, "
            + "assignedServer = :assignedServer, claimedAt = :claimedAt, startedAt = :startedAt, "
            + "completedAt = :completedAt, lastUpdateAt = :lastUpdateAt, lastError = :lastError, "
            + "retryCount = :retryCount WHERE id = :id AND status = 'PROCESSING'")
    int updateIfProcessing(
        @Bind("id") String id,
        @Bind("status") String status,
        @Bind("cursor") long cursor,
        @Bind("processedCount") long processedCount,
        @Bind("successCount") long successCount,
        @Bind("failedCount") long failedCount,
        @Bind("assignedServer") String assignedServer,
        @Bind("claimedAt") Long claimedAt,
        @Bind("startedAt") Long startedAt,
        @Bind("completedAt") Long completedAt,
        @Bind("lastUpdateAt") Long lastUpdateAt,
        @Bind("lastError") String lastError,
        @Bind("retryCount") int retryCount);

    @SqlUpdate(
        "UPDATE rdf_index_partition SET status = :status, assignedServer = NULL, claimedAt = NULL, "
            + "lastError = :reason, lastUpdateAt = :updatedAt, completedAt = :completedAt "
            + "WHERE jobId = :jobId AND status = 'PROCESSING' AND assignedServer = :serverId")
    int releaseProcessingPartitions(
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("status") String status,
        @Bind("reason") String reason,
        @Bind("updatedAt") long updatedAt,
        @Bind("completedAt") Long completedAt);

    @SqlQuery(
        "SELECT entityType, "
            + "SUM(estimatedCount) as totalRecords, "
            + "SUM(processedCount) as processedRecords, "
            + "SUM(successCount) as successRecords, "
            + "SUM(failedCount) as failedRecords, "
            + "SUM(readerTimeMs) as readerTimeMs, "
            + "SUM(processTimeMs) as processTimeMs, "
            + "SUM(sinkTimeMs) as sinkTimeMs, "
            + "COUNT(*) as totalPartitions, "
            + "SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completedPartitions, "
            + "SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failedPartitions "
            + "FROM rdf_index_partition WHERE jobId = :jobId GROUP BY entityType")
    @RegisterRowMapper(RdfEntityStatsMapper.class)
    List<RdfEntityStatsRecord> getEntityStats(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT "
            + "SUM(estimatedCount) as totalRecords, "
            + "SUM(processedCount) as processedRecords, "
            + "SUM(successCount) as successRecords, "
            + "SUM(failedCount) as failedRecords, "
            + "COUNT(*) as totalPartitions, "
            + "SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completedPartitions, "
            + "SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failedPartitions, "
            + "SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingPartitions, "
            + "SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processingPartitions "
            + "FROM rdf_index_partition WHERE jobId = :jobId")
    @RegisterRowMapper(RdfAggregatedStatsMapper.class)
    RdfAggregatedStatsRecord getAggregatedStats(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT assignedServer, "
            + "SUM(processedCount) as processedRecords, "
            + "SUM(successCount) as successRecords, "
            + "SUM(failedCount) as failedRecords, "
            + "COUNT(*) as totalPartitions, "
            + "SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completedPartitions, "
            + "SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processingPartitions "
            + "FROM rdf_index_partition WHERE jobId = :jobId AND assignedServer IS NOT NULL "
            + "GROUP BY assignedServer")
    @RegisterRowMapper(RdfServerStatsMapper.class)
    List<RdfServerPartitionStatsRecord> getServerStats(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT DISTINCT assignedServer FROM rdf_index_partition "
            + "WHERE jobId = :jobId AND assignedServer IS NOT NULL")
    List<String> getAssignedServers(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT lastError FROM rdf_index_partition "
            + "WHERE jobId = :jobId AND lastError IS NOT NULL "
            + "ORDER BY lastUpdateAt DESC LIMIT :limit")
    List<String> findRecentPartitionErrors(@Bind("jobId") String jobId, @Bind("limit") int limit);

    @SqlUpdate("DELETE FROM rdf_index_partition")
    void deleteAll();

    class RdfIndexPartitionMapper implements RowMapper<RdfIndexPartitionRecord> {
      @Override
      public RdfIndexPartitionRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new RdfIndexPartitionRecord(
            rs.getString("id"),
            rs.getString("jobId"),
            rs.getString("entityType"),
            rs.getInt("partitionIndex"),
            rs.getLong("rangeStart"),
            rs.getLong("rangeEnd"),
            rs.getLong("estimatedCount"),
            rs.getLong("workUnits"),
            rs.getInt("priority"),
            rs.getString("status"),
            rs.getLong("processingCursor"),
            rs.getLong("processedCount"),
            rs.getLong("successCount"),
            rs.getLong("failedCount"),
            rs.getLong("readerTimeMs"),
            rs.getLong("processTimeMs"),
            rs.getLong("sinkTimeMs"),
            rs.getString("assignedServer"),
            (Long) rs.getObject("claimedAt"),
            (Long) rs.getObject("startedAt"),
            (Long) rs.getObject("completedAt"),
            (Long) rs.getObject("lastUpdateAt"),
            rs.getString("lastError"),
            rs.getInt("retryCount"),
            rs.getLong("claimableAt"));
      }
    }

    class RdfEntityStatsMapper implements RowMapper<RdfEntityStatsRecord> {
      @Override
      public RdfEntityStatsRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new RdfEntityStatsRecord(
            rs.getString("entityType"),
            rs.getLong("totalRecords"),
            rs.getLong("processedRecords"),
            rs.getLong("successRecords"),
            rs.getLong("failedRecords"),
            rs.getLong("readerTimeMs"),
            rs.getLong("processTimeMs"),
            rs.getLong("sinkTimeMs"),
            rs.getInt("totalPartitions"),
            rs.getInt("completedPartitions"),
            rs.getInt("failedPartitions"));
      }
    }

    class RdfAggregatedStatsMapper implements RowMapper<RdfAggregatedStatsRecord> {
      @Override
      public RdfAggregatedStatsRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new RdfAggregatedStatsRecord(
            rs.getLong("totalRecords"),
            rs.getLong("processedRecords"),
            rs.getLong("successRecords"),
            rs.getLong("failedRecords"),
            rs.getInt("totalPartitions"),
            rs.getInt("completedPartitions"),
            rs.getInt("failedPartitions"),
            rs.getInt("pendingPartitions"),
            rs.getInt("processingPartitions"));
      }
    }

    class RdfServerStatsMapper implements RowMapper<RdfServerPartitionStatsRecord> {
      @Override
      public RdfServerPartitionStatsRecord map(ResultSet rs, StatementContext ctx)
          throws SQLException {
        return new RdfServerPartitionStatsRecord(
            rs.getString("assignedServer"),
            rs.getLong("processedRecords"),
            rs.getLong("successRecords"),
            rs.getLong("failedRecords"),
            rs.getInt("totalPartitions"),
            rs.getInt("completedPartitions"),
            rs.getInt("processingPartitions"));
      }
    }

    record RdfIndexPartitionRecord(
        String id,
        String jobId,
        String entityType,
        int partitionIndex,
        long rangeStart,
        long rangeEnd,
        long estimatedCount,
        long workUnits,
        int priority,
        String status,
        long cursor,
        long processedCount,
        long successCount,
        long failedCount,
        long readerTimeMs,
        long processTimeMs,
        long sinkTimeMs,
        String assignedServer,
        Long claimedAt,
        Long startedAt,
        Long completedAt,
        Long lastUpdateAt,
        String lastError,
        int retryCount,
        long claimableAt) {}

    record RdfEntityStatsRecord(
        String entityType,
        long totalRecords,
        long processedRecords,
        long successRecords,
        long failedRecords,
        long readerTimeMs,
        long processTimeMs,
        long sinkTimeMs,
        int totalPartitions,
        int completedPartitions,
        int failedPartitions) {}

    record RdfAggregatedStatsRecord(
        long totalRecords,
        long processedRecords,
        long successRecords,
        long failedRecords,
        int totalPartitions,
        int completedPartitions,
        int failedPartitions,
        int pendingPartitions,
        int processingPartitions) {}

    record RdfServerPartitionStatsRecord(
        String serverId,
        long processedRecords,
        long successRecords,
        long failedRecords,
        int totalPartitions,
        int completedPartitions,
        int processingPartitions) {}
  }

  /** DAO for RDF distributed reindex lock. */
  interface RdfReindexLockDAO {

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO rdf_reindex_lock (lockKey, jobId, serverId, acquiredAt, lastHeartbeat, expiresAt) "
                + "VALUES (:lockKey, :jobId, :serverId, :acquiredAt, :lastHeartbeat, :expiresAt)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_reindex_lock (lockKey, jobId, serverId, acquiredAt, lastHeartbeat, expiresAt) "
                + "VALUES (:lockKey, :jobId, :serverId, :acquiredAt, :lastHeartbeat, :expiresAt) "
                + "ON CONFLICT (lockKey) DO NOTHING",
        connectionType = POSTGRES)
    int insertIfNotExists(
        @Bind("lockKey") String lockKey,
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("acquiredAt") long acquiredAt,
        @Bind("lastHeartbeat") long lastHeartbeat,
        @Bind("expiresAt") long expiresAt);

    @SqlUpdate(
        "UPDATE rdf_reindex_lock SET lastHeartbeat = :lastHeartbeat, expiresAt = :expiresAt "
            + "WHERE lockKey = :lockKey AND jobId = :jobId")
    int updateHeartbeat(
        @Bind("lockKey") String lockKey,
        @Bind("jobId") String jobId,
        @Bind("lastHeartbeat") long lastHeartbeat,
        @Bind("expiresAt") long expiresAt);

    @SqlQuery("SELECT * FROM rdf_reindex_lock WHERE lockKey = :lockKey")
    @RegisterRowMapper(RdfReindexLockMapper.class)
    RdfReindexLockRecord findByKey(@Bind("lockKey") String lockKey);

    @SqlUpdate("DELETE FROM rdf_reindex_lock WHERE lockKey = :lockKey")
    void delete(@Bind("lockKey") String lockKey);

    @SqlUpdate("DELETE FROM rdf_reindex_lock WHERE lockKey = :lockKey AND jobId = :jobId")
    int deleteByKeyAndJob(@Bind("lockKey") String lockKey, @Bind("jobId") String jobId);

    @SqlUpdate("DELETE FROM rdf_reindex_lock WHERE expiresAt < :now")
    int deleteExpiredLocks(@Bind("now") long now);

    @SqlUpdate(
        "UPDATE rdf_reindex_lock SET jobId = :toJobId, serverId = :serverId, "
            + "lastHeartbeat = :heartbeat, expiresAt = :expiresAt "
            + "WHERE lockKey = :lockKey AND jobId = :fromJobId")
    int updateLockOwner(
        @Bind("lockKey") String lockKey,
        @Bind("fromJobId") String fromJobId,
        @Bind("toJobId") String toJobId,
        @Bind("serverId") String serverId,
        @Bind("heartbeat") long heartbeat,
        @Bind("expiresAt") long expiresAt);

    default boolean tryAcquireLock(
        String lockKey, String jobId, String serverId, long acquiredAt, long expiresAt) {
      deleteExpiredLocks(System.currentTimeMillis());
      int inserted = insertIfNotExists(lockKey, jobId, serverId, acquiredAt, acquiredAt, expiresAt);
      if (inserted > 0) {
        return true;
      }

      RdfReindexLockRecord existing = findByKey(lockKey);
      if (existing != null && existing.isExpired()) {
        delete(lockKey);
        inserted = insertIfNotExists(lockKey, jobId, serverId, acquiredAt, acquiredAt, expiresAt);
        return inserted > 0;
      }
      return false;
    }

    default void releaseLock(String lockKey, String jobId) {
      deleteByKeyAndJob(lockKey, jobId);
    }

    default boolean transferLock(
        String lockKey,
        String fromJobId,
        String toJobId,
        String serverId,
        long heartbeat,
        long expiresAt) {
      return updateLockOwner(lockKey, fromJobId, toJobId, serverId, heartbeat, expiresAt) > 0;
    }

    class RdfReindexLockMapper implements RowMapper<RdfReindexLockRecord> {
      @Override
      public RdfReindexLockRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new RdfReindexLockRecord(
            rs.getString("lockKey"),
            rs.getString("jobId"),
            rs.getString("serverId"),
            rs.getLong("acquiredAt"),
            rs.getLong("lastHeartbeat"),
            rs.getLong("expiresAt"));
      }
    }

    record RdfReindexLockRecord(
        String lockKey,
        String jobId,
        String serverId,
        long acquiredAt,
        long lastHeartbeat,
        long expiresAt) {

      public boolean isExpired() {
        return System.currentTimeMillis() > expiresAt;
      }
    }
  }

  /** DAO for RDF per-server distributed stats. */
  interface RdfIndexServerStatsDAO {

    record ServerStatsRecord(
        String id,
        String jobId,
        String serverId,
        String entityType,
        long processedRecords,
        long successRecords,
        long failedRecords,
        int partitionsCompleted,
        int partitionsFailed,
        long lastUpdatedAt) {}

    record AggregatedServerStats(
        long processedRecords,
        long successRecords,
        long failedRecords,
        int partitionsCompleted,
        int partitionsFailed) {}

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_index_server_stats (id, jobId, serverId, entityType, processedRecords, "
                + "successRecords, failedRecords, partitionsCompleted, partitionsFailed, lastUpdatedAt) "
                + "VALUES (:id, :jobId, :serverId, :entityType, :processedRecords, :successRecords, "
                + ":failedRecords, :partitionsCompleted, :partitionsFailed, :lastUpdatedAt) "
                + "ON DUPLICATE KEY UPDATE "
                + "processedRecords = processedRecords + VALUES(processedRecords), "
                + "successRecords = successRecords + VALUES(successRecords), "
                + "failedRecords = failedRecords + VALUES(failedRecords), "
                + "partitionsCompleted = partitionsCompleted + VALUES(partitionsCompleted), "
                + "partitionsFailed = partitionsFailed + VALUES(partitionsFailed), "
                + "lastUpdatedAt = VALUES(lastUpdatedAt)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_index_server_stats (id, jobId, serverId, entityType, processedRecords, "
                + "successRecords, failedRecords, partitionsCompleted, partitionsFailed, lastUpdatedAt) "
                + "VALUES (:id, :jobId, :serverId, :entityType, :processedRecords, :successRecords, "
                + ":failedRecords, :partitionsCompleted, :partitionsFailed, :lastUpdatedAt) "
                + "ON CONFLICT (jobId, serverId, entityType) DO UPDATE SET "
                + "processedRecords = rdf_index_server_stats.processedRecords + EXCLUDED.processedRecords, "
                + "successRecords = rdf_index_server_stats.successRecords + EXCLUDED.successRecords, "
                + "failedRecords = rdf_index_server_stats.failedRecords + EXCLUDED.failedRecords, "
                + "partitionsCompleted = rdf_index_server_stats.partitionsCompleted + EXCLUDED.partitionsCompleted, "
                + "partitionsFailed = rdf_index_server_stats.partitionsFailed + EXCLUDED.partitionsFailed, "
                + "lastUpdatedAt = EXCLUDED.lastUpdatedAt",
        connectionType = POSTGRES)
    void incrementStats(
        @Bind("id") String id,
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("entityType") String entityType,
        @Bind("processedRecords") long processedRecords,
        @Bind("successRecords") long successRecords,
        @Bind("failedRecords") long failedRecords,
        @Bind("partitionsCompleted") int partitionsCompleted,
        @Bind("partitionsFailed") int partitionsFailed,
        @Bind("lastUpdatedAt") long lastUpdatedAt);

    @SqlQuery("SELECT * FROM rdf_index_server_stats WHERE jobId = :jobId")
    @RegisterRowMapper(RdfServerStatsRecordMapper.class)
    List<ServerStatsRecord> findByJobId(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT "
            + "COALESCE(SUM(processedRecords), 0) as processedRecords, "
            + "COALESCE(SUM(successRecords), 0) as successRecords, "
            + "COALESCE(SUM(failedRecords), 0) as failedRecords, "
            + "COALESCE(SUM(partitionsCompleted), 0) as partitionsCompleted, "
            + "COALESCE(SUM(partitionsFailed), 0) as partitionsFailed "
            + "FROM rdf_index_server_stats WHERE jobId = :jobId")
    @RegisterRowMapper(RdfAggregatedServerStatsMapper.class)
    AggregatedServerStats getAggregatedStats(@Bind("jobId") String jobId);

    @SqlUpdate("DELETE FROM rdf_index_server_stats")
    void deleteAll();

    class RdfServerStatsRecordMapper implements RowMapper<ServerStatsRecord> {
      @Override
      public ServerStatsRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new ServerStatsRecord(
            rs.getString("id"),
            rs.getString("jobId"),
            rs.getString("serverId"),
            rs.getString("entityType"),
            rs.getLong("processedRecords"),
            rs.getLong("successRecords"),
            rs.getLong("failedRecords"),
            rs.getInt("partitionsCompleted"),
            rs.getInt("partitionsFailed"),
            rs.getLong("lastUpdatedAt"));
      }
    }

    class RdfAggregatedServerStatsMapper implements RowMapper<AggregatedServerStats> {
      @Override
      public AggregatedServerStats map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new AggregatedServerStats(
            rs.getLong("processedRecords"),
            rs.getLong("successRecords"),
            rs.getLong("failedRecords"),
            rs.getInt("partitionsCompleted"),
            rs.getInt("partitionsFailed"));
      }
    }
  }

  /**
   * Single-row pointer naming the RDF dataset that currently serves reads and live writes. A
   * blue/green rebuild populates the other dataset and then flips this row, so the served graph is
   * never cleared out from under queries. An absent row means "use the dataset named in the
   * configured endpoint" — the behaviour before blue/green existed — so upgrades are inert until an
   * operator enables it.
   */
  interface RdfActiveDatasetDAO {

    String POINTER_ID = "active";

    @SqlQuery("SELECT datasetName FROM rdf_active_dataset WHERE id = '" + POINTER_ID + "'")
    String getActiveDataset();

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_active_dataset (id, datasetName, updatedAt, updatedBy) "
                + "VALUES ('"
                + POINTER_ID
                + "', :datasetName, :updatedAt, :updatedBy) "
                + "ON DUPLICATE KEY UPDATE datasetName = VALUES(datasetName), "
                + "updatedAt = VALUES(updatedAt), updatedBy = VALUES(updatedBy)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_active_dataset (id, datasetName, updatedAt, updatedBy) "
                + "VALUES ('"
                + POINTER_ID
                + "', :datasetName, :updatedAt, :updatedBy) "
                + "ON CONFLICT (id) DO UPDATE SET datasetName = EXCLUDED.datasetName, "
                + "updatedAt = EXCLUDED.updatedAt, updatedBy = EXCLUDED.updatedBy",
        connectionType = POSTGRES)
    void setActiveDataset(
        @Bind("datasetName") String datasetName,
        @Bind("updatedAt") long updatedAt,
        @Bind("updatedBy") String updatedBy);

    @SqlUpdate("DELETE FROM rdf_active_dataset WHERE id = '" + POINTER_ID + "'")
    void clearActiveDataset();
  }

  /**
   * DAO for RDF index failure records. Mirrors {@link SearchIndexFailureDAO}: failed records are
   * persisted per job so they can be inspected and retried at end-of-run instead of being silently
   * lost until the next full reindex.
   */
  interface RdfIndexFailureDAO {

    String STAGE_ENTITY_WRITE = "ENTITY_WRITE";
    String STAGE_RELATIONSHIP = "RELATIONSHIP";
    String STAGE_LINEAGE = "LINEAGE";
    String STAGE_READER = "READER";

    /** Bean class for @BindBean compatibility (records use id() not getId()) */
    @lombok.Getter
    @lombok.AllArgsConstructor
    class RdfIndexFailureRecord {
      private final String id;
      private final String jobId;
      private final String serverId;
      private final String entityType;
      private final String entityId;
      private final String entityFqn;
      private final String failureStage;
      private final String errorMessage;
      private final String stackTrace;
      private final long timestamp;
    }

    @SqlUpdate(
        "INSERT INTO rdf_index_failures (id, jobId, serverId, entityType, entityId, entityFqn, "
            + "failureStage, errorMessage, stackTrace, timestamp) "
            + "VALUES (:id, :jobId, :serverId, :entityType, :entityId, :entityFqn, "
            + ":failureStage, :errorMessage, :stackTrace, :timestamp)")
    void insert(
        @Bind("id") String id,
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("entityType") String entityType,
        @Bind("entityId") String entityId,
        @Bind("entityFqn") String entityFqn,
        @Bind("failureStage") String failureStage,
        @Bind("errorMessage") String errorMessage,
        @Bind("stackTrace") String stackTrace,
        @Bind("timestamp") long timestamp);

    @SqlBatch(
        "INSERT INTO rdf_index_failures (id, jobId, serverId, entityType, entityId, entityFqn, "
            + "failureStage, errorMessage, stackTrace, timestamp) "
            + "VALUES (:id, :jobId, :serverId, :entityType, :entityId, :entityFqn, "
            + ":failureStage, :errorMessage, :stackTrace, :timestamp)")
    void insertBatch(@BindBean List<RdfIndexFailureRecord> failures);

    @SqlQuery(
        "SELECT * FROM rdf_index_failures WHERE jobId = :jobId "
            + "ORDER BY timestamp ASC LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(RdfIndexFailureMapper.class)
    List<RdfIndexFailureRecord> findByJobId(
        @Bind("jobId") String jobId, @Bind("limit") int limit, @Bind("offset") int offset);

    @SqlQuery("SELECT COUNT(*) FROM rdf_index_failures WHERE jobId = :jobId")
    int countByJobId(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT * FROM rdf_index_failures WHERE jobId = :jobId AND failureStage = :failureStage "
            + "ORDER BY timestamp ASC LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(RdfIndexFailureMapper.class)
    List<RdfIndexFailureRecord> findByJobIdAndStage(
        @Bind("jobId") String jobId,
        @Bind("failureStage") String failureStage,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    @SqlUpdate("DELETE FROM rdf_index_failures WHERE jobId = :jobId")
    int deleteByJobId(@Bind("jobId") String jobId);

    @SqlUpdate("DELETE FROM rdf_index_failures WHERE id = :id")
    int deleteById(@Bind("id") String id);

    @SqlUpdate("DELETE FROM rdf_index_failures WHERE timestamp < :cutoffTime")
    int deleteOlderThan(@Bind("cutoffTime") long cutoffTime);

    @SqlUpdate("DELETE FROM rdf_index_failures")
    int deleteAll();

    @SqlQuery("SELECT COUNT(*) FROM rdf_index_failures")
    int countAll();

    @SqlQuery(
        "SELECT * FROM rdf_index_failures ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(RdfIndexFailureMapper.class)
    List<RdfIndexFailureRecord> findAll(@Bind("limit") int limit, @Bind("offset") int offset);

    @SqlQuery("SELECT COUNT(*) FROM rdf_index_failures WHERE entityType = :entityType")
    int countByEntityType(@Bind("entityType") String entityType);

    @SqlQuery(
        "SELECT * FROM rdf_index_failures WHERE entityType = :entityType "
            + "ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(RdfIndexFailureMapper.class)
    List<RdfIndexFailureRecord> findByEntityType(
        @Bind("entityType") String entityType,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    class RdfIndexFailureMapper implements RowMapper<RdfIndexFailureRecord> {
      @Override
      public RdfIndexFailureRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new RdfIndexFailureRecord(
            rs.getString("id"),
            rs.getString("jobId"),
            rs.getString("serverId"),
            rs.getString("entityType"),
            rs.getString("entityId"),
            rs.getString("entityFqn"),
            rs.getString("failureStage"),
            rs.getString("errorMessage"),
            rs.getString("stackTrace"),
            rs.getLong("timestamp"));
      }
    }
  }
}
