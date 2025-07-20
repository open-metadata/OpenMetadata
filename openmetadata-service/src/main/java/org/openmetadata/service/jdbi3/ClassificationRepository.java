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

import static org.openmetadata.service.Entity.CLASSIFICATION;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.search.SearchClient.TAG_SEARCH_INDEX;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.tags.ClassificationResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class ClassificationRepository extends EntityRepository<Classification> {
  public ClassificationRepository() {
    super(
        ClassificationResource.TAG_COLLECTION_PATH,
        Entity.CLASSIFICATION,
        Classification.class,
        Entity.getCollectionDAO().classificationDAO(),
        "",
        "");
    quoteFqn = true;
    supportsSearch = true;
    renameAllowed = true;
  }

  @Override
  public EntityRepository<Classification>.EntityUpdater getUpdater(
      Classification original,
      Classification updated,
      Operation operation,
      ChangeSource changeSource) {
    return new ClassificationUpdater(original, updated, operation);
  }

  @Override
  public void setFields(Classification classification, Fields fields) {
    classification.withTermCount(
        fields.contains("termCount") ? getTermCount(classification) : null);
    classification.withUsageCount(
        fields.contains("usageCount") ? getUsageCount(classification) : null);
  }

  @Override
  public void clearFields(Classification classification, Fields fields) {
    classification.withTermCount(
        fields.contains("termCount") ? classification.getTermCount() : null);
    classification.withUsageCount(
        fields.contains("usageCount") ? classification.getUsageCount() : null);
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Classification> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    fetchAndSetFields(entities, fields);
    fetchAndSetClassificationSpecificFields(entities, fields);
    setInheritedFields(entities, fields);
    for (Classification entity : entities) {
      clearFieldsInternal(entity, fields);
    }
  }

  private void fetchAndSetClassificationSpecificFields(
      List<Classification> classifications, Fields fields) {
    if (classifications == null || classifications.isEmpty()) {
      return;
    }
    if (fields.contains("termCount")) {
      fetchAndSetTermCounts(classifications);
    }
    if (fields.contains("usageCount")) {
      fetchAndSetUsageCounts(classifications);
    }
  }

  private void fetchAndSetTermCounts(List<Classification> classifications) {
    // Batch fetch term counts for all classifications
    Map<String, Integer> termCountMap = batchFetchTermCounts(classifications);
    for (Classification classification : classifications) {
      classification.withTermCount(
          termCountMap.getOrDefault(classification.getFullyQualifiedName(), 0));
    }
  }

  private void fetchAndSetUsageCounts(List<Classification> classifications) {
    Map<String, Integer> usageCountMap = batchFetchUsageCounts(classifications);
    for (Classification classification : classifications) {
      classification.withUsageCount(
          usageCountMap.getOrDefault(classification.getFullyQualifiedName(), 0));
    }
  }

  private Map<String, Integer> batchFetchTermCounts(List<Classification> classifications) {
    Map<String, Integer> termCountMap = new HashMap<>();
    if (classifications == null || classifications.isEmpty()) {
      return termCountMap;
    }

    try {
      // Build regex pattern for bulk fetch
      StringBuilder patternBuilder = new StringBuilder("^(");
      Map<String, String> hashToFqnMap = new HashMap<>();
      
      for (int i = 0; i < classifications.size(); i++) {
        if (i > 0) {
          patternBuilder.append("|");
        }
        String fqn = classifications.get(i).getFullyQualifiedName();
        String hash = FullyQualifiedName.buildHash(fqn);
        patternBuilder.append(hash);
        hashToFqnMap.put(hash, fqn);
      }
      patternBuilder.append(")\\..*$");
      
      // Use the DAO method for database-specific query
      List<Pair<String, Integer>> results = 
          daoCollection.classificationDAO().bulkGetTermCounts(patternBuilder.toString());
      
      // Process results
      for (Pair<String, Integer> result : results) {
        String classificationHash = result.getLeft();
        Integer count = result.getRight();
        String fqn = hashToFqnMap.get(classificationHash);
        if (fqn != null) {
          termCountMap.put(fqn, count);
        }
      }
      
      // Set 0 for classifications with no tags
      for (Classification classification : classifications) {
        termCountMap.putIfAbsent(classification.getFullyQualifiedName(), 0);
      }
      
      return termCountMap;
    } catch (Exception e) {
      LOG.error("Error batch fetching term counts, falling back to individual queries", e);
      // Fall back to individual queries
      for (Classification classification : classifications) {
        ListFilter filterWithParent = new ListFilter(Include.NON_DELETED)
            .addQueryParam("parent", classification.getFullyQualifiedName());
        int count = daoCollection.tagDAO().listCount(filterWithParent);
        termCountMap.put(classification.getFullyQualifiedName(), count);
      }
      return termCountMap;
    }
  }

  private Map<String, Integer> batchFetchUsageCounts(List<Classification> classifications) {
    Map<String, Integer> usageCountMap = new HashMap<>();
    if (classifications == null || classifications.isEmpty()) {
      return usageCountMap;
    }

    // Batch fetch usage counts for all classifications at once
    List<String> classificationFQNs = classifications.stream()
        .map(Classification::getFullyQualifiedName)
        .collect(Collectors.toList());
    
    Map<String, Integer> counts = daoCollection.tagUsageDAO()
        .getTagCountsBulk(TagSource.CLASSIFICATION.ordinal(), classificationFQNs);
    
    return counts != null ? counts : usageCountMap;
  }

  @Override
  public void prepare(Classification entity, boolean update) {
    /* Nothing to do */
  }

  @Override
  public void storeEntity(Classification classification, boolean update) {
    store(classification, update);
  }

  @Override
  public void storeRelationships(Classification entity) {
    // No relationships to store beyond what is stored in the super class
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

  public static class TagLabelMapper implements RowMapper<TagLabel> {
    @Override
    public TagLabel map(ResultSet r, org.jdbi.v3.core.statement.StatementContext ctx)
        throws SQLException {
      return new TagLabel()
          .withLabelType(TagLabel.LabelType.values()[r.getInt("labelType")])
          .withState(TagLabel.State.values()[r.getInt("state")])
          .withTagFQN(r.getString("tagFQN"));
    }
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
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      // Mutually exclusive cannot be updated
      updated.setMutuallyExclusive(original.getMutuallyExclusive());
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
  }
}
