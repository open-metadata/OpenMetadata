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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeApplication;
import org.openmetadata.schema.governance.changeRequest.ChangeLifecycleEvent;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.governance.changeRequest.DeliveryStatus;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.approval.ChangeRequestKeys;
import org.openmetadata.service.governance.approval.ChangeRequestMappers;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.jdbi.BindConcat;
import org.openmetadata.service.util.jdbi.BindUUID;

public interface GovernanceDAOs {
  @CreateSqlObject
  DomainDAO domainDAO();

  @CreateSqlObject
  DataProductDAO dataProductDAO();

  @CreateSqlObject
  DataContractDAO dataContractDAO();

  @CreateSqlObject
  ChangeRequestDAO changeRequestDAO();

  @CreateSqlObject
  ChangeRevisionDAO changeRevisionDAO();

  @CreateSqlObject
  ApprovalDecisionDAO approvalDecisionDAO();

  @CreateSqlObject
  ChangeApplicationDAO changeApplicationDAO();

  @CreateSqlObject
  ChangeLifecycleEventDAO changeLifecycleEventDAO();

  interface DomainDAO extends EntityDAO<Domain> {
    @Override
    default String getTableName() {
      return "domain_entity";
    }

    @Override
    default Class<Domain> getEntityClass() {
      return Domain.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }

    @Override
    default int listCount(ListFilter filter) {
      String condition = filter.getConditionForEntity(getTableName());
      String directChildrenOf = filter.getQueryParam("directChildrenOf");
      String hierarchyFilter = filter.getQueryParam("hierarchyFilter");

      if (!nullOrEmpty(directChildrenOf)) {
        String parentFqnHash = FullyQualifiedName.buildHash(directChildrenOf);
        filter.queryParams.put("fqnHashSingleLevel", parentFqnHash + ".%");
        filter.queryParams.put("fqnHashNestedLevel", parentFqnHash + ".%.%");

        condition +=
            " AND fqnHash LIKE :fqnHashSingleLevel AND fqnHash NOT LIKE :fqnHashNestedLevel";
      } else if (Boolean.TRUE.toString().equals(hierarchyFilter)) {
        // For hierarchy API, when directChildrenOf is null, show only root domains
        condition +=
            " AND NOT EXISTS (SELECT 1 FROM entity_relationship er WHERE er.toId = domain_entity.id AND er.fromEntity = 'domain' AND er.toEntity = 'domain' AND er.relation = "
                + Relationship.CONTAINS.ordinal()
                + ")";
      }

      return listCount(getTableName(), getNameHashColumn(), filter.getQueryParams(), condition);
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String condition = filter.getConditionForEntity(getTableName());
      String directChildrenOf = filter.getQueryParam("directChildrenOf");
      String hierarchyFilter = filter.getQueryParam("hierarchyFilter");

      if (!nullOrEmpty(directChildrenOf)) {
        String parentFqnHash = FullyQualifiedName.buildHash(directChildrenOf);
        filter.queryParams.put("fqnHashSingleLevel", parentFqnHash + ".%");
        filter.queryParams.put("fqnHashNestedLevel", parentFqnHash + ".%.%");

        condition +=
            " AND fqnHash LIKE :fqnHashSingleLevel AND fqnHash NOT LIKE :fqnHashNestedLevel";
      } else if (Boolean.TRUE.toString().equals(hierarchyFilter)) {
        // For hierarchy API, when directChildrenOf is null, show only root domains
        condition +=
            " AND NOT EXISTS (SELECT 1 FROM entity_relationship er WHERE er.toId = domain_entity.id AND er.fromEntity = 'domain' AND er.toEntity = 'domain' AND er.relation = "
                + Relationship.CONTAINS.ordinal()
                + ")";
      }

      return listBefore(
          getTableName(), filter.getQueryParams(), condition, limit, beforeName, beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String condition = filter.getConditionForEntity(getTableName());
      String directChildrenOf = filter.getQueryParam("directChildrenOf");
      String hierarchyFilter = filter.getQueryParam("hierarchyFilter");
      String offsetParam = filter.getQueryParam("offset");

      if (!nullOrEmpty(directChildrenOf)) {
        String parentFqnHash = FullyQualifiedName.buildHash(directChildrenOf);
        filter.queryParams.put("fqnHashSingleLevel", parentFqnHash + ".%");
        filter.queryParams.put("fqnHashNestedLevel", parentFqnHash + ".%.%");

        condition +=
            " AND fqnHash LIKE :fqnHashSingleLevel AND fqnHash NOT LIKE :fqnHashNestedLevel";
      } else if (Boolean.TRUE.toString().equals(hierarchyFilter)) {
        // For hierarchy API, when directChildrenOf is null, show only root domains
        condition +=
            " AND NOT EXISTS (SELECT 1 FROM entity_relationship er WHERE er.toId = domain_entity.id AND er.fromEntity = 'domain' AND er.toEntity = 'domain' AND er.relation = "
                + Relationship.CONTAINS.ordinal()
                + ")";
      }

      if (!nullOrEmpty(offsetParam) && Integer.parseInt(offsetParam) >= 0) {
        return listAfter(
            getTableName(),
            filter.getQueryParams(),
            condition,
            limit,
            Integer.parseInt(offsetParam));
      }

      return listAfter(
          getTableName(), filter.getQueryParams(), condition, limit, afterName, afterId);
    }

    @SqlQuery("SELECT json FROM domain_entity WHERE fqnHash LIKE :concatFqnhash ")
    List<String> getNestedDomains(
        @BindConcat(
                value = "concatFqnhash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash);

    @SqlQuery("SELECT COUNT(*) FROM domain_entity WHERE fqnHash LIKE :concatFqnhash ")
    int countNestedDomains(
        @BindConcat(
                value = "concatFqnhash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash);

    @SqlQuery("SELECT fqnHash FROM domain_entity WHERE fqnHash LIKE :prefix")
    List<String> listFqnHashesByPrefix(@Bind("prefix") String prefix);

    @SqlQuery("SELECT fqnHash FROM domain_entity")
    List<String> listAllFqnHashes();

    @ConnectionAwareSqlQuery(
        value = "SELECT json ->> 'fullyQualifiedName' FROM domain_entity ORDER BY fqnHash",
        connectionType = POSTGRES)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName')) FROM domain_entity ORDER BY fqnHash",
        connectionType = MYSQL)
    List<String> listAllFqns();
  }

  interface DataProductDAO extends EntityDAO<DataProduct> {
    @Override
    default String getTableName() {
      return "data_product_entity";
    }

    @Override
    default Class<DataProduct> getEntityClass() {
      return DataProduct.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }
  }

  interface DataContractDAO extends EntityDAO<DataContract> {
    @Override
    default String getTableName() {
      return "data_contract_entity";
    }

    @Override
    default Class<DataContract> getEntityClass() {
      return DataContract.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM data_contract_entity WHERE JSON_EXTRACT(json, '$.entity.id') = :entityId AND JSON_EXTRACT(json, '$.entity.type') = :entityType AND (JSON_EXTRACT(json, '$.deleted') IS NULL OR JSON_EXTRACT(json, '$.deleted') = false) LIMIT 1",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM data_contract_entity WHERE json#>>'{entity,id}' = :entityId AND json#>>'{entity,type}' = :entityType AND (json->>'deleted' IS NULL OR json->>'deleted' = 'false') LIMIT 1",
        connectionType = POSTGRES)
    String getContractByEntityId(
        @Bind("entityId") String entityId, @Bind("entityType") String entityType);
  }

  interface ChangeRequestDAO {
    String COLUMNS =
        "id, entityType, entityId, requestedBy, workflowDefinitionId, status, activeInterceptKey,"
            + " taskId, deliveryStatus, deliveryAttempts, nextDeliveryAt, updatedAt, json";

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO change_request ("
                + COLUMNS
                + ") VALUES (:id, :entityType, :entityId,"
                + " :requestedBy, :workflowDefinitionId, :status, :activeInterceptKey, :taskId,"
                + " :deliveryStatus, 0, :updatedAt, :updatedAt, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO change_request ("
                + COLUMNS
                + ") VALUES (:id, :entityType, :entityId,"
                + " :requestedBy, :workflowDefinitionId, :status, :activeInterceptKey, :taskId,"
                + " :deliveryStatus, 0, :updatedAt, :updatedAt, :json::jsonb)",
        connectionType = POSTGRES)
    void insertRow(
        @Bind("id") String id,
        @Bind("entityType") String entityType,
        @Bind("entityId") String entityId,
        @Bind("requestedBy") String requestedBy,
        @Bind("workflowDefinitionId") String workflowDefinitionId,
        @Bind("status") String status,
        @Bind("activeInterceptKey") String activeInterceptKey,
        @Bind("taskId") String taskId,
        @Bind("deliveryStatus") String deliveryStatus,
        @Bind("updatedAt") long updatedAt,
        @Bind("json") String json);

    default void insert(ChangeRequest request) {
      insertRow(
          request.getId().toString(),
          request.getEntityType(),
          request.getEntityId().toString(),
          request.getRequestedBy(),
          request.getWorkflowDefinitionId().toString(),
          request.getStatus().value(),
          ChangeRequestKeys.activeInterceptKey(request),
          request.getTaskId() == null ? null : request.getTaskId().toString(),
          DeliveryStatus.PENDING.value(),
          request.getUpdatedAt(),
          JsonUtils.pojoToJson(persistable(request)));
    }

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE change_request SET status = :status, activeInterceptKey = :activeInterceptKey,"
                + " taskId = :taskId, updatedAt = :updatedAt, json = :json WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE change_request SET status = :status, activeInterceptKey = :activeInterceptKey,"
                + " taskId = :taskId, updatedAt = :updatedAt, json = :json::jsonb WHERE id = :id",
        connectionType = POSTGRES)
    void updateRow(
        @Bind("id") String id,
        @Bind("status") String status,
        @Bind("activeInterceptKey") String activeInterceptKey,
        @Bind("taskId") String taskId,
        @Bind("updatedAt") long updatedAt,
        @Bind("json") String json);

    default void update(ChangeRequest request) {
      request.setUpdatedAt(System.currentTimeMillis());
      updateRow(
          request.getId().toString(),
          request.getStatus().value(),
          ChangeRequestKeys.activeInterceptKey(request),
          request.getTaskId() == null ? null : request.getTaskId().toString(),
          request.getUpdatedAt(),
          JsonUtils.pojoToJson(persistable(request)));
    }

    // activeRevision is a read-side projection; delivery fields are column-owned.
    private static ChangeRequest persistable(ChangeRequest request) {
      return JsonUtils.deepCopy(request, ChangeRequest.class)
          .withActiveRevision(null)
          .withDeliveryStatus(null)
          .withDeliveryAttempts(null);
    }

    @SqlQuery("SELECT * FROM change_request WHERE id = :id")
    @RegisterRowMapper(ChangeRequestMappers.ChangeRequestMapper.class)
    ChangeRequest findById(@BindUUID("id") UUID id);

    @SqlQuery("SELECT * FROM change_request WHERE id = :id FOR UPDATE")
    @RegisterRowMapper(ChangeRequestMappers.ChangeRequestMapper.class)
    ChangeRequest findByIdForUpdate(@BindUUID("id") UUID id);

    @SqlQuery("SELECT * FROM change_request WHERE activeInterceptKey = :key FOR UPDATE")
    @RegisterRowMapper(ChangeRequestMappers.ChangeRequestMapper.class)
    ChangeRequest findByActiveInterceptKeyForUpdate(@Bind("key") String activeInterceptKey);

    @SqlQuery("SELECT * FROM change_request WHERE taskId = :taskId")
    @RegisterRowMapper(ChangeRequestMappers.ChangeRequestMapper.class)
    ChangeRequest findByTaskId(@BindUUID("taskId") UUID taskId);

    @SqlQuery("SELECT COUNT(*) FROM change_request WHERE status = :status")
    int countByStatus(@Bind("status") String status);

    @SqlQuery(
        "SELECT * FROM change_request WHERE entityId = :entityId ORDER BY updatedAt DESC LIMIT :limit")
    @RegisterRowMapper(ChangeRequestMappers.ChangeRequestMapper.class)
    List<ChangeRequest> listByEntity(@BindUUID("entityId") UUID entityId, @Bind("limit") int limit);

    @SqlQuery(
        "SELECT * FROM change_request WHERE entityId IN (<entityIds>) AND status IN (<statuses>)")
    @RegisterRowMapper(ChangeRequestMappers.ChangeRequestMapper.class)
    List<ChangeRequest> listByEntitiesAndStatuses(
        @BindList("entityIds") List<String> entityIds, @BindList("statuses") List<String> statuses);

    @SqlQuery(
        "SELECT * FROM change_request WHERE requestedBy = :requestedBy ORDER BY updatedAt DESC LIMIT :limit")
    @RegisterRowMapper(ChangeRequestMappers.ChangeRequestMapper.class)
    List<ChangeRequest> listByRequester(
        @Bind("requestedBy") String requestedBy, @Bind("limit") int limit);

    @SqlQuery(
        "SELECT * FROM change_request WHERE workflowDefinitionId = :workflowId"
            + " AND status IN (<statuses>)")
    @RegisterRowMapper(ChangeRequestMappers.ChangeRequestMapper.class)
    List<ChangeRequest> listByWorkflowAndStatuses(
        @BindUUID("workflowId") UUID workflowDefinitionId,
        @BindList("statuses") List<String> statuses);

    @SqlUpdate(
        "UPDATE change_request SET deliveryStatus = 'Pending', nextDeliveryAt = :next,"
            + " claimToken = NULL, leaseUntil = NULL WHERE id = :id")
    void markDeliveryDue(@BindUUID("id") UUID id, @Bind("next") long nextDeliveryAt);

    @SqlUpdate(
        "UPDATE change_request SET deliveryStatus = 'Delivering', claimToken = :token,"
            + " leaseUntil = :leaseUntil, deliveryAttempts = deliveryAttempts + 1 WHERE id = :id"
            + " AND status = 'Pending' AND ((deliveryStatus = 'Pending' AND nextDeliveryAt <= :now)"
            + " OR (deliveryStatus = 'Delivering' AND leaseUntil < :now))")
    int claimForDelivery(
        @BindUUID("id") UUID id,
        @Bind("token") String claimToken,
        @Bind("leaseUntil") long leaseUntil,
        @Bind("now") long now);

    @SqlUpdate(
        "UPDATE change_request SET deliveryStatus = 'Delivered', claimToken = NULL, leaseUntil = NULL"
            + " WHERE id = :id AND claimToken = :token")
    int completeDelivery(@BindUUID("id") UUID id, @Bind("token") String claimToken);

    @SqlUpdate(
        "UPDATE change_request SET deliveryStatus = :deliveryStatus, nextDeliveryAt = :next,"
            + " claimToken = NULL, leaseUntil = NULL WHERE id = :id AND claimToken = :token")
    int releaseDelivery(
        @BindUUID("id") UUID id,
        @Bind("token") String claimToken,
        @Bind("deliveryStatus") String deliveryStatus,
        @Bind("next") long nextDeliveryAt);

    @SqlQuery(
        "SELECT id FROM change_request WHERE status = 'Pending' AND ((deliveryStatus = 'Pending'"
            + " AND nextDeliveryAt <= :now) OR (deliveryStatus = 'Delivering' AND leaseUntil < :now))"
            + " ORDER BY nextDeliveryAt LIMIT :limit")
    List<String> listDueForDelivery(@Bind("now") long now, @Bind("limit") int limit);

    @SqlQuery(
        "SELECT id FROM change_request WHERE status = 'Approved' AND updatedAt < :before"
            + " ORDER BY updatedAt LIMIT :limit")
    List<String> listApprovedBefore(@Bind("before") long updatedBefore, @Bind("limit") int limit);

    @SqlQuery(
        "SELECT CONCAT(COUNT(*), ':', COALESCE(MAX(updatedAt), 0)) FROM workflow_definition_entity")
    String workflowDefinitionEpoch();

    @SqlUpdate(
        "UPDATE change_request SET deliveryStatus = 'Pending', deliveryAttempts = 0,"
            + " nextDeliveryAt = :now, claimToken = NULL, leaseUntil = NULL"
            + " WHERE workflowDefinitionId = :workflowId AND status = 'Pending'"
            + " AND deliveryStatus = 'AttentionRequired'")
    int requeueAttentionRequired(
        @BindUUID("workflowId") UUID workflowDefinitionId, @Bind("now") long now);

    // Clearing the claim makes any in-flight delivery's complete/release a no-op, so a delivery
    // that fails because of this refusal cannot put the request back to Pending.
    @SqlUpdate(
        "UPDATE change_request SET deliveryStatus = 'AttentionRequired', claimToken = NULL,"
            + " leaseUntil = NULL WHERE id = :id")
    void markAttentionRequired(@BindUUID("id") UUID id);

    @SqlUpdate("UPDATE change_request SET updatedAt = :updatedAt WHERE id = :id")
    void backdate(@BindUUID("id") UUID id, @Bind("updatedAt") long updatedAt);
  }

  interface ChangeRevisionDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO change_revision (id, changeRequestId, revisionNumber, status, json)"
                + " VALUES (:id, :changeRequestId, :revisionNumber, :status, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO change_revision (id, changeRequestId, revisionNumber, status, json)"
                + " VALUES (:id, :changeRequestId, :revisionNumber, :status, :json::jsonb)",
        connectionType = POSTGRES)
    void insertRow(
        @Bind("id") String id,
        @Bind("changeRequestId") String changeRequestId,
        @Bind("revisionNumber") int revisionNumber,
        @Bind("status") String status,
        @Bind("json") String json);

    default void insert(ChangeRevision revision) {
      insertRow(
          revision.getId().toString(),
          revision.getChangeRequestId().toString(),
          revision.getRevisionNumber(),
          revision.getStatus().value(),
          JsonUtils.pojoToJson(revision));
    }

    @ConnectionAwareSqlUpdate(
        value = "UPDATE change_revision SET status = :status, json = :json WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE change_revision SET status = :status, json = :json::jsonb WHERE id = :id",
        connectionType = POSTGRES)
    void updateStatusRow(
        @Bind("id") String id, @Bind("status") String status, @Bind("json") String json);

    default void updateStatus(ChangeRevision revision) {
      updateStatusRow(
          revision.getId().toString(),
          revision.getStatus().value(),
          JsonUtils.pojoToJson(revision));
    }

    @SqlQuery("SELECT json FROM change_revision WHERE id = :id")
    @RegisterRowMapper(ChangeRequestMappers.ChangeRevisionMapper.class)
    ChangeRevision findById(@BindUUID("id") UUID id);

    @SqlQuery("SELECT json FROM change_revision WHERE id IN (<ids>)")
    @RegisterRowMapper(ChangeRequestMappers.ChangeRevisionMapper.class)
    List<ChangeRevision> findByIds(@BindList("ids") List<String> ids);

    @SqlQuery(
        "SELECT json FROM change_revision WHERE changeRequestId = :changeRequestId"
            + " ORDER BY revisionNumber")
    @RegisterRowMapper(ChangeRequestMappers.ChangeRevisionMapper.class)
    List<ChangeRevision> listByRequest(@BindUUID("changeRequestId") UUID changeRequestId);
  }

  interface ApprovalDecisionDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO approval_decision (id, changeRequestId, revisionId, decidedBy, decision,"
                + " decidedAt, json) VALUES (:id, :changeRequestId, :revisionId, :decidedBy,"
                + " :decision, :decidedAt, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO approval_decision (id, changeRequestId, revisionId, decidedBy, decision,"
                + " decidedAt, json) VALUES (:id, :changeRequestId, :revisionId, :decidedBy,"
                + " :decision, :decidedAt, :json::jsonb)",
        connectionType = POSTGRES)
    void insertRow(
        @Bind("id") String id,
        @Bind("changeRequestId") String changeRequestId,
        @Bind("revisionId") String revisionId,
        @Bind("decidedBy") String decidedBy,
        @Bind("decision") String decision,
        @Bind("decidedAt") long decidedAt,
        @Bind("json") String json);

    default void insert(ApprovalDecision decision) {
      insertRow(
          decision.getId().toString(),
          decision.getChangeRequestId().toString(),
          decision.getRevisionId().toString(),
          decision.getDecidedBy(),
          decision.getDecision().value(),
          decision.getDecidedAt(),
          JsonUtils.pojoToJson(decision));
    }

    @SqlQuery(
        "SELECT json FROM approval_decision WHERE revisionId = :revisionId ORDER BY decidedAt")
    @RegisterRowMapper(ChangeRequestMappers.ApprovalDecisionMapper.class)
    List<ApprovalDecision> listByRevision(@BindUUID("revisionId") UUID revisionId);

    @SqlQuery(
        "SELECT json FROM approval_decision WHERE changeRequestId = :changeRequestId"
            + " ORDER BY decidedAt")
    @RegisterRowMapper(ChangeRequestMappers.ApprovalDecisionMapper.class)
    List<ApprovalDecision> listByRequest(@BindUUID("changeRequestId") UUID changeRequestId);
  }

  interface ChangeLifecycleEventDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO change_lifecycle_event (id, changeRequestId, eventSequence, eventType,"
                + " eventAt, json) VALUES (:id, :changeRequestId, :sequence, :eventType, :eventAt, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO change_lifecycle_event (id, changeRequestId, eventSequence, eventType,"
                + " eventAt, json) VALUES (:id, :changeRequestId, :sequence, :eventType, :eventAt,"
                + " :json::jsonb)",
        connectionType = POSTGRES)
    void insertRow(
        @Bind("id") String id,
        @Bind("changeRequestId") String changeRequestId,
        @Bind("sequence") int sequence,
        @Bind("eventType") String eventType,
        @Bind("eventAt") long eventAt,
        @Bind("json") String json);

    default void insert(ChangeLifecycleEvent event) {
      insertRow(
          event.getId().toString(),
          event.getChangeRequestId().toString(),
          event.getSequence(),
          event.getEventType().value(),
          event.getTimestamp(),
          JsonUtils.pojoToJson(event));
    }

    @SqlQuery(
        "SELECT COALESCE(MAX(eventSequence), 0) FROM change_lifecycle_event"
            + " WHERE changeRequestId = :changeRequestId")
    int lastSequence(@BindUUID("changeRequestId") UUID changeRequestId);

    @SqlQuery(
        "SELECT json FROM change_lifecycle_event WHERE changeRequestId = :changeRequestId"
            + " ORDER BY eventSequence")
    @RegisterRowMapper(ChangeRequestMappers.ChangeLifecycleEventMapper.class)
    List<ChangeLifecycleEvent> listByRequest(@BindUUID("changeRequestId") UUID changeRequestId);
  }

  interface ChangeApplicationDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO change_application (id, changeRequestId, revisionId, appliedAt, json)"
                + " VALUES (:id, :changeRequestId, :revisionId, :appliedAt, :json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO change_application (id, changeRequestId, revisionId, appliedAt, json)"
                + " VALUES (:id, :changeRequestId, :revisionId, :appliedAt, :json::jsonb)",
        connectionType = POSTGRES)
    void insertRow(
        @Bind("id") String id,
        @Bind("changeRequestId") String changeRequestId,
        @Bind("revisionId") String revisionId,
        @Bind("appliedAt") long appliedAt,
        @Bind("json") String json);

    default void insert(ChangeApplication application) {
      insertRow(
          application.getId().toString(),
          application.getChangeRequestId().toString(),
          application.getRevisionId().toString(),
          application.getAppliedAt(),
          JsonUtils.pojoToJson(application));
    }

    @SqlQuery("SELECT json FROM change_application WHERE changeRequestId = :id")
    @RegisterRowMapper(ChangeRequestMappers.ChangeApplicationMapper.class)
    ChangeApplication findByRequest(@BindUUID("id") UUID changeRequestId);
  }
}
