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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.FIELD_TAGS;
import static org.openmetadata.catalog.Entity.GLOSSARY_TERM;
import static org.openmetadata.catalog.type.Include.ALL;
import static org.openmetadata.catalog.util.EntityUtil.stringMatch;
import static org.openmetadata.catalog.util.EntityUtil.termReferenceMatch;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.TermReference;
import org.openmetadata.catalog.entity.data.GlossaryTerm;
import org.openmetadata.catalog.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.catalog.resources.glossary.GlossaryTermResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.Source;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.FullyQualifiedName;

@Slf4j
public class GlossaryTermRepository extends EntityRepository<GlossaryTerm> {
  private static final String UPDATE_FIELDS = "tags,references,relatedTerms,reviewers,synonyms";
  private static final String PATCH_FIELDS = "tags,references,relatedTerms,reviewers,synonyms";

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
    entity.setGlossary(getGlossary(entity));
    System.out.println("XXX entity glossary " + entity.getGlossary());
    entity.setParent(getParent(entity));
    entity.setChildren(fields.contains("children") ? getChildren(entity) : null);
    entity.setRelatedTerms(fields.contains("relatedTerms") ? getRelatedTerms(entity) : null);
    entity.setReviewers(fields.contains("reviewers") ? getReviewers(entity) : null);
    entity.setTags(fields.contains(FIELD_TAGS) ? getTags(entity.getFullyQualifiedName()) : null);
    entity.setUsageCount(fields.contains("usageCount") ? getUsageCount(entity) : null);
    return entity;
  }

  private Integer getUsageCount(GlossaryTerm term) {
    return daoCollection.tagUsageDAO().getTagCount(Source.GLOSSARY.ordinal(), term.getFullyQualifiedName());
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
    // Validate glossary
    EntityReference glossary = Entity.getEntityReference(entity.getGlossary());
    entity.setGlossary(glossary);

    // Validate parent term
    EntityReference parentTerm = Entity.getEntityReference(entity.getParent());
    entity.setParent(parentTerm);

    setFullyQualifiedName(entity);

    // Validate related terms
    EntityUtil.populateEntityReferences(entity.getRelatedTerms());

    // Validate reviewers
    EntityUtil.populateEntityReferences(entity.getReviewers());

    // Validate table tags and add derived tags to the list
    entity.setTags(addDerivedTags(entity.getTags()));
  }

  @Override
  public void storeEntity(GlossaryTerm entity, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    List<TagLabel> tags = entity.getTags();
    // TODO Add relationships for reviewers
    EntityReference glossary = entity.getGlossary();
    EntityReference parentTerm = entity.getParent();
    List<EntityReference> relatedTerms = entity.getRelatedTerms();
    List<EntityReference> reviewers = entity.getReviewers();

    // Don't store owner, dashboard, href and tags as JSON. Build it on the fly based on relationships
    entity
        .withGlossary(null)
        .withParent(null)
        .withRelatedTerms(relatedTerms)
        .withReviewers(null)
        .withHref(null)
        .withTags(null);

    store(entity.getId(), entity, update);

    // Restore the relationships
    entity
        .withGlossary(glossary)
        .withParent(parentTerm)
        .withRelatedTerms(relatedTerms)
        .withReviewers(reviewers)
        .withTags(tags);
  }

  @Override
  public void storeRelationships(GlossaryTerm entity) {
    addRelationship(
        entity.getGlossary().getId(), entity.getId(), Entity.GLOSSARY, GLOSSARY_TERM, Relationship.CONTAINS);
    if (entity.getParent() != null) {
      addRelationship(entity.getParent().getId(), entity.getId(), GLOSSARY_TERM, GLOSSARY_TERM, Relationship.CONTAINS);
    }
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
    // Patch can't update Children, Glossary, or Parent
    updated.withChildren(original.getChildren()).withGlossary(original.getGlossary()).withParent(original.getParent());
  }

  @Override
  public void setFullyQualifiedName(GlossaryTerm entity) {
    // Validate parent
    if (entity.getParent() == null) { // Glossary term at the root of the glossary
      entity.setFullyQualifiedName(FullyQualifiedName.add(entity.getGlossary().getName(), entity.getName()));
    } else { // Glossary term that is a child of another glossary term
      EntityReference parent = entity.getParent();
      entity.setFullyQualifiedName(FullyQualifiedName.add(parent.getFullyQualifiedName(), entity.getName()));
    }
  }

  protected EntityReference getGlossary(GlossaryTerm term) throws IOException {
    return getFromEntityRef(term.getId(), Relationship.CONTAINS, Entity.GLOSSARY, true);
  }

  public EntityReference getGlossary(String id) throws IOException {
    return daoCollection.glossaryDAO().findEntityReferenceById(UUID.fromString(id), ALL);
  }

  @Override
  public GlossaryTermUpdater getUpdater(GlossaryTerm original, GlossaryTerm updated, Operation operation) {
    return new GlossaryTermUpdater(original, updated, operation);
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
    }

    @Override
    protected void updateTags(String fqn, String fieldName, List<TagLabel> origTags, List<TagLabel> updatedTags)
        throws IOException {
      super.updateTags(fqn, fieldName, origTags, updatedTags);
      List<String> targetFQNList = daoCollection.tagUsageDAO().tagTargetFQN(fqn);
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
  }
}
