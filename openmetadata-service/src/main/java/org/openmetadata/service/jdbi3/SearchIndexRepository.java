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
import static org.openmetadata.service.util.EntityUtil.getSearchIndexField;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.searchindex.SearchIndexSampleData;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.searchindex.SearchIndexResource;
import org.openmetadata.service.security.mask.PIIMasker;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

public class SearchIndexRepository extends EntityRepository<SearchIndex> {

  public SearchIndexRepository() {
    super(
        SearchIndexResource.COLLECTION_PATH,
        Entity.SEARCH_INDEX,
        SearchIndex.class,
        Entity.getCollectionDAO().searchIndexDAO(),
        "",
        "");
    supportsSearch = true;

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put(FIELD_FOLLOWERS, this::fetchAndSetFollowers);
    fieldFetchers.put(FIELD_TAGS, this::fetchAndSetFieldTags);
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
    SearchService searchService = Entity.getEntity(searchIndex.getService(), "", ALL);
    searchIndex.setService(searchService.getEntityReference());
    searchIndex.setServiceType(searchService.getServiceType());
  }

  @Override
  public void storeEntity(SearchIndex searchIndex, boolean update) {
    // Relationships and fields such as service are derived and not stored as part of json
    EntityReference service = searchIndex.getService();
    searchIndex.withService(null);

    // Don't store fields tags as JSON but build it on the fly based on relationships
    List<SearchIndexField> fieldsWithTags = null;
    if (searchIndex.getFields() != null) {
      fieldsWithTags = searchIndex.getFields();
      searchIndex.setFields(cloneWithoutTags(fieldsWithTags));
      searchIndex.getFields().forEach(field -> field.setTags(null));
    }

    store(searchIndex, update);

    // Restore the relationships
    if (fieldsWithTags != null) {
      searchIndex.setFields(fieldsWithTags);
    }
    searchIndex.withService(service);
  }

  @Override
  public void storeRelationships(SearchIndex searchIndex) {
    addServiceRelationship(searchIndex, searchIndex.getService());
  }

  @Override
  public void setFields(SearchIndex searchIndex, Fields fields) {
    searchIndex.setService(getContainer(searchIndex.getId()));
    searchIndex.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(searchIndex) : null);
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
    super.setFieldsInBulk(fields, entities);
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
        daoCollection
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
    setFieldFromMap(
        true, searchIndexes, batchFetchFollowers(searchIndexes), SearchIndex::setFollowers);
  }

  private void fetchAndSetFieldTags(List<SearchIndex> searchIndexes, Fields fields) {
    if (!fields.contains(FIELD_TAGS) || searchIndexes == null || searchIndexes.isEmpty()) {
      return;
    }

    // First, fetch searchIndex-level tags (important for search indexing)
    List<String> entityFQNs =
        searchIndexes.stream().map(SearchIndex::getFullyQualifiedName).toList();
    Map<String, List<TagLabel>> tagsMap = batchFetchTags(entityFQNs);
    for (SearchIndex searchIndex : searchIndexes) {
      searchIndex.setTags(
          addDerivedTags(
              tagsMap.getOrDefault(searchIndex.getFullyQualifiedName(), Collections.emptyList())));
    }

    // Then, if fields are requested, also fetch field-level tags
    if (fields.contains("fields")) {
      // Use bulk tag fetching to avoid N+1 queries
      bulkPopulateEntityFieldTags(
          searchIndexes, entityType, SearchIndex::getFields, SearchIndex::getFullyQualifiedName);
    }
  }

  @Override
  public EntityRepository<SearchIndex>.EntityUpdater getUpdater(
      SearchIndex original, SearchIndex updated, Operation operation, ChangeSource changeSource) {
    return new SearchIndexUpdater(original, updated, operation);
  }

  public SearchIndex getSampleData(UUID searchIndexId, boolean authorizePII) {
    // Validate the request content
    SearchIndex searchIndex = find(searchIndexId, NON_DELETED);
    SearchIndexSampleData sampleData =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionDAO()
                .getExtension(searchIndex.getId(), "searchIndex.sampleData"),
            SearchIndexSampleData.class);
    searchIndex.setSampleData(sampleData);
    setFieldsInternal(searchIndex, Fields.EMPTY_FIELDS);

    // Set the fields tags. Will be used to mask the sample data
    if (!authorizePII) {
      getFieldTags(true, searchIndex.getFields());
      searchIndex.setTags(getTags(searchIndex.getFullyQualifiedName()));
      return PIIMasker.getSampleData(searchIndex);
    }

    return searchIndex;
  }

  public SearchIndex addSampleData(UUID searchIndexId, SearchIndexSampleData sampleData) {
    // Validate the request content
    SearchIndex searchIndex = daoCollection.searchIndexDAO().findEntityById(searchIndexId);

    daoCollection
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
          String fieldFqn = FullyQualifiedName.add(parentFQN, c.getName());
          c.setFullyQualifiedName(fieldFqn);
          if (c.getChildren() != null) {
            setFieldFQN(fieldFqn, c.getChildren());
          }
        });
  }

  private void getFieldTags(boolean setTags, List<SearchIndexField> fields) {
    for (SearchIndexField f : listOrEmpty(fields)) {
      f.setTags(setTags ? getTags(f.getFullyQualifiedName()) : null);
      getFieldTags(setTags, f.getChildren());
    }
  }

  List<SearchIndexField> cloneWithoutTags(List<SearchIndexField> fields) {
    if (nullOrEmpty(fields)) {
      return fields;
    }
    List<SearchIndexField> copy = new ArrayList<>();
    fields.forEach(f -> copy.add(cloneWithoutTags(f)));
    return copy;
  }

  private SearchIndexField cloneWithoutTags(SearchIndexField field) {
    List<SearchIndexField> children = cloneWithoutTags(field.getChildren());
    return new SearchIndexField()
        .withDescription(field.getDescription())
        .withName(field.getName())
        .withDisplayName(field.getDisplayName())
        .withFullyQualifiedName(field.getFullyQualifiedName())
        .withDataType(field.getDataType())
        .withDataTypeDisplay(field.getDataTypeDisplay())
        .withChildren(children);
  }

  @Override
  public void validateTags(SearchIndex entity) {
    super.validateTags(entity);
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
      applyTags(field.getTags(), field.getFullyQualifiedName());
      if (field.getChildren() != null) {
        applyFieldTags(field.getChildren());
      }
    }
  }

  @Override
  public void applyTags(SearchIndex searchIndex) {
    // Add table level tags by adding tag to table relationship
    super.applyTags(searchIndex);
    if (searchIndex.getFields() != null) {
      applyFieldTags(searchIndex.getFields());
    }
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

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
    EntityLink entityLink = threadContext.getAbout();
    if (entityLink.getFieldName().equals("fields")) {
      TaskType taskType = threadContext.getThread().getTask().getType();
      if (EntityUtil.isDescriptionTask(taskType)) {
        return new FieldDescriptionWorkflow(threadContext);
      } else if (EntityUtil.isTagTask(taskType)) {
        return new FieldTagWorkflow(threadContext);
      } else {
        throw new IllegalArgumentException(String.format("Invalid task type %s", taskType));
      }
    }
    return super.getTaskWorkflow(threadContext);
  }

  static class FieldDescriptionWorkflow extends DescriptionTaskWorkflow {
    private final SearchIndexField schemaField;

    FieldDescriptionWorkflow(ThreadContext threadContext) {
      super(threadContext);
      schemaField =
          getSchemaField(
              (SearchIndex) threadContext.getAboutEntity(),
              threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      schemaField.setDescription(resolveTask.getNewValue());
      return threadContext.getAboutEntity();
    }
  }

  static class FieldTagWorkflow extends TagTaskWorkflow {
    private final SearchIndexField schemaField;

    FieldTagWorkflow(ThreadContext threadContext) {
      super(threadContext);
      schemaField =
          getSchemaField(
              (SearchIndex) threadContext.getAboutEntity(),
              threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      List<TagLabel> tags = JsonUtils.readObjects(resolveTask.getNewValue(), TagLabel.class);
      schemaField.setTags(tags);
      return threadContext.getAboutEntity();
    }
  }

  private static SearchIndexField getSchemaField(SearchIndex searchIndex, String fieldName) {
    String schemaName = fieldName;
    List<SearchIndexField> schemaFields = searchIndex.getFields();
    String childSchemaName = "";
    if (fieldName.contains(".")) {
      String fieldNameWithoutQuotes = fieldName.substring(1, fieldName.length() - 1);
      schemaName = fieldNameWithoutQuotes.substring(0, fieldNameWithoutQuotes.indexOf("."));
      childSchemaName =
          fieldNameWithoutQuotes.substring(fieldNameWithoutQuotes.lastIndexOf(".") + 1);
    }
    SearchIndexField schemaField = null;
    for (SearchIndexField field : schemaFields) {
      if (field.getName().equals(schemaName)) {
        schemaField = field;
        break;
      }
    }
    if (!"".equals(childSchemaName) && schemaField != null) {
      schemaField = getChildSchemaField(schemaField.getChildren(), childSchemaName);
    }
    if (schemaField == null) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.invalidFieldName("schema", fieldName));
    }
    return schemaField;
  }

  private static SearchIndexField getChildSchemaField(
      List<SearchIndexField> fields, String childSchemaName) {
    SearchIndexField childrenSchemaField = null;
    for (SearchIndexField field : fields) {
      if (field.getName().equals(childSchemaName)) {
        childrenSchemaField = field;
        break;
      }
    }
    if (childrenSchemaField == null) {
      for (SearchIndexField field : fields) {
        if (field.getChildren() != null) {
          childrenSchemaField = getChildSchemaField(field.getChildren(), childSchemaName);
          if (childrenSchemaField != null) {
            break;
          }
        }
      }
    }
    return childrenSchemaField;
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
        daoCollection
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

  public class SearchIndexUpdater extends EntityUpdater {
    public static final String FIELD_DATA_TYPE_DISPLAY = "dataTypeDisplay";

    public SearchIndexUpdater(SearchIndex original, SearchIndex updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      if (updated.getFields() != null) {
        updateSearchIndexFields(
            "fields",
            original.getFields() == null ? null : original.getFields(),
            updated.getFields(),
            EntityUtil.searchIndexFieldMatch);
      }
      recordChange(
          "searchIndexSettings",
          original.getSearchIndexSettings(),
          updated.getSearchIndexSettings());
      recordChange("sourceHash", original.getSourceHash(), updated.getSourceHash());
      recordChange("indexType", original.getIndexType(), updated.getIndexType());
    }

    private void updateSearchIndexFields(
        String fieldName,
        List<SearchIndexField> origFields,
        List<SearchIndexField> updatedFields,
        BiPredicate<SearchIndexField, SearchIndexField> fieldMatch) {
      List<SearchIndexField> deletedFields = new ArrayList<>();
      List<SearchIndexField> addedFields = new ArrayList<>();
      recordListChange(
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
              daoCollection.tagUsageDAO().deleteTagsByTarget(deleted.getFullyQualifiedName()));

      // Add tags related to newly added fields
      for (SearchIndexField added : addedFields) {
        applyTags(added.getTags(), added.getFullyQualifiedName());
      }

      // Carry forward the user generated metadata from existing fields to new fields
      for (SearchIndexField updated : updatedFields) {
        // Find stored field matching name, data type and ordinal position
        SearchIndexField stored =
            origFields.stream().filter(c -> fieldMatch.test(c, updated)).findAny().orElse(null);
        if (stored == null) { // New field added
          continue;
        }
        updateFieldDescription(stored, updated);
        updateFieldDataTypeDisplay(stored, updated);
        updateFieldDisplayName(stored, updated);
        updateTags(
            stored.getFullyQualifiedName(),
            EntityUtil.getFieldName(fieldName, updated.getName(), FIELD_TAGS),
            stored.getTags(),
            updated.getTags());

        if (updated.getChildren() != null && stored.getChildren() != null) {
          String childrenFieldName = EntityUtil.getFieldName(fieldName, updated.getName());
          updateSearchIndexFields(
              childrenFieldName, stored.getChildren(), updated.getChildren(), fieldMatch);
        }
      }
      majorVersionChange = majorVersionChange || !deletedFields.isEmpty();
    }

    private void updateFieldDescription(SearchIndexField origField, SearchIndexField updatedField) {
      if (operation.isPut() && !nullOrEmpty(origField.getDescription()) && updatedByBot()) {
        // Revert the non-empty field description if being updated by a bot
        updatedField.setDescription(origField.getDescription());
        return;
      }
      String field = getSearchIndexField(original, origField, FIELD_DESCRIPTION);
      recordChange(field, origField.getDescription(), updatedField.getDescription());
    }

    private void updateFieldDisplayName(SearchIndexField origField, SearchIndexField updatedField) {
      if (operation.isPut() && !nullOrEmpty(origField.getDescription()) && updatedByBot()) {
        // Revert the non-empty field description if being updated by a bot
        updatedField.setDisplayName(origField.getDisplayName());
        return;
      }
      String field = getSearchIndexField(original, origField, FIELD_DISPLAY_NAME);
      recordChange(field, origField.getDisplayName(), updatedField.getDisplayName());
    }

    private void updateFieldDataTypeDisplay(
        SearchIndexField origField, SearchIndexField updatedField) {
      if (operation.isPut() && !nullOrEmpty(origField.getDataTypeDisplay()) && updatedByBot()) {
        // Revert the non-empty field dataTypeDisplay if being updated by a bot
        updatedField.setDataTypeDisplay(origField.getDataTypeDisplay());
        return;
      }
      String field = getSearchIndexField(original, origField, FIELD_DATA_TYPE_DISPLAY);
      recordChange(field, origField.getDataTypeDisplay(), updatedField.getDataTypeDisplay());
    }
  }
}
