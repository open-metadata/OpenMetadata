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
import static org.openmetadata.service.Entity.FIELD_SERVICE;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.populateEntityFieldTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusive;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.topic.CleanupPolicy;
import org.openmetadata.schema.type.topic.TopicSampleData;
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
import org.openmetadata.service.resources.topics.TopicResource;
import org.openmetadata.service.security.mask.PIIMasker;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Repository()
public class TopicRepository implements EntityPolicy<Topic> {

  private static final Set<String> CHANGE_SUMMARY_FIELDS =
      Set.of("messageSchema.schemaFields.description");

  public static final String TOPIC_SAMPLE_DATA_EXTENSION = "topic.sampleData";

  public TopicRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                TopicResource.COLLECTION_PATH,
                Entity.TOPIC,
                Topic.class,
                Entity.getCollectionDAO().topicDAO()),
            new EntityPolicyContext.WriteFields("", "", CHANGE_SUMMARY_FIELDS),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
    // Covered by the parent service delete cascade: search docs by service.id
    // (SearchRepository.deleteOrUpdateChildren) and field_relationship / tag_usage by
    // the root cleanup() FQN prefix. See EntityRepository#descendantsCoveredByAncestorCascade.
    context().options().setDescendantsCoveredByAncestorCascade(true);
    // Register bulk field fetchers for efficient database operations
    fieldLoading().register(FIELD_TAGS, this::fetchAndSetSchemaFieldTags);
    fieldLoading().register("followers", this::fetchAndSetFollowers);
    fieldLoading().register("usageSummary", this::fetchAndSetUsageSummaries);
    fieldLoading().register("service", this::fetchAndSetServices);
  }

  @Override
  public void setFullyQualifiedName(Topic topic) {
    topic.setFullyQualifiedName(
        FullyQualifiedName.add(topic.getService().getFullyQualifiedName(), topic.getName()));
    if (topic.getMessageSchema() != null) {
      setFieldFQN(topic.getFullyQualifiedName(), topic.getMessageSchema().getSchemaFields());
    }
  }

  @Override
  public void prepare(Topic topic, boolean update) {
    var messagingService = (MessagingService) getCachedParentOrLoad(topic.getService(), "", ALL);
    topic.setService(messagingService.getEntityReference());
    topic.setServiceType(messagingService.getServiceType());
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service");
  }

  @Override
  public ObjectNode storageJsonNode(Topic topic) {
    ObjectNode node = EntityPolicy.super.storageJsonNode(topic);
    JsonNode messageSchema = node.get("messageSchema");
    if (!(messageSchema instanceof ObjectNode messageSchemaNode)) {
      return node;
    }
    stripSchemaFieldTags(messageSchemaNode.get("schemaFields"));
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
  public void storeEntity(Topic topic, boolean update) {
    persistence().store(topic, update);
  }

  @Override
  public void storeEntities(List<Topic> topics) {
    persistence().insertMany(topics);
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<Topic> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Topic::getId).toList();
    deleteToMany(ids, context().schema().entityType(), Relationship.CONTAINS, null);
  }

  @Override
  public void storeRelationships(Topic topic) {
    addServiceRelationship(topic, topic.getService());
  }

  @Override
  public void storeEntitySpecificRelationshipsForMany(List<Topic> entities) {
    List<CollectionDAO.EntityRelationshipObject> relationships = new ArrayList<>();
    for (Topic topic : entities) {
      EntityReference service = topic.getService();
      if (service == null || service.getId() == null) {
        continue;
      }
      relationships.add(
          newRelationship(
              service.getId(),
              topic.getId(),
              service.getType(),
              context().schema().entityType(),
              Relationship.CONTAINS));
    }
    bulkInsertRelationships(relationships);
  }

  @Override
  public void setFields(Topic topic, Fields fields, RelationIncludes relationIncludes) {
    // Set default service field
    topic.setService(relationships().container(topic.getId(), null));
    if (topic.getMessageSchema() != null) {
      populateEntityFieldTags(
          context().schema().entityType(),
          topic.getMessageSchema().getSchemaFields(),
          topic.getFullyQualifiedName(),
          fields.contains(FIELD_TAGS));
    }
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Topic> entities) {
    // Always set default service field for all topics
    fetchAndSetDefaultService(entities);
    fieldLoading().populate(entities, fields, Set.of(FIELD_SERVICE));
    // The legacy follower resolver retains its reference types and missing-entity behavior.
    fetchAndSetFollowers(entities, fields);
    setInheritedFields(entities, fields);
    entities.forEach(entity -> clearFieldsInternal(entity, fields));
  }

  @Override
  public DerivedTagLoader.FailureMode derivedTagFailureMode() {
    return DerivedTagLoader.FailureMode.FALL_BACK_TO_INDIVIDUAL;
  }

  private void fetchAndSetSchemaFieldTags(List<Topic> topics, Fields fields) {
    if (!fields.contains(FIELD_TAGS) || topics == null || topics.isEmpty()) {
      return;
    }
    // Then, if messageSchema field is requested, also fetch schema field tags
    if (fields.contains("messageSchema")) {
      // Filter topics that have message schemas and use bulk tag fetching
      List<Topic> topicsWithSchemas =
          topics.stream().filter(t -> t.getMessageSchema() != null).toList();
      if (!topicsWithSchemas.isEmpty()) {
        fieldTags().populate(topicsWithSchemas, t -> t.getMessageSchema().getSchemaFields());
      }
    }
  }

  private void fetchAndSetFollowers(List<Topic> topics, Fields fields) {
    if (!fields.contains("followers") || topics == null || topics.isEmpty()) {
      return;
    }
    EntityBatchFields.assign(true, topics, batchFetchFollowers(topics), Topic::setFollowers);
  }

  private void fetchAndSetUsageSummaries(List<Topic> topics, Fields fields) {
    if (!fields.contains("usageSummary") || topics == null || topics.isEmpty()) {
      return;
    }
    EntityBatchFields.assign(
        true,
        topics,
        EntityUtil.getLatestUsageForEntities(
            context().dependencies().daos().usageDAO(), EntityBatchFields.ids(topics)),
        Topic::setUsageSummary);
  }

  private void fetchAndSetServices(List<Topic> topics, Fields fields) {
    if (!fields.contains("service") || topics == null || topics.isEmpty()) {
      return;
    }
    EntityBatchFields.assign(true, topics, batchFetchServices(topics), Topic::setService);
  }

  @Override
  public void clearFields(Topic topic, Fields fields) {
    /* Nothing to do */
  }

  @Override
  public EntityUpdater<Topic> getUpdater(
      Topic original, Topic updated, EntityOperation operation, ChangeSource changeSource) {
    return new TopicUpdater(original, updated, operation).mutation();
  }

  public Topic getSampleData(UUID topicId, boolean authorizePII) {
    // Validate the request content
    Topic topic = lookup().byId(topicId, NON_DELETED);
    TopicSampleData sampleData =
        JsonUtils.readValue(
            context()
                .dependencies()
                .daos()
                .entityExtensionDAO()
                .getExtension(topic.getId(), TOPIC_SAMPLE_DATA_EXTENSION),
            TopicSampleData.class);
    topic.setSampleData(sampleData);
    setFieldsInternal(topic, Fields.EMPTY_FIELDS);
    // Set the fields tags. Will be used to mask the sample data
    if (!authorizePII) {
      List<Field> schemaFields =
          topic.getMessageSchema() != null ? topic.getMessageSchema().getSchemaFields() : List.of();
      populateEntityFieldTags(
          context().schema().entityType(), schemaFields, topic.getFullyQualifiedName(), true);
      topic.setTags(tags().read(topic));
      return PIIMasker.getSampleData(topic);
    }
    return topic;
  }

  @Transaction
  public Topic addSampleData(UUID topicId, TopicSampleData sampleData) {
    // Validate the request content
    Topic topic = context().dependencies().daos().topicDAO().findEntityById(topicId);
    context()
        .dependencies()
        .daos()
        .entityExtensionDAO()
        .insert(
            topicId,
            TOPIC_SAMPLE_DATA_EXTENSION,
            "topicSampleData",
            JsonUtils.pojoToJson(sampleData));
    setFieldsInternal(topic, Fields.EMPTY_FIELDS);
    return topic.withSampleData(sampleData);
  }

  @Transaction
  public Topic deleteSampleData(UUID topicId) {
    Topic topic = lookup().byId(topicId, NON_DELETED);
    context()
        .dependencies()
        .daos()
        .entityExtensionDAO()
        .delete(topicId, TOPIC_SAMPLE_DATA_EXTENSION);
    setFieldsInternal(topic, Fields.EMPTY_FIELDS);
    return topic;
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

  List<Field> cloneWithoutTags(List<Field> fields) {
    if (nullOrEmpty(fields)) {
      return fields;
    }
    List<Field> copy = new ArrayList<>();
    fields.forEach(f -> copy.add(cloneWithoutTags(f)));
    return copy;
  }

  private Field cloneWithoutTags(Field field) {
    List<Field> children = cloneWithoutTags(field.getChildren());
    return new Field()
        .withDescription(field.getDescription())
        .withName(field.getName())
        .withDisplayName(field.getDisplayName())
        .withFullyQualifiedName(field.getFullyQualifiedName())
        .withDataType(field.getDataType())
        .withDataTypeDisplay(field.getDataTypeDisplay())
        .withChildren(children);
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
  public void applyTags(Topic topic) {
    // Add table level tags by adding tag to table relationship
    EntityPolicy.super.applyTags(topic);
    if (topic.getMessageSchema() != null) {
      applyTags(topic.getMessageSchema().getSchemaFields());
    }
  }

  @Override
  public EntityReference getParentReference(Topic entity) {
    return entity.getService();
  }

  @Override
  public EntityInterface getParentEntity(Topic entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  @Override
  public void validateTags(Topic entity) {
    EntityPolicy.super.validateTags(entity);
    if (entity.getMessageSchema() != null) {
      validateSchemaFieldTags(entity.getMessageSchema().getSchemaFields());
    }
  }

  @Override
  public List<TagLabel> getAllTags(EntityInterface entity) {
    List<TagLabel> allTags = new ArrayList<>();
    Topic topic = (Topic) entity;
    EntityUtil.mergeTags(allTags, topic.getTags());
    List<Field> schemaFields =
        topic.getMessageSchema() != null ? topic.getMessageSchema().getSchemaFields() : null;
    for (Field schemaField : listOrEmpty(schemaFields)) {
      EntityUtil.mergeTags(allTags, schemaField.getTags());
    }
    return allTags;
  }

  public static Set<TagLabel> getAllFieldTags(Field field) {
    Set<TagLabel> tags = new HashSet<>();
    if (!listOrEmpty(field.getTags()).isEmpty()) {
      tags.addAll(field.getTags());
    }
    for (Field c : listOrEmpty(field.getChildren())) {
      tags.addAll(getAllFieldTags(c));
    }
    return tags;
  }

  private Map<UUID, List<EntityReference>> batchFetchFollowers(List<Topic> topics) {
    var followersMap = new HashMap<UUID, List<EntityReference>>();
    if (topics == null || topics.isEmpty()) {
      return followersMap;
    }
    // Initialize empty lists for all topics
    topics.forEach(topic -> followersMap.put(topic.getId(), new ArrayList<>()));
    // Single batch query to get all followers for all topics
    var records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(topics),
                org.openmetadata.schema.type.Relationship.FOLLOWS.ordinal());
    // Group followers by topic ID
    records.forEach(
        record -> {
          var topicId = UUID.fromString(record.getToId());
          var followerRef =
              Entity.getEntityReferenceById(
                  record.getFromEntity(), UUID.fromString(record.getFromId()), NON_DELETED);
          followersMap.get(topicId).add(followerRef);
        });
    return followersMap;
  }

  private Map<UUID, EntityReference> batchFetchServices(List<Topic> topics) {
    var serviceMap = new HashMap<UUID, EntityReference>();
    if (topics == null || topics.isEmpty()) {
      return serviceMap;
    }
    // Single batch query to get all services for all topics
    var records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(topics),
                org.openmetadata.schema.type.Relationship.CONTAINS.ordinal());
    records.forEach(
        record -> {
          var topicId = UUID.fromString(record.getToId());
          var serviceRef =
              Entity.getEntityReferenceById(
                  Entity.MESSAGING_SERVICE, UUID.fromString(record.getFromId()), NON_DELETED);
          serviceMap.put(topicId, serviceRef);
        });
    return serviceMap;
  }

  private void fetchAndSetDefaultService(List<Topic> topics) {
    if (topics == null || topics.isEmpty()) {
      return;
    }
    // Use the existing batch fetch method
    var serviceMap = batchFetchServices(topics);
    // Set service for all topics
    topics.forEach(topic -> topic.setService(serviceMap.get(topic.getId())));
  }

  public class TopicUpdater implements EntitySpecificMutation<Topic> {

    public static final String FIELD_DATA_TYPE_DISPLAY = "dataTypeDisplay";

    public TopicUpdater(Topic original, Topic updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<Topic> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "maximumMessageSize",
          () ->
              entityUpdate.recordChange(
                  "maximumMessageSize",
                  entityUpdate.getOriginal().getMaximumMessageSize(),
                  entityUpdate.getUpdated().getMaximumMessageSize()));
      entityUpdate.compareAndUpdate(
          "minimumInSyncReplicas",
          () ->
              entityUpdate.recordChange(
                  "minimumInSyncReplicas",
                  entityUpdate.getOriginal().getMinimumInSyncReplicas(),
                  entityUpdate.getUpdated().getMinimumInSyncReplicas()));
      entityUpdate.compareAndUpdate(
          "partitions",
          () -> {
            // Partitions is a required field. Cannot be null.
            if (entityUpdate.getUpdated().getPartitions() != null) {
              entityUpdate.recordChange(
                  "partitions",
                  entityUpdate.getOriginal().getPartitions(),
                  entityUpdate.getUpdated().getPartitions());
            }
          });
      entityUpdate.compareAndUpdate(
          "replicationFactor",
          () ->
              entityUpdate.recordChange(
                  "replicationFactor",
                  entityUpdate.getOriginal().getReplicationFactor(),
                  entityUpdate.getUpdated().getReplicationFactor()));
      entityUpdate.compareAndUpdate(
          "retentionTime",
          () ->
              entityUpdate.recordChange(
                  "retentionTime",
                  entityUpdate.getOriginal().getRetentionTime(),
                  entityUpdate.getUpdated().getRetentionTime()));
      entityUpdate.compareAndUpdate(
          "retentionSize",
          () ->
              entityUpdate.recordChange(
                  "retentionSize",
                  entityUpdate.getOriginal().getRetentionSize(),
                  entityUpdate.getUpdated().getRetentionSize()));
      entityUpdate.compareAndUpdate(
          "messageSchema",
          () -> {
            if (entityUpdate.getUpdated().getMessageSchema() != null) {
              entityUpdate.recordChange(
                  "messageSchema.schemaText",
                  entityUpdate.getOriginal().getMessageSchema() == null
                      ? null
                      : entityUpdate.getOriginal().getMessageSchema().getSchemaText(),
                  entityUpdate.getUpdated().getMessageSchema().getSchemaText());
              entityUpdate.recordChange(
                  "messageSchema.schemaType",
                  entityUpdate.getOriginal().getMessageSchema() == null
                      ? null
                      : entityUpdate.getOriginal().getMessageSchema().getSchemaType(),
                  entityUpdate.getUpdated().getMessageSchema().getSchemaType());
              updateSchemaFields(
                  "messageSchema.schemaFields",
                  entityUpdate.getOriginal().getMessageSchema() == null
                      ? new ArrayList<>()
                      : listOrEmpty(
                          entityUpdate.getOriginal().getMessageSchema().getSchemaFields()),
                  listOrEmpty(entityUpdate.getUpdated().getMessageSchema().getSchemaFields()),
                  EntityUtil.schemaFieldMatch);
            }
          });
      entityUpdate.compareAndUpdate(
          "topicConfig",
          () ->
              entityUpdate.recordChange(
                  "topicConfig",
                  entityUpdate.getOriginal().getTopicConfig(),
                  entityUpdate.getUpdated().getTopicConfig()));
      entityUpdate.compareAndUpdate(
          "cleanupPolicies",
          () -> updateCleanupPolicies(entityUpdate.getOriginal(), entityUpdate.getUpdated()));
      entityUpdate.compareAndUpdate(
          "sourceUrl",
          () ->
              entityUpdate.recordChange(
                  "sourceUrl",
                  entityUpdate.getOriginal().getSourceUrl(),
                  entityUpdate.getUpdated().getSourceUrl()));
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

    private void updateCleanupPolicies(Topic original, Topic updated) {
      List<CleanupPolicy> added = new ArrayList<>();
      List<CleanupPolicy> deleted = new ArrayList<>();
      entityUpdate.recordListChange(
          "cleanupPolicies",
          original.getCleanupPolicies(),
          updated.getCleanupPolicies(),
          added,
          deleted,
          CleanupPolicy::equals);
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

    private final EntityUpdater<Topic> entityUpdate;

    public EntityUpdater<Topic> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<Topic> entityContext;

  @Override
  public final EntityPolicyContext<Topic> context() {
    return entityContext;
  }
}
