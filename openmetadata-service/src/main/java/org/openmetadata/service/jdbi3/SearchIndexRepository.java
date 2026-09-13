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
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusive;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.searchindex.SearchIndexSampleData;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.DerivedTagLoader;
import org.openmetadata.service.entity.metadata.EntityTagWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityBatchFields;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.searchindex.SearchIndexResource;
import org.openmetadata.service.security.mask.PIIMasker;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Repository()
public class SearchIndexRepository implements EntityPolicy<SearchIndex> {

  private static final Set<String> CHANGE_SUMMARY_FIELDS = Set.of("fields.description");

  public SearchIndexRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                SearchIndexResource.COLLECTION_PATH,
                Entity.SEARCH_INDEX,
                SearchIndex.class,
                Entity.getCollectionDAO().searchIndexDAO()),
            new EntityPolicyContext.WriteFields("", "", CHANGE_SUMMARY_FIELDS),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
    // Covered by the parent service delete cascade: search docs by service.id
    // (SearchRepository.deleteOrUpdateChildren) and field_relationship / tag_usage by
    // the root cleanup() FQN prefix. See EntityRepository#descendantsCoveredByAncestorCascade.
    context().options().setDescendantsCoveredByAncestorCascade(true);
    // Register bulk field fetchers for efficient database operations
    fieldLoading().register(FIELD_FOLLOWERS, this::fetchAndSetFollowers);
    fieldLoading().register(FIELD_TAGS, this::fetchAndSetFieldTags);
  }

  @Override
  public void setFullyQualifiedName(SearchIndex searchIndex) {
    searchIndex.setFullyQualifiedName(
        FullyQualifiedName.add(
            searchIndex.getService().getFullyQualifiedName(), searchIndex.getName()));
    if (searchIndex.getFields() != null) {
      setFieldFQN(searchIndex.getFullyQualifiedName(), searchIndex.getFields());
    }
  }

  @Override
  public void prepare(SearchIndex searchIndex, boolean update) {
    var searchService = (SearchService) getCachedParentOrLoad(searchIndex.getService(), "", ALL);
    searchIndex.setService(searchService.getEntityReference());
    searchIndex.setServiceType(searchService.getServiceType());
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service");
  }

  @Override
  public ObjectNode storageJsonNode(SearchIndex searchIndex) {
    ObjectNode node = EntityPolicy.super.storageJsonNode(searchIndex);
    stripFieldTags(node.get("fields"));
    return node;
  }

  private void stripFieldTags(JsonNode fieldsNode) {
    if (!(fieldsNode instanceof ArrayNode fieldArray)) {
      return;
    }
    for (JsonNode field : fieldArray) {
      if (!(field instanceof ObjectNode fieldNode)) {
        continue;
      }
      fieldNode.remove("tags");
      stripFieldTags(fieldNode.get("children"));
    }
  }

  @Override
  public void storeEntity(SearchIndex searchIndex, boolean update) {
    persistence().store(searchIndex, update);
  }

  @Override
  public void storeEntities(List<SearchIndex> searchIndexes) {
    persistence().insertMany(searchIndexes);
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<SearchIndex> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(SearchIndex::getId).toList();
    deleteToMany(ids, context().schema().entityType(), Relationship.CONTAINS, null);
  }

  @Override
  public void storeRelationships(SearchIndex searchIndex) {
    addServiceRelationship(searchIndex, searchIndex.getService());
  }

  @Override
  public void storeEntitySpecificRelationshipsForMany(List<SearchIndex> entities) {
    List<CollectionDAO.EntityRelationshipObject> relationships = new ArrayList<>();
    for (SearchIndex searchIndex : entities) {
      EntityReference service = searchIndex.getService();
      if (service == null || service.getId() == null) {
        continue;
      }
      relationships.add(
          newRelationship(
              service.getId(),
              searchIndex.getId(),
              service.getType(),
              context().schema().entityType(),
              Relationship.CONTAINS));
    }
    bulkInsertRelationships(relationships);
  }

  @Override
  public void setFields(SearchIndex searchIndex, Fields fields, RelationIncludes relationIncludes) {
    searchIndex.setService(relationships().container(searchIndex.getId(), null));
    if (searchIndex.getFields() != null) {
      getFieldTags(fields.contains(FIELD_TAGS), searchIndex.getFields());
    }
  }

  @Override
  public void clearFields(SearchIndex searchIndex, Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<SearchIndex> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    // Bulk fetch and set service for all search indexes first
    fetchAndSetServices(entities);
    // Then call parent's implementation which handles standard fields
    EntityPolicy.super.setFieldsInBulk(fields, entities);
  }

  private void fetchAndSetServices(List<SearchIndex> searchIndexes) {
    if (searchIndexes == null || searchIndexes.isEmpty()) {
      return;
    }
    // Batch fetch service references for all search indexes
    Map<UUID, EntityReference> serviceRefs = batchFetchServices(searchIndexes);
    // Set service field for all search indexes
    for (SearchIndex searchIndex : searchIndexes) {
      EntityReference serviceRef = serviceRefs.get(searchIndex.getId());
      if (serviceRef != null) {
        searchIndex.withService(serviceRef);
      }
    }
  }

  private Map<UUID, EntityReference> batchFetchServices(List<SearchIndex> searchIndexes) {
    Map<UUID, EntityReference> serviceMap = new HashMap<>();
    if (searchIndexes == null || searchIndexes.isEmpty()) {
      return serviceMap;
    }
    // Batch query to get all services that contain these search indexes
    // findFromBatch finds relationships where the provided IDs are in the "to" position
    // So this finds: SEARCH_SERVICE (from) -> CONTAINS -> SEARCH_INDEX (to)
    List<CollectionDAO.EntityRelationshipObject> records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(entityListToStrings(searchIndexes), Relationship.CONTAINS.ordinal());
    for (CollectionDAO.EntityRelationshipObject record : records) {
      // We're looking for records where Search Service contains Search Index
      if (Entity.SEARCH_SERVICE.equals(record.getFromEntity())) {
        UUID searchIndexId = UUID.fromString(record.getToId());
        EntityReference serviceRef =
            Entity.getEntityReferenceById(
                Entity.SEARCH_SERVICE, UUID.fromString(record.getFromId()), Include.NON_DELETED);
        serviceMap.put(searchIndexId, serviceRef);
      }
    }
    return serviceMap;
  }

  // Individual field fetchers registered in constructor
  private void fetchAndSetFollowers(List<SearchIndex> searchIndexes, Fields fields) {
    if (!fields.contains(FIELD_FOLLOWERS) || searchIndexes == null || searchIndexes.isEmpty()) {
      return;
    }
    EntityBatchFields.assign(
        true, searchIndexes, batchFetchFollowers(searchIndexes), SearchIndex::setFollowers);
  }

  @Override
  public DerivedTagLoader.FailureMode derivedTagFailureMode() {
    return DerivedTagLoader.FailureMode.FALL_BACK_TO_INDIVIDUAL;
  }

  private void fetchAndSetFieldTags(List<SearchIndex> searchIndexes, Fields fields) {
    if (!fields.contains(FIELD_TAGS) || searchIndexes == null || searchIndexes.isEmpty()) {
      return;
    }
    // Then, if fields are requested, also fetch field-level tags
    if (fields.contains("fields")) {
      // Use bulk tag fetching to avoid N+1 queries
      fieldTags().populate(searchIndexes, SearchIndex::getFields);
    }
  }

  @Override
  public EntityUpdater<SearchIndex> getUpdater(
      SearchIndex original,
      SearchIndex updated,
      EntityOperation operation,
      ChangeSource changeSource) {
    return new SearchIndexUpdater(original, updated, operation).mutation();
  }

  public SearchIndex getSampleData(UUID searchIndexId, boolean authorizePII) {
    // Validate the request content
    SearchIndex searchIndex = lookup().byId(searchIndexId, NON_DELETED);
    SearchIndexSampleData sampleData =
        JsonUtils.readValue(
            context()
                .dependencies()
                .daos()
                .entityExtensionDAO()
                .getExtension(searchIndex.getId(), "searchIndex.sampleData"),
            SearchIndexSampleData.class);
    searchIndex.setSampleData(sampleData);
    setFieldsInternal(searchIndex, Fields.EMPTY_FIELDS);
    // Set the fields tags. Will be used to mask the sample data
    if (!authorizePII) {
      getFieldTags(true, searchIndex.getFields());
      searchIndex.setTags(tags().read(searchIndex.getFullyQualifiedName()));
      return PIIMasker.getSampleData(searchIndex);
    }
    return searchIndex;
  }

  public SearchIndex addSampleData(UUID searchIndexId, SearchIndexSampleData sampleData) {
    // Validate the request content
    SearchIndex searchIndex =
        context().dependencies().daos().searchIndexDAO().findEntityById(searchIndexId);
    context()
        .dependencies()
        .daos()
        .entityExtensionDAO()
        .insert(
            searchIndexId,
            "searchIndex.sampleData",
            "searchIndexSampleData",
            JsonUtils.pojoToJson(sampleData));
    setFieldsInternal(searchIndex, Fields.EMPTY_FIELDS);
    return searchIndex.withSampleData(sampleData);
  }

  private void setFieldFQN(String parentFQN, List<SearchIndexField> fields) {
    fields.forEach(
        c -> {
          FullyQualifiedName.validateFqnName(c.getName());
          String fieldFqn = FullyQualifiedName.add(parentFQN, c.getName());
          c.setFullyQualifiedName(fieldFqn);
          if (c.getChildren() != null) {
            setFieldFQN(fieldFqn, c.getChildren());
          }
        });
  }

  private void getFieldTags(boolean setTags, List<SearchIndexField> fields) {
    for (SearchIndexField f : listOrEmpty(fields)) {
      f.setTags(setTags ? tags().read(f.getFullyQualifiedName()) : null);
      getFieldTags(setTags, f.getChildren());
    }
  }

  @Override
  public void validateTags(SearchIndex entity) {
    EntityPolicy.super.validateTags(entity);
    validateSchemaFieldTags(entity.getFields());
  }

  private void validateSchemaFieldTags(List<SearchIndexField> fields) {
    // Add field level tags by adding tag to field relationship
    for (SearchIndexField field : listOrEmpty(fields)) {
      validateTags(field.getTags());
      field.setTags(addDerivedTags(field.getTags()));
      checkMutuallyExclusive(field.getTags());
      if (field.getChildren() != null) {
        validateSchemaFieldTags(field.getChildren());
      }
    }
  }

  private void applyFieldTags(List<SearchIndexField> fields) {
    // Add field level tags by adding tag to field relationship
    for (SearchIndexField field : fields) {
      tagWrites().apply(field.getTags(), new EntityTagWriter.Target(field.getFullyQualifiedName()));
      if (field.getChildren() != null) {
        applyFieldTags(field.getChildren());
      }
    }
  }

  @Override
  public void applyTags(SearchIndex searchIndex) {
    // Add table level tags by adding tag to table relationship
    EntityPolicy.super.applyTags(searchIndex);
    if (searchIndex.getFields() != null) {
      applyFieldTags(searchIndex.getFields());
    }
  }

  @Override
  public EntityReference getParentReference(SearchIndex entity) {
    return entity.getService();
  }

  @Override
  public EntityInterface getParentEntity(SearchIndex entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  @Override
  public List<TagLabel> getAllTags(EntityInterface entity) {
    List<TagLabel> allTags = new ArrayList<>();
    SearchIndex searchIndex = (SearchIndex) entity;
    EntityUtil.mergeTags(allTags, searchIndex.getTags());
    List<SearchIndexField> schemaFields =
        searchIndex.getFields() != null ? searchIndex.getFields() : null;
    for (SearchIndexField schemaField : listOrEmpty(schemaFields)) {
      EntityUtil.mergeTags(allTags, schemaField.getTags());
    }
    return allTags;
  }

  private Map<UUID, List<EntityReference>> batchFetchFollowers(List<SearchIndex> searchIndexes) {
    Map<UUID, List<EntityReference>> followersMap = new HashMap<>();
    if (searchIndexes == null || searchIndexes.isEmpty()) {
      return followersMap;
    }
    // Initialize empty lists for all search indexes
    for (SearchIndex searchIndex : searchIndexes) {
      followersMap.put(searchIndex.getId(), new ArrayList<>());
    }
    // Single batch query to get all followers for all search indexes
    List<CollectionDAO.EntityRelationshipObject> records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(searchIndexes),
                org.openmetadata.schema.type.Relationship.FOLLOWS.ordinal());
    // Group followers by search index ID
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID searchIndexId = UUID.fromString(record.getToId());
      EntityReference followerRef =
          Entity.getEntityReferenceById(
              record.getFromEntity(), UUID.fromString(record.getFromId()), NON_DELETED);
      followersMap.get(searchIndexId).add(followerRef);
    }
    return followersMap;
  }

  public class SearchIndexUpdater implements EntitySpecificMutation<SearchIndex> {

    public static final String FIELD_DATA_TYPE_DISPLAY = "dataTypeDisplay";

    public SearchIndexUpdater(
        SearchIndex original, SearchIndex updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<SearchIndex> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "fields",
          () -> {
            if (entityUpdate.getUpdated().getFields() != null) {
              updateSearchIndexFields(
                  "fields",
                  entityUpdate.getOriginal().getFields() == null
                      ? null
                      : entityUpdate.getOriginal().getFields(),
                  entityUpdate.getUpdated().getFields(),
                  EntityUtil.searchIndexFieldMatch);
            }
          });
      entityUpdate.compareAndUpdate(
          "searchIndexSettings",
          () ->
              entityUpdate.recordChange(
                  "searchIndexSettings",
                  entityUpdate.getOriginal().getSearchIndexSettings(),
                  entityUpdate.getUpdated().getSearchIndexSettings()));
      entityUpdate.compareAndUpdate(
          "sourceHash",
          () ->
              entityUpdate.recordChange(
                  "sourceHash",
                  entityUpdate.getOriginal().getSourceHash(),
                  entityUpdate.getUpdated().getSourceHash(),
                  false,
                  EntityUtil.objectMatch,
                  false));
      entityUpdate.compareAndUpdate(
          "indexType",
          () ->
              entityUpdate.recordChange(
                  "indexType",
                  entityUpdate.getOriginal().getIndexType(),
                  entityUpdate.getUpdated().getIndexType()));
    }

    private void updateSearchIndexFields(
        String fieldName,
        List<SearchIndexField> origFields,
        List<SearchIndexField> updatedFields,
        BiPredicate<SearchIndexField, SearchIndexField> fieldMatch) {
      List<SearchIndexField> deletedFields = new ArrayList<>();
      List<SearchIndexField> addedFields = new ArrayList<>();
      entityUpdate.recordListChange(
          fieldName, origFields, updatedFields, addedFields, deletedFields, fieldMatch);
      // carry forward tags and description if deletedFields matches added field
      Map<String, SearchIndexField> addedFieldMap =
          addedFields.stream()
              .collect(Collectors.toMap(SearchIndexField::getName, Function.identity()));
      for (SearchIndexField deleted : deletedFields) {
        if (addedFieldMap.containsKey(deleted.getName())) {
          SearchIndexField addedField = addedFieldMap.get(deleted.getName());
          if (nullOrEmpty(addedField.getDescription()) && nullOrEmpty(deleted.getDescription())) {
            addedField.setDescription(deleted.getDescription());
          }
          if (nullOrEmpty(addedField.getTags()) && nullOrEmpty(deleted.getTags())) {
            addedField.setTags(deleted.getTags());
          }
        }
      }
      // Delete tags related to deleted fields
      deletedFields.forEach(
          deleted ->
              context()
                  .dependencies()
                  .daos()
                  .tagUsageDAO()
                  .deleteTagsByTarget(deleted.getFullyQualifiedName()));
      // Add tags related to newly added fields
      for (SearchIndexField added : addedFields) {
        tagWrites()
            .apply(added.getTags(), new EntityTagWriter.Target(added.getFullyQualifiedName()));
      }
      // Carry forward the user generated metadata from existing fields to new fields
      for (SearchIndexField updated : updatedFields) {
        // Find stored field matching name, data type and ordinal position
        SearchIndexField stored =
            origFields.stream().filter(c -> fieldMatch.test(c, updated)).findAny().orElse(null);
        if (stored == null) {
          // New field added
          continue;
        }
        String searchFieldPrefix =
            EntityUtil.getFieldName(fieldName, FullyQualifiedName.quoteName(updated.getName()));
        updateFieldDescription(searchFieldPrefix, stored, updated);
        updateFieldDataTypeDisplay(searchFieldPrefix, stored, updated);
        updateFieldDisplayName(searchFieldPrefix, stored, updated);
        entityUpdate.updateTags(
            stored.getFullyQualifiedName(),
            EntityUtil.getFieldName(searchFieldPrefix, FIELD_TAGS),
            stored.getTags(),
            updated.getTags());
        if (updated.getChildren() != null && stored.getChildren() != null) {
          updateSearchIndexFields(
              searchFieldPrefix, stored.getChildren(), updated.getChildren(), fieldMatch);
        }
      }
      entityUpdate.setMajorVersionChange(
          entityUpdate.isMajorVersionChange() || !deletedFields.isEmpty());
    }

    private void updateFieldDescription(
        String fieldPrefix, SearchIndexField origField, SearchIndexField updatedField) {
      if (entityUpdate.getOperation().isPut()
          && !nullOrEmpty(origField.getDescription())
          && entityUpdate.updatedByBot()) {
        updatedField.setDescription(origField.getDescription());
        return;
      }
      entityUpdate.recordChange(
          EntityUtil.getFieldName(fieldPrefix, FIELD_DESCRIPTION),
          origField.getDescription(),
          updatedField.getDescription());
    }

    private void updateFieldDisplayName(
        String fieldPrefix, SearchIndexField origField, SearchIndexField updatedField) {
      if (entityUpdate.getOperation().isPut()
          && !nullOrEmpty(origField.getDisplayName())
          && entityUpdate.updatedByBot()) {
        updatedField.setDisplayName(origField.getDisplayName());
        return;
      }
      entityUpdate.recordChange(
          EntityUtil.getFieldName(fieldPrefix, FIELD_DISPLAY_NAME),
          origField.getDisplayName(),
          updatedField.getDisplayName());
    }

    private void updateFieldDataTypeDisplay(
        String fieldPrefix, SearchIndexField origField, SearchIndexField updatedField) {
      if (entityUpdate.getOperation().isPut()
          && !nullOrEmpty(origField.getDataTypeDisplay())
          && entityUpdate.updatedByBot()) {
        updatedField.setDataTypeDisplay(origField.getDataTypeDisplay());
        return;
      }
      entityUpdate.recordChange(
          EntityUtil.getFieldName(fieldPrefix, FIELD_DATA_TYPE_DISPLAY),
          origField.getDataTypeDisplay(),
          updatedField.getDataTypeDisplay());
    }

    private final EntityUpdater<SearchIndex> entityUpdate;

    public EntityUpdater<SearchIndex> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<SearchIndex> entityContext;

  @Override
  public final EntityPolicyContext<SearchIndex> context() {
    return entityContext;
  }
}
