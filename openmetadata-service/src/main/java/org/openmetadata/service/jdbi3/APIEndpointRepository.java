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
import static org.openmetadata.service.Entity.API_COLLECTION;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.populateEntityFieldTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTagsWithPreFetched;
import static org.openmetadata.service.resources.tags.TagLabelUtil.batchFetchDerivedTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusive;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collections;
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
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.apis.APIEndpointResource;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

public class APIEndpointRepository extends EntityRepository<APIEndpoint> {
  private static final Set<String> CHANGE_SUMMARY_FIELDS =
      Set.of("requestSchema.schemaFields.description", "responseSchema.schemaFields.description");
  private static final ReadPrefetchKey PREFETCH_DEFAULT_FIELDS =
      ReadPrefetchKey.API_ENDPOINT_DEFAULT_FIELDS;

  public APIEndpointRepository() {
    super(
        APIEndpointResource.COLLECTION_PATH,
        Entity.API_ENDPOINT,
        APIEndpoint.class,
        Entity.getCollectionDAO().apiEndpointDAO(),
        "",
        "",
        CHANGE_SUMMARY_FIELDS);
    supportsSearch = true;

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put(FIELD_TAGS, this::fetchAndSetSchemaFieldTags);
  }

  @Override
  public void setFullyQualifiedName(APIEndpoint apiEndpoint) {
    apiEndpoint.setFullyQualifiedName(
        FullyQualifiedName.add(
            apiEndpoint.getApiCollection().getFullyQualifiedName(), apiEndpoint.getName()));
    if (apiEndpoint.getRequestSchema() != null) {
      setFieldFQN(
          apiEndpoint.getFullyQualifiedName() + ".requestSchema",
          apiEndpoint.getRequestSchema().getSchemaFields());
    }
    if (apiEndpoint.getResponseSchema() != null) {
      setFieldFQN(
          apiEndpoint.getFullyQualifiedName() + ".responseSchema",
          apiEndpoint.getResponseSchema().getSchemaFields());
    }
  }

  @Override
  public void setInheritedFields(APIEndpoint endpoint, Fields fields) {
    hydrateParentReferencesForInheritance(List.of(endpoint), fields);
    super.setInheritedFields(endpoint, fields);
  }

  @Override
  public void prepare(APIEndpoint apiEndpoint, boolean update) {
    populateAPICollection(apiEndpoint);
  }

  @Override
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of("apiCollection");
  }

  @Override
  protected ObjectNode storageJsonNode(APIEndpoint apiEndpoint) {
    ObjectNode node = super.storageJsonNode(apiEndpoint);
    stripSchemaFieldTags(node.at("/requestSchema/schemaFields"));
    stripSchemaFieldTags(node.at("/responseSchema/schemaFields"));
    return node;
  }

  private void stripSchemaFieldTags(JsonNode schemaFields) {
    if (!(schemaFields instanceof ArrayNode schemaFieldArray)) {
      return;
    }
    for (JsonNode schemaField : schemaFieldArray) {
      if (!(schemaField instanceof ObjectNode schemaFieldNode)) {
        continue;
      }
      schemaFieldNode.remove("tags");
      stripSchemaFieldTags(schemaFieldNode.get("children"));
    }
  }

  @Override
  public void storeEntity(APIEndpoint apiEndpoint, boolean update) {
    store(apiEndpoint, update);
  }

  @Override
  public void storeEntities(List<APIEndpoint> entities) {
    storeMany(entities);
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<APIEndpoint> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(APIEndpoint::getId).toList();
    deleteToMany(ids, Entity.API_ENDPOINT, Relationship.CONTAINS, Entity.API_COLLECTION);
  }

  @Override
  public void storeRelationships(APIEndpoint apiEndpoint) {
    EntityReference apiCollection = apiEndpoint.getApiCollection();
    addRelationship(
        apiCollection.getId(),
        apiEndpoint.getId(),
        apiCollection.getType(),
        Entity.API_ENDPOINT,
        Relationship.CONTAINS);
  }

  @Override
  protected void storeEntitySpecificRelationshipsForMany(List<APIEndpoint> entities) {
    List<CollectionDAO.EntityRelationshipObject> relationships = new ArrayList<>();
    for (APIEndpoint endpoint : entities) {
      if (endpoint.getApiCollection() == null || endpoint.getApiCollection().getId() == null) {
        continue;
      }
      EntityReference apiCollection = endpoint.getApiCollection();
      relationships.add(
          newRelationship(
              apiCollection.getId(),
              endpoint.getId(),
              apiCollection.getType(),
              Entity.API_ENDPOINT,
              Relationship.CONTAINS));
    }
    bulkInsertRelationships(relationships);
  }

  @Override
  public void setFields(APIEndpoint apiEndpoint, Fields fields, RelationIncludes relationIncludes) {
    setDefaultFields(apiEndpoint);
    if (apiEndpoint.getRequestSchema() != null) {
      populateEntityFieldTags(
          entityType,
          apiEndpoint.getRequestSchema().getSchemaFields(),
          apiEndpoint.getFullyQualifiedName() + ".requestSchema",
          fields.contains(FIELD_TAGS));
    }
    if (apiEndpoint.getResponseSchema() != null) {
      populateEntityFieldTags(
          entityType,
          apiEndpoint.getResponseSchema().getSchemaFields(),
          apiEndpoint.getFullyQualifiedName() + ".responseSchema",
          fields.contains(FIELD_TAGS));
    }
  }

  @Override
  public void clearFields(APIEndpoint apiEndpoint, Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<APIEndpoint> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    fetchAndSetDefaultFields(entities);
    super.setFieldsInBulk(fields, entities);
  }

  @Override
  protected void setInheritedFields(List<APIEndpoint> entities, Fields fields) {
    hydrateParentReferencesForInheritance(entities, fields);
    super.setInheritedFields(entities, fields);
  }

  // Individual field fetchers registered in constructor
  private void fetchAndSetSchemaFieldTags(List<APIEndpoint> apiEndpoints, Fields fields) {
    if (!fields.contains(FIELD_TAGS) || apiEndpoints == null || apiEndpoints.isEmpty()) {
      return;
    }

    // First, fetch endpoint-level tags (important for search indexing)
    List<String> entityFQNs =
        apiEndpoints.stream().map(APIEndpoint::getFullyQualifiedName).toList();
    Map<String, List<TagLabel>> tagsMap = batchFetchTags(entityFQNs);
    Map<String, List<TagLabel>> derivedEndpointTags =
        batchFetchDerivedTags(tagsMap.values().stream().flatMap(List::stream).toList());
    for (APIEndpoint endpoint : apiEndpoints) {
      endpoint.setTags(
          addDerivedTagsWithPreFetched(
              tagsMap.getOrDefault(endpoint.getFullyQualifiedName(), Collections.emptyList()),
              derivedEndpointTags));
    }

    // Then, if schemas are requested, also fetch schema field tags
    if (fields.contains("requestSchema") || fields.contains("responseSchema")) {
      fetchAndSetSchemaFieldTagsInBatch(apiEndpoints);
    }
  }

  private void fetchAndSetSchemaFieldTagsInBatch(List<APIEndpoint> apiEndpoints) {
    List<Field> schemaFields = new ArrayList<>();
    for (APIEndpoint endpoint : apiEndpoints) {
      if (endpoint.getRequestSchema() != null) {
        schemaFields.addAll(
            EntityUtil.getFlattenedEntityField(endpoint.getRequestSchema().getSchemaFields()));
      }
      if (endpoint.getResponseSchema() != null) {
        schemaFields.addAll(
            EntityUtil.getFlattenedEntityField(endpoint.getResponseSchema().getSchemaFields()));
      }
    }

    if (schemaFields.isEmpty()) {
      return;
    }

    List<String> schemaFieldFQNs =
        schemaFields.stream()
            .map(Field::getFullyQualifiedName)
            .filter(fqn -> !nullOrEmpty(fqn))
            .distinct()
            .toList();
    if (schemaFieldFQNs.isEmpty()) {
      return;
    }

    Map<String, List<TagLabel>> schemaFieldTags = batchFetchTags(schemaFieldFQNs);
    Map<String, List<TagLabel>> derivedSchemaFieldTags =
        batchFetchDerivedTags(schemaFieldTags.values().stream().flatMap(List::stream).toList());

    for (Field schemaField : schemaFields) {
      List<TagLabel> fieldTags =
          schemaFieldTags.getOrDefault(
              schemaField.getFullyQualifiedName(), Collections.emptyList());
      schemaField.setTags(addDerivedTagsWithPreFetched(fieldTags, derivedSchemaFieldTags));
    }
  }

  @Override
  public EntityRepository<APIEndpoint>.EntityUpdater getUpdater(
      APIEndpoint original, APIEndpoint updated, Operation operation, ChangeSource changeSource) {
    return new APIEndpointUpdater(original, updated, operation);
  }

  private void setDefaultFields(APIEndpoint apiEndpoint) {
    if (hasDefaultFields(apiEndpoint)) {
      return;
    }
    fetchAndSetDefaultFields(List.of(apiEndpoint));
  }

  private void populateAPICollection(APIEndpoint apiEndpoint) {
    var apiCollection =
        (APICollection) getCachedParentOrLoad(apiEndpoint.getApiCollection(), "", ALL);
    apiEndpoint.setApiCollection(apiCollection.getEntityReference());
    apiEndpoint.setService(apiCollection.getService());
    apiEndpoint.setServiceType(apiCollection.getServiceType());
  }

  private void setFieldFQN(String parentFQN, List<Field> fields) {
    fields.forEach(
        c -> {
          String fieldFqn = FullyQualifiedName.add(parentFQN, c.getName());
          c.setFullyQualifiedName(fieldFqn);
          if (c.getChildren() != null) {
            setFieldFQN(fieldFqn, c.getChildren());
          }
        });
  }

  private void validateSchemaFieldTags(List<Field> fields) {
    // Add field level tags by adding tag to field relationship
    for (Field field : fields) {
      validateTags(field.getTags());
      field.setTags(addDerivedTags(field.getTags()));
      checkMutuallyExclusive(field.getTags());
      if (field.getChildren() != null) {
        validateSchemaFieldTags(field.getChildren());
      }
    }
  }

  private void applyTags(List<Field> fields) {
    // Add field level tags by adding tag to field relationship
    for (Field field : fields) {
      applyTags(field.getTags(), field.getFullyQualifiedName());
      if (field.getChildren() != null) {
        applyTags(field.getChildren());
      }
    }
  }

  @Override
  public void applyTags(APIEndpoint apiEndpoint) {
    // Add table level tags by adding tag to table relationship
    super.applyTags(apiEndpoint);
    if (apiEndpoint.getRequestSchema() != null) {
      applyTags(apiEndpoint.getRequestSchema().getSchemaFields());
    }
    if (apiEndpoint.getResponseSchema() != null) {
      applyTags(apiEndpoint.getResponseSchema().getSchemaFields());
    }
  }

  @Override
  protected EntityReference getParentReference(APIEndpoint entity) {
    return entity.getApiCollection();
  }

  @Override
  protected String getInheritableFields() {
    return "owners,domains";
  }

  @Override
  protected void applyInheritance(APIEndpoint entity, Fields fields, EntityInterface parent) {
    inheritOwners(entity, fields, parent);
    inheritDomains(entity, fields, parent);
  }

  @Override
  public EntityInterface getParentEntity(APIEndpoint entity, String fields) {
    return Entity.getEntity(entity.getApiCollection(), fields, Include.ALL);
  }

  @Override
  protected void augmentReadPlan(
      ReadPlanBuilder builder,
      APIEndpoint entity,
      Fields fields,
      RelationIncludes relationIncludes) {
    builder.addEntitySpecificPrefetch(PREFETCH_DEFAULT_FIELDS);
  }

  @Override
  protected void prefetchEntitySpecificReadData(
      APIEndpoint entity, ReadPlan readPlan, ReadBundle bundle) {
    if (entity == null
        || entity.getId() == null
        || hasDefaultFields(entity)
        || !readPlan.hasEntitySpecificPrefetch(PREFETCH_DEFAULT_FIELDS)) {
      return;
    }
    fetchAndSetDefaultFields(List.of(entity));
  }

  private boolean hasDefaultFields(APIEndpoint apiEndpoint) {
    return apiEndpoint.getApiCollection() != null && apiEndpoint.getService() != null;
  }

  private void hydrateParentReferencesForInheritance(List<APIEndpoint> endpoints, Fields fields) {
    if (endpoints == null || endpoints.isEmpty()) {
      return;
    }
    boolean needsOwners = fields.contains(FIELD_OWNERS);
    boolean needsDomains = fields.contains("domains");
    if (!needsOwners && !needsDomains) {
      return;
    }

    List<APIEndpoint> missingParentRefs =
        endpoints.stream().filter(endpoint -> endpoint.getApiCollection() == null).toList();
    if (missingParentRefs.isEmpty()) {
      return;
    }

    Map<UUID, EntityReference> apiCollectionRefs =
        batchFetchContainers(missingParentRefs, API_COLLECTION, Include.ALL);
    for (APIEndpoint endpoint : missingParentRefs) {
      EntityReference parentRef = apiCollectionRefs.get(endpoint.getId());
      if (parentRef != null) {
        endpoint.withApiCollection(parentRef);
      }
    }
  }

  private void fetchAndSetDefaultFields(List<APIEndpoint> apiEndpoints) {
    if (apiEndpoints == null || apiEndpoints.isEmpty()) {
      return;
    }

    List<APIEndpoint> endpointsMissingDefaults =
        apiEndpoints.stream().filter(endpoint -> !hasDefaultFields(endpoint)).toList();
    if (endpointsMissingDefaults.isEmpty()) {
      return;
    }

    Map<UUID, EntityReference> apiCollectionRefs =
        batchFetchContainers(endpointsMissingDefaults, API_COLLECTION, Include.ALL);
    if (apiCollectionRefs.isEmpty()) {
      return;
    }

    Map<UUID, EntityReference> servicesByApiCollection =
        batchFetchApiCollectionServices(apiCollectionRefs);

    for (APIEndpoint endpoint : endpointsMissingDefaults) {
      EntityReference apiCollectionRef = apiCollectionRefs.get(endpoint.getId());
      if (apiCollectionRef == null) {
        continue;
      }
      endpoint.withApiCollection(apiCollectionRef);

      EntityReference serviceRef = servicesByApiCollection.get(apiCollectionRef.getId());
      if (serviceRef != null) {
        endpoint.withService(serviceRef);
      }
    }
  }

  private Map<UUID, EntityReference> batchFetchApiCollectionServices(
      Map<UUID, EntityReference> apiCollectionRefs) {
    Map<UUID, EntityReference> servicesByApiCollection = new HashMap<>();
    if (apiCollectionRefs == null || apiCollectionRefs.isEmpty()) {
      return servicesByApiCollection;
    }

    List<String> apiCollectionIds =
        apiCollectionRefs.values().stream()
            .map(EntityReference::getId)
            .distinct()
            .map(UUID::toString)
            .toList();
    if (apiCollectionIds.isEmpty()) {
      return servicesByApiCollection;
    }

    List<CollectionDAO.EntityRelationshipObject> relations =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                apiCollectionIds, Relationship.CONTAINS.ordinal(), Entity.API_SERVICE, Include.ALL);
    if (relations.isEmpty()) {
      return servicesByApiCollection;
    }

    List<UUID> serviceIds =
        relations.stream()
            .map(relation -> UUID.fromString(relation.getFromId()))
            .distinct()
            .toList();
    if (serviceIds.isEmpty()) {
      return servicesByApiCollection;
    }

    Map<UUID, EntityReference> serviceRefMap =
        Entity.getEntityReferencesByIds(Entity.API_SERVICE, serviceIds, Include.ALL).stream()
            .collect(Collectors.toMap(EntityReference::getId, ref -> ref));

    relations.forEach(
        relation -> {
          UUID apiCollectionId = UUID.fromString(relation.getToId());
          UUID serviceId = UUID.fromString(relation.getFromId());
          EntityReference serviceRef = serviceRefMap.get(serviceId);
          if (serviceRef != null) {
            servicesByApiCollection.putIfAbsent(apiCollectionId, serviceRef);
          }
        });

    return servicesByApiCollection;
  }

  @Override
  public void validateTags(APIEndpoint entity) {
    super.validateTags(entity);
    if (entity.getRequestSchema() != null) {
      validateSchemaFieldTags(entity.getRequestSchema().getSchemaFields());
    }
    if (entity.getResponseSchema() != null) {
      validateSchemaFieldTags(entity.getResponseSchema().getSchemaFields());
    }
  }

  @Override
  public List<TagLabel> getAllTags(EntityInterface entity) {
    List<TagLabel> allTags = new ArrayList<>();
    APIEndpoint apiEndpoint = (APIEndpoint) entity;
    EntityUtil.mergeTags(allTags, apiEndpoint.getTags());
    List<Field> requestSchemaFields =
        apiEndpoint.getRequestSchema() != null
            ? apiEndpoint.getRequestSchema().getSchemaFields()
            : null;
    List<Field> responseSchemaFields =
        apiEndpoint.getResponseSchema() != null
            ? apiEndpoint.getResponseSchema().getSchemaFields()
            : null;
    for (Field schemaField : listOrEmpty(responseSchemaFields)) {
      EntityUtil.mergeTags(allTags, schemaField.getTags());
    }
    for (Field schemaField : listOrEmpty(requestSchemaFields)) {
      EntityUtil.mergeTags(allTags, schemaField.getTags());
    }
    return allTags;
  }

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
    EntityLink entityLink = threadContext.getAbout();
    if (entityLink.getFieldName() != null && entityLink.getFieldName().equals("responseSchema")) {
      TaskType taskType = threadContext.getThread().getTask().getType();
      if (EntityUtil.isDescriptionTask(taskType)) {
        return new ResponseSchemaDescriptionWorkflow(threadContext);
      } else if (EntityUtil.isTagTask(taskType)) {
        return new ResponseSchemaTagWorkflow(threadContext);
      } else {
        throw new IllegalArgumentException(String.format("Invalid task type %s", taskType));
      }
    }
    return super.getTaskWorkflow(threadContext);
  }

  static class ResponseSchemaDescriptionWorkflow extends DescriptionTaskWorkflow {
    private final Field schemaField;

    ResponseSchemaDescriptionWorkflow(ThreadContext threadContext) {
      super(threadContext);
      schemaField =
          getResponseSchemaField(
              (APIEndpoint) threadContext.getAboutEntity(),
              threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      schemaField.setDescription(resolveTask.getNewValue());
      return threadContext.getAboutEntity();
    }
  }

  static class ResponseSchemaTagWorkflow extends TagTaskWorkflow {
    private final Field schemaField;

    ResponseSchemaTagWorkflow(ThreadContext threadContext) {
      super(threadContext);
      schemaField =
          getResponseSchemaField(
              (APIEndpoint) threadContext.getAboutEntity(),
              threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      List<TagLabel> tags = JsonUtils.readObjects(resolveTask.getNewValue(), TagLabel.class);
      schemaField.setTags(tags);
      return threadContext.getAboutEntity();
    }
  }

  private static Field getResponseSchemaField(APIEndpoint apiEndpoint, String schemaName) {
    String childrenSchemaName = "";
    if (schemaName.contains(".")) {
      String fieldNameWithoutQuotes = schemaName.substring(1, schemaName.length() - 1);
      schemaName = fieldNameWithoutQuotes.substring(0, fieldNameWithoutQuotes.indexOf("."));
      childrenSchemaName =
          fieldNameWithoutQuotes.substring(fieldNameWithoutQuotes.lastIndexOf(".") + 1);
    }
    Field schemaField = null;
    for (Field field : apiEndpoint.getResponseSchema().getSchemaFields()) {
      if (field.getName().equals(schemaName)) {
        schemaField = field;
        break;
      }
    }
    if (childrenSchemaName.isEmpty() && schemaField != null) {
      schemaField = getChildSchemaField(schemaField.getChildren(), childrenSchemaName);
    }
    if (schemaField == null) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.invalidFieldName("responseSchema", schemaName));
    }
    return schemaField;
  }

  private static Field getChildSchemaField(List<Field> fields, String childrenSchemaName) {
    Field childrenSchemaField = null;
    for (Field field : fields) {
      if (field.getName().equals(childrenSchemaName)) {
        childrenSchemaField = field;
        break;
      }
    }
    if (childrenSchemaField == null) {
      for (Field field : fields) {
        if (field.getChildren() != null) {
          childrenSchemaField = getChildSchemaField(field.getChildren(), childrenSchemaName);
          if (childrenSchemaField != null) {
            break;
          }
        }
      }
    }
    return childrenSchemaField;
  }

  public class APIEndpointUpdater extends EntityUpdater {
    public static final String FIELD_DATA_TYPE_DISPLAY = "dataTypeDisplay";

    public APIEndpointUpdater(APIEndpoint original, APIEndpoint updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate(
          "endpointURL",
          () -> recordChange("endpointURL", original.getEndpointURL(), updated.getEndpointURL()));
      compareAndUpdate(
          "requestMethod",
          () ->
              recordChange(
                  "requestMethod", original.getRequestMethod(), updated.getRequestMethod()));

      compareAndUpdate(
          "requestSchema",
          () -> {
            if (updated.getRequestSchema() != null
                && updated.getRequestSchema().getSchemaFields() != null) {
              updateSchemaFields(
                  "requestSchema.schemaFields",
                  original.getRequestSchema() == null
                      ? new ArrayList<>()
                      : listOrEmpty(original.getRequestSchema().getSchemaFields()),
                  listOrEmpty(updated.getRequestSchema().getSchemaFields()),
                  EntityUtil.schemaFieldMatch);
            }
          });

      compareAndUpdate(
          "responseSchema",
          () -> {
            if (updated.getResponseSchema() != null
                && updated.getResponseSchema().getSchemaFields() != null) {
              updateSchemaFields(
                  "responseSchema.schemaFields",
                  original.getResponseSchema() == null
                      ? new ArrayList<>()
                      : listOrEmpty(original.getResponseSchema().getSchemaFields()),
                  listOrEmpty(updated.getResponseSchema().getSchemaFields()),
                  EntityUtil.schemaFieldMatch);
            }
          });
      compareAndUpdate(
          "sourceHash",
          () ->
              recordChange(
                  "sourceHash",
                  original.getSourceHash(),
                  updated.getSourceHash(),
                  false,
                  EntityUtil.objectMatch,
                  false));
    }

    private void updateSchemaFields(
        String fieldName,
        List<Field> origFields,
        List<Field> updatedFields,
        BiPredicate<Field, Field> fieldMatch) {
      List<Field> deletedFields = new ArrayList<>();
      List<Field> addedFields = new ArrayList<>();
      recordListChange(
          fieldName, origFields, updatedFields, addedFields, deletedFields, fieldMatch);
      // carry forward tags and description if deletedFields matches added field
      Map<String, Field> addedFieldMap =
          addedFields.stream().collect(Collectors.toMap(Field::getName, Function.identity()));

      for (Field deleted : deletedFields) {
        if (addedFieldMap.containsKey(deleted.getName())) {
          Field addedField = addedFieldMap.get(deleted.getName());
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
      for (Field added : addedFields) {
        applyTags(added.getTags(), added.getFullyQualifiedName());
      }

      // Carry forward the user generated metadata from existing fields to new fields
      for (Field updated : updatedFields) {
        // Find stored field matching name, data type and ordinal position
        Field stored =
            origFields.stream().filter(c -> fieldMatch.test(c, updated)).findAny().orElse(null);
        if (stored == null) { // New field added
          continue;
        }

        String schemaFieldPrefix =
            EntityUtil.getFieldName(fieldName, FullyQualifiedName.quoteName(updated.getName()));
        updateFieldDescription(schemaFieldPrefix, stored, updated);
        updateFieldDataTypeDisplay(schemaFieldPrefix, stored, updated);
        updateFieldDisplayName(schemaFieldPrefix, stored, updated);
        updateTags(
            stored.getFullyQualifiedName(),
            EntityUtil.getFieldName(schemaFieldPrefix, FIELD_TAGS),
            stored.getTags(),
            updated.getTags());

        if (updated.getChildren() != null && stored.getChildren() != null) {
          updateSchemaFields(
              schemaFieldPrefix,
              listOrEmpty(stored.getChildren()),
              listOrEmpty(updated.getChildren()),
              fieldMatch);
        }
      }

      majorVersionChange = majorVersionChange || !deletedFields.isEmpty();
    }

    private void updateFieldDescription(String fieldPrefix, Field origField, Field updatedField) {
      if (operation.isPut() && !nullOrEmpty(origField.getDescription()) && updatedByBot()) {
        updatedField.setDescription(origField.getDescription());
        return;
      }
      recordChange(
          EntityUtil.getFieldName(fieldPrefix, FIELD_DESCRIPTION),
          origField.getDescription(),
          updatedField.getDescription());
    }

    private void updateFieldDisplayName(String fieldPrefix, Field origField, Field updatedField) {
      if (operation.isPut() && !nullOrEmpty(origField.getDisplayName()) && updatedByBot()) {
        updatedField.setDisplayName(origField.getDisplayName());
        return;
      }
      recordChange(
          EntityUtil.getFieldName(fieldPrefix, FIELD_DISPLAY_NAME),
          origField.getDisplayName(),
          updatedField.getDisplayName());
    }

    private void updateFieldDataTypeDisplay(
        String fieldPrefix, Field origField, Field updatedField) {
      if (operation.isPut() && !nullOrEmpty(origField.getDataTypeDisplay()) && updatedByBot()) {
        updatedField.setDataTypeDisplay(origField.getDataTypeDisplay());
        return;
      }
      recordChange(
          EntityUtil.getFieldName(fieldPrefix, FIELD_DATA_TYPE_DISPLAY),
          origField.getDataTypeDisplay(),
          updatedField.getDataTypeDisplay());
    }
  }
}
