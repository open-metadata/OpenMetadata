/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
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
import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidGlossaryTermMove;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusive;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusiveForParentAndSubField;
import static org.openmetadata.service.resources.tags.TagLabelUtil.getUniqueTags;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchConstants.TAGS_FQN;
import static org.openmetadata.service.util.EntityUtil.compareEntityReferenceById;
import static org.openmetadata.service.util.EntityUtil.compareTagLabel;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.EntityUtil.getId;
import static org.openmetadata.service.util.EntityUtil.stringMatch;
import static org.openmetadata.service.util.EntityUtil.tagLabelMatch;
import static org.openmetadata.service.util.EntityUtil.termReferenceMatch;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.google.gson.Gson;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.ValidateGlossaryTagsRequest;
import org.openmetadata.schema.api.data.MoveGlossaryTermRequest;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.GlossaryTerm.Status;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
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
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.glossary.GlossaryTermResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

@Slf4j
public class GlossaryTermRepository extends EntityRepository<GlossaryTerm> {
  private static final String ES_MISSING_DATA =
      "Entity Details is unavailable in Elastic Search. Please reindex to get more Information.";
  private static final String UPDATE_FIELDS = "references,relatedTerms,synonyms";
  private static final String PATCH_FIELDS = "references,relatedTerms,synonyms";

  final FeedRepository feedRepository = Entity.getFeedRepository();

  public GlossaryTermRepository() {
    super(
        GlossaryTermResource.COLLECTION_PATH,
        GLOSSARY_TERM,
        GlossaryTerm.class,
        Entity.getCollectionDAO().glossaryTermDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;
    renameAllowed = true;
    fieldFetchers.put("parent", this::fetchAndSetParentOrGlossary);
    fieldFetchers.put("relatedTerms", this::fetchAndSetRelatedTerms);
    fieldFetchers.put("usageCount", this::fetchAndSetUsageCount);
    fieldFetchers.put("childrenCount", this::fetchAndSetChildrenCount);
  }

  @Override
  public void setFields(GlossaryTerm entity, Fields fields) {
    entity.withParent(getParent(entity)).withGlossary(getGlossary(entity));
    entity.setRelatedTerms(
        fields.contains("relatedTerms") ? getRelatedTerms(entity) : entity.getRelatedTerms());
    entity.withUsageCount(
        fields.contains("usageCount") ? getUsageCount(entity) : entity.getUsageCount());
    entity.withChildrenCount(
        fields.contains("childrenCount") ? getChildrenCount(entity) : entity.getChildrenCount());
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<GlossaryTerm> entities) {
    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);
    for (GlossaryTerm entity : entities) {
      clearFieldsInternal(entity, fields);
    }
  }

  @Override
  public void clearFields(GlossaryTerm entity, Fields fields) {
    entity.setRelatedTerms(fields.contains("relatedTerms") ? entity.getRelatedTerms() : null);
    entity.withUsageCount(fields.contains("usageCount") ? entity.getUsageCount() : null);
    entity.withChildrenCount(fields.contains("childrenCount") ? entity.getChildrenCount() : null);
  }

  @Override
  public void setInheritedFields(GlossaryTerm glossaryTerm, Fields fields) {
    EntityInterface parent = getParentEntity(glossaryTerm, "owners,domains,reviewers");
    inheritOwners(glossaryTerm, fields, parent);
    inheritDomains(glossaryTerm, fields, parent);
    inheritReviewers(glossaryTerm, fields, parent);
  }

  @Override
  public void setInheritedFields(List<GlossaryTerm> glossaryTerms, Fields fields) {
    List<? extends EntityInterface> parents =
        getParentEntities(glossaryTerms, "owners,domains,reviewers");
    Map<UUID, EntityInterface> parentMap =
        parents.stream().collect(Collectors.toMap(EntityInterface::getId, e -> e));
    for (GlossaryTerm glossaryTerm : glossaryTerms) {
      EntityInterface parent = null;
      if (glossaryTerm.getParent() != null) {
        parent = parentMap.get(glossaryTerm.getParent().getId());
      } else if (glossaryTerm.getGlossary() != null) {
        parent = parentMap.get(glossaryTerm.getGlossary().getId());
      }
      inheritOwners(glossaryTerm, fields, parent);
      inheritDomains(glossaryTerm, fields, parent);
      inheritReviewers(glossaryTerm, fields, parent);
    }
  }

  private Integer getUsageCount(GlossaryTerm term) {
    return daoCollection
        .tagUsageDAO()
        .getTagCount(TagSource.GLOSSARY.ordinal(), term.getFullyQualifiedName());
  }

  private Integer getChildrenCount(GlossaryTerm term) {
    return daoCollection
        .relationshipDAO()
        .findTo(term.getId(), GLOSSARY_TERM, Relationship.CONTAINS.ordinal(), GLOSSARY_TERM)
        .size();
  }

  private List<EntityReference> getRelatedTerms(GlossaryTerm entity) {
    return findBoth(entity.getId(), GLOSSARY_TERM, Relationship.RELATED_TO, GLOSSARY_TERM);
  }

  @Override
  public void prepare(GlossaryTerm entity, boolean update) {
    List<EntityReference> parentReviewers = null;
    // Validate parent term
    GlossaryTerm parentTerm =
        entity.getParent() != null
            ? Entity.getEntity(
                entity.getParent().withType(GLOSSARY_TERM), "owners,reviewers", Include.NON_DELETED)
            : null;
    if (parentTerm != null) {
      parentReviewers = parentTerm.getReviewers();
      entity.setParent(parentTerm.getEntityReference());
    }

    // Validate glossary
    Glossary glossary = Entity.getEntity(entity.getGlossary(), "reviewers", Include.NON_DELETED);
    entity.setGlossary(glossary.getEntityReference());
    parentReviewers = parentReviewers != null ? parentReviewers : glossary.getReviewers();

    validateHierarchy(entity);

    // Validate related terms
    EntityUtil.populateEntityReferences(entity.getRelatedTerms());

    if (!update || entity.getStatus() == null) {
      // If parentTerm or glossary has reviewers set, the glossary term can only be created in
      // `Draft` mode
      entity.setStatus(!nullOrEmpty(parentReviewers) ? Status.DRAFT : Status.APPROVED);
    }
    if (!update) {
      checkDuplicateTerms(entity);
    }
  }

  @Override
  public void storeEntity(GlossaryTerm entity, boolean update) {
    // Relationships and fields such as parentTerm are derived and not stored as part of json
    EntityReference glossary = entity.getGlossary();
    EntityReference parentTerm = entity.getParent();
    List<EntityReference> relatedTerms = entity.getRelatedTerms();
    List<EntityReference> reviewers = entity.getReviewers();

    entity.withGlossary(null).withParent(null).withRelatedTerms(relatedTerms).withReviewers(null);
    store(entity, update);

    // Restore the relationships
    entity
        .withGlossary(glossary)
        .withParent(parentTerm)
        .withRelatedTerms(relatedTerms)
        .withReviewers(reviewers);
  }

  @Override
  public void storeEntities(List<GlossaryTerm> entities) {
    List<GlossaryTerm> entitiesToStore = new ArrayList<>();
    Gson gson = new Gson();
    for (GlossaryTerm entity : entities) {
      EntityReference glossary = entity.getGlossary();
      EntityReference parentTerm = entity.getParent();
      List<EntityReference> reviewers = entity.getReviewers();

      String jsonCopy = gson.toJson(entity.withGlossary(null).withParent(null).withReviewers(null));
      entitiesToStore.add(gson.fromJson(jsonCopy, GlossaryTerm.class));

      // restore the relationships
      entity.withGlossary(glossary).withParent(parentTerm).withReviewers(reviewers);
    }
    storeMany(entitiesToStore);
  }

  @Override
  public void storeRelationships(GlossaryTerm entity) {
    addGlossaryRelationship(entity);
    addParentRelationship(entity);
    for (EntityReference relTerm : listOrEmpty(entity.getRelatedTerms())) {
      // Make this bidirectional relationship
      addRelationship(
          entity.getId(),
          relTerm.getId(),
          GLOSSARY_TERM,
          GLOSSARY_TERM,
          Relationship.RELATED_TO,
          true);
    }
  }

  @Override
  public void restorePatchAttributes(GlossaryTerm original, GlossaryTerm updated) {
    // Patch can't update Children
    super.restorePatchAttributes(original, updated);
    updated.withChildren(original.getChildren());
  }

  @Override
  public void entityRelationshipReindex(GlossaryTerm original, GlossaryTerm updated) {
    super.entityRelationshipReindex(original, updated);

    // Update search indexes of assets and entity itself on name , fullyQualifiedName and
    // displayName change
    if (!Objects.equals(original.getFullyQualifiedName(), updated.getFullyQualifiedName())
        || !Objects.equals(original.getDisplayName(), updated.getDisplayName())) {
      updateAssetIndexes(original, updated);
    }
  }

  @Override
  public void setFullyQualifiedName(GlossaryTerm entity) {
    // Validate parent
    if (entity.getParent() == null) { // Glossary term at the root of the glossary
      entity.setFullyQualifiedName(
          FullyQualifiedName.build(entity.getGlossary().getFullyQualifiedName(), entity.getName()));
    } else { // Glossary term that is a child of another glossary term
      EntityReference parent = entity.getParent();
      entity.setFullyQualifiedName(
          FullyQualifiedName.add(parent.getFullyQualifiedName(), entity.getName()));
    }
  }

  public BulkOperationResult bulkAddAndValidateGlossaryToAssets(
      UUID glossaryTermId, AddGlossaryToAssetsRequest request) {
    boolean dryRun = Boolean.TRUE.equals(request.getDryRun());

    GlossaryTerm term = this.get(null, glossaryTermId, getFields("id,tags"));
    EntityRepository<?> glossaryRepository = Entity.getEntityRepository(Entity.GLOSSARY);
    EntityInterface glossary =
        glossaryRepository.getByName(
            null, term.getGlossary().getFullyQualifiedName(), glossaryRepository.getFields("tags"));
    // Check if the tags are mutually exclusive for the glossary
    checkMutuallyExclusive(glossary.getTags());

    BulkOperationResult result = new BulkOperationResult().withDryRun(dryRun);
    List<BulkResponse> failures = new ArrayList<>();
    List<BulkResponse> success = new ArrayList<>();

    if (dryRun
        && (CommonUtil.nullOrEmpty(glossary.getTags())
            || CommonUtil.nullOrEmpty(request.getAssets()))) {
      // Nothing to Validate
      return result
          .withStatus(ApiStatus.SUCCESS)
          .withSuccessRequest(List.of(new BulkResponse().withMessage("Nothing to Validate.")));
    }

    // Validation for entityReferences
    EntityUtil.populateEntityReferences(request.getAssets());

    TagLabel tagLabel =
        new TagLabel()
            .withTagFQN(term.getFullyQualifiedName())
            .withSource(TagSource.GLOSSARY)
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
            glossary.getTags(),
            false);
        success.add(new BulkResponse().withRequest(ref));
        result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
      } catch (Exception ex) {
        failures.add(new BulkResponse().withRequest(ref).withMessage(ex.getMessage()));
        result.withFailedRequest(failures);
        result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
      }
      // Validate and Store Tags
      if (!dryRun && CommonUtil.nullOrEmpty(result.getFailedRequest())) {
        List<TagLabel> tempList = new ArrayList<>(asset.getTags());
        tempList.add(tagLabel);
        // Apply Tags to Entities
        entityRepository.applyTags(getUniqueTags(tempList), asset.getFullyQualifiedName());

        searchRepository.updateEntity(ref);
      }
    }

    // Apply the tags of glossary to the glossary term
    if (!dryRun
        && CommonUtil.nullOrEmpty(result.getFailedRequest())
        && (!(term.getTags().isEmpty() && glossary.getTags().isEmpty()))) {
      // Remove current entity tags in the database. It will be added back later from the merged tag
      // list.
      daoCollection.tagUsageDAO().deleteTagsByTarget(term.getFullyQualifiedName());
      applyTags(getUniqueTags(glossary.getTags()), term.getFullyQualifiedName());

      searchRepository.updateEntity(term.getEntityReference());
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

  public BulkOperationResult validateGlossaryTagsAddition(
      UUID glossaryTermId, ValidateGlossaryTagsRequest request) {
    GlossaryTerm term = this.get(null, glossaryTermId, getFields("id,tags"));

    List<TagLabel> glossaryTagsToValidate = request.getGlossaryTags();

    // Check if the tags are mutually exclusive for the glossary
    checkMutuallyExclusive(request.getGlossaryTags());

    BulkOperationResult result = new BulkOperationResult().withDryRun(true);
    List<BulkResponse> failures = new ArrayList<>();
    List<BulkResponse> success = new ArrayList<>();

    if (CommonUtil.nullOrEmpty(glossaryTagsToValidate)) {
      // Nothing to Validate
      return result
          .withStatus(ApiStatus.SUCCESS)
          .withSuccessRequest(List.of(new BulkResponse().withMessage("Nothing to Validate.")));
    }

    Set<String> targetFQNHashesFromDb =
        new HashSet<>(
            daoCollection.tagUsageDAO().getTargetFQNHashForTag(term.getFullyQualifiedName()));
    Map<String, EntityReference> targetFQNFromES =
        getGlossaryUsageFromES(term.getFullyQualifiedName(), targetFQNHashesFromDb.size(), false);
    // Inclusion of soft deleted assets as well
    targetFQNFromES.putAll(
        getGlossaryUsageFromES(term.getFullyQualifiedName(), targetFQNHashesFromDb.size(), true));

    for (String fqnHash : targetFQNHashesFromDb) {
      // Update Result Processed
      result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);

      Map<String, List<TagLabel>> allAssetTags =
          daoCollection.tagUsageDAO().getTagsByPrefix(fqnHash, "%", false);

      EntityReference refDetails = targetFQNFromES.get(fqnHash);

      try {
        // Assets FQN is not available / we can use fqnHash for now
        checkMutuallyExclusiveForParentAndSubField(
            term.getFullyQualifiedName(), fqnHash, allAssetTags, glossaryTagsToValidate, true);
        if (refDetails != null) {
          success.add(new BulkResponse().withRequest(refDetails));
        } else {
          success.add(
              new BulkResponse()
                  .withRequest(
                      new EntityReference().withFullyQualifiedName(fqnHash).withType("unknown"))
                  .withMessage(ES_MISSING_DATA));
        }
        result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
      } catch (IllegalArgumentException ex) {
        if (refDetails != null) {
          failures.add(new BulkResponse().withRequest(refDetails).withMessage(ex.getMessage()));
        } else {
          failures.add(
              new BulkResponse()
                  .withRequest(
                      new EntityReference().withFullyQualifiedName(fqnHash).withType("unknown"))
                  .withMessage(String.format("%s %s", ex.getMessage(), ES_MISSING_DATA)));
        }
        result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
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

  protected Map<String, EntityReference> getGlossaryUsageFromES(
      String glossaryFqn, int size, boolean softDeleted) {
    try {
      String key = "_source";
      SearchRequest searchRequest =
          new SearchRequest()
              .withQuery(
                  String.format(
                      "** AND (tags.tagFQN:\"%s\")",
                      ReindexingUtil.escapeDoubleQuotes(glossaryFqn)))
              .withSize(size)
              .withIndex(Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
              .withFrom(0)
              .withFetchSource(true)
              .withTrackTotalHits(false)
              .withSortFieldParam("_score")
              .withDeleted(softDeleted)
              .withSortOrder("desc")
              .withIncludeSourceFields(new ArrayList<>());
      Response response = searchRepository.search(searchRequest, null);
      String json = (String) response.getEntity();
      Set<EntityReference> fqns = new TreeSet<>(compareEntityReferenceById);
      for (Iterator<JsonNode> it =
              ((ArrayNode) JsonUtils.extractValue(json, "hits", "hits")).elements();
          it.hasNext(); ) {
        JsonNode jsonNode = it.next();
        String id = JsonUtils.extractValue(jsonNode, key, "id");
        String fqn = JsonUtils.extractValue(jsonNode, key, "fullyQualifiedName");
        String type = JsonUtils.extractValue(jsonNode, key, "entityType");
        if (!CommonUtil.nullOrEmpty(fqn) && !CommonUtil.nullOrEmpty(type)) {
          fqns.add(
              new EntityReference()
                  .withId(UUID.fromString(id))
                  .withFullyQualifiedName(fqn)
                  .withType(type));
        }
      }

      return fqns.stream()
          .collect(
              Collectors.toMap(
                  entityReference ->
                      FullyQualifiedName.buildHash(entityReference.getFullyQualifiedName()),
                  entityReference -> entityReference));
    } catch (Exception ex) {
      LOG.error("Error while getting glossary usage from ES for validation", ex);
    }
    return new HashMap<>();
  }

  public BulkOperationResult bulkRemoveGlossaryToAssets(
      UUID glossaryTermId, AddGlossaryToAssetsRequest request) {
    GlossaryTerm term = this.get(null, glossaryTermId, getFields("id,tags"));

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
              term.getFullyQualifiedName(), asset.getFullyQualifiedName());
      success.add(new BulkResponse().withRequest(ref));
      result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);

      // Update ES
      searchRepository.updateEntity(ref);
    }

    return result.withSuccessRequest(success);
  }

  protected EntityReference getGlossary(GlossaryTerm term) {
    Relationship relationship = term.getParent() != null ? Relationship.HAS : Relationship.CONTAINS;
    return term.getGlossary() != null
        ? term.getGlossary()
        : getFromEntityRef(term.getId(), relationship, GLOSSARY, true);
  }

  public EntityReference getGlossary(String id) {
    return Entity.getEntityReferenceById(GLOSSARY, UUID.fromString(id), ALL);
  }

  @Override
  public EntityRepository<GlossaryTerm>.EntityUpdater getUpdater(
      GlossaryTerm original, GlossaryTerm updated, Operation operation, ChangeSource changeSource) {
    return new GlossaryTermUpdater(original, updated, operation);
  }

  @Override
  protected void postCreate(GlossaryTerm entity) {
    super.postCreate(entity);
  }

  @Override
  public void postUpdate(GlossaryTerm original, GlossaryTerm updated) {
    super.postUpdate(original, updated);
    if (original.getStatus() == Status.IN_REVIEW) {
      if (updated.getStatus() == Status.APPROVED) {
        closeApprovalTask(updated, "Approved the glossary term");
      } else if (updated.getStatus() == Status.REJECTED) {
        closeApprovalTask(updated, "Rejected the glossary term");
      }
    }

    // TODO: It might happen that a task went from DRAFT to IN_REVIEW to DRAFT fairly quickly
    // Due to ChangesConsolidation, the postUpdate will be called as from DRAFT to DRAFT, but there
    // will be a Task created.
    // This if handles this case scenario, by guaranteeing that we are any Approval Task if the
    // Glossary Term goes back to DRAFT.
    if (updated.getStatus() == Status.DRAFT) {
      try {
        closeApprovalTask(updated, "Closed due to glossary term going back to DRAFT.");
      } catch (EntityNotFoundException ignored) {
      } // No ApprovalTask is present, and thus we don't need to worry about this.
    }
  }

  @Override
  protected void preDelete(GlossaryTerm entity, String deletedBy) {
    // A glossary term in `Draft` state can only be deleted by the reviewers
    if (Status.IN_REVIEW.equals(entity.getStatus())) {
      checkUpdatedByReviewer(entity, deletedBy);
    }
  }

  @Override
  protected void postDelete(GlossaryTerm entity) {
    // Cleanup all the tag labels using this glossary term
    daoCollection
        .tagUsageDAO()
        .deleteTagLabels(TagSource.GLOSSARY.ordinal(), entity.getFullyQualifiedName());
  }

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
    TaskType taskType = threadContext.getThread().getTask().getType();
    if (EntityUtil.isApprovalTask(taskType)) {
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
      // TODO: Resolve this outside
      GlossaryTerm glossaryTerm = (GlossaryTerm) threadContext.getAboutEntity();
      checkUpdatedByReviewer(glossaryTerm, user);

      UUID taskId = threadContext.getThread().getId();
      Map<String, Object> variables = new HashMap<>();
      variables.put(RESULT_VARIABLE, resolveTask.getNewValue().equalsIgnoreCase("approved"));
      variables.put(UPDATED_BY_VARIABLE, user);
      WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
      workflowHandler.resolveTask(
          taskId, workflowHandler.transformToNodeVariables(taskId, variables));
      // ---

      // TODO: performTask returns the updated Entity and the flow applies the new value.
      // This should be changed with the new Governance Workflows.
      //      glossaryTerm.setStatus(Status.APPROVED);
      return glossaryTerm;
    }
  }

  @Override
  public EntityInterface getParentEntity(GlossaryTerm entity, String fields) {
    return entity.getParent() != null
        ? Entity.getEntity(entity.getParent(), fields, Include.ALL)
        : Entity.getEntity(entity.getGlossary(), fields, Include.ALL);
  }

  public List<EntityInterface> getParentEntities(List<GlossaryTerm> entities, String fields) {
    List<EntityInterface> result = new ArrayList<>();
    if (CollectionUtils.isEmpty(entities)) {
      return result;
    }
    List<EntityReference> parents =
        entities.stream().map(GlossaryTerm::getParent).filter(Objects::nonNull).distinct().toList();
    result.addAll(Entity.getEntities(parents, fields, Include.ALL));
    List<EntityReference> glossaries =
        entities.stream()
            .map(GlossaryTerm::getGlossary)
            .filter(Objects::nonNull)
            .distinct()
            .toList();
    result.addAll(Entity.getEntities(glossaries, fields, Include.ALL));
    return result;
  }

  private void addGlossaryRelationship(GlossaryTerm term) {
    Relationship relationship = term.getParent() != null ? Relationship.HAS : Relationship.CONTAINS;
    addRelationship(
        term.getGlossary().getId(), term.getId(), GLOSSARY, GLOSSARY_TERM, relationship);
  }

  private void addParentRelationship(GlossaryTerm term) {
    if (term.getParent() != null) {
      addRelationship(
          term.getParent().getId(),
          term.getId(),
          GLOSSARY_TERM,
          GLOSSARY_TERM,
          Relationship.CONTAINS);
    }
  }

  private void validateHierarchy(GlossaryTerm term) {
    if (term.getParent() == null) {
      return; // Parent is the root of the glossary
    }
    // Check for circular references
    String parentFqn = term.getParent().getFullyQualifiedName();
    String termFqn = term.getFullyQualifiedName();
    if (FullyQualifiedName.isParent(parentFqn, termFqn)) {
      throw new IllegalArgumentException(
          String.format(
              "Invalid hierarchy - cannot move term [%s] under its child [%s]",
              termFqn, parentFqn));
    }
  }

  public static void checkUpdatedByReviewer(GlossaryTerm term, String updatedBy) {
    // Only list of allowed reviewers can change the status from DRAFT to APPROVED
    List<EntityReference> reviewers = term.getReviewers();
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

  private void closeApprovalTask(GlossaryTerm entity, String comment) {
    EntityLink about = new EntityLink(GLOSSARY_TERM, entity.getFullyQualifiedName());
    FeedRepository feedRepository = Entity.getFeedRepository();
    try {
      Thread taskThread = feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      feedRepository.closeTask(
          taskThread, entity.getUpdatedBy(), new CloseTask().withComment(comment));
    } catch (EntityNotFoundException ex) {
      LOG.info(
          "{} Task not found for glossary term {}",
          TaskType.RequestApproval,
          entity.getFullyQualifiedName());
    }
  }

  private void updateAssetIndexes(GlossaryTerm original, GlossaryTerm updated) {
    String oldParentFqn = original.getFullyQualifiedName();
    String newParentFqn = updated.getFullyQualifiedName();
    searchRepository
        .getSearchClient()
        .updateGlossaryTermByFqnPrefix(GLOBAL_SEARCH_ALIAS, oldParentFqn, newParentFqn, TAGS_FQN);
  }

  private void updateEntityLinks(GlossaryTerm original, GlossaryTerm updated) {
    daoCollection
        .fieldRelationshipDAO()
        .renameByToFQN(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
    EntityLink about = new EntityLink(GLOSSARY_TERM, original.getFullyQualifiedName());

    EntityLink newAbout = new EntityLink(GLOSSARY_TERM, updated.getFullyQualifiedName());

    daoCollection.feedDAO().updateByEntityId(newAbout.getLinkString(), original.getId().toString());
    List<EntityReference> childTerms =
        findTo(updated.getId(), GLOSSARY_TERM, Relationship.CONTAINS, GLOSSARY_TERM);

    for (EntityReference child : childTerms) {
      newAbout = new EntityLink(entityType, child.getFullyQualifiedName());
      daoCollection.feedDAO().updateByEntityId(newAbout.getLinkString(), child.getId().toString());
    }
  }

  private List<GlossaryTerm> getNestedTerms(GlossaryTerm glossaryTerm) {
    // Get all the hierarchically nested child terms of the glossary term
    List<String> jsons =
        daoCollection.glossaryTermDAO().getNestedTerms(glossaryTerm.getFullyQualifiedName());
    return JsonUtils.readObjects(jsons, GlossaryTerm.class);
  }

  protected void updateTaskWithNewReviewers(GlossaryTerm term) {
    try {
      MessageParser.EntityLink about =
          new MessageParser.EntityLink(GLOSSARY_TERM, term.getFullyQualifiedName());
      Thread originalTask =
          feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      term =
          Entity.getEntityByName(
              Entity.GLOSSARY_TERM,
              term.getFullyQualifiedName(),
              "id,fullyQualifiedName,reviewers",
              Include.ALL);

      Thread updatedTask = JsonUtils.deepCopy(originalTask, Thread.class);
      updatedTask.getTask().withAssignees(new ArrayList<>(term.getReviewers()));
      JsonPatch patch = JsonUtils.getJsonPatch(originalTask, updatedTask);
      RestUtil.PatchResponse<Thread> thread =
          feedRepository.patchThread(null, originalTask.getId(), updatedTask.getUpdatedBy(), patch);

      // Send WebSocket Notification
      WebsocketNotificationHandler.handleTaskNotification(thread.entity());
    } catch (EntityNotFoundException e) {
      LOG.info(
          "{} Task not found for glossary term {}",
          TaskType.RequestApproval,
          term.getFullyQualifiedName());
    }
  }

  private void fetchAndSetRelatedTerms(List<GlossaryTerm> entities, Fields fields) {
    if (!fields.contains("relatedTerms") || entities.isEmpty()) {
      return;
    }
    Set<String> termIdsSet =
        entities.stream().map(GlossaryTerm::getId).map(UUID::toString).collect(Collectors.toSet());

    List<CollectionDAO.EntityRelationshipObject> fromRecords =
        findFromRecordsBatch(termIdsSet, GLOSSARY_TERM, Relationship.RELATED_TO, GLOSSARY_TERM);
    List<CollectionDAO.EntityRelationshipObject> toRecords =
        findToRecordsBatch(
            termIdsSet, Entity.GLOSSARY_TERM, Relationship.RELATED_TO, Entity.GLOSSARY_TERM);

    List<CollectionDAO.EntityRelationshipObject> allRecords = new ArrayList<>();
    allRecords.addAll(fromRecords);
    allRecords.addAll(toRecords);

    Map<UUID, Set<UUID>> relatedTermIdsMap = new HashMap<>();

    for (CollectionDAO.EntityRelationshipObject rec : allRecords) {
      UUID termId = UUID.fromString(rec.getFromId());
      UUID relatedTermId = UUID.fromString(rec.getToId());

      // store the bidirectional relationship in related-term map
      relatedTermIdsMap.computeIfAbsent(termId, k -> new HashSet<>()).add(relatedTermId);
      relatedTermIdsMap.computeIfAbsent(relatedTermId, k -> new HashSet<>()).add(termId);
    }

    Map<UUID, List<EntityReference>> relatedTermsMap =
        relatedTermIdsMap.entrySet().stream()
            .collect(
                Collectors.toMap(
                    Map.Entry::getKey,
                    entry ->
                        entry.getValue().stream()
                            .map(
                                id ->
                                    Entity.getEntityReferenceById(
                                        Entity.GLOSSARY_TERM, id, Include.ALL))
                            .sorted(EntityUtil.compareEntityReference)
                            .toList()));

    if (!allRecords.isEmpty()) {
      for (GlossaryTerm term : entities) {
        List<EntityReference> relatedTerms =
            relatedTermsMap.getOrDefault(term.getId(), Collections.emptyList());
        term.setRelatedTerms(relatedTerms);
      }
    }
  }

  private void fetchAndSetParentOrGlossary(List<GlossaryTerm> terms, Fields fields) {
    if (terms == null || terms.isEmpty()) {
      return;
    }

    List<String> entityIds =
        terms.stream().map(GlossaryTerm::getId).map(UUID::toString).distinct().toList();

    List<CollectionDAO.EntityRelationshipObject> parentRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(entityIds, Relationship.CONTAINS.ordinal(), entityType, entityType);

    Map<UUID, EntityReference> parentMap = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject rec : parentRecords) {
      parentMap.put(
          UUID.fromString(rec.getToId()),
          Entity.getEntityReferenceById(
              rec.getFromEntity(), UUID.fromString(rec.getFromId()), ALL));
    }

    // Set parent references on GlossaryTerms
    for (GlossaryTerm term : terms) {
      EntityReference parentRef = parentMap.get(term.getId());
      if (parentRef != null) {
        term.setParent(parentRef);
      }
    }

    List<String> hasRelationIds =
        terms.stream()
            .filter(term -> term.getParent() != null)
            .map(GlossaryTerm::getId)
            .map(UUID::toString)
            .toList();

    List<String> containsRelationIds =
        terms.stream()
            .filter(term -> term.getParent() == null)
            .map(GlossaryTerm::getId)
            .map(UUID::toString)
            .toList();

    List<CollectionDAO.EntityRelationshipObject> hasRecords = Collections.emptyList();
    if (!hasRelationIds.isEmpty()) {
      hasRecords =
          daoCollection
              .relationshipDAO()
              .findFromBatch(hasRelationIds, Relationship.HAS.ordinal(), GLOSSARY);
    }

    List<CollectionDAO.EntityRelationshipObject> containsRecords = Collections.emptyList();
    if (!containsRelationIds.isEmpty()) {
      containsRecords =
          daoCollection
              .relationshipDAO()
              .findFromBatch(containsRelationIds, Relationship.CONTAINS.ordinal(), GLOSSARY);
    }

    List<CollectionDAO.EntityRelationshipObject> allRecords = new ArrayList<>();
    allRecords.addAll(hasRecords);
    allRecords.addAll(containsRecords);

    // Map to entity ID -> glossary reference
    Map<UUID, EntityReference> glossaryMap = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject rec : allRecords) {
      glossaryMap.put(
          UUID.fromString(rec.getToId()),
          Entity.getEntityReferenceById(
              rec.getFromEntity(), UUID.fromString(rec.getFromId()), ALL));
    }

    for (GlossaryTerm term : terms) {
      EntityReference glossaryRef = glossaryMap.get(term.getId());
      if (glossaryRef != null) {
        term.setGlossary(glossaryRef);
      }
    }
  }

  private void fetchAndSetUsageCount(List<GlossaryTerm> entities, Fields fields) {
    if (!fields.contains("usageCount") || entities.isEmpty()) {
      return;
    }
    // TODO: modify to use a single db query
    for (GlossaryTerm entity : entities) {
      entity.withUsageCount(getUsageCount(entity));
    }
  }

  private void fetchAndSetChildrenCount(List<GlossaryTerm> entities, Fields fields) {
    if (!fields.contains("childrenCount") || entities.isEmpty()) {
      return;
    }
    List<String> termIds =
        entities.stream().map(GlossaryTerm::getId).map(UUID::toString).distinct().toList();

    Map<UUID, Integer> termIdCountMap =
        daoCollection
            .relationshipDAO()
            .countFindTo(termIds, GLOSSARY_TERM, Relationship.CONTAINS.ordinal(), GLOSSARY_TERM)
            .stream()
            .collect(
                Collectors.toMap(
                    CollectionDAO.EntityRelationshipCount::getId,
                    CollectionDAO.EntityRelationshipCount::getCount));

    for (GlossaryTerm entity : entities) {
      entity.setChildrenCount(
          termIdCountMap.getOrDefault(entity.getId(), entity.getChildrenCount()));
    }
  }

  private void checkDuplicateTerms(GlossaryTerm entity) {
    int count =
        daoCollection
            .glossaryTermDAO()
            .getGlossaryTermCountIgnoreCase(entity.getGlossary().getName(), entity.getName());
    if (count > 0) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.duplicateGlossaryTerm(
              entity.getName(), entity.getGlossary().getName()));
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class GlossaryTermUpdater extends EntityUpdater {
    public GlossaryTermUpdater(GlossaryTerm original, GlossaryTerm updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void updateReviewers() {
      super.updateReviewers();
      // adding the reviewer should add the person as assignee to the task

      if (!original.getReviewers().equals(updated.getReviewers())) {

        List<GlossaryTerm> childTerms = getNestedTerms(updated);
        childTerms.add(updated);
        for (GlossaryTerm term : childTerms) {
          updateTaskWithNewReviewers(term);
        }
      }
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      validateParent();
      updateStatus(original, updated, consolidatingChanges);
      updateSynonyms(original, updated);
      updateReferences(original, updated);
      updateRelatedTerms(original, updated);
      updateName(original, updated);
      updateParent(original, updated);
      // Mutually exclusive cannot be updated
      updated.setMutuallyExclusive(original.getMutuallyExclusive());
    }

    /**
     * Move a glossary term to a new parent or glossary. Only parent or glossary can be changed.
     */
    @Transaction
    public void moveAndStore() {
      updateChangeDescriptionForMove();
      // Now updated from previous/original to updated one
      validateParent();
      updateParent(original, updated); // Only update parent/glossary and FQN/relationships
      storeUpdate();
      postUpdate(original, updated);
    }

    private void updateChangeDescriptionForMove() {
      ChangeDescription change = new ChangeDescription().withPreviousVersion(original.getVersion());
      if (!Objects.equals(original.getParent(), updated.getParent())) {
        fieldUpdated(change, "parent", original.getParent(), updated.getParent());
      }
      if (!Objects.equals(original.getGlossary(), updated.getGlossary())) {
        fieldUpdated(change, "glossary", original.getGlossary(), updated.getGlossary());
      }
      updated.setIncrementalChangeDescription(change);
      updated.setChangeDescription(change);
      this.changeDescription = change;
    }

    private boolean validateIfTagsAreEqual(
        List<TagLabel> originalTags, List<TagLabel> updatedTags) {
      Set<String> originalTagsFqn =
          listOrEmpty(originalTags).stream()
              .map(TagLabel::getTagFQN)
              .collect(Collectors.toCollection(TreeSet::new));
      Set<String> updatedTagsFqn =
          listOrEmpty(updatedTags).stream()
              .map(TagLabel::getTagFQN)
              .collect(Collectors.toCollection(TreeSet::new));

      // Validate if both are exactly equal
      return originalTagsFqn.equals(updatedTagsFqn);
    }

    @Override
    protected void updateTags(
        String fqn, String fieldName, List<TagLabel> origTags, List<TagLabel> updatedTags) {
      // Remove current entity tags in the database. It will be added back later from the merged tag
      // list.
      origTags = listOrEmpty(origTags);
      // updatedTags cannot be immutable list, as we are adding the origTags to updatedTags even if
      // its empty.
      updatedTags = Optional.ofNullable(updatedTags).orElse(new ArrayList<>());
      if (!(origTags.isEmpty() && updatedTags.isEmpty())
          && !validateIfTagsAreEqual(origTags, updatedTags)) {
        List<String> targetFQNHashes = daoCollection.tagUsageDAO().getTargetFQNHashForTag(fqn);
        for (String fqnHash : targetFQNHashes) {
          Map<String, List<TagLabel>> allAssetTags =
              daoCollection.tagUsageDAO().getTagsByPrefix(fqnHash, "%", false);

          // Assets FQN is not available / we can use fqnHash for now
          checkMutuallyExclusiveForParentAndSubField("", fqnHash, allAssetTags, updatedTags, true);
        }

        // Remove current entity tags in the database. It will be added back later from the merged
        // tag
        // list.
        daoCollection.tagUsageDAO().deleteTagsByTarget(fqn);

        if (operation.isPut()) {
          // PUT operation merges tags in the request with what already exists
          EntityUtil.mergeTags(updatedTags, origTags);
          checkMutuallyExclusive(updatedTags);
        }

        List<TagLabel> addedTags = new ArrayList<>();
        List<TagLabel> deletedTags = new ArrayList<>();
        recordListChange(fieldName, origTags, updatedTags, addedTags, deletedTags, tagLabelMatch);
        updatedTags.sort(compareTagLabel);
        applyTags(updatedTags, fqn);
      }
    }

    private void updateStatus(
        GlossaryTerm origTerm, GlossaryTerm updatedTerm, boolean consolidatingChanges) {
      if (origTerm.getStatus() == updatedTerm.getStatus()) {
        return;
      }
      // Only reviewers can change from IN_REVIEW status to APPROVED/REJECTED status
      if (!consolidatingChanges
          && origTerm.getStatus() == Status.IN_REVIEW
          && (updatedTerm.getStatus() == Status.APPROVED
              || updatedTerm.getStatus() == Status.REJECTED)) {
        checkUpdatedByReviewer(origTerm, updatedTerm.getUpdatedBy());
      }
      recordChange("status", origTerm.getStatus(), updatedTerm.getStatus());
    }

    private void updateSynonyms(GlossaryTerm origTerm, GlossaryTerm updatedTerm) {
      List<String> origSynonyms = listOrEmpty(origTerm.getSynonyms());
      List<String> updatedSynonyms = listOrEmpty(updatedTerm.getSynonyms());

      List<String> added = new ArrayList<>();
      List<String> deleted = new ArrayList<>();
      recordListChange("synonyms", origSynonyms, updatedSynonyms, added, deleted, stringMatch);
    }

    private void updateReferences(GlossaryTerm origTerm, GlossaryTerm updatedTerm) {
      List<TermReference> origReferences = listOrEmpty(origTerm.getReferences());
      List<TermReference> updatedReferences = listOrEmpty(updatedTerm.getReferences());

      List<TermReference> added = new ArrayList<>();
      List<TermReference> deleted = new ArrayList<>();
      recordListChange(
          "references", origReferences, updatedReferences, added, deleted, termReferenceMatch);
    }

    private void updateRelatedTerms(GlossaryTerm origTerm, GlossaryTerm updatedTerm) {
      List<EntityReference> origRelated = listOrEmpty(origTerm.getRelatedTerms());
      List<EntityReference> updatedRelated = listOrEmpty(updatedTerm.getRelatedTerms());
      updateToRelationships(
          "relatedTerms",
          GLOSSARY_TERM,
          origTerm.getId(),
          Relationship.RELATED_TO,
          GLOSSARY_TERM,
          origRelated,
          updatedRelated,
          true);
    }

    public void updateName(GlossaryTerm original, GlossaryTerm updated) {
      if (!original.getName().equals(updated.getName())) {
        if (ProviderType.SYSTEM.equals(original.getProvider())) {
          throw new IllegalArgumentException(
              CatalogExceptionMessage.systemEntityRenameNotAllowed(original.getName(), entityType));
        }
        // Glossary term name changed - update the FQNs of the children terms to reflect this
        setFullyQualifiedName(updated);
        LOG.info("Glossary term name changed from {} to {}", original.getName(), updated.getName());
        daoCollection
            .glossaryTermDAO()
            .updateFqn(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
        daoCollection
            .tagUsageDAO()
            .rename(
                TagSource.GLOSSARY.ordinal(),
                original.getFullyQualifiedName(),
                updated.getFullyQualifiedName());
        recordChange("name", original.getName(), updated.getName());
        invalidateTerm(original.getId());

        // update tags
        daoCollection.tagUsageDAO().deleteTagsByTarget(original.getFullyQualifiedName());
        List<TagLabel> updatedTags = updated.getTags();
        updatedTags.sort(compareTagLabel);
        applyTags(updatedTags, updated.getFullyQualifiedName());
        daoCollection
            .tagUsageDAO()
            .renameByTargetFQNHash(
                TagSource.CLASSIFICATION.ordinal(),
                original.getFullyQualifiedName(),
                updated.getFullyQualifiedName());

        updateEntityLinks(original, updated);
      }
    }

    private void updateParent(GlossaryTerm original, GlossaryTerm updated) {
      // Can't change parent and glossary both at the same time
      UUID oldParentId = getId(original.getParent());
      UUID newParentId = getId(updated.getParent());
      final boolean parentChanged = !Objects.equals(oldParentId, newParentId);

      UUID oldGlossaryId = getId(original.getGlossary());
      UUID newGlossaryId = getId(updated.getGlossary());
      final boolean glossaryChanged = !Objects.equals(oldGlossaryId, newGlossaryId);
      if (!parentChanged && !glossaryChanged) {
        return;
      }

      setFullyQualifiedName(updated); // Update the FQN since the parent has changed
      daoCollection
          .glossaryTermDAO()
          .updateFqn(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
      daoCollection
          .tagUsageDAO()
          .rename(
              TagSource.GLOSSARY.ordinal(),
              original.getFullyQualifiedName(),
              updated.getFullyQualifiedName());

      // update tags
      daoCollection.tagUsageDAO().deleteTagsByTarget(original.getFullyQualifiedName());
      List<TagLabel> updatedTags = updated.getTags();
      updatedTags.sort(compareTagLabel);
      applyTags(updatedTags, updated.getFullyQualifiedName());

      // do same for children terms
      // update Tags Of Glossary On Rename
      daoCollection
          .tagUsageDAO()
          .renameByTargetFQNHash(
              TagSource.CLASSIFICATION.ordinal(),
              original.getFullyQualifiedName(),
              updated.getFullyQualifiedName());

      updateEntityLinks(original, updated);

      if (glossaryChanged) {
        updateGlossaryRelationship(original, updated);
        recordChange(
            "glossary", original.getGlossary(), updated.getGlossary(), true, entityReferenceMatch);
        invalidateTerm(original.getId());
      }
      if (parentChanged) {
        updateGlossaryRelationship(original, updated);
        updateParentRelationship(original, updated);
        recordChange(
            "parent", original.getParent(), updated.getParent(), true, entityReferenceMatch);
        invalidateTerm(original.getId());
      }
      updateAssetIndexes(original, updated);
    }

    private void validateParent() {
      String fqn = original.getFullyQualifiedName();
      String newParentFqn =
          updated.getParent() == null ? null : updated.getParent().getFullyQualifiedName();
      // A glossary term can't be moved under its child
      if (newParentFqn != null && FullyQualifiedName.isParent(newParentFqn, fqn)) {
        throw new IllegalArgumentException(invalidGlossaryTermMove(fqn, newParentFqn));
      }
    }

    private void updateGlossaryRelationship(GlossaryTerm orig, GlossaryTerm updated) {
      deleteGlossaryRelationship(orig);
      addGlossaryRelationship(updated);
    }

    private void deleteGlossaryRelationship(GlossaryTerm term) {
      Relationship relationship =
          term.getParent() == null ? Relationship.CONTAINS : Relationship.HAS;
      deleteRelationship(
          term.getGlossary().getId(), GLOSSARY, term.getId(), GLOSSARY_TERM, relationship);
    }

    private void updateParentRelationship(GlossaryTerm orig, GlossaryTerm updated) {
      deleteParentRelationship(orig);
      addParentRelationship(updated);
    }

    private void deleteParentRelationship(GlossaryTerm term) {
      if (term.getParent() != null) {
        deleteRelationship(
            term.getParent().getId(),
            GLOSSARY_TERM,
            term.getId(),
            GLOSSARY_TERM,
            Relationship.CONTAINS);
      }
    }

    private void invalidateTerm(UUID termId) {
      // The name of the glossary term changed or parent change. Invalidate that tag and all the
      // children from the cache
      List<EntityRelationshipRecord> tagRecords =
          findToRecords(termId, GLOSSARY_TERM, Relationship.CONTAINS, GLOSSARY_TERM);
      CACHE_WITH_ID.invalidate(new ImmutablePair<>(GLOSSARY_TERM, termId));
      for (EntityRelationshipRecord tagRecord : tagRecords) {
        invalidateTerm(tagRecord.getId());
      }
    }
  }

  /**
   * Move a glossary term to a new parent or glossary. Only parent or glossary can be changed.
   */
  public GlossaryTerm moveGlossaryTerm(UUID id, MoveGlossaryTermRequest moveRequest, String user) {
    if (moveRequest == null || moveRequest.getParent() == null) {
      return null; // Nothing to move
    }
    GlossaryTerm original =
        Entity.getEntity(
            GLOSSARY_TERM,
            id,
            "id,name,fullyQualifiedName,parent,glossary,tags,reviewers,status",
            Include.ALL);
    GlossaryTerm updated = JsonUtils.deepCopy(original, GlossaryTerm.class);

    EntityReference parent = moveRequest.getParent();
    if (parent.getType().equalsIgnoreCase("glossary")) {
      // Move to root of the glossary
      Glossary glossary =
          Entity.getEntity(GLOSSARY, parent.getId(), "id,name,fullyQualifiedName", Include.ALL);
      updated.setParent(null);
      updated.setGlossary(glossary.getEntityReference());
    } else if (parent.getType().equalsIgnoreCase("glossaryTerm")) {
      // Can be of same glossary or a different glossary
      GlossaryTerm parentTerm =
          Entity.getEntity(
              GLOSSARY_TERM, parent.getId(), "id,name,fullyQualifiedName,glossary", Include.ALL);
      updated.setParent(parentTerm.getEntityReference());
      Glossary glossary =
          Entity.getEntity(
              GLOSSARY,
              parentTerm.getGlossary().getId(),
              "id,name,fullyQualifiedName",
              Include.ALL);
      updated.setGlossary(glossary.getEntityReference());
    } else {
      throw new IllegalArgumentException("Invalid parent type: " + parent.getType());
    }
    updated.setUpdatedBy(user);
    updated.setUpdatedAt(System.currentTimeMillis());
    GlossaryTermUpdater updater = new GlossaryTermUpdater(original, updated, Operation.PUT);
    updater.moveAndStore();
    return updated;
  }

  @Override
  public RestUtil.PutResponse<GlossaryTerm> createOrUpdateForImport(
      UriInfo uriInfo, GlossaryTerm updated, String updatedBy) {

    GlossaryTerm original = findByNameOrNull(updated.getFullyQualifiedName(), Include.ALL);

    // Glossary term's parent can change which alters its FQN. If the FQN lookup fails, try
    // locating the term by (glossary, name) combination.
    if (original == null) {
      try {
        String existingTermString =
            Entity.getCollectionDAO()
                .glossaryTermDAO()
                .getGlossaryTermByNameAndGlossaryIgnoreCase(
                    updated.getGlossary().getFullyQualifiedName(), updated.getName());
        if (existingTermString != null && !existingTermString.isEmpty()) {
          original = JsonUtils.readValue(existingTermString, GlossaryTerm.class);
        }
      } catch (Exception ignored) {
      }
    }

    if (original == null) {
      return new RestUtil.PutResponse<>(
          Response.Status.CREATED, withHref(uriInfo, createNewEntity(updated)), ENTITY_CREATED);
    }

    return updateForImport(uriInfo, original, updated, updatedBy);
  }

  @Override
  public boolean isUpdateForImport(GlossaryTerm entity) {
    if (super.isUpdateForImport(entity)) {
      return true;
    }

    // A glossary term may have been moved to a different parent causing its FQN to change. So check
    // with name field
    return Entity.getCollectionDAO()
            .glossaryTermDAO()
            .getGlossaryTermCountIgnoreCase(
                entity.getGlossary().getFullyQualifiedName(), entity.getName())
        > 0;
  }
}
