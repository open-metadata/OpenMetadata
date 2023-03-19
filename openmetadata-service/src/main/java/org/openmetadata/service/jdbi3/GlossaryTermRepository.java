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
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.getId;
import static org.openmetadata.service.util.EntityUtil.stringMatch;
import static org.openmetadata.service.util.EntityUtil.termReferenceMatch;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.glossary.GlossaryTermResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class GlossaryTermRepository extends EntityRepository<GlossaryTerm> {
  private static final String UPDATE_FIELDS = "tags,references,relatedTerms,reviewers,owner,synonyms";
  private static final String PATCH_FIELDS = "tags,references,relatedTerms,reviewers,owner,synonyms";

  public GlossaryTermRepository(CollectionDAO dao) {
    super(
        GlossaryTermResource.COLLECTION_PATH,
        GLOSSARY_TERM,
        GlossaryTerm.class,
        dao.glossaryTermDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public GlossaryTerm setFields(GlossaryTerm entity, Fields fields) throws IOException {
    entity.withGlossary(getGlossary(entity)).withParent(getParent(entity));
    entity.setChildren(fields.contains("children") ? getChildren(entity) : null);
    entity.setRelatedTerms(fields.contains("relatedTerms") ? getRelatedTerms(entity) : null);
    entity.setReviewers(fields.contains("reviewers") ? getReviewers(entity) : null);
    entity.setOwner(fields.contains("owner") ? getOwner(entity) : null);
    return entity.withUsageCount(fields.contains("usageCount") ? getUsageCount(entity) : null);
  }

  private Integer getUsageCount(GlossaryTerm term) {
    return daoCollection.tagUsageDAO().getTagCount(TagSource.GLOSSARY.ordinal(), term.getFullyQualifiedName());
  }

  private EntityReference getParent(GlossaryTerm entity) throws IOException {
    return getFromEntityRef(entity.getId(), Relationship.CONTAINS, GLOSSARY_TERM, false);
  }

  private List<EntityReference> getChildren(GlossaryTerm entity) throws IOException {
    List<EntityRelationshipRecord> ids = findTo(entity.getId(), GLOSSARY_TERM, Relationship.CONTAINS, GLOSSARY_TERM);
    return EntityUtil.populateEntityReferences(ids, GLOSSARY_TERM);
  }

  private List<EntityReference> getRelatedTerms(GlossaryTerm entity) throws IOException {
    List<EntityRelationshipRecord> ids =
        findBoth(entity.getId(), GLOSSARY_TERM, Relationship.RELATED_TO, GLOSSARY_TERM);
    return EntityUtil.populateEntityReferences(ids, GLOSSARY_TERM);
  }

  private List<EntityReference> getReviewers(GlossaryTerm entity) throws IOException {
    List<EntityRelationshipRecord> ids = findFrom(entity.getId(), GLOSSARY_TERM, Relationship.REVIEWS, Entity.USER);
    return EntityUtil.populateEntityReferences(ids, Entity.USER);
  }

  @Override
  public void prepare(GlossaryTerm entity) throws IOException {
    // Validate parent term
    GlossaryTerm parentTerm =
        entity.getParent() != null
            ? getByName(null, entity.getParent().getFullyQualifiedName(), getFields("owner"))
            : null;
    List<EntityReference> inheritedReviewers = null;
    EntityReference inheritedOwner = null;
    if (parentTerm != null) {
      entity.setParent(parentTerm.getEntityReference());
      inheritedReviewers = parentTerm.getReviewers(); // Inherit reviewers from the parent term
      inheritedOwner = parentTerm.getOwner(); // Inherit ownership from the parent term
    }

    // Validate glossary
    Glossary glossary = Entity.getEntity(entity.getGlossary(), "owner,reviewers", Include.NON_DELETED);
    entity.setGlossary(glossary.getEntityReference());

    // If parent term does not have reviewers or owner then inherit from the glossary
    inheritedReviewers = inheritedReviewers != null ? inheritedReviewers : glossary.getReviewers();
    inheritedOwner = inheritedOwner != null ? inheritedOwner : glossary.getOwner();

    validateHierarchy(entity);

    // If reviewers and owner are not set for the glossary term, then carry it from the glossary
    entity.setReviewers(entity.getReviewers() != null ? entity.getReviewers() : inheritedReviewers);
    entity.setOwner(entity.getOwner() != null ? entity.getOwner() : inheritedOwner);

    // Validate related terms
    EntityUtil.populateEntityReferences(entity.getRelatedTerms());

    // Validate reviewers
    EntityUtil.populateEntityReferences(entity.getReviewers());
  }

  @Override
  public void storeEntity(GlossaryTerm entity, boolean update) throws IOException {
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
    storeOwner(entity, entity.getOwner());
    for (EntityReference relTerm : listOrEmpty(entity.getRelatedTerms())) {
      // Make this bidirectional relationship
      addRelationship(entity.getId(), relTerm.getId(), GLOSSARY_TERM, GLOSSARY_TERM, Relationship.RELATED_TO, true);
    }
    for (EntityReference reviewer : listOrEmpty(entity.getReviewers())) {
      addRelationship(reviewer.getId(), entity.getId(), Entity.USER, GLOSSARY_TERM, Relationship.REVIEWS);
    }

    applyTags(entity);
  }

  @Override
  public void restorePatchAttributes(GlossaryTerm original, GlossaryTerm updated) {
    // Patch can't update Children
    updated.withChildren(original.getChildren());
  }

  @Override
  public void setFullyQualifiedName(GlossaryTerm entity) {
    // Validate parent
    if (entity.getParent() == null) { // Glossary term at the root of the glossary
      entity.setFullyQualifiedName(FullyQualifiedName.build(entity.getGlossary().getName(), entity.getName()));
    } else { // Glossary term that is a child of another glossary term
      EntityReference parent = entity.getParent();
      entity.setFullyQualifiedName(FullyQualifiedName.add(parent.getFullyQualifiedName(), entity.getName()));
    }
  }

  protected EntityReference getGlossary(GlossaryTerm term) throws IOException {
    return getFromEntityRef(term.getId(), Relationship.CONTAINS, GLOSSARY, true);
  }

  public EntityReference getGlossary(String id) throws IOException {
    return daoCollection.glossaryDAO().findEntityReferenceById(UUID.fromString(id), ALL);
  }

  @Override
  public GlossaryTermUpdater getUpdater(GlossaryTerm original, GlossaryTerm updated, Operation operation) {
    return new GlossaryTermUpdater(original, updated, operation);
  }

  @Override
  protected void postDelete(GlossaryTerm entity) {
    // Cleanup all the tag labels using this glossary term
    daoCollection.tagUsageDAO().deleteTagLabels(TagSource.GLOSSARY.ordinal(), entity.getFullyQualifiedName());
  }

  private void addGlossaryRelationship(GlossaryTerm term) {
    addRelationship(term.getGlossary().getId(), term.getId(), GLOSSARY, GLOSSARY_TERM, Relationship.CONTAINS);
  }

  private void deleteGlossaryRelationship(GlossaryTerm term) {
    deleteRelationship(term.getGlossary().getId(), GLOSSARY, term.getId(), GLOSSARY_TERM, Relationship.CONTAINS);
  }

  private void updateGlossaryRelationship(GlossaryTerm orig, GlossaryTerm updated) {
    deleteGlossaryRelationship(orig);
    addGlossaryRelationship(updated);
  }

  private void addParentRelationship(GlossaryTerm term) {
    if (term.getParent() != null) {
      addRelationship(term.getParent().getId(), term.getId(), GLOSSARY_TERM, GLOSSARY_TERM, Relationship.CONTAINS);
    }
  }

  private void deleteParentRelationship(GlossaryTerm term) {
    if (term.getParent() != null) {
      deleteRelationship(term.getParent().getId(), GLOSSARY_TERM, term.getId(), GLOSSARY_TERM, Relationship.CONTAINS);
    }
  }

  private void updateParentRelationship(GlossaryTerm orig, GlossaryTerm updated) {
    deleteParentRelationship(orig);
    addParentRelationship(updated);
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

  /** Handles entity updated from PUT and POST operation. */
  public class GlossaryTermUpdater extends EntityUpdater {
    public GlossaryTermUpdater(GlossaryTerm original, GlossaryTerm updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateStatus(original, updated);
      updateSynonyms(original, updated);
      updateReferences(original, updated);
      updateRelatedTerms(original, updated);
      updateReviewers(original, updated);
      updateName(original, updated);
      updateParent(original, updated);
    }

    @Override
    protected void updateTags(String fqn, String fieldName, List<TagLabel> origTags, List<TagLabel> updatedTags)
        throws IOException {
      super.updateTags(fqn, fieldName, origTags, updatedTags);
      List<String> targetFQNList = daoCollection.tagUsageDAO().getTargetFQNs(TagSource.CLASSIFICATION.ordinal(), fqn);
      for (String targetFQN : targetFQNList) {
        applyTags(updatedTags, targetFQN);
      }
    }

    private void updateStatus(GlossaryTerm origTerm, GlossaryTerm updatedTerm) throws JsonProcessingException {
      // TODO Only list of allowed reviewers can change the status from DRAFT to APPROVED
      recordChange("status", origTerm.getStatus(), updatedTerm.getStatus());
    }

    private void updateSynonyms(GlossaryTerm origTerm, GlossaryTerm updatedTerm) throws JsonProcessingException {
      List<String> origSynonyms = listOrEmpty(origTerm.getSynonyms());
      List<String> updatedSynonyms = listOrEmpty(updatedTerm.getSynonyms());

      List<String> added = new ArrayList<>();
      List<String> deleted = new ArrayList<>();
      recordListChange("synonyms", origSynonyms, updatedSynonyms, added, deleted, stringMatch);
    }

    private void updateReferences(GlossaryTerm origTerm, GlossaryTerm updatedTerm) throws JsonProcessingException {
      List<TermReference> origReferences = listOrEmpty(origTerm.getReferences());
      List<TermReference> updatedReferences = listOrEmpty(updatedTerm.getReferences());

      List<TermReference> added = new ArrayList<>();
      List<TermReference> deleted = new ArrayList<>();
      recordListChange("references", origReferences, updatedReferences, added, deleted, termReferenceMatch);
    }

    private void updateRelatedTerms(GlossaryTerm origTerm, GlossaryTerm updatedTerm) throws JsonProcessingException {
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

    private void updateReviewers(GlossaryTerm origTerm, GlossaryTerm updatedTerm) throws JsonProcessingException {
      List<EntityReference> origReviewers = listOrEmpty(origTerm.getReviewers());
      List<EntityReference> updatedReviewers = listOrEmpty(updatedTerm.getReviewers());
      updateFromRelationships(
          "reviewers",
          Entity.USER,
          origReviewers,
          updatedReviewers,
          Relationship.REVIEWS,
          GLOSSARY_TERM,
          origTerm.getId());
    }

    public void updateName(GlossaryTerm original, GlossaryTerm updated) throws IOException {
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
      }
    }

    private void updateParent(GlossaryTerm original, GlossaryTerm updated) throws JsonProcessingException {
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
      }
      if (parentChanged) {
        updateParentRelationship(original, updated);
        recordChange("parent", original.getParent(), updated.getParent(), true, entityReferenceMatch);
      }
    }
  }
}
