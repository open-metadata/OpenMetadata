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
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.jdbi.v3.sqlobject.transaction.Transactional;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindFQN;
import org.openmetadata.service.util.jdbi.BindJson;
import org.openmetadata.service.util.jdbi.BindUUID;

/**
 * Thin composite over the domain aggregator interfaces the DAOs were split into. JDBI builds its
 * handler map from {@code getMethods()}, which returns inherited methods, so every
 * {@code @CreateSqlObject} accessor stays wired through this type unchanged.
 *
 * <p><b>Referencing the nested types.</b> The member types those aggregators declare are inherited
 * here, so an existing inline reference such as {@code CollectionDAO.EntityRelationshipObject} still
 * compiles. An <b>import</b> does not: JLS 7.5 requires the canonical name, which is now the owning
 * interface — {@code CoreRelationshipDAOs.EntityRelationshipObject},
 * {@code TimeSeriesDAOs.TestCaseDAO}, and so on. An IDE "add import" or organize-imports that
 * reaches for {@code CollectionDAO.<Nested>} will therefore not compile; name the owning interface
 * instead. Spotless does not catch this.
 *
 * <p><b>Type-level JDBI configurers belong here, not on an aggregator.</b> Java does not inherit
 * annotations across interfaces ({@code @Inherited} is superclass-only), so a
 * {@code @RegisterRowMapper} / {@code @RegisterArgumentFactory} placed on one of the extended
 * interfaces is silently ignored when JDBI attaches this type. {@code CollectionDAOCompositionTest}
 * guards both invariants.
 */
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
        RdfInfraDAOs,
        Transactional<CollectionDAO> {
  @CreateSqlObject
  IndexMappingVersionDAO indexMappingVersionDAO();

  @CreateSqlObject
  AssetDAO assetDAO();

  @CreateSqlObject
  DeletionLockDAO deletionLockDAO();

  @CreateSqlObject
  IntakeFormDAO intakeFormDAO();

  @CreateSqlObject
  PendingApprovalChangeDAO pendingApprovalChangeDAO();

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
    void insert(@BindFQN("fqnHash") String fqnHash, @BindJson("json") String json);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE asset_entity SET json = :json WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE asset_entity SET json = :json::jsonb WHERE id = :id",
        connectionType = POSTGRES)
    void update(@BindJson("json") String json, @Bind("id") String id);

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

  record PendingApprovalChangeRecord(String json, long updatedAt) {}

  class PendingApprovalChangeRecordMapper implements RowMapper<PendingApprovalChangeRecord> {
    @Override
    public PendingApprovalChangeRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new PendingApprovalChangeRecord(rs.getString("json"), rs.getLong("updated_at"));
    }
  }

  interface PendingApprovalChangeDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO pending_approval_change (entity_id, updated_by, json, updated_at) "
                + "VALUES (:entityId, :updatedBy, :json, :updatedAt) "
                + "ON DUPLICATE KEY UPDATE json = :json, updated_at = :updatedAt",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO pending_approval_change (entity_id, updated_by, json, updated_at) "
                + "VALUES (:entityId, :updatedBy, (:json :: jsonb), :updatedAt) "
                + "ON CONFLICT (entity_id, updated_by) DO UPDATE SET json = (:json :: jsonb), updated_at = :updatedAt",
        connectionType = POSTGRES)
    void upsert(
        @BindUUID("entityId") UUID entityId,
        @Bind("updatedBy") String updatedBy,
        @Bind("json") String json,
        @Bind("updatedAt") long updatedAt);

    // Ensure a hold row exists for this (entity, requester) without failing on a concurrent insert.
    // accumulate() calls this before findForUpdate so the FOR UPDATE below always locks a real
    // record rather than a gap; a gap lock on the low-population hold table deadlocks concurrent
    // inserts. The affected-row count is deliberately not used, so the MySQL vs Postgres reporting
    // difference for a no-op upsert does not matter.
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO pending_approval_change (entity_id, updated_by, json, updated_at) "
                + "VALUES (:entityId, :updatedBy, :json, :updatedAt) "
                + "ON DUPLICATE KEY UPDATE entity_id = entity_id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO pending_approval_change (entity_id, updated_by, json, updated_at) "
                + "VALUES (:entityId, :updatedBy, (:json :: jsonb), :updatedAt) "
                + "ON CONFLICT (entity_id, updated_by) DO NOTHING",
        connectionType = POSTGRES)
    void insertIfAbsent(
        @BindUUID("entityId") UUID entityId,
        @Bind("updatedBy") String updatedBy,
        @Bind("json") String json,
        @Bind("updatedAt") long updatedAt);

    // Locks the hold row for this (entity, requester) and returns its json plus current updated_at.
    // accumulate() guarantees the row exists first (via insertIfAbsent), so this always takes a
    // record lock, never a gap lock, and concurrent edits for the same key serialize instead of
    // deadlocking. The returned updated_at lets accumulate() advance the version token
    // monotonically.
    @SqlQuery(
        "SELECT json, updated_at FROM pending_approval_change WHERE entity_id = :entityId AND updated_by = :updatedBy FOR UPDATE")
    @RegisterRowMapper(PendingApprovalChangeRecordMapper.class)
    PendingApprovalChangeRecord findForUpdate(
        @BindUUID("entityId") UUID entityId, @Bind("updatedBy") String updatedBy);

    @SqlQuery(
        "SELECT json, updated_at FROM pending_approval_change WHERE entity_id = :entityId AND updated_by = :updatedBy")
    @RegisterRowMapper(PendingApprovalChangeRecordMapper.class)
    PendingApprovalChangeRecord findRecord(
        @BindUUID("entityId") UUID entityId, @Bind("updatedBy") String updatedBy);

    @SqlQuery(
        "SELECT json FROM pending_approval_change WHERE entity_id = :entityId AND updated_by = :updatedBy")
    String find(@BindUUID("entityId") UUID entityId, @Bind("updatedBy") String updatedBy);

    @SqlUpdate(
        "DELETE FROM pending_approval_change WHERE entity_id = :entityId AND updated_by = :updatedBy")
    void delete(@BindUUID("entityId") UUID entityId, @Bind("updatedBy") String updatedBy);

    // Deletes the hold only if it has not changed since it was read (matched on updated_at), so a
    // resolution that read an earlier snapshot cannot drop a newer edit that accumulated in
    // between.
    @SqlUpdate(
        "DELETE FROM pending_approval_change WHERE entity_id = :entityId AND updated_by = :updatedBy AND updated_at = :updatedAt")
    void deleteIfUnchanged(
        @BindUUID("entityId") UUID entityId,
        @Bind("updatedBy") String updatedBy,
        @Bind("updatedAt") long updatedAt);

    @SqlUpdate("DELETE FROM pending_approval_change WHERE entity_id = :entityId")
    void deleteAllForEntity(@BindUUID("entityId") UUID entityId);
  }
}
