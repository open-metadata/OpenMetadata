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
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidGlossaryTermMove;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.getId;
import static org.openmetadata.service.util.EntityUtil.stringMatch;
import static org.openmetadata.service.util.EntityUtil.termReferenceMatch;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import javax.json.JsonPatch;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.GlossaryTerm.Status;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.feeds.FeedResource;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.glossary.GlossaryTermResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class GlossaryTermRepository extends EntityRepository<GlossaryTerm> {
  private static final String UPDATE_FIELDS = "references,relatedTerms,synonyms";
  private static final String PATCH_FIELDS = "references,relatedTerms,synonyms";

  public GlossaryTermRepository() {
    super(
        GlossaryTermResource.COLLECTION_PATH,
        GLOSSARY_TERM,
        GlossaryTerm.class,
        Entity.getCollectionDAO().glossaryTermDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;
  }

  @Override
  public GlossaryTerm setFields(GlossaryTerm entity, Fields fields) {
    entity.withParent(getParent(entity)).withGlossary(getGlossary(entity));
    entity.setRelatedTerms(fields.contains("relatedTerms") ? getRelatedTerms(entity) : entity.getRelatedTerms());
    return entity.withUsageCount(fields.contains("usageCount") ? getUsageCount(entity) : entity.getUsageCount());
  }

  @Override
  public GlossaryTerm clearFields(GlossaryTerm entity, Fields fields) {
    entity.setRelatedTerms(fields.contains("relatedTerms") ? entity.getRelatedTerms() : null);
    return entity.withUsageCount(fields.contains("usageCount") ? entity.getUsageCount() : null);
  }

  @Override
  public GlossaryTerm setInheritedFields(GlossaryTerm glossaryTerm, Fields fields) {
    EntityInterface parent = getParentEntity(glossaryTerm, "owner,domain,reviewers");
    inheritOwner(glossaryTerm, fields, parent);
    inheritDomain(glossaryTerm, fields, parent);
    inheritReviewers(glossaryTerm, fields, parent);
    return glossaryTerm;
  }

  private Integer getUsageCount(GlossaryTerm term) {
    return daoCollection.tagUsageDAO().getTagCount(TagSource.GLOSSARY.ordinal(), term.getFullyQualifiedName());
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
            ? Entity.getEntity(entity.getParent().withType(GLOSSARY_TERM), "owner,reviewers", Include.NON_DELETED)
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

    // Validate reviewers
    EntityUtil.populateEntityReferences(entity.getReviewers());

    if (!update || entity.getStatus() == null) {
      // If parentTerm or glossary has reviewers set, the glossary term can only be created in `Draft` mode
      entity.setStatus(!nullOrEmpty(parentReviewers) ? Status.DRAFT : Status.APPROVED);
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
    entity.withGlossary(glossary).withParent(parentTerm).withRelatedTerms(relatedTerms).withReviewers(reviewers);
  }

  @Override
  public void storeRelationships(GlossaryTerm entity) {
    addGlossaryRelationship(entity);
    addParentRelationship(entity);
    for (EntityReference relTerm : listOrEmpty(entity.getRelatedTerms())) {
      // Make this bidirectional relationship
      addRelationship(entity.getId(), relTerm.getId(), GLOSSARY_TERM, GLOSSARY_TERM, Relationship.RELATED_TO, true);
    }
    for (EntityReference reviewer : listOrEmpty(entity.getReviewers())) {
      addRelationship(reviewer.getId(), entity.getId(), Entity.USER, GLOSSARY_TERM, Relationship.REVIEWS);
    }
  }

  @Override
  public void restorePatchAttributes(GlossaryTerm original, GlossaryTerm updated) {
    // Patch can't update Children
    super.restorePatchAttributes(original, updated);
    updated.withChildren(original.getChildren());
  }

  @Override
  public void setFullyQualifiedName(GlossaryTerm entity) {
    // Validate parent
    if (entity.getParent() == null) { // Glossary term at the root of the glossary
      entity.setFullyQualifiedName(
          FullyQualifiedName.build(entity.getGlossary().getFullyQualifiedName(), entity.getName()));
    } else { // Glossary term that is a child of another glossary term
      EntityReference parent = entity.getParent();
      entity.setFullyQualifiedName(FullyQualifiedName.add(parent.getFullyQualifiedName(), entity.getName()));
    }
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
  public GlossaryTermUpdater getUpdater(GlossaryTerm original, GlossaryTerm updated, Operation operation) {
    return new GlossaryTermUpdater(original, updated, operation);
  }

  @Override
  protected void postCreate(GlossaryTerm entity) {
    super.postCreate(entity);
    if (entity.getStatus() == Status.DRAFT) {
      // Create an approval task for glossary term in draft mode
      createApprovalTask(entity, entity.getReviewers());
    }
  }

  @Override
  public void postUpdate(GlossaryTerm original, GlossaryTerm updated) {
    super.postUpdate(original, updated);
    if (original.getStatus() == Status.DRAFT) {
      if (updated.getStatus() == Status.APPROVED) {
        closeApprovalTask(updated, "Approved the glossary term");
      } else if (updated.getStatus() == Status.REJECTED) {
        closeApprovalTask(updated, "Rejected the glossary term");
      }
    }
  }

  @Override
  protected void preDelete(GlossaryTerm entity, String deletedBy) {
    // A glossary term in `Draft` state can only be deleted by the reviewers
    if (Status.DRAFT.equals(entity.getStatus())) {
      checkUpdatedByReviewer(entity, deletedBy);
    }
  }

  @Override
  protected void postDelete(GlossaryTerm entity) {
    // Cleanup all the tag labels using this glossary term
    daoCollection.tagUsageDAO().deleteTagLabels(TagSource.GLOSSARY.ordinal(), entity.getFullyQualifiedName());
  }

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
      GlossaryTerm glossaryTerm = (GlossaryTerm) threadContext.getAboutEntity();
      glossaryTerm.setStatus(Status.APPROVED);
      return glossaryTerm;
    }

    @Override
    protected void closeTask(String user, CloseTask closeTask) {
      // Closing task results in glossary term going from `Draft` to `Rejected`
      GlossaryTerm term = (GlossaryTerm) threadContext.getAboutEntity();
      if (term.getStatus() == Status.DRAFT) {
        String origJson = JsonUtils.pojoToJson(term);
        term.setStatus(Status.REJECTED);
        String updatedJson = JsonUtils.pojoToJson(term);
        JsonPatch patch = JsonUtils.getJsonPatch(origJson, updatedJson);
        EntityRepository<?> repository = threadContext.getEntityRepository();
        repository.patch(null, term.getId(), user, patch);
      }
    }
  }

  @Override
  public EntityInterface getParentEntity(GlossaryTerm entity, String fields) {
    return entity.getParent() != null
        ? Entity.getEntity(entity.getParent(), fields, Include.NON_DELETED)
        : Entity.getEntity(entity.getGlossary(), fields, Include.NON_DELETED);
  }

  private void addGlossaryRelationship(GlossaryTerm term) {
    Relationship relationship = term.getParent() != null ? Relationship.HAS : Relationship.CONTAINS;
    addRelationship(term.getGlossary().getId(), term.getId(), GLOSSARY, GLOSSARY_TERM, relationship);
  }

  private void addParentRelationship(GlossaryTerm term) {
    if (term.getParent() != null) {
      addRelationship(term.getParent().getId(), term.getId(), GLOSSARY_TERM, GLOSSARY_TERM, Relationship.CONTAINS);
    }
  }

  private void validateHierarchy(GlossaryTerm term) {
    // The glossary and the parent term must belong to the same hierarchy
    if (term.getParent() == null) {
      return; // Parent is the root of the glossary
    }
    String glossaryFqn = FullyQualifiedName.build(term.getGlossary().getName());
    if (!term.getParent().getFullyQualifiedName().startsWith(glossaryFqn)) {
      throw new IllegalArgumentException(
          String.format(
              "Invalid hierarchy - parent [%s] does not belong to glossary[%s]",
              term.getParent().getFullyQualifiedName(), term.getGlossary().getFullyQualifiedName()));
    }
  }

  private void checkUpdatedByReviewer(GlossaryTerm term, String updatedBy) {
    // Only list of allowed reviewers can change the status from DRAFT to APPROVED
    List<EntityReference> reviewers = term.getReviewers();
    if (!nullOrEmpty(reviewers)) {
      // Updating user must be one of the reviewers
      boolean isReviewer =
          reviewers.stream()
              .anyMatch(e -> e.getName().equals(updatedBy) || e.getFullyQualifiedName().equals(updatedBy));
      if (!isReviewer) {
        throw new AuthorizationException(notReviewer(updatedBy));
      }
    }
  }

  private void createApprovalTask(GlossaryTerm entity, List<EntityReference> parentReviewers) {
    TaskDetails taskDetails =
        new TaskDetails()
            .withAssignees(FeedResource.formatAssignees(parentReviewers))
            .withType(TaskType.RequestApproval)
            .withStatus(TaskStatus.Open);

    EntityLink about = new EntityLink(entityType, entity.getFullyQualifiedName());
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withThreadTs(System.currentTimeMillis())
            .withMessage("Approval required for ") // TODO fix this
            .withCreatedBy(entity.getUpdatedBy())
            .withAbout(about.getLinkString())
            .withType(ThreadType.Task)
            .withTask(taskDetails)
            .withUpdatedBy(entity.getUpdatedBy())
            .withUpdatedAt(System.currentTimeMillis());
    FeedRepository feedRepository = Entity.getFeedRepository();
    feedRepository.create(thread);
  }

  private void closeApprovalTask(GlossaryTerm entity, String comment) {
    EntityLink about = new EntityLink(GLOSSARY_TERM, entity.getFullyQualifiedName());
    FeedRepository feedRepository = Entity.getFeedRepository();
    Thread taskThread = feedRepository.getTask(about, TaskType.RequestApproval);
    if (TaskStatus.Open.equals(taskThread.getTask().getStatus())) {
      feedRepository.closeTask(taskThread, entity.getUpdatedBy(), new CloseTask().withComment(comment));
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class GlossaryTermUpdater extends EntityUpdater {
    public GlossaryTermUpdater(GlossaryTerm original, GlossaryTerm updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate() {
      validateParent();
      updateStatus(original, updated);
      updateSynonyms(original, updated);
      updateReferences(original, updated);
      updateRelatedTerms(original, updated);
      updateName(original, updated);
      updateParent(original, updated);
    }

    @Override
    protected void updateTags(String fqn, String fieldName, List<TagLabel> origTags, List<TagLabel> updatedTags) {
      super.updateTags(fqn, fieldName, origTags, updatedTags);
      List<String> targetFQNList = daoCollection.tagUsageDAO().getTargetFQNs(TagSource.CLASSIFICATION.ordinal(), fqn);
      for (String targetFQN : targetFQNList) {
        applyTags(updatedTags, targetFQN);
      }
    }

    private void updateStatus(GlossaryTerm origTerm, GlossaryTerm updatedTerm) {
      if (origTerm.getStatus() == updatedTerm.getStatus()) {
        return;
      }
      // Only reviewers can change from DRAFT status to APPROVED/REJECTED status
      if (origTerm.getStatus() == Status.DRAFT
          && (updatedTerm.getStatus() == Status.APPROVED || updatedTerm.getStatus() == Status.REJECTED)) {
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
      recordListChange("references", origReferences, updatedReferences, added, deleted, termReferenceMatch);
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
        LOG.info("Glossary term name changed from {} to {}", original.getName(), updated.getName());
        daoCollection.glossaryTermDAO().updateFqn(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
        daoCollection
            .tagUsageDAO()
            .rename(TagSource.GLOSSARY.ordinal(), original.getFullyQualifiedName(), updated.getFullyQualifiedName());
        recordChange("name", original.getName(), updated.getName());
        invalidateTerm(original.getId());
      }
    }

    private void updateParent(GlossaryTerm original, GlossaryTerm updated) {
      // Can't change parent and glossary both at the same time
      UUID oldParentId = getId(original.getParent());
      UUID newParentId = getId(updated.getParent());
      boolean parentChanged = !Objects.equals(oldParentId, newParentId);

      UUID oldGlossaryId = getId(original.getGlossary());
      UUID newGlossaryId = getId(updated.getGlossary());
      boolean glossaryChanged = !Objects.equals(oldGlossaryId, newGlossaryId);

      daoCollection.glossaryTermDAO().updateFqn(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
      daoCollection
          .tagUsageDAO()
          .rename(TagSource.GLOSSARY.ordinal(), original.getFullyQualifiedName(), updated.getFullyQualifiedName());
      if (glossaryChanged) {
        updateGlossaryRelationship(original, updated);
        recordChange("glossary", original.getGlossary(), updated.getGlossary(), true, entityReferenceMatch);
        invalidateTerm(original.getId());
      }
      if (parentChanged) {
        updateGlossaryRelationship(original, updated);
        updateParentRelationship(original, updated);
        recordChange("parent", original.getParent(), updated.getParent(), true, entityReferenceMatch);
        invalidateTerm(original.getId());
      }
    }

    private void validateParent() {
      String fqn = original.getFullyQualifiedName();
      String newParentFqn = updated.getParent() == null ? null : updated.getParent().getFullyQualifiedName();
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
      Relationship relationship = term.getParent() == null ? Relationship.CONTAINS : Relationship.HAS;
      deleteRelationship(term.getGlossary().getId(), GLOSSARY, term.getId(), GLOSSARY_TERM, relationship);
    }

    private void updateParentRelationship(GlossaryTerm orig, GlossaryTerm updated) {
      deleteParentRelationship(orig);
      addParentRelationship(updated);
    }

    private void deleteParentRelationship(GlossaryTerm term) {
      if (term.getParent() != null) {
        deleteRelationship(term.getParent().getId(), GLOSSARY_TERM, term.getId(), GLOSSARY_TERM, Relationship.CONTAINS);
      }
    }

    private void invalidateTerm(UUID termId) {
      // The name of the glossary term changed or parent change. Invalidate that tag and all the children from the cache
      List<EntityRelationshipRecord> tagRecords =
          findToRecords(termId, GLOSSARY_TERM, Relationship.CONTAINS, GLOSSARY_TERM);
      CACHE_WITH_ID.invalidate(new ImmutablePair<>(GLOSSARY_TERM, termId));
      for (EntityRelationshipRecord tagRecord : tagRecords) {
        invalidateTerm(tagRecord.getId());
      }
    }
  }
}
