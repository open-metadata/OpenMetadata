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

import static org.openmetadata.catalog.util.EntityUtil.stringMatch;
import static org.openmetadata.catalog.util.EntityUtil.termReferenceMatch;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.TermReference;
import org.openmetadata.catalog.entity.data.GlossaryTerm;
import org.openmetadata.catalog.resources.glossary.GlossaryTermResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

@Slf4j
public class GlossaryTermRepository extends EntityRepository<GlossaryTerm> {
  private static final Fields UPDATE_FIELDS =
      new Fields(GlossaryTermResource.ALLOWED_FIELDS, "tags,references,relatedTerms,reviewers,synonyms");
  private static final Fields PATCH_FIELDS =
      new Fields(GlossaryTermResource.ALLOWED_FIELDS, "tags,references,relatedTerms,reviewers,synonyms");

  public GlossaryTermRepository(CollectionDAO dao) {
    super(
        GlossaryTermResource.COLLECTION_PATH,
        Entity.GLOSSARY_TERM,
        GlossaryTerm.class,
        dao.glossaryTermDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS,
        true,
        false,
        false);
  }

  @Override
  public GlossaryTerm setFields(GlossaryTerm entity, Fields fields) throws IOException, ParseException {
    entity.setGlossary(getGlossary(entity));
    entity.setParent(getParent(entity));
    entity.setChildren(fields.contains("children") ? getChildren(entity) : null);
    entity.setRelatedTerms(fields.contains("relatedTerms") ? getRelatedTerms(entity) : null);
    entity.setReviewers(fields.contains("reviewers") ? getReviewers(entity) : null);
    entity.setTags(fields.contains("tags") ? getTags(entity.getFullyQualifiedName()) : null);
    return entity;
  }

  private EntityReference getParent(GlossaryTerm entity) throws IOException {
    List<String> ids =
        findFrom(
            entity.getId(), Entity.GLOSSARY_TERM, Relationship.PARENT_OF, Entity.GLOSSARY_TERM, entity.getDeleted());
    return ids.size() == 1 ? Entity.getEntityReferenceById(Entity.GLOSSARY_TERM, UUID.fromString(ids.get(0))) : null;
  }

  private List<EntityReference> getChildren(GlossaryTerm entity) throws IOException {
    List<String> ids =
        findTo(entity.getId(), Entity.GLOSSARY_TERM, Relationship.PARENT_OF, Entity.GLOSSARY_TERM, entity.getDeleted());
    return EntityUtil.populateEntityReferences(ids, Entity.GLOSSARY_TERM);
  }

  private List<EntityReference> getRelatedTerms(GlossaryTerm entity) throws IOException {
    List<String> ids =
        findBoth(
            entity.getId(), Entity.GLOSSARY_TERM, Relationship.RELATED_TO, Entity.GLOSSARY_TERM, entity.getDeleted());
    return EntityUtil.populateEntityReferences(ids, Entity.GLOSSARY_TERM);
  }

  private List<EntityReference> getReviewers(GlossaryTerm entity) throws IOException {
    List<String> ids =
        findFrom(entity.getId(), Entity.GLOSSARY_TERM, Relationship.REVIEWS, Entity.USER, entity.getDeleted());
    return EntityUtil.populateEntityReferences(ids, Entity.USER);
  }

  @Override
  public void prepare(GlossaryTerm entity) throws IOException, ParseException {
    // Validate glossary
    EntityReference glossary = Entity.getEntityReference(entity.getGlossary());
    entity.setGlossary(glossary);

    // Validate parent
    if (entity.getParent() == null) {
      entity.setFullyQualifiedName(entity.getGlossary().getName() + "." + entity.getName());
    } else {
      EntityReference parent = Entity.getEntityReference(entity.getParent());
      entity.setFullyQualifiedName(parent.getName() + "." + entity.getName());
      entity.setParent(parent);
    }

    // Validate related terms
    EntityUtil.populateEntityReferences(entity.getRelatedTerms());

    // Validate reviewers
    EntityUtil.populateEntityReferences(entity.getReviewers());

    // Set tags
    entity.setTags(EntityUtil.addDerivedTags(daoCollection.tagDAO(), entity.getTags()));
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

    if (update) {
      daoCollection.glossaryTermDAO().update(entity.getId(), JsonUtils.pojoToJson(entity));
    } else {
      daoCollection.glossaryTermDAO().insert(entity);
    }

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
        entity.getGlossary().getId(), entity.getId(), Entity.GLOSSARY, Entity.GLOSSARY_TERM, Relationship.CONTAINS);
    if (entity.getParent() != null) {
      addRelationship(
          entity.getParent().getId(),
          entity.getId(),
          Entity.GLOSSARY_TERM,
          Entity.GLOSSARY_TERM,
          Relationship.PARENT_OF);
    }
    for (EntityReference relTerm : listOrEmpty(entity.getRelatedTerms())) {
      // Make this bidirectional relationship
      addRelationship(
          entity.getId(), relTerm.getId(), Entity.GLOSSARY_TERM, Entity.GLOSSARY_TERM, Relationship.RELATED_TO, true);
    }
    for (EntityReference reviewer : listOrEmpty(entity.getReviewers())) {
      addRelationship(reviewer.getId(), entity.getId(), Entity.USER, Entity.GLOSSARY_TERM, Relationship.REVIEWS);
    }

    applyTags(entity);
  }

  @Override
  public void restorePatchAttributes(GlossaryTerm original, GlossaryTerm updated) {
    // Patch can't update Children, Glossary, or Parent
    updated.withChildren(original.getChildren()).withGlossary(original.getGlossary()).withParent(original.getParent());
  }

  protected EntityReference getGlossary(GlossaryTerm term) throws IOException {
    // TODO check deleted
    List<String> refs = findFrom(term.getId(), Entity.GLOSSARY_TERM, Relationship.CONTAINS, Entity.GLOSSARY, null);
    if (refs.size() != 1) {
      LOG.warn(
          "Possible database issues - multiple owners found for entity {} with type {}", term.getId(), Entity.GLOSSARY);
    }
    return getGlossary(refs.get(0));
  }

  public EntityReference getGlossary(String id) throws IOException {
    return daoCollection.glossaryDAO().findEntityReferenceById(UUID.fromString(id));
  }

  @Override
  public EntityInterface<GlossaryTerm> getEntityInterface(GlossaryTerm entity) {
    return new GlossaryTermEntityInterface(entity);
  }

  @Override
  public EntityUpdater getUpdater(GlossaryTerm original, GlossaryTerm updated, Operation operation) {
    return new GlossaryTermUpdater(original, updated, operation);
  }

  public static class GlossaryTermEntityInterface implements EntityInterface<GlossaryTerm> {
    private final GlossaryTerm entity;

    public GlossaryTermEntityInterface(GlossaryTerm entity) {
      this.entity = entity;
    }

    @Override
    public UUID getId() {
      return entity.getId();
    }

    @Override
    public String getDescription() {
      return entity.getDescription();
    }

    @Override
    public String getDisplayName() {
      return entity.getDisplayName();
    }

    @Override
    public String getName() {
      return entity.getName();
    }

    @Override
    public Boolean isDeleted() {
      return entity.getDeleted();
    }

    @Override
    public EntityReference getOwner() {
      return null;
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return entity.getTags();
    }

    @Override
    public Double getVersion() {
      return entity.getVersion();
    }

    @Override
    public String getUpdatedBy() {
      return entity.getUpdatedBy();
    }

    @Override
    public long getUpdatedAt() {
      return entity.getUpdatedAt();
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.GLOSSARY_TERM);
    }

    @Override
    public GlossaryTerm getEntity() {
      return entity;
    }

    @Override
    public EntityReference getContainer() {
      return null;
    }

    @Override
    public void setId(UUID id) {
      entity.setId(id);
    }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setName(String name) {
      entity.setName(name);
    }

    @Override
    public void setUpdateDetails(String updatedBy, long updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public GlossaryTerm withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class GlossaryTermUpdater extends EntityUpdater {
    public GlossaryTermUpdater(GlossaryTerm original, GlossaryTerm updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateStatus(original.getEntity(), updated.getEntity());
      updateSynonyms(original.getEntity(), updated.getEntity());
      updateReferences(original.getEntity(), updated.getEntity());
      updateRelatedTerms(original.getEntity(), updated.getEntity());
      updateReviewers(original.getEntity(), updated.getEntity());
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
          Entity.GLOSSARY_TERM,
          origTerm.getId(),
          Relationship.RELATED_TO,
          Entity.GLOSSARY_TERM,
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
          Entity.GLOSSARY_TERM,
          origTerm.getId());
    }
  }
}
