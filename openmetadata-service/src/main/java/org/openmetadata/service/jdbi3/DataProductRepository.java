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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_ENTITY_STATUS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.util.EntityUtil.mergedInheritedEntityRefs;

import jakarta.json.JsonPatch;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.domains.DataProductResource;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.rules.RuleValidationException;
import org.openmetadata.service.search.DefaultInheritedFieldEntitySearch;
import org.openmetadata.service.search.InheritedFieldEntitySearch;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldQuery;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldResult;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityFieldUtils;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.LineageUtil;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Slf4j
public class DataProductRepository extends EntityRepository<DataProduct> {
  private static final String UPDATE_FIELDS = "experts"; // Domain field can't be updated

  private InheritedFieldEntitySearch inheritedFieldEntitySearch;

  public DataProductRepository() {
    super(
        DataProductResource.COLLECTION_PATH,
        Entity.DATA_PRODUCT,
        DataProduct.class,
        Entity.getCollectionDAO().dataProductDAO(),
        UPDATE_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;

    // Initialize inherited field search
    if (searchRepository != null) {
      inheritedFieldEntitySearch = new DefaultInheritedFieldEntitySearch(searchRepository);
    }

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put("experts", this::fetchAndSetExperts);
  }

  @Override
  public void setFields(DataProduct entity, Fields fields) {
    // Assets field is not exposed via API - use dedicated paginated API:
    // GET /v1/dataProducts/{id}/assets
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<DataProduct> entities) {
    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);
    for (DataProduct entity : entities) {
      clearFieldsInternal(entity, fields);
    }
  }

  private void fetchAndSetExperts(List<DataProduct> dataProducts, Fields fields) {
    if (!fields.contains("experts") || dataProducts == null || dataProducts.isEmpty()) {
      return;
    }
    setFieldFromMap(true, dataProducts, batchFetchExperts(dataProducts), DataProduct::setExperts);
  }

  @Override
  public void clearFields(DataProduct entity, Fields fields) {
    // Assets field is deprecated - use GET /v1/dataProducts/{id}/assets API
    entity.setAssets(null);
  }

  @Override
  public void prepare(DataProduct entity, boolean update) {
    // Parent, Experts, Owner, Assets are already validated
  }

  @Override
  public void storeEntity(DataProduct entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(DataProduct entity) {
    for (EntityReference domain : listOrEmpty(entity.getDomains())) {
      addRelationship(
          domain.getId(),
          entity.getId(),
          Entity.DOMAIN,
          Entity.DATA_PRODUCT,
          Relationship.CONTAINS);
    }
    for (EntityReference expert : listOrEmpty(entity.getExperts())) {
      addRelationship(
          entity.getId(), expert.getId(), Entity.DATA_PRODUCT, Entity.USER, Relationship.EXPERT);
    }
    // Assets cannot be added via create/PUT/PATCH - use bulk API:
    // PUT /v1/dataProducts/{name}/assets/add
  }

  public final EntityReference getDomain(Domain domain) {
    return getFromEntityRef(domain.getId(), Relationship.CONTAINS, DOMAIN, false);
  }

  @Override
  public void setInheritedFields(DataProduct dataProduct, Fields fields) {
    // If dataProduct does not have owners and experts, inherit them from the domains
    List<EntityReference> domains =
        !nullOrEmpty(dataProduct.getDomains()) ? getDomains(dataProduct) : Collections.emptyList();
    if (!nullOrEmpty(domains)
        && (fields.contains(FIELD_EXPERTS) || fields.contains(FIELD_OWNERS))
        && (nullOrEmpty(dataProduct.getOwners()) || nullOrEmpty(dataProduct.getExperts()))) {
      List<EntityReference> owners = new ArrayList<>();
      List<EntityReference> experts = new ArrayList<>();

      for (EntityReference domainRef : domains) {
        Domain domain = Entity.getEntity(DOMAIN, domainRef.getId(), "owners,experts", ALL);
        owners = mergedInheritedEntityRefs(owners, domain.getOwners());
        experts = mergedInheritedEntityRefs(experts, domain.getExperts());
      }
      // inherit only if applicable and empty
      if (fields.contains(FIELD_OWNERS) && nullOrEmpty(dataProduct.getOwners())) {
        dataProduct.setOwners(owners);
      }
      if (fields.contains(FIELD_EXPERTS) && nullOrEmpty(dataProduct.getExperts())) {
        dataProduct.setExperts(experts);
      }
    }
  }

  @Override
  public EntityRepository<DataProduct>.EntityUpdater getUpdater(
      DataProduct original, DataProduct updated, Operation operation, ChangeSource changeSource) {
    return new DataProductUpdater(original, updated, operation);
  }

  public BulkOperationResult bulkAddAssets(String domainName, BulkAssets request) {
    DataProduct dataProduct = getByName(null, domainName, getFields("id"));
    BulkOperationResult result =
        bulkAssetsOperation(dataProduct.getId(), DATA_PRODUCT, Relationship.HAS, request, true);
    if (result.getStatus().equals(ApiStatus.SUCCESS)) {
      for (EntityReference ref : listOrEmpty(request.getAssets())) {
        LineageUtil.addDataProductsLineage(
            ref.getId(), ref.getType(), List.of(dataProduct.getEntityReference()));
      }
    }
    return result;
  }

  public BulkOperationResult bulkRemoveAssets(String domainName, BulkAssets request) {
    DataProduct dataProduct = getByName(null, domainName, getFields("id"));
    BulkOperationResult result =
        bulkAssetsOperation(dataProduct.getId(), DATA_PRODUCT, Relationship.HAS, request, false);
    if (result.getStatus().equals(ApiStatus.SUCCESS)) {
      for (EntityReference ref : listOrEmpty(request.getAssets())) {
        LineageUtil.removeDataProductsLineage(
            ref.getId(), ref.getType(), List.of(dataProduct.getEntityReference()));
      }
    }
    return result;
  }

  public ResultList<EntityReference> getDataProductAssets(
      UUID dataProductId, int limit, int offset) {
    DataProduct dataProduct = get(null, dataProductId, getFields("id,fullyQualifiedName"));

    if (inheritedFieldEntitySearch == null) {
      LOG.warn("Search is unavailable for data product assets. Returning empty list.");
      return new ResultList<>(new ArrayList<>(), null, null, 0);
    }

    // Use InheritedFieldQuery for data product assets
    InheritedFieldQuery query =
        InheritedFieldQuery.forDataProduct(dataProduct.getFullyQualifiedName(), offset, limit);

    InheritedFieldResult result =
        inheritedFieldEntitySearch.getEntitiesForField(
            query,
            () -> {
              LOG.warn(
                  "Search fallback for data product {} assets. Returning empty list.",
                  dataProduct.getFullyQualifiedName());
              return new InheritedFieldResult(new ArrayList<>(), 0);
            });

    return new ResultList<>(result.entities(), null, null, result.total());
  }

  public ResultList<EntityReference> getDataProductAssetsByName(
      String dataProductName, int limit, int offset) {
    DataProduct dataProduct = getByName(null, dataProductName, getFields("id,fullyQualifiedName"));
    return getDataProductAssets(dataProduct.getId(), limit, offset);
  }

  public Map<String, Integer> getAllDataProductsWithAssetsCount() {
    if (inheritedFieldEntitySearch == null) {
      LOG.warn("Search unavailable for data product asset counts");
      return new HashMap<>();
    }

    List<DataProduct> allDataProducts =
        listAll(getFields("fullyQualifiedName"), new ListFilter(null));
    Map<String, Integer> dataProductAssetCounts = new LinkedHashMap<>();

    for (DataProduct dataProduct : allDataProducts) {
      InheritedFieldQuery query =
          InheritedFieldQuery.forDataProduct(dataProduct.getFullyQualifiedName(), 0, 0);

      Integer count =
          inheritedFieldEntitySearch.getCountForField(
              query,
              () -> {
                LOG.warn(
                    "Search fallback for data product {} asset count. Returning 0.",
                    dataProduct.getFullyQualifiedName());
                return 0;
              });

      dataProductAssetCounts.put(dataProduct.getFullyQualifiedName(), count);
    }

    return dataProductAssetCounts;
  }

  @Transaction
  @Override
  protected BulkOperationResult bulkAssetsOperation(
      UUID entityId,
      String fromEntity,
      Relationship relationship,
      BulkAssets request,
      boolean isAdd) {
    BulkOperationResult result =
        new BulkOperationResult().withStatus(ApiStatus.SUCCESS).withDryRun(false);
    List<BulkResponse> success = new ArrayList<>();
    List<BulkResponse> failed = new ArrayList<>();

    ArrayList<EntityReference> assets = new ArrayList<>(listOrEmpty(request.getAssets()));
    EntityUtil.populateEntityReferences(assets);

    // Get the data product reference for validation
    DataProduct dataProduct = find(entityId, ALL);
    EntityReference dataProductRef = dataProduct.getEntityReference();

    // Group assets by type for efficient fetching
    Map<String, List<EntityReference>> assetsByType = new HashMap<>();
    for (EntityReference asset : assets) {
      assetsByType.computeIfAbsent(asset.getType(), k -> new ArrayList<>()).add(asset);
    }

    // Fetch all asset entities grouped by type for validation
    Map<UUID, EntityInterface> assetEntitiesMap = new HashMap<>();
    if (isAdd && !assets.isEmpty()) {
      for (Map.Entry<String, List<EntityReference>> entry : assetsByType.entrySet()) {
        List<EntityInterface> entitiesOfType =
            Entity.getEntities(entry.getValue(), "domains,dataProducts", ALL);
        for (int i = 0; i < entitiesOfType.size(); i++) {
          assetEntitiesMap.put(entry.getValue().get(i).getId(), entitiesOfType.get(i));
        }
      }
    }

    for (EntityReference ref : assets) {
      result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);

      try {
        if (isAdd) {
          EntityInterface assetEntity = assetEntitiesMap.get(ref.getId());
          if (assetEntity == null) {
            throw new IllegalStateException("Asset entity not found for ID: " + ref.getId());
          }
          validateAssetDataProductAssignment(assetEntity, dataProductRef);
          addRelationship(entityId, ref.getId(), fromEntity, ref.getType(), relationship);
        } else {
          deleteRelationship(entityId, fromEntity, ref.getId(), ref.getType(), relationship);
        }

        success.add(new BulkResponse().withRequest(ref));
        result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);

        searchRepository.updateEntity(ref);
      } catch (RuleValidationException e) {
        LOG.warn(
            "Validation failed for asset {} in bulk operation: {}", ref.getId(), e.getMessage());
        failed.add(new BulkResponse().withRequest(ref).withMessage(e.getMessage()));
        result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
        result.setStatus(ApiStatus.PARTIAL_SUCCESS);
      } catch (Exception e) {
        LOG.error(
            "Unexpected error during bulk operation for asset {}: {}",
            ref.getId(),
            e.getMessage(),
            e);
        failed.add(
            new BulkResponse().withRequest(ref).withMessage("Internal error: " + e.getMessage()));
        result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
        result.setStatus(ApiStatus.PARTIAL_SUCCESS);
      }
    }

    result.withSuccessRequest(success).withFailedRequest(failed);

    // If all operations failed, mark as failure
    if (success.isEmpty() && !failed.isEmpty()) {
      result.setStatus(ApiStatus.FAILURE);
    }

    // Create a Change Event on successful operations
    if (!success.isEmpty()) {
      EntityInterface entityInterface = Entity.getEntity(fromEntity, entityId, "id", ALL);
      List<EntityReference> successfulAssets = new ArrayList<>();
      for (BulkResponse response : success) {
        successfulAssets.add((EntityReference) response.getRequest());
      }
      ChangeDescription change =
          addBulkAddRemoveChangeDescription(
              entityInterface.getVersion(), isAdd, successfulAssets, null);
      ChangeEvent changeEvent =
          getChangeEvent(entityInterface, change, fromEntity, entityInterface.getVersion());
      Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));
    }

    return result;
  }

  /**
   * Validates that an asset can be assigned to a data product according to configured rules.
   * This method leverages the RuleEngine to validate domain matching rules that are enabled.
   *
   * @param assetEntity The asset entity interface (pre-fetched with domains,dataProducts)
   * @param dataProductRef The data product entity reference
   * @throws RuleValidationException if validation fails
   */
  private void validateAssetDataProductAssignment(
      EntityInterface assetEntity, EntityReference dataProductRef) {
    try {

      List<EntityReference> currentDataProducts = listOrEmpty(assetEntity.getDataProducts());
      List<EntityReference> updatedDataProducts = new ArrayList<>(currentDataProducts);
      updatedDataProducts.add(dataProductRef);

      assetEntity.setDataProducts(updatedDataProducts);
      RuleEngine.getInstance().evaluate(assetEntity, true, false);

    } catch (RuleValidationException e) {
      // Re-throw validation exceptions with context about the bulk operation
      throw new RuleValidationException(
          String.format(
              "Cannot assign asset '%s' (type: %s) to data product '%s': %s",
              assetEntity.getName(),
              assetEntity.getEntityReference().getType(),
              dataProductRef.getName(),
              e.getMessage()));
    } catch (Exception e) {
      LOG.warn(
          "Error during asset data product validation for asset {}: {}",
          assetEntity.getId(),
          e.getMessage());
    }
  }

  @Override
  public void restorePatchAttributes(DataProduct original, DataProduct updated) {
    super.restorePatchAttributes(original, updated);
    updated.withDomains(original.getDomains()); // Domain can't be changed
  }

  @Override
  protected void postUpdate(DataProduct original, DataProduct updated) {
    super.postUpdate(original, updated);
    if (original.getEntityStatus() == EntityStatus.IN_REVIEW) {
      if (updated.getEntityStatus() == EntityStatus.APPROVED) {
        closeApprovalTask(updated, "Approved the data product");
      } else if (updated.getEntityStatus() == EntityStatus.REJECTED) {
        closeApprovalTask(updated, "Rejected the data product");
      }
    }

    // TODO: It might happen that a task went from DRAFT to IN_REVIEW to DRAFT fairly quickly
    // Due to ChangesConsolidation, the postUpdate will be called as from DRAFT to DRAFT, but there
    // will be a Task created.
    // This if handles this case scenario, by guaranteeing that we are any Approval Task if the
    // Data Product goes back to DRAFT.
    if (updated.getEntityStatus() == EntityStatus.DRAFT) {
      try {
        closeApprovalTask(updated, "Closed due to data product going back to DRAFT.");
      } catch (EntityNotFoundException ignored) {
      } // No ApprovalTask is present, and thus we don't need to worry about this.
    }

    // Assets are not tracked via inline updates - they are managed through bulk APIs
    // Search index updates for assets are triggered by the bulk APIs directly
  }

  public class DataProductUpdater extends EntityUpdater {
    public DataProductUpdater(DataProduct original, DataProduct updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void updateReviewers() {
      super.updateReviewers();
      // adding the reviewer should add the person as assignee to the task
      if (original.getReviewers() != null
          && updated.getReviewers() != null
          && !original.getReviewers().equals(updated.getReviewers())) {
        updateTaskWithNewReviewers(updated);
      }
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      // Assets cannot be updated via PUT/PATCH - use bulk APIs:
      // PUT /v1/dataProducts/{name}/assets/add
      // PUT /v1/dataProducts/{name}/assets/remove
    }
  }

  private Map<UUID, List<EntityReference>> batchFetchExperts(List<DataProduct> dataProducts) {
    Map<UUID, List<EntityReference>> expertsMap = new HashMap<>();
    if (dataProducts == null || dataProducts.isEmpty()) {
      return expertsMap;
    }

    // Initialize empty lists for all data products
    for (DataProduct dataProduct : dataProducts) {
      expertsMap.put(dataProduct.getId(), new ArrayList<>());
    }

    // Single batch query to get all expert relationships
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findToBatch(
                entityListToStrings(dataProducts), Relationship.EXPERT.ordinal(), Entity.USER);

    // Group experts by data product ID
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID dataProductId = UUID.fromString(record.getFromId());
      EntityReference expertRef =
          Entity.getEntityReferenceById(
              Entity.USER, UUID.fromString(record.getToId()), NON_DELETED);
      expertsMap.get(dataProductId).add(expertRef);
    }

    return expertsMap;
  }

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
    TaskType taskType = threadContext.getThread().getTask().getType();
    if (EntityUtil.isDescriptionTask(taskType)) {
      return new DescriptionTaskWorkflow(threadContext);
    } else if (EntityUtil.isTagTask(taskType)) {
      return new TagTaskWorkflow(threadContext);
    } else if (!EntityUtil.isTestCaseFailureResolutionTask(taskType)) {
      return new ApprovalTaskWorkflow(threadContext);
    }
    return super.getTaskWorkflow(threadContext);
  }

  public static class ApprovalTaskWorkflow extends TaskWorkflow {
    ApprovalTaskWorkflow(ThreadContext threadContext) {
      super(threadContext);
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      DataProduct dataProduct = (DataProduct) threadContext.getAboutEntity();
      DataProductRepository.checkUpdatedByReviewer(dataProduct, user);

      UUID taskId = threadContext.getThread().getId();
      Map<String, Object> variables = new HashMap<>();
      variables.put(RESULT_VARIABLE, resolveTask.getNewValue().equalsIgnoreCase("approved"));
      variables.put(UPDATED_BY_VARIABLE, user);
      WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
      boolean workflowSuccess =
          workflowHandler.resolveTask(
              taskId, workflowHandler.transformToNodeVariables(taskId, variables));

      // If workflow failed (corrupted Flowable task), apply the status directly
      if (!workflowSuccess) {
        LOG.warn(
            "[GlossaryTerm] Workflow failed for taskId='{}', applying status directly", taskId);
        Boolean approved = (Boolean) variables.get(RESULT_VARIABLE);
        String entityStatus = (approved != null && approved) ? "Approved" : "Rejected";
        EntityFieldUtils.setEntityField(
            dataProduct, DATA_PRODUCT, user, FIELD_ENTITY_STATUS, entityStatus, true);
      }

      return dataProduct;
    }
  }

  @Override
  protected void preDelete(DataProduct entity, String deletedBy) {
    // A data product in `Draft` state can only be deleted by the reviewers
    if (EntityStatus.IN_REVIEW.equals(entity.getEntityStatus())) {
      checkUpdatedByReviewer(entity, deletedBy);
    }
  }

  public static void checkUpdatedByReviewer(DataProduct dataProduct, String updatedBy) {
    // Only list of allowed reviewers can change the status from DRAFT to APPROVED
    List<EntityReference> reviewers = dataProduct.getReviewers();
    if (!nullOrEmpty(reviewers)) {
      // Updating user must be one of the reviewers
      boolean isReviewer =
          reviewers.stream()
              .anyMatch(
                  e -> {
                    if (e.getType().equals(TEAM)) {
                      Team team =
                          Entity.getEntityByName(TEAM, e.getName(), "users", Include.NON_DELETED);
                      return team.getUsers().stream()
                          .anyMatch(
                              u ->
                                  u.getName().equals(updatedBy)
                                      || u.getFullyQualifiedName().equals(updatedBy));
                    } else {
                      return e.getName().equals(updatedBy)
                          || e.getFullyQualifiedName().equals(updatedBy);
                    }
                  });
      if (!isReviewer) {
        throw new AuthorizationException(notReviewer(updatedBy));
      }
    }
  }

  private void closeApprovalTask(DataProduct entity, String comment) {
    EntityLink about = new EntityLink(DATA_PRODUCT, entity.getFullyQualifiedName());
    FeedRepository feedRepository = Entity.getFeedRepository();

    // Try to close ChangeReview task first (higher priority)
    // Try to close RequestApproval task
    try {
      Thread taskThread = feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      feedRepository.closeTask(
          taskThread, entity.getUpdatedBy(), new CloseTask().withComment(comment));
    } catch (EntityNotFoundException ex) {
      LOG.info("No approval task found for data product {}", entity.getFullyQualifiedName());
    }
  }

  protected void updateTaskWithNewReviewers(DataProduct dataProduct) {
    try {
      EntityLink about = new EntityLink(DATA_PRODUCT, dataProduct.getFullyQualifiedName());
      FeedRepository feedRepository = Entity.getFeedRepository();
      Thread originalTask =
          feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      dataProduct =
          Entity.getEntityByName(
              Entity.DATA_PRODUCT,
              dataProduct.getFullyQualifiedName(),
              "id,fullyQualifiedName,reviewers",
              Include.ALL);

      Thread updatedTask = JsonUtils.deepCopy(originalTask, Thread.class);
      updatedTask.getTask().withAssignees(new ArrayList<>(dataProduct.getReviewers()));
      JsonPatch patch = JsonUtils.getJsonPatch(originalTask, updatedTask);
      RestUtil.PatchResponse<Thread> thread =
          feedRepository.patchThread(null, originalTask.getId(), updatedTask.getUpdatedBy(), patch);

      // Send WebSocket Notification
      WebsocketNotificationHandler.handleTaskNotification(thread.entity());
    } catch (EntityNotFoundException e) {
      LOG.info(
          "{} Task not found for data product {}",
          TaskType.RequestApproval,
          dataProduct.getFullyQualifiedName());
    }
  }
}
