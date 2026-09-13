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
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.metadata.EntityTagWriter;
import org.openmetadata.service.entity.metadata.InheritedReferences;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.ReadBundle;
import org.openmetadata.service.entity.read.ReadPlan;
import org.openmetadata.service.entity.read.ReadPlanBuilder;
import org.openmetadata.service.entity.read.ReadPrefetchKey;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.apis.APIEndpointResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Repository()
public class APIEndpointRepository implements EntityPolicy<APIEndpoint> {

  private static final Set<String> CHANGE_SUMMARY_FIELDS =
      Set.of("requestSchema.schemaFields.description", "responseSchema.schemaFields.description");

  private static final ReadPrefetchKey PREFETCH_DEFAULT_FIELDS =
      ReadPrefetchKey.API_ENDPOINT_DEFAULT_FIELDS;

  public APIEndpointRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                APIEndpointResource.COLLECTION_PATH,
                Entity.API_ENDPOINT,
                APIEndpoint.class,
                Entity.getCollectionDAO().apiEndpointDAO()),
            new EntityPolicyContext.WriteFields("", "", CHANGE_SUMMARY_FIELDS),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
    // Covered by the API service / API collection delete cascade: search docs by service.id
    // (SearchRepository.deleteOrUpdateChildren) and field_relationship / tag_usage by the root
    // cleanup() FQN prefix (FQNs are service-nested). See
    // EntityRepository#descendantsCoveredByAncestorCascade.
    context().options().setDescendantsCoveredByAncestorCascade(true);
    // Register bulk field fetchers for efficient database operations
    fieldLoading().register(FIELD_TAGS, this::fetchAndSetSchemaFieldTags);
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
    EntityPolicy.super.setInheritedFields(endpoint, fields);
  }

  @Override
  public void prepare(APIEndpoint apiEndpoint, boolean update) {
    populateAPICollection(apiEndpoint);
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("apiCollection");
  }

  @Override
  public ObjectNode storageJsonNode(APIEndpoint apiEndpoint) {
    ObjectNode node = EntityPolicy.super.storageJsonNode(apiEndpoint);
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
    persistence().store(apiEndpoint, update);
  }

  @Override
  public void storeEntities(List<APIEndpoint> entities) {
    persistence().insertMany(entities);
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<APIEndpoint> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(APIEndpoint::getId).toList();
    deleteToMany(ids, Entity.API_ENDPOINT, Relationship.CONTAINS, Entity.API_COLLECTION);
  }

  @Override
  public void storeRelationships(APIEndpoint apiEndpoint) {
    EntityReference apiCollection = apiEndpoint.getApiCollection();
    relationshipWrites()
        .add(
            new EntityRelationshipWriter.Edge(
                apiCollection.getId(),
                apiEndpoint.getId(),
                apiCollection.getType(),
                Entity.API_ENDPOINT,
                Relationship.CONTAINS),
            EntityRelationshipWriter.Value.EMPTY,
            false);
  }

  @Override
  public void storeEntitySpecificRelationshipsForMany(List<APIEndpoint> entities) {
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
          context().schema().entityType(),
          apiEndpoint.getRequestSchema().getSchemaFields(),
          apiEndpoint.getFullyQualifiedName() + ".requestSchema",
          fields.contains(FIELD_TAGS));
    }
    if (apiEndpoint.getResponseSchema() != null) {
      populateEntityFieldTags(
          context().schema().entityType(),
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
    EntityPolicy.super.setFieldsInBulk(fields, entities);
  }

  @Override
  public void setInheritedFields(List<APIEndpoint> entities, Fields fields) {
    hydrateParentReferencesForInheritance(entities, fields);
    EntityPolicy.super.setInheritedFields(entities, fields);
  }

  // Individual field fetchers registered in constructor
  private void fetchAndSetSchemaFieldTags(List<APIEndpoint> apiEndpoints, Fields fields) {
    if (!fields.contains(FIELD_TAGS) || apiEndpoints == null || apiEndpoints.isEmpty()) {
      return;
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
    Map<String, List<TagLabel>> schemaFieldTags = tags().readMany(schemaFieldFQNs);
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
  public EntityUpdater<APIEndpoint> getUpdater(
      APIEndpoint original,
      APIEndpoint updated,
      EntityOperation operation,
      ChangeSource changeSource) {
    return new APIEndpointUpdater(original, updated, operation).mutation();
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
          FullyQualifiedName.validateFqnName(c.getName());
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
      tagWrites().apply(field.getTags(), new EntityTagWriter.Target(field.getFullyQualifiedName()));
      if (field.getChildren() != null) {
        applyTags(field.getChildren());
      }
    }
  }

  @Override
  public void applyTags(APIEndpoint apiEndpoint) {
    // Add table level tags by adding tag to table relationship
    EntityPolicy.super.applyTags(apiEndpoint);
    if (apiEndpoint.getRequestSchema() != null) {
      applyTags(apiEndpoint.getRequestSchema().getSchemaFields());
    }
    if (apiEndpoint.getResponseSchema() != null) {
      applyTags(apiEndpoint.getResponseSchema().getSchemaFields());
    }
  }

  @Override
  public EntityReference getParentReference(APIEndpoint entity) {
    return entity.getApiCollection();
  }

  @Override
  public String getInheritableFields() {
    return "owners,domains";
  }

  @Override
  public void applyInheritance(APIEndpoint entity, Fields fields, EntityInterface parent) {
    InheritedReferences.apply(InheritedReferences.Field.OWNERS, entity, fields, parent);
    InheritedReferences.apply(InheritedReferences.Field.DOMAINS, entity, fields, parent);
  }

  @Override
  public EntityInterface getParentEntity(APIEndpoint entity, String fields) {
    return Entity.getEntity(entity.getApiCollection(), fields, Include.ALL);
  }

  @Override
  public void augmentReadPlan(
      ReadPlanBuilder builder,
      APIEndpoint entity,
      Fields fields,
      RelationIncludes relationIncludes) {
    builder.addEntitySpecificPrefetch(PREFETCH_DEFAULT_FIELDS);
  }

  @Override
  public void prefetchEntitySpecificReadData(
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
        context()
            .dependencies()
            .daos()
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
    EntityPolicy.super.validateTags(entity);
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

  public class APIEndpointUpdater implements EntitySpecificMutation<APIEndpoint> {

    public static final String FIELD_DATA_TYPE_DISPLAY = "dataTypeDisplay";

    public APIEndpointUpdater(
        APIEndpoint original, APIEndpoint updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<APIEndpoint> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "endpointURL",
          () ->
              entityUpdate.recordChange(
                  "endpointURL",
                  entityUpdate.getOriginal().getEndpointURL(),
                  entityUpdate.getUpdated().getEndpointURL()));
      entityUpdate.compareAndUpdate(
          "requestMethod",
          () ->
              entityUpdate.recordChange(
                  "requestMethod",
                  entityUpdate.getOriginal().getRequestMethod(),
                  entityUpdate.getUpdated().getRequestMethod()));
      entityUpdate.compareAndUpdate(
          "requestSchema",
          () -> {
            if (entityUpdate.getUpdated().getRequestSchema() != null
                && entityUpdate.getUpdated().getRequestSchema().getSchemaFields() != null) {
              updateSchemaFields(
                  "requestSchema.schemaFields",
                  entityUpdate.getOriginal().getRequestSchema() == null
                      ? new ArrayList<>()
                      : listOrEmpty(
                          entityUpdate.getOriginal().getRequestSchema().getSchemaFields()),
                  listOrEmpty(entityUpdate.getUpdated().getRequestSchema().getSchemaFields()),
                  EntityUtil.schemaFieldMatch);
            }
          });
      entityUpdate.compareAndUpdate(
          "responseSchema",
          () -> {
            if (entityUpdate.getUpdated().getResponseSchema() != null
                && entityUpdate.getUpdated().getResponseSchema().getSchemaFields() != null) {
              updateSchemaFields(
                  "responseSchema.schemaFields",
                  entityUpdate.getOriginal().getResponseSchema() == null
                      ? new ArrayList<>()
                      : listOrEmpty(
                          entityUpdate.getOriginal().getResponseSchema().getSchemaFields()),
                  listOrEmpty(entityUpdate.getUpdated().getResponseSchema().getSchemaFields()),
                  EntityUtil.schemaFieldMatch);
            }
          });
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
    }

    private void updateSchemaFields(
        String fieldName,
        List<Field> origFields,
        List<Field> updatedFields,
        BiPredicate<Field, Field> fieldMatch) {
      List<Field> deletedFields = new ArrayList<>();
      List<Field> addedFields = new ArrayList<>();
      entityUpdate.recordListChange(
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
              context()
                  .dependencies()
                  .daos()
                  .tagUsageDAO()
                  .deleteTagsByTarget(deleted.getFullyQualifiedName()));
      // Add tags related to newly added fields
      for (Field added : addedFields) {
        tagWrites()
            .apply(added.getTags(), new EntityTagWriter.Target(added.getFullyQualifiedName()));
      }
      // Carry forward the user generated metadata from existing fields to new fields
      for (Field updated : updatedFields) {
        // Find stored field matching name, data type and ordinal position
        Field stored =
            origFields.stream().filter(c -> fieldMatch.test(c, updated)).findAny().orElse(null);
        if (stored == null) {
          // New field added
          continue;
        }
        String schemaFieldPrefix =
            EntityUtil.getFieldName(fieldName, FullyQualifiedName.quoteName(updated.getName()));
        updateFieldDescription(schemaFieldPrefix, stored, updated);
        updateFieldDataTypeDisplay(schemaFieldPrefix, stored, updated);
        updateFieldDisplayName(schemaFieldPrefix, stored, updated);
        entityUpdate.updateTags(
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
      entityUpdate.setMajorVersionChange(
          entityUpdate.isMajorVersionChange() || !deletedFields.isEmpty());
    }

    private void updateFieldDescription(String fieldPrefix, Field origField, Field updatedField) {
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

    private void updateFieldDisplayName(String fieldPrefix, Field origField, Field updatedField) {
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
        String fieldPrefix, Field origField, Field updatedField) {
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

    private final EntityUpdater<APIEndpoint> entityUpdate;

    public EntityUpdater<APIEndpoint> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<APIEndpoint> entityContext;

  @Override
  public final EntityPolicyContext<APIEndpoint> context() {
    return entityContext;
  }
}
