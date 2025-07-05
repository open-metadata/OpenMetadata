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
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.populateEntityFieldTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusive;

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
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.topic.CleanupPolicy;
import org.openmetadata.schema.type.topic.TopicSampleData;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.topics.TopicResource;
import org.openmetadata.service.security.mask.PIIMasker;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

public class TopicRepository extends EntityRepository<Topic> {

  public TopicRepository() {
    super(
        TopicResource.COLLECTION_PATH,
        Entity.TOPIC,
        Topic.class,
        Entity.getCollectionDAO().topicDAO(),
        "",
        "");
    supportsSearch = true;

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put(FIELD_TAGS, this::fetchAndSetSchemaFieldTags);
    fieldFetchers.put("followers", this::fetchAndSetFollowers);
    fieldFetchers.put("usageSummary", this::fetchAndSetUsageSummaries);
    fieldFetchers.put("service", this::fetchAndSetServices);
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
    MessagingService messagingService = Entity.getEntity(topic.getService(), "", ALL);
    topic.setService(messagingService.getEntityReference());
    topic.setServiceType(messagingService.getServiceType());
  }

  @Override
  public void storeEntity(Topic topic, boolean update) {
    // Relationships and fields such as service are derived and not stored as part of json
    EntityReference service = topic.getService();
    topic.withService(null);

    // Don't store fields tags as JSON but build it on the fly based on relationships
    List<Field> fieldsWithTags = null;
    if (topic.getMessageSchema() != null) {
      fieldsWithTags = topic.getMessageSchema().getSchemaFields();
      topic.getMessageSchema().setSchemaFields(cloneWithoutTags(fieldsWithTags));
      topic.getMessageSchema().getSchemaFields().forEach(field -> field.setTags(null));
    }

    store(topic, update);

    // Restore the relationships
    if (fieldsWithTags != null) {
      topic.getMessageSchema().withSchemaFields(fieldsWithTags);
    }
    topic.withService(service);
  }

  @Override
  public void storeRelationships(Topic topic) {
    addServiceRelationship(topic, topic.getService());
  }

  @Override
  public void setFields(Topic topic, Fields fields) {
    // Set default service field
    topic.setService(getContainer(topic.getId()));

    if (topic.getMessageSchema() != null) {
      populateEntityFieldTags(
          entityType,
          topic.getMessageSchema().getSchemaFields(),
          topic.getFullyQualifiedName(),
          fields.contains(FIELD_TAGS));
    }
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Topic> entities) {
    // Always set default service field for all topics
    fetchAndSetDefaultService(entities);

    fetchAndSetFields(entities, fields);
    fetchAndSetTopicSpecificFields(entities, fields);
    setInheritedFields(entities, fields);
    entities.forEach(entity -> clearFieldsInternal(entity, fields));
  }

  private void fetchAndSetTopicSpecificFields(List<Topic> topics, Fields fields) {
    if (topics == null || topics.isEmpty()) {
      return;
    }

    if (fields.contains(FIELD_TAGS)) {
      fetchAndSetSchemaFieldTags(topics, fields);
    }

    if (fields.contains("followers")) {
      fetchAndSetFollowers(topics, fields);
    }

    if (fields.contains("usageSummary")) {
      fetchAndSetUsageSummaries(topics, fields);
    }

    if (fields.contains("service")) {
      fetchAndSetServices(topics, fields);
    }
  }

  private void fetchAndSetSchemaFieldTags(List<Topic> topics, Fields fields) {
    if (!fields.contains(FIELD_TAGS) || topics == null || topics.isEmpty()) {
      return;
    }

    // Filter topics that have message schemas and use bulk tag fetching
    List<Topic> topicsWithSchemas =
        topics.stream().filter(t -> t.getMessageSchema() != null).toList();

    if (!topicsWithSchemas.isEmpty()) {
      bulkPopulateEntityFieldTags(
          topicsWithSchemas,
          entityType,
          t -> t.getMessageSchema().getSchemaFields(),
          Topic::getFullyQualifiedName);
    }
  }

  private void fetchAndSetFollowers(List<Topic> topics, Fields fields) {
    if (!fields.contains("followers") || topics == null || topics.isEmpty()) {
      return;
    }
    setFieldFromMap(true, topics, batchFetchFollowers(topics), Topic::setFollowers);
  }

  private void fetchAndSetUsageSummaries(List<Topic> topics, Fields fields) {
    if (!fields.contains("usageSummary") || topics == null || topics.isEmpty()) {
      return;
    }
    setFieldFromMap(
        true,
        topics,
        EntityUtil.getLatestUsageForEntities(daoCollection.usageDAO(), entityListToUUID(topics)),
        Topic::setUsageSummary);
  }

  private void fetchAndSetServices(List<Topic> topics, Fields fields) {
    if (!fields.contains("service") || topics == null || topics.isEmpty()) {
      return;
    }
    setFieldFromMap(true, topics, batchFetchServices(topics), Topic::setService);
  }

  @Override
  public void clearFields(Topic topic, Fields fields) {
    /* Nothing to do */
  }

  @Override
  public EntityRepository<Topic>.EntityUpdater getUpdater(
      Topic original, Topic updated, Operation operation, ChangeSource changeSource) {
    return new TopicUpdater(original, updated, operation);
  }

  public Topic getSampleData(UUID topicId, boolean authorizePII) {
    // Validate the request content
    Topic topic = find(topicId, NON_DELETED);

    TopicSampleData sampleData =
        JsonUtils.readValue(
            daoCollection.entityExtensionDAO().getExtension(topic.getId(), "topic.sampleData"),
            TopicSampleData.class);
    topic.setSampleData(sampleData);
    setFieldsInternal(topic, Fields.EMPTY_FIELDS);

    // Set the fields tags. Will be used to mask the sample data
    if (!authorizePII) {
      populateEntityFieldTags(
          entityType,
          topic.getMessageSchema().getSchemaFields(),
          topic.getFullyQualifiedName(),
          true);
      topic.setTags(getTags(topic));
      return PIIMasker.getSampleData(topic);
    }

    return topic;
  }

  public Topic addSampleData(UUID topicId, TopicSampleData sampleData) {
    // Validate the request content
    Topic topic = daoCollection.topicDAO().findEntityById(topicId);

    daoCollection
        .entityExtensionDAO()
        .insert(topicId, "topic.sampleData", "topicSampleData", JsonUtils.pojoToJson(sampleData));
    setFieldsInternal(topic, Fields.EMPTY_FIELDS);
    return topic.withSampleData(sampleData);
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
      applyTags(field.getTags(), field.getFullyQualifiedName());
      if (field.getChildren() != null) {
        applyTags(field.getChildren());
      }
    }
  }

  @Override
  public void applyTags(Topic topic) {
    // Add table level tags by adding tag to table relationship
    super.applyTags(topic);
    if (topic.getMessageSchema() != null) {
      applyTags(topic.getMessageSchema().getSchemaFields());
    }
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
    super.validateTags(entity);
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

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
    EntityLink entityLink = threadContext.getAbout();
    if (entityLink.getFieldName().equals("messageSchema")) {
      TaskType taskType = threadContext.getThread().getTask().getType();
      if (EntityUtil.isDescriptionTask(taskType)) {
        return new MessageSchemaDescriptionWorkflow(threadContext);
      } else if (EntityUtil.isTagTask(taskType)) {
        return new MessageSchemaTagWorkflow(threadContext);
      } else {
        throw new IllegalArgumentException(String.format("Invalid task type %s", taskType));
      }
    }
    return super.getTaskWorkflow(threadContext);
  }

  static class MessageSchemaDescriptionWorkflow extends DescriptionTaskWorkflow {
    private final Field schemaField;

    MessageSchemaDescriptionWorkflow(ThreadContext threadContext) {
      super(threadContext);
      schemaField =
          getSchemaField(
              (Topic) threadContext.getAboutEntity(), threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      schemaField.setDescription(resolveTask.getNewValue());
      return threadContext.getAboutEntity();
    }
  }

  static class MessageSchemaTagWorkflow extends TagTaskWorkflow {
    private final Field schemaField;

    MessageSchemaTagWorkflow(ThreadContext threadContext) {
      super(threadContext);
      schemaField =
          getSchemaField(
              (Topic) threadContext.getAboutEntity(), threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      List<TagLabel> tags = JsonUtils.readObjects(resolveTask.getNewValue(), TagLabel.class);
      schemaField.setTags(tags);
      return threadContext.getAboutEntity();
    }
  }

  private static Field getSchemaField(Topic topic, String schemaName) {
    String childrenSchemaName = "";
    if (schemaName.contains(".")) {
      String fieldNameWithoutQuotes = schemaName.substring(1, schemaName.length() - 1);
      schemaName = fieldNameWithoutQuotes.substring(0, fieldNameWithoutQuotes.indexOf("."));
      childrenSchemaName =
          fieldNameWithoutQuotes.substring(fieldNameWithoutQuotes.lastIndexOf(".") + 1);
    }
    Field schemaField = null;
    for (Field field : topic.getMessageSchema().getSchemaFields()) {
      if (field.getName().equals(schemaName)) {
        schemaField = field;
        break;
      }
    }
    if (!"".equals(childrenSchemaName) && schemaField != null) {
      schemaField = getChildSchemaField(schemaField.getChildren(), childrenSchemaName);
    }
    if (schemaField == null) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.invalidFieldName("schema", schemaName));
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
        daoCollection
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
        daoCollection
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

  public class TopicUpdater extends EntityUpdater {
    public static final String FIELD_DATA_TYPE_DISPLAY = "dataTypeDisplay";

    public TopicUpdater(Topic original, Topic updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange(
          "maximumMessageSize", original.getMaximumMessageSize(), updated.getMaximumMessageSize());
      recordChange(
          "minimumInSyncReplicas",
          original.getMinimumInSyncReplicas(),
          updated.getMinimumInSyncReplicas());
      // Partitions is a required field. Cannot be null.
      if (updated.getPartitions() != null) {
        recordChange("partitions", original.getPartitions(), updated.getPartitions());
      }
      recordChange(
          "replicationFactor", original.getReplicationFactor(), updated.getReplicationFactor());
      recordChange("retentionTime", original.getRetentionTime(), updated.getRetentionTime());
      recordChange("retentionSize", original.getRetentionSize(), updated.getRetentionSize());
      if (updated.getMessageSchema() != null) {
        recordChange(
            "messageSchema.schemaText",
            original.getMessageSchema() == null
                ? null
                : original.getMessageSchema().getSchemaText(),
            updated.getMessageSchema().getSchemaText());
        recordChange(
            "messageSchema.schemaType",
            original.getMessageSchema() == null
                ? null
                : original.getMessageSchema().getSchemaType(),
            updated.getMessageSchema().getSchemaType());
        updateSchemaFields(
            "messageSchema.schemaFields",
            original.getMessageSchema() == null
                ? new ArrayList<>()
                : listOrEmpty(original.getMessageSchema().getSchemaFields()),
            listOrEmpty(updated.getMessageSchema().getSchemaFields()),
            EntityUtil.schemaFieldMatch);
      }
      recordChange("topicConfig", original.getTopicConfig(), updated.getTopicConfig());
      updateCleanupPolicies(original, updated);
      recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl());
      recordChange("sourceHash", original.getSourceHash(), updated.getSourceHash());
    }

    private void updateCleanupPolicies(Topic original, Topic updated) {
      List<CleanupPolicy> added = new ArrayList<>();
      List<CleanupPolicy> deleted = new ArrayList<>();
      recordListChange(
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
          updateSchemaFields(
              childrenFieldName,
              listOrEmpty(stored.getChildren()),
              listOrEmpty(updated.getChildren()),
              fieldMatch);
        }
      }

      majorVersionChange = majorVersionChange || !deletedFields.isEmpty();
    }

    private void updateFieldDescription(Field origField, Field updatedField) {
      if (operation.isPut() && !nullOrEmpty(origField.getDescription()) && updatedByBot()) {
        // Revert the non-empty field description if being updated by a bot
        updatedField.setDescription(origField.getDescription());
        return;
      }
      String field = EntityUtil.getSchemaField(original, origField, FIELD_DESCRIPTION);
      recordChange(field, origField.getDescription(), updatedField.getDescription());
    }

    private void updateFieldDisplayName(Field origField, Field updatedField) {
      if (operation.isPut() && !nullOrEmpty(origField.getDescription()) && updatedByBot()) {
        // Revert the non-empty field description if being updated by a bot
        updatedField.setDisplayName(origField.getDisplayName());
        return;
      }
      String field = EntityUtil.getSchemaField(original, origField, FIELD_DISPLAY_NAME);
      recordChange(field, origField.getDisplayName(), updatedField.getDisplayName());
    }

    private void updateFieldDataTypeDisplay(Field origField, Field updatedField) {
      if (operation.isPut() && !nullOrEmpty(origField.getDataTypeDisplay()) && updatedByBot()) {
        // Revert the non-empty field dataTypeDisplay if being updated by a bot
        updatedField.setDataTypeDisplay(origField.getDataTypeDisplay());
        return;
      }
      String field = EntityUtil.getSchemaField(original, origField, FIELD_DATA_TYPE_DISPLAY);
      recordChange(field, origField.getDataTypeDisplay(), updatedField.getDataTypeDisplay());
    }
  }
}
