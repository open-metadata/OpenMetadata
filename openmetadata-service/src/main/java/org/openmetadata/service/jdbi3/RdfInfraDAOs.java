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
import org.jdbi.v3.sqlobject.statement.SqlBatch;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindUUID;

public interface RdfInfraDAOs {
  @CreateSqlObject
  OntologyDAO ontologyDAO();

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
  RdfReindexLockDAO rdfReindexLockDAO();

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
            // BIGINT UNSIGNED on MySQL: a plain getObject returns BigInteger there.
            resultSet.getObject("lastMaterializedAt", Long.class),
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
