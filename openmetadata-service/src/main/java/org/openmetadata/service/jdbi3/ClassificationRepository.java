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
import static org.openmetadata.service.Entity.CLASSIFICATION;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.search.SearchClient.TAG_SEARCH_INDEX;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.tags.ClassificationResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class ClassificationRepository extends EntityRepository<Classification> {
  static final String ROLES_FIELD = "roles";

  public ClassificationRepository() {
    super(
        ClassificationResource.TAG_COLLECTION_PATH,
        Entity.CLASSIFICATION,
        Classification.class,
        Entity.getCollectionDAO().classificationDAO(),
        ROLES_FIELD,
        ROLES_FIELD);
    quoteFqn = true;
    supportsSearch = true;
    renameAllowed = true;
  }

  @Override
  public EntityUpdater getUpdater(
      Classification original, Classification updated, Operation operation) {
    return new ClassificationUpdater(original, updated, operation);
  }

  @Override
  public void setFields(Classification classification, Fields fields) {
    classification.withTermCount(
        fields.contains("termCount") ? getTermCount(classification) : null);
    classification.withUsageCount(
        fields.contains("usageCount") ? getUsageCount(classification) : null);
    classification.setRoles(
        fields.contains(ROLES_FIELD) ? getRoles(classification) : classification.getRoles());
  }

  @Override
  public void clearFields(Classification classification, Fields fields) {
    classification.withTermCount(
        fields.contains("termCount") ? classification.getTermCount() : null);
    classification.withUsageCount(
        fields.contains("usageCount") ? classification.getUsageCount() : null);
  }

  @Override
  public void prepare(Classification entity, boolean update) {
    validateRoles(entity.getRoles());
  }

  @Override
  public void storeEntity(Classification classification, boolean update) {
    List<EntityReference> roles = classification.getRoles();
    classification.withRoles(null);
    store(classification, update);
    classification.withRoles(roles);
  }

  @Override
  public void storeRelationships(Classification entity) {
    assignRoles(entity, entity.getRoles());
  }

  private int getTermCount(Classification classification) {
    ListFilter filter =
        new ListFilter(Include.NON_DELETED)
            .addQueryParam("parent", classification.getFullyQualifiedName());
    return daoCollection.tagDAO().listCount(filter);
  }

  private Integer getUsageCount(Classification classification) {
    return daoCollection
        .tagUsageDAO()
        .getTagCount(TagSource.CLASSIFICATION.ordinal(), classification.getFullyQualifiedName());
  }

  private void assignRoles(Classification classification, List<EntityReference> roles) {
    roles = listOrEmpty(roles);
    for (EntityReference role : roles) {
      addRelationship(
          classification.getId(), role.getId(), CLASSIFICATION, Entity.ROLE, Relationship.HAS);
    }
  }

  private List<EntityReference> getRoles(Classification classification) {
    return findTo(classification.getId(), CLASSIFICATION, Relationship.HAS, Entity.ROLE);
  }

  @Override
  public void entityRelationshipReindex(Classification original, Classification updated) {
    super.entityRelationshipReindex(original, updated);

    // Update search on name , fullyQualifiedName and displayName change
    if (!Objects.equals(original.getFullyQualifiedName(), updated.getFullyQualifiedName())
        || !Objects.equals(original.getDisplayName(), updated.getDisplayName())) {
      List<Tag> tagsWithUpdatedClassification = getAllTagsByClassification(updated);
      List<EntityReference> tagsWithOriginalClassification =
          searchRepository.getEntitiesContainingFQNFromES(
              original.getFullyQualifiedName(),
              tagsWithUpdatedClassification.size(),
              TAG_SEARCH_INDEX);
      searchRepository
          .getSearchClient()
          .reindexAcrossIndices("classification.name", original.getEntityReference());
      searchRepository
          .getSearchClient()
          .reindexAcrossIndices("classification.fullyQualifiedName", original.getEntityReference());
      for (EntityReference tag : tagsWithOriginalClassification) {
        searchRepository.getSearchClient().reindexAcrossIndices("tags.tagFQN", tag);
      }
    }
  }

  private List<Tag> getAllTagsByClassification(Classification classification) {
    // Get all the tags under the specified classification
    List<String> jsons =
        daoCollection.tagDAO().getTagsStartingWithPrefix(classification.getFullyQualifiedName());
    return JsonUtils.readObjects(jsons, Tag.class);
  }

  public class ClassificationUpdater extends EntityUpdater {
    public ClassificationUpdater(
        Classification original, Classification updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate() {
      // Mutually exclusive cannot be updated
      updated.setMutuallyExclusive(original.getMutuallyExclusive());
      updateRoles(original, updated);
      recordChange("disabled", original.getDisabled(), updated.getDisabled());
      updateName(original, updated);
    }

    public void updateName(Classification original, Classification updated) {
      if (!original.getName().equals(updated.getName())) {
        if (ProviderType.SYSTEM.equals(original.getProvider())) {
          throw new IllegalArgumentException(
              CatalogExceptionMessage.systemEntityRenameNotAllowed(original.getName(), entityType));
        }
        // on Classification name change - update tag's name under classification
        setFullyQualifiedName(updated);
        daoCollection
            .tagDAO()
            .updateFqn(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
        daoCollection
            .tagUsageDAO()
            .updateTagPrefix(
                TagSource.CLASSIFICATION.ordinal(),
                original.getFullyQualifiedName(),
                updated.getFullyQualifiedName());
        recordChange("name", original.getName(), updated.getName());
        invalidateClassification(original.getId());
      }
    }

    private void invalidateClassification(UUID classificationId) {
      // Name of the classification changed. Invalidate the classification and all the children tags
      CACHE_WITH_ID.invalidate(new ImmutablePair<>(CLASSIFICATION, classificationId));
      List<EntityRelationshipRecord> tagRecords =
          findToRecords(classificationId, CLASSIFICATION, Relationship.CONTAINS, TAG);
      for (EntityRelationshipRecord tagRecord : tagRecords) {
        invalidateTags(tagRecord.getId());
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

    private void updateRoles(Classification original, Classification updated) {
      deleteFrom(original.getId(), CLASSIFICATION, Relationship.HAS, Entity.ROLE);
      assignRoles(updated, updated.getRoles());

      List<EntityReference> origRoles = listOrEmpty(original.getRoles());
      List<EntityReference> updatedRoles = listOrEmpty(updated.getRoles());

      origRoles.sort(EntityUtil.compareEntityReference);
      updatedRoles.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange(
          ROLES_FIELD, origRoles, updatedRoles, added, deleted, EntityUtil.entityReferenceMatch);
    }
  }
}
