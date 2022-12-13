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

import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.Entity.TAG_CATEGORY;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.getId;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.tags.Tag;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.tags.TagResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class TagRepository extends EntityRepository<Tag> {
  public TagRepository(CollectionDAO dao) {
    super(TagResource.TAG_COLLECTION_PATH, Entity.TAG, Tag.class, dao.tagDAO(), dao, "", "");
  }

  @Override
  public void prepare(Tag entity) throws IOException {
    // Validate parent term
    EntityReference parentTerm = Entity.getEntityReferenceByName(entity.getParent());
    entity.setParent(parentTerm);

    // Validate tagCategory
    EntityReference tagCategory = Entity.getEntityReferenceByName(entity.getTagCategory());
    entity.setTagCategory(tagCategory);
  }

  @Override
  public void storeEntity(Tag tag, boolean update) throws IOException {
    EntityReference tagCategory = tag.getTagCategory();
    EntityReference parent = tag.getParent();

    // Parent and tagCategory are not stored as part of JSON. Build it on the fly based on relationships
    tag.withTagCategory(null).withParent(null);
    store(tag, update);
    tag.withTagCategory(tagCategory).withParent(parent);
  }

  @Override
  public void restorePatchAttributes(Tag original, Tag updated) {
    updated.setChildren(original.getChildren());
  }

  @Override
  public void storeRelationships(Tag entity) {
    addTagCategoryRelationship(entity);
    addParentRelationship(entity);
  }

  @Override
  public void setFullyQualifiedName(Tag entity) {
    EntityUtil.setFullyQualifiedName(entity);
  }

  @Override
  public EntityRepository<Tag>.EntityUpdater getUpdater(Tag original, Tag updated, Operation operation) {
    return new TagUpdater(original, updated, operation);
  }

  @Override
  protected void postDelete(Tag entity) {
    // Cleanup all the tag labels using this tag
    daoCollection.tagUsageDAO().deleteTagLabels(TagSource.TAG.ordinal(), entity.getFullyQualifiedName());
  }

  @Override
  public Tag setFields(Tag tag, Fields fields) throws IOException {
    tag.withTagCategory(getTagCategory(tag)).withParent(getParent(tag));
    tag.setChildren(fields.contains("children") ? getChildren(tag) : null);
    return tag.withUsageCount(fields.contains("usageCount") ? getUsageCount(tag) : null);
  }

  private Integer getUsageCount(Tag tag) {
    return daoCollection.tagUsageDAO().getTagCount(TagSource.TAG.ordinal(), tag.getFullyQualifiedName());
  }

  @Transaction
  public Tag delete(UriInfo uriInfo, UUID id) throws IOException {
    Tag tag = get(uriInfo, id, Fields.EMPTY_FIELDS, Include.NON_DELETED);
    checkSystemEntityDeletion(tag);
    dao.delete(id.toString());
    daoCollection.tagDAO().deleteTagsByPrefix(tag.getFullyQualifiedName());
    daoCollection.tagUsageDAO().deleteTagLabels(TagSource.TAG.ordinal(), tag.getFullyQualifiedName());
    daoCollection.tagUsageDAO().deleteTagLabelsByPrefix(TagSource.TAG.ordinal(), tag.getFullyQualifiedName());
    return tag;
  }

  private List<EntityReference> getChildren(Tag entity) throws IOException {
    List<EntityRelationshipRecord> ids = findTo(entity.getId(), TAG, Relationship.CONTAINS, TAG);
    return EntityUtil.populateEntityReferences(ids, TAG);
  }

  private EntityReference getParent(Tag tag) throws IOException {
    return getFromEntityRef(tag.getId(), Relationship.CONTAINS, TAG, false);
  }

  private EntityReference getTagCategory(Tag tag) throws IOException {
    return getFromEntityRef(tag.getId(), Relationship.CONTAINS, TAG_CATEGORY, true);
  }

  private void addTagCategoryRelationship(Tag term) {
    addRelationship(term.getTagCategory().getId(), term.getId(), TAG_CATEGORY, TAG, Relationship.CONTAINS);
  }

  private void deleteTagCategoryRelationship(Tag term) {
    deleteRelationship(term.getTagCategory().getId(), TAG_CATEGORY, term.getId(), TAG, Relationship.CONTAINS);
  }

  private void updateTagCategoryRelationship(Tag orig, Tag updated) {
    deleteTagCategoryRelationship(orig);
    addTagCategoryRelationship(updated);
  }

  private void addParentRelationship(Tag term) {
    if (term.getParent() != null) {
      addRelationship(term.getParent().getId(), term.getId(), TAG, TAG, Relationship.CONTAINS);
    }
  }

  private void deleteParentRelationship(Tag term) {
    if (term.getParent() != null) {
      deleteRelationship(term.getParent().getId(), TAG, term.getId(), TAG, Relationship.CONTAINS);
    }
  }

  private void updateParentRelationship(Tag orig, Tag updated) {
    deleteParentRelationship(orig);
    addParentRelationship(updated);
  }

  public class TagUpdater extends EntityUpdater {
    public TagUpdater(Tag original, Tag updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("mutuallyExclusive", original.getMutuallyExclusive(), updated.getMutuallyExclusive());
      updateName(original, updated);
      updateParent(original, updated);
    }

    public void updateName(Tag original, Tag updated) throws IOException {
      if (!original.getName().equals(updated.getName())) {
        if (ProviderType.SYSTEM.equals(original.getProvider())) {
          throw new IllegalArgumentException(
              CatalogExceptionMessage.systemEntityRenameNotAllowed(original.getName(), entityType));
        }
        // Category name changed - update tag names starting from category and all the children tags
        LOG.info("Tag name changed from {} to {}", original.getName(), updated.getName());
        daoCollection.tagDAO().updateFqn(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
        daoCollection.tagUsageDAO().rename(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
        recordChange("name", original.getName(), updated.getName());
      }

      // Populate response fields
      getChildren(updated);
    }

    private void updateParent(Tag original, Tag updated) throws JsonProcessingException {
      // Can't change parent and tagCategory both at the same time
      UUID oldParentId = getId(original.getParent());
      UUID newParentId = getId(updated.getParent());
      boolean parentChanged = !Objects.equals(oldParentId, newParentId);

      UUID oldCategoryId = getId(original.getTagCategory());
      UUID newCategoryId = getId(updated.getTagCategory());
      boolean tagCategoryChanged = !Objects.equals(oldCategoryId, newCategoryId);

      daoCollection.tagDAO().updateFqn(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
      daoCollection.tagUsageDAO().rename(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
      if (tagCategoryChanged) {
        updateTagCategoryRelationship(original, updated);
        recordChange("tagCategory", original.getTagCategory(), updated.getTagCategory(), true, entityReferenceMatch);
      }
      if (parentChanged) {
        updateParentRelationship(original, updated);
        recordChange("parent", original.getParent(), updated.getParent(), true, entityReferenceMatch);
      }
    }
  }
}
