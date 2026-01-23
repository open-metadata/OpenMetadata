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
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.CLASSIFICATION;
import static org.openmetadata.service.Entity.FIELD_ENTITY_STATUS;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusiveForParentAndSubField;
import static org.openmetadata.service.resources.tags.TagLabelUtil.getUniqueTags;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.getId;

import jakarta.json.JsonPatch;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.BulkAssetsRequestInterface;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.AddTagToAssetsRequest;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.tags.TagResource;
import org.openmetadata.service.search.DefaultInheritedFieldEntitySearch;
import org.openmetadata.service.search.InheritedFieldEntitySearch;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldQuery;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldResult;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityFieldUtils;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Slf4j
public class TagRepository extends EntityRepository<Tag> {
  private InheritedFieldEntitySearch inheritedFieldEntitySearch;

  public TagRepository() {
    super(
        TagResource.TAG_COLLECTION_PATH,
        Entity.TAG,
        Tag.class,
        Entity.getCollectionDAO().tagDAO(),
        "",
        "");
    supportsSearch = true;
    renameAllowed = true;

    // Initialize inherited field search
    if (searchRepository != null) {
      inheritedFieldEntitySearch = new DefaultInheritedFieldEntitySearch(searchRepository);
    }
  }

  public ResultList<EntityReference> getTagAssets(UUID tagId, int limit, int offset) {
    Tag tag = get(null, tagId, getFields("id,fullyQualifiedName"));

    if (inheritedFieldEntitySearch == null) {
      LOG.warn("Search is unavailable for tag assets. Returning empty list.");
      return new ResultList<>(new ArrayList<>(), null, null, 0);
    }

    InheritedFieldQuery query =
        InheritedFieldQuery.forTag(tag.getFullyQualifiedName(), offset, limit);

    InheritedFieldResult result =
        inheritedFieldEntitySearch.getEntitiesForField(
            query,
            () -> {
              LOG.warn(
                  "Search fallback for tag {} assets. Returning empty list.",
                  tag.getFullyQualifiedName());
              return new InheritedFieldResult(new ArrayList<>(), 0);
            });

    return new ResultList<>(result.entities(), null, null, result.total());
  }

  public ResultList<EntityReference> getTagAssetsByName(String tagName, int limit, int offset) {
    Tag tag = getByName(null, tagName, getFields("id,fullyQualifiedName"));
    return getTagAssets(tag.getId(), limit, offset);
  }

  public Map<String, Integer> getAllTagsWithAssetsCount() {
    if (inheritedFieldEntitySearch == null) {
      LOG.warn("Search unavailable for tag asset counts");
      return new HashMap<>();
    }

    List<Tag> allTags = listAll(getFields("fullyQualifiedName"), new ListFilter(null));
    Map<String, Integer> tagAssetCounts = new LinkedHashMap<>();

    for (Tag tag : allTags) {
      InheritedFieldQuery query = InheritedFieldQuery.forTag(tag.getFullyQualifiedName(), 0, 0);

      Integer count =
          inheritedFieldEntitySearch.getCountForField(
              query,
              () -> {
                LOG.warn(
                    "Search fallback for tag {} asset count. Returning 0.",
                    tag.getFullyQualifiedName());
                return 0;
              });

      tagAssetCounts.put(tag.getFullyQualifiedName(), count);
    }

    return tagAssetCounts;
  }

  @Override
  public void prepare(Tag entity, boolean update) {
    // Validate parent term
    EntityReference parentTerm = Entity.getEntityReference(entity.getParent(), NON_DELETED);
    entity.setParent(parentTerm);

    // Validate Classification
    EntityReference classification =
        Entity.getEntityReference(entity.getClassification(), NON_DELETED);
    entity.setClassification(classification);

    // Validate recognizers
    if (entity.getRecognizers() != null) {
      for (org.openmetadata.schema.type.Recognizer recognizer : entity.getRecognizers()) {
        validateRecognizer(recognizer);
      }
    }
  }

  private void validateRecognizer(org.openmetadata.schema.type.Recognizer recognizer) {
    if (recognizer.getRecognizerConfig() == null) {
      throw new IllegalArgumentException("recognizerConfig is required");
    }

    if (recognizer.getConfidenceThreshold() != null) {
      double threshold = recognizer.getConfidenceThreshold();
      if (threshold < 0.0 || threshold > 1.0) {
        throw new IllegalArgumentException("confidenceThreshold must be between 0.0 and 1.0");
      }
    }
  }

  @Override
  public void setInheritedFields(Tag tag, Fields fields) {
    if (tag.getClassification() == null || tag.getClassification().getId() == null) {
      return;
    }

    try {
      Classification parent =
          Entity.getEntity(
              CLASSIFICATION, tag.getClassification().getId(), "owners,domains,reviewers", ALL);
      if (parent.getDisabled() != null && parent.getDisabled()) {
        tag.setDisabled(true);
      }
      inheritOwners(tag, fields, parent);
      inheritDomains(tag, fields, parent);
      inheritReviewers(tag, fields, parent);
    } catch (Exception e) {
      LOG.debug(
          "Failed to get classification {} for tag {}: {}",
          tag.getClassification().getId(),
          tag.getId(),
          e.getMessage());
    }
  }

  @Override
  public void setInheritedFields(List<Tag> tags, Fields fields) {
    if (tags == null || tags.isEmpty()) {
      return;
    }

    Set<UUID> classificationIds =
        tags.stream()
            .map(Tag::getClassification)
            .filter(Objects::nonNull)
            .map(EntityReference::getId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());

    if (classificationIds.isEmpty()) {
      return;
    }

    ClassificationRepository classificationRepository =
        (ClassificationRepository) Entity.getEntityRepository(CLASSIFICATION);
    List<Classification> classifications =
        classificationRepository
            .getDao()
            .findEntitiesByIds(new ArrayList<>(classificationIds), ALL);

    classificationRepository.setFieldsInBulk(
        new Fields(Set.of("owners", "domains", "reviewers")), classifications);

    Map<UUID, Classification> classificationMap =
        classifications.stream().collect(Collectors.toMap(Classification::getId, c -> c));

    for (Tag tag : tags) {
      if (tag.getClassification() != null && tag.getClassification().getId() != null) {
        Classification classification = classificationMap.get(tag.getClassification().getId());
        if (classification != null) {
          if (classification.getDisabled() != null && classification.getDisabled()) {
            tag.setDisabled(true);
          }
          inheritOwners(tag, fields, classification);
          inheritDomains(tag, fields, classification);
          inheritReviewers(tag, fields, classification);
        }
      }
    }
  }

  @Override
  public void storeEntity(Tag tag, boolean update) {
    EntityReference classification = tag.getClassification();
    EntityReference parent = tag.getParent();

    // Parent and Classification are not stored as part of JSON. Build it on the fly based on
    // relationships
    tag.withClassification(null).withParent(null);
    store(tag, update);
    tag.withClassification(classification).withParent(parent);
  }

  @Override
  public void restorePatchAttributes(Tag original, Tag updated) {
    super.restorePatchAttributes(original, updated);
    updated.setChildren(original.getChildren());
  }

  @Override
  public void storeRelationships(Tag entity) {
    addClassificationRelationship(entity);
    addParentRelationship(entity);
  }

  @Override
  public void setFullyQualifiedName(Tag tag) {
    if (tag.getParent() == null) {
      tag.setFullyQualifiedName(
          FullyQualifiedName.build(tag.getClassification().getFullyQualifiedName(), tag.getName()));
    } else {
      tag.setFullyQualifiedName(
          FullyQualifiedName.add(tag.getParent().getFullyQualifiedName(), tag.getName()));
    }
  }

  @Override
  public BulkOperationResult bulkAddAndValidateTagsToAssets(
      UUID classificationTagId, BulkAssetsRequestInterface request) {
    AddTagToAssetsRequest addTagToAssetsRequest = (AddTagToAssetsRequest) request;
    boolean dryRun = Boolean.TRUE.equals(addTagToAssetsRequest.getDryRun());

    Tag tag = this.get(null, classificationTagId, getFields("id"));

    BulkOperationResult result = new BulkOperationResult().withDryRun(dryRun);
    List<BulkResponse> failures = new ArrayList<>();
    List<BulkResponse> success = new ArrayList<>();

    if (dryRun || nullOrEmpty(request.getAssets())) {
      // Nothing to Validate
      return result
          .withStatus(ApiStatus.SUCCESS)
          .withSuccessRequest(List.of(new BulkResponse().withMessage("Nothing to Validate.")));
    }

    // Validation for entityReferences
    EntityUtil.populateEntityReferences(request.getAssets());

    TagLabel tagLabel =
        new TagLabel()
            .withTagFQN(tag.getFullyQualifiedName())
            .withSource(TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);

    for (EntityReference ref : request.getAssets()) {
      // Update Result Processed
      result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);

      EntityRepository<?> entityRepository = Entity.getEntityRepository(ref.getType());
      EntityInterface asset =
          entityRepository.get(null, ref.getId(), entityRepository.getFields("tags"));

      try {
        Map<String, List<TagLabel>> allAssetTags =
            daoCollection.tagUsageDAO().getTagsByPrefix(asset.getFullyQualifiedName(), "%", true);
        checkMutuallyExclusiveForParentAndSubField(
            asset.getFullyQualifiedName(),
            FullyQualifiedName.buildHash(asset.getFullyQualifiedName()),
            allAssetTags,
            new ArrayList<>(Collections.singleton(tagLabel)),
            false);
        success.add(new BulkResponse().withRequest(ref));
        result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
      } catch (Exception ex) {
        failures.add(new BulkResponse().withRequest(ref).withMessage(ex.getMessage()));
        result.withFailedRequest(failures);
        result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
      }
      // Validate and Store Tags
      if (nullOrEmpty(result.getFailedRequest())) {
        List<TagLabel> tempList = new ArrayList<>(asset.getTags());
        tempList.add(tagLabel);
        // Apply Tags to Entities
        entityRepository.applyTags(getUniqueTags(tempList), asset.getFullyQualifiedName());

        searchRepository.updateEntity(ref);
      }
    }

    // Add Failed And Suceess Request
    result.withFailedRequest(failures).withSuccessRequest(success);

    // Set Final Status
    if (result.getNumberOfRowsPassed().equals(result.getNumberOfRowsProcessed())) {
      result.withStatus(ApiStatus.SUCCESS);
    } else if (result.getNumberOfRowsPassed() > 1) {
      result.withStatus(ApiStatus.PARTIAL_SUCCESS);
    } else {
      result.withStatus(ApiStatus.FAILURE);
    }

    return result;
  }

  @Override
  public BulkOperationResult bulkRemoveAndValidateTagsToAssets(
      UUID classificationTagId, BulkAssetsRequestInterface request) {
    Tag tag = this.get(null, classificationTagId, getFields("id"));

    BulkOperationResult result =
        new BulkOperationResult().withStatus(ApiStatus.SUCCESS).withDryRun(false);
    List<BulkResponse> success = new ArrayList<>();

    // Validation for entityReferences
    EntityUtil.populateEntityReferences(request.getAssets());

    for (EntityReference ref : request.getAssets()) {
      // Update Result Processed
      result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);

      EntityRepository<?> entityRepository = Entity.getEntityRepository(ref.getType());
      EntityInterface asset =
          entityRepository.get(null, ref.getId(), entityRepository.getFields("id"));

      daoCollection
          .tagUsageDAO()
          .deleteTagsByTagAndTargetEntity(
              tag.getFullyQualifiedName(), asset.getFullyQualifiedName());
      success.add(new BulkResponse().withRequest(ref));
      result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);

      // Update ES
      searchRepository.updateEntity(ref);
    }

    return result.withSuccessRequest(success);
  }

  @Override
  public EntityRepository<Tag>.EntityUpdater getUpdater(
      Tag original, Tag updated, Operation operation, ChangeSource changeSource) {
    return new TagUpdater(original, updated, operation);
  }

  @Override
  public void entityRelationshipReindex(Tag original, Tag updated) {
    super.entityRelationshipReindex(original, updated);
    if (!Objects.equals(original.getFullyQualifiedName(), updated.getFullyQualifiedName())
        || !Objects.equals(original.getDisplayName(), updated.getDisplayName())) {
      searchRepository
          .getSearchClient()
          .reindexAcrossIndices("tags.tagFQN", original.getEntityReference());
    }
  }

  @Override
  protected void postDelete(Tag entity, boolean hardDelete) {
    super.postDelete(entity, hardDelete);
    // Cleanup all the tag labels using this tag
    daoCollection
        .tagUsageDAO()
        .deleteTagLabels(TagSource.CLASSIFICATION.ordinal(), entity.getFullyQualifiedName());
  }

  @Override
  public void setFields(Tag tag, Fields fields, RelationIncludes relationIncludes) {
    tag.withClassification(getClassification(tag)).withParent(getParent(tag));
    if (fields.contains("usageCount")) {
      tag.withUsageCount(getUsageCount(tag));
    }
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Tag> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }

    // Batch fetch classifications and parents for all tags
    var classificationsMap = batchFetchClassifications(entities);
    var parentsMap = batchFetchParents(entities);

    // Set default fields (classification and parent) for all entities first
    entities.forEach(
        entity ->
            entity
                .withClassification(classificationsMap.get(entity.getId()))
                .withParent(parentsMap.get(entity.getId())));

    // Batch fetch usage counts if requested
    if (fields.contains("usageCount")) {
      var usageCountMap = batchFetchUsageCounts(entities);
      entities.forEach(
          entity ->
              entity.withUsageCount(usageCountMap.getOrDefault(entity.getFullyQualifiedName(), 0)));
    }

    // Process other fields using the standard bulk processing
    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);
    entities.forEach(entity -> clearFieldsInternal(entity, fields));
  }

  private Map<UUID, EntityReference> batchFetchClassifications(List<Tag> tags) {
    // Classification -> CONTAINS -> Tag relationship
    // We need to find classifications that contain these tags
    if (tags == null || tags.isEmpty()) {
      return Map.of();
    }

    var entityIds = tags.stream().map(e -> e.getId().toString()).toList();

    // Find all CONTAINS relationships where tags are on the "to" side and from entity is
    // CLASSIFICATION
    var records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                entityIds, Relationship.CONTAINS.ordinal(), Entity.CLASSIFICATION, NON_DELETED);

    if (records.isEmpty()) {
      return Map.of();
    }

    // Get unique classification IDs and batch fetch references
    var classificationIds =
        records.stream().map(r -> UUID.fromString(r.getFromId())).distinct().toList();

    var classificationRefs =
        Entity.getEntityReferencesByIds(Entity.CLASSIFICATION, classificationIds, NON_DELETED);
    var idToRefMap =
        classificationRefs.stream()
            .collect(Collectors.toMap(ref -> ref.getId().toString(), ref -> ref));

    // Map tags to their classifications
    return records.stream()
        .collect(
            Collectors.toMap(
                r -> UUID.fromString(r.getToId()),
                r -> idToRefMap.get(r.getFromId()),
                (existing, replacement) -> existing // In case of duplicates, keep first
                ))
        .entrySet()
        .stream()
        .filter(e -> e.getValue() != null)
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
  }

  private Map<UUID, EntityReference> batchFetchParents(List<Tag> tags) {
    // Parent Tag -> CONTAINS -> Child Tag relationship
    if (tags == null || tags.isEmpty()) {
      return Map.of();
    }

    var entityIds = tags.stream().map(e -> e.getId().toString()).toList();

    // For parent tags, we need to find where current tags are the "to" side of CONTAINS
    // relationship
    var records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(entityIds, Relationship.CONTAINS.ordinal(), TAG, NON_DELETED);

    if (records.isEmpty()) {
      return Map.of();
    }

    // Get unique parent IDs and batch fetch references
    var parentIds = records.stream().map(r -> UUID.fromString(r.getFromId())).distinct().toList();

    var parentRefs = Entity.getEntityReferencesByIds(TAG, parentIds, NON_DELETED);
    var idToRefMap =
        parentRefs.stream().collect(Collectors.toMap(ref -> ref.getId().toString(), ref -> ref));

    // Map tags to their parents
    return records.stream()
        .collect(
            Collectors.toMap(
                r -> UUID.fromString(r.getToId()),
                r -> idToRefMap.get(r.getFromId()),
                (existing, replacement) -> existing))
        .entrySet()
        .stream()
        .filter(e -> e.getValue() != null)
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
  }

  private Map<String, Integer> batchFetchUsageCounts(List<Tag> tags) {
    if (tags == null || tags.isEmpty()) {
      return Map.of();
    }

    // Build and execute a single query for all tags
    var tagFQNs = tags.stream().map(Tag::getFullyQualifiedName).toList();

    // Build UNION query that gets counts for all tags in one go
    var queryBuilder = new StringBuilder();
    tagFQNs.forEach(
        tagFQN -> {
          if (queryBuilder.length() > 0) {
            queryBuilder.append(" UNION ALL ");
          }
          var escapedFQN = tagFQN.replace("'", "''");
          queryBuilder.append(
              """
          SELECT '%s' as tagFQN,
          COUNT(DISTINCT targetFQNHash) as count
          FROM tag_usage
          WHERE source = %d
          AND (tagFQNHash = MD5('%s') OR tagFQNHash LIKE CONCAT(MD5('%s'), '.%%'))
          """
                  .formatted(
                      escapedFQN, TagSource.CLASSIFICATION.ordinal(), escapedFQN, escapedFQN));
        });

    try {
      var results =
          Entity.getJdbi()
              .withHandle(handle -> handle.createQuery(queryBuilder.toString()).mapToMap().list());

      return results.stream()
          .filter(row -> row.get("tagFQN") != null)
          .collect(
              Collectors.toMap(
                  row -> (String) row.get("tagFQN"),
                  row -> {
                    var count = (Number) row.get("count");
                    return count != null ? count.intValue() : 0;
                  }));
    } catch (Exception e) {
      LOG.error("Error batch fetching usage counts", e);
      // Fall back to individual queries
      return daoCollection
          .tagUsageDAO()
          .getTagCountsBulk(TagSource.CLASSIFICATION.ordinal(), tagFQNs);
    }
  }

  @Override
  public void clearFields(Tag tag, Fields fields) {
    tag.withUsageCount(fields.contains("usageCount") ? tag.getUsageCount() : null);
  }

  private Integer getUsageCount(Tag tag) {
    return tag.getUsageCount() != null
        ? tag.getUsageCount()
        : daoCollection
            .tagUsageDAO()
            .getTagCount(TagSource.CLASSIFICATION.ordinal(), tag.getFullyQualifiedName());
  }

  private EntityReference getClassification(Tag tag) {
    return getFromEntityRef(tag.getId(), Relationship.CONTAINS, Entity.CLASSIFICATION, true);
  }

  private void addClassificationRelationship(Tag term) {
    addRelationship(
        term.getClassification().getId(),
        term.getId(),
        Entity.CLASSIFICATION,
        TAG,
        Relationship.CONTAINS);
  }

  private void addParentRelationship(Tag term) {
    if (term.getParent() != null) {
      addRelationship(term.getParent().getId(), term.getId(), TAG, TAG, Relationship.CONTAINS);
    }
  }

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
    TaskType taskType = threadContext.getThread().getTask().getType();
    if (EntityUtil.isDescriptionTask(taskType)) {
      return new DescriptionTaskWorkflow(threadContext);
    } else if (EntityUtil.isTagTask(taskType)) {
      return new TagTaskWorkflow(threadContext);
    } else if (isRecognizerFeedbackTask(threadContext.getThread().getId())) {
      return new RecognizerFeedbackTaskWorkflow(threadContext);
    } else if (!EntityUtil.isTestCaseFailureResolutionTask(taskType)) {
      return new ApprovalTaskWorkflow(threadContext);
    }
    return super.getTaskWorkflow(threadContext);
  }

  private boolean isRecognizerFeedbackTask(UUID taskId) {
    try {
      FeedRepository feedRepository = Entity.getFeedRepository();
      Thread thread = feedRepository.get(taskId);
      return thread.getTask() != null && thread.getTask().getFeedback() != null;
    } catch (Exception e) {
      LOG.debug("Failed to check if task is recognizer feedback task", e);
    }
    return false;
  }

  public static class ApprovalTaskWorkflow extends TaskWorkflow {
    ApprovalTaskWorkflow(ThreadContext threadContext) {
      super(threadContext);
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      Tag tag = (Tag) threadContext.getAboutEntity();
      TagRepository.checkUpdatedByReviewer(tag, user);

      UUID taskId = threadContext.getThread().getId();
      Map<String, Object> variables = new HashMap<>();
      variables.put(RESULT_VARIABLE, resolveTask.getNewValue().equalsIgnoreCase("approved"));
      variables.put(UPDATED_BY_VARIABLE, user);
      WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
      boolean workflowSuccess =
          workflowHandler.resolveTask(
              taskId, workflowHandler.transformToNodeVariables(taskId, variables));

      if (!workflowSuccess) {
        LOG.warn(
            "[GlossaryTerm] Workflow failed for taskId='{}', applying status directly", taskId);
        Boolean approved = (Boolean) variables.get(RESULT_VARIABLE);
        String entityStatus = (approved != null && approved) ? "Approved" : "Rejected";
        EntityFieldUtils.setEntityField(tag, TAG, user, FIELD_ENTITY_STATUS, entityStatus, true);
      }
      return tag;
    }
  }

  public static class RecognizerFeedbackTaskWorkflow extends TaskWorkflow {
    RecognizerFeedbackTaskWorkflow(ThreadContext threadContext) {
      super(threadContext);
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      Tag tag = (Tag) threadContext.getAboutEntity();
      TagRepository.checkUpdatedByReviewer(tag, user);

      UUID taskId = threadContext.getThread().getId();
      Map<String, Object> variables = new HashMap<>();
      variables.put(RESULT_VARIABLE, resolveTask.getNewValue().equalsIgnoreCase("approved"));
      variables.put(UPDATED_BY_VARIABLE, user);

      WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
      boolean workflowSuccess =
          workflowHandler.resolveTask(
              taskId, workflowHandler.transformToNodeVariables(taskId, variables));

      if (!workflowSuccess) {
        LOG.warn(
            "[RecognizerFeedback] Workflow failed for taskId='{}', attempting direct resolution",
            taskId);
        try {
          org.openmetadata.schema.type.RecognizerFeedback feedback =
              threadContext.getThread().getTask().getFeedback();
          if (feedback != null) {
            RecognizerFeedbackRepository repo =
                new RecognizerFeedbackRepository(Entity.getCollectionDAO());

            boolean approved =
                resolveTask.getNewValue() != null
                    && resolveTask.getNewValue().equalsIgnoreCase("approved");
            if (approved) {
              repo.applyFeedback(feedback, user);
            } else {
              repo.rejectFeedback(feedback, user, null);
            }
          }
        } catch (Exception e) {
          LOG.error("[RecognizerFeedback] Failed to resolve feedback directly", e);
        }
      }

      return tag;
    }
  }

  public class TagUpdater extends EntityUpdater {
    private boolean renameProcessed = false;

    public TagUpdater(Tag original, Tag updated, Operation operation) {
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
      recordChange(
          "mutuallyExclusive", original.getMutuallyExclusive(), updated.getMutuallyExclusive());
      recordChange("disabled", original.getDisabled(), updated.getDisabled());
      recordChange("recognizers", original.getRecognizers(), updated.getRecognizers(), true);
      recordChange(
          "autoClassificationEnabled",
          original.getAutoClassificationEnabled(),
          updated.getAutoClassificationEnabled());
      recordChange(
          "autoClassificationPriority",
          original.getAutoClassificationPriority(),
          updated.getAutoClassificationPriority());
      updateNameAndParent(updated);
    }

    /**
     * Handle name and parent changes together using getOriginalFqn() for correct FQN tracking.
     */
    public void updateNameAndParent(Tag updated) {
      // Use getOriginalFqn() which was captured at EntityUpdater construction time.
      String oldFqn = getOriginalFqn();
      setFullyQualifiedName(updated);
      String newFqn = updated.getFullyQualifiedName();

      // Check if this is a name change
      String[] oldParts = FullyQualifiedName.split(oldFqn);
      String oldTagName = oldParts.length > 0 ? oldParts[oldParts.length - 1] : "";
      boolean nameChanged = !oldTagName.equals(updated.getName());

      // Check for parent/classification changes
      UUID oldParentId = getId(original.getParent());
      UUID newParentId = getId(updated.getParent());
      boolean parentChanged = !Objects.equals(oldParentId, newParentId);

      UUID oldCategoryId = getId(original.getClassification());
      UUID newCategoryId = getId(updated.getClassification());
      boolean classificationChanged = !Objects.equals(oldCategoryId, newCategoryId);

      boolean fqnChanged = !oldFqn.equals(newFqn);

      if (fqnChanged && !renameProcessed) {
        renameProcessed = true;

        if (nameChanged && ProviderType.SYSTEM.equals(original.getProvider())) {
          throw new IllegalArgumentException(
              CatalogExceptionMessage.systemEntityRenameNotAllowed(original.getName(), entityType));
        }

        LOG.info("Tag FQN changed from {} to {}", oldFqn, newFqn);
        daoCollection.tagDAO().updateFqn(oldFqn, newFqn);
        daoCollection.tagUsageDAO().rename(TagSource.CLASSIFICATION.ordinal(), oldFqn, newFqn);

        if (nameChanged) {
          recordChange("name", oldTagName, updated.getName());
        }

        updateEntityLinks(oldFqn, newFqn, updated);
      }

      if (classificationChanged) {
        updateClassificationRelationship(original, updated);
        recordChange(
            "Classification",
            original.getClassification(),
            updated.getClassification(),
            true,
            entityReferenceMatch);
        invalidateTags(updated.getId());
      }
      if (parentChanged) {
        updateParentRelationship(original, updated);
        recordChange(
            "parent", original.getParent(), updated.getParent(), true, entityReferenceMatch);
        invalidateTags(updated.getId());
      }

      // Populate response fields
      invalidateTags(updated.getId());
      getChildren(updated);
    }

    private void updateClassificationRelationship(Tag orig, Tag updated) {
      deleteClassificationRelationship(orig);
      addClassificationRelationship(updated);
    }

    private void deleteClassificationRelationship(Tag term) {
      deleteRelationship(
          term.getClassification().getId(),
          Entity.CLASSIFICATION,
          term.getId(),
          TAG,
          Relationship.CONTAINS);
    }

    private void updateParentRelationship(Tag orig, Tag updated) {
      deleteParentRelationship(orig);
      addParentRelationship(updated);
    }

    private void deleteParentRelationship(Tag term) {
      if (term.getParent() != null) {
        deleteRelationship(term.getParent().getId(), TAG, term.getId(), TAG, Relationship.CONTAINS);
      }
    }

    private void updateEntityLinks(String oldFqn, String newFqn, Tag updated) {
      daoCollection.fieldRelationshipDAO().renameByToFQN(oldFqn, newFqn);

      MessageParser.EntityLink newAbout = new MessageParser.EntityLink(TAG, newFqn);
      daoCollection
          .feedDAO()
          .updateByEntityId(newAbout.getLinkString(), updated.getId().toString());

      List<EntityReference> childTags = findTo(updated.getId(), TAG, Relationship.CONTAINS, TAG);

      for (EntityReference child : childTags) {
        newAbout = new MessageParser.EntityLink(TAG, child.getFullyQualifiedName());
        daoCollection
            .feedDAO()
            .updateByEntityId(newAbout.getLinkString(), child.getId().toString());
      }
    }

    private void invalidateTags(UUID tagId) {
      // The name of the tag changed. Invalidate that tag and all the children from the cache
      List<EntityRelationshipRecord> tagRecords =
          findToRecords(tagId, TAG, Relationship.CONTAINS, TAG);
      CACHE_WITH_ID.invalidate(new ImmutablePair<>(TAG, tagId));
      for (EntityRelationshipRecord tagRecord : tagRecords) {
        invalidateTags(tagRecord.getId());
      }
    }
  }

  @Override
  public void postUpdate(Tag original, Tag updated) {
    super.postUpdate(original, updated);
    if (EntityStatus.IN_REVIEW.equals(original.getEntityStatus())) {
      if (EntityStatus.APPROVED.equals(updated.getEntityStatus())) {
        closeApprovalTask(updated, "Approved the tag");
      } else if (EntityStatus.REJECTED.equals(updated.getEntityStatus())) {
        closeApprovalTask(updated, "Rejected the tag");
      }
    }

    // TODO: It might happen that a task went from DRAFT to IN_REVIEW to DRAFT fairly quickly
    // Due to ChangesConsolidation, the postUpdate will be called as from DRAFT to DRAFT, but there
    // will be a Task created.
    // This if handles this case scenario, by guaranteeing that we are any Approval Task if the
    // Tag goes back to DRAFT.
    if (EntityStatus.DRAFT.equals(updated.getEntityStatus())) {
      try {
        closeApprovalTask(updated, "Closed due to tag going back to DRAFT.");
      } catch (EntityNotFoundException ignored) {
      } // No ApprovalTask is present, and thus we don't need to worry about this.
    }
  }

  @Override
  protected void preDelete(Tag entity, String deletedBy) {
    // A tag in `Draft` state can only be deleted by the reviewers
    if (EntityStatus.IN_REVIEW.equals(entity.getEntityStatus())) {
      checkUpdatedByReviewer(entity, deletedBy);
    }
  }

  private void closeApprovalTask(Tag entity, String comment) {
    MessageParser.EntityLink about =
        new MessageParser.EntityLink(TAG, entity.getFullyQualifiedName());
    FeedRepository feedRepository = Entity.getFeedRepository();

    // Skip closing tasks if updatedBy is null (e.g., during tests)
    if (entity.getUpdatedBy() == null) {
      LOG.debug(
          "Skipping task closure for tag {} - updatedBy is null", entity.getFullyQualifiedName());
      return;
    }

    // Close User Tasks
    try {
      Thread taskThread = feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      feedRepository.closeTask(
          taskThread, entity.getUpdatedBy(), new CloseTask().withComment(comment));
    } catch (EntityNotFoundException ex) {
      LOG.info("No approval task found for tag {}", entity.getFullyQualifiedName());
    }
  }

  protected void updateTaskWithNewReviewers(Tag tag) {
    try {
      MessageParser.EntityLink about =
          new MessageParser.EntityLink(TAG, tag.getFullyQualifiedName());
      FeedRepository feedRepository = Entity.getFeedRepository();
      Thread originalTask =
          feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      tag =
          Entity.getEntityByName(
              Entity.TAG,
              tag.getFullyQualifiedName(),
              "id,fullyQualifiedName,reviewers",
              Include.ALL);

      Thread updatedTask = JsonUtils.deepCopy(originalTask, Thread.class);
      updatedTask.getTask().withAssignees(new ArrayList<>(tag.getReviewers()));
      JsonPatch patch = JsonUtils.getJsonPatch(originalTask, updatedTask);
      RestUtil.PatchResponse<Thread> thread =
          feedRepository.patchThread(null, originalTask.getId(), updatedTask.getUpdatedBy(), patch);

      // Send WebSocket Notification
      WebsocketNotificationHandler.handleTaskNotification(thread.entity());
    } catch (EntityNotFoundException e) {
      LOG.info(
          "{} Task not found for tag {}", TaskType.RequestApproval, tag.getFullyQualifiedName());
    }
  }

  public static void checkUpdatedByReviewer(Tag tag, String updatedBy) {
    // Only list of allowed reviewers can change the status from DRAFT to APPROVED
    List<EntityReference> reviewers = tag.getReviewers();
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
}
