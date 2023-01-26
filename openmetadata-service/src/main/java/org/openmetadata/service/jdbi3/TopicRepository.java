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
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.util.EntityUtil.getSchemaField;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.topic.CleanupPolicy;
import org.openmetadata.schema.type.topic.TopicSampleData;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.topics.TopicResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

public class TopicRepository extends EntityRepository<Topic> {
  private static final String TOPIC_UPDATE_FIELDS = "owner,tags,extension";
  private static final String TOPIC_PATCH_FIELDS = "owner,tags,extension";

  @Override
  public void setFullyQualifiedName(Topic topic) {
    topic.setFullyQualifiedName(FullyQualifiedName.add(topic.getService().getName(), topic.getName()));
    if (topic.getMessageSchema() != null) {
      setFieldFQN(topic.getFullyQualifiedName(), topic.getMessageSchema().getSchemaFields());
    }
  }

  public TopicRepository(CollectionDAO dao) {
    super(
        TopicResource.COLLECTION_PATH,
        Entity.TOPIC,
        Topic.class,
        dao.topicDAO(),
        dao,
        TOPIC_PATCH_FIELDS,
        TOPIC_UPDATE_FIELDS);
  }

  @Override
  public void prepare(Topic topic) throws IOException {
    MessagingService messagingService = Entity.getEntity(topic.getService(), Fields.EMPTY_FIELDS, Include.ALL);
    topic.setService(messagingService.getEntityReference());
    topic.setServiceType(messagingService.getServiceType());
    // Validate field tags
    if (topic.getMessageSchema() != null) {
      addDerivedFieldTags(topic.getMessageSchema().getSchemaFields());
      topic.getMessageSchema().getSchemaFields().forEach(field -> checkMutuallyExclusive(field.getTags()));
    }
  }

  @Override
  public void storeEntity(Topic topic, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = topic.getOwner();
    List<TagLabel> tags = topic.getTags();
    EntityReference service = topic.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    topic.withOwner(null).withService(null).withHref(null).withTags(null);

    // Don't store feild tags as JSON but build it on the fly based on relationships
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
    topic.withOwner(owner).withService(service).withTags(tags);
  }

  @Override
  public void storeRelationships(Topic topic) {
    setService(topic, topic.getService());
    storeOwner(topic, topic.getOwner());
    applyTags(topic);
  }

  @Override
  public Topic setFields(Topic topic, Fields fields) throws IOException {
    topic.setService(getContainer(topic.getId()));
    topic.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(topic) : null);
    topic.setSampleData(fields.contains("sampleData") ? getSampleData(topic) : null);
    if (topic.getMessageSchema() != null) {
      getFieldTags(fields.contains(FIELD_TAGS), topic.getMessageSchema().getSchemaFields());
    }
    return topic;
  }

  @Override
  public TopicUpdater getUpdater(Topic original, Topic updated, Operation operation) {
    return new TopicUpdater(original, updated, operation);
  }

  public void setService(Topic topic, EntityReference service) {
    if (service != null && topic != null) {
      addRelationship(service.getId(), topic.getId(), service.getType(), Entity.TOPIC, Relationship.CONTAINS);
      topic.setService(service);
    }
  }

  private TopicSampleData getSampleData(Topic topic) throws IOException {
    return JsonUtils.readValue(
        daoCollection.entityExtensionDAO().getExtension(topic.getId().toString(), "topic.sampleData"),
        TopicSampleData.class);
  }

  @Transaction
  public Topic addSampleData(UUID topicId, TopicSampleData sampleData) throws IOException {
    // Validate the request content
    Topic topic = daoCollection.topicDAO().findEntityById(topicId);

    daoCollection
        .entityExtensionDAO()
        .insert(topicId.toString(), "topic.sampleData", "topicSampleData", JsonUtils.pojoToJson(sampleData));
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

  private void getFieldTags(boolean setTags, List<Field> fields) {
    for (Field f : listOrEmpty(fields)) {
      f.setTags(setTags ? getTags(f.getFullyQualifiedName()) : null);
      getFieldTags(setTags, f.getChildren());
    }
  }

  private void addDerivedFieldTags(List<Field> fields) {
    if (nullOrEmpty(fields)) {
      return;
    }

    for (Field field : fields) {
      field.setTags(addDerivedTags(field.getTags()));
      if (field.getChildren() != null) {
        addDerivedFieldTags(field.getChildren());
      }
    }
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
        .withChildren(children);
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

  public class TopicUpdater extends EntityUpdater {
    public TopicUpdater(Topic original, Topic updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("maximumMessageSize", original.getMaximumMessageSize(), updated.getMaximumMessageSize());
      recordChange("minimumInSyncReplicas", original.getMinimumInSyncReplicas(), updated.getMinimumInSyncReplicas());
      recordChange("partitions", original.getPartitions(), updated.getPartitions());
      recordChange("replicationFactor", original.getReplicationFactor(), updated.getReplicationFactor());
      recordChange("retentionTime", original.getRetentionTime(), updated.getRetentionTime());
      recordChange("retentionSize", original.getRetentionSize(), updated.getRetentionSize());
      if (updated.getMessageSchema() != null) {
        recordChange(
            "messageSchema.schemaText",
            original.getMessageSchema() == null ? null : original.getMessageSchema().getSchemaText(),
            updated.getMessageSchema().getSchemaText());
        recordChange(
            "messageSchema.schemaType",
            original.getMessageSchema() == null ? null : original.getMessageSchema().getSchemaText(),
            updated.getMessageSchema().getSchemaType());
        updateSchemaFields(
            "messageSchema.schemaFields",
            original.getMessageSchema() == null ? null : original.getMessageSchema().getSchemaFields(),
            updated.getMessageSchema().getSchemaFields(),
            EntityUtil.schemaFieldMatch);
      }
      recordChange("topicConfig", original.getTopicConfig(), updated.getTopicConfig());
      updateCleanupPolicies(original, updated);
    }

    private void updateCleanupPolicies(Topic original, Topic updated) throws JsonProcessingException {
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
        String fieldName, List<Field> origFields, List<Field> updatedFields, BiPredicate<Field, Field> fieldMatch)
        throws IOException {
      List<Field> deletedFields = new ArrayList<>();
      List<Field> addedFields = new ArrayList<>();
      recordListChange(fieldName, origFields, updatedFields, addedFields, deletedFields, fieldMatch);
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
      deletedFields.forEach(deleted -> daoCollection.tagUsageDAO().deleteTagsByTarget(deleted.getFullyQualifiedName()));

      // Add tags related to newly added fields
      for (Field added : addedFields) {
        applyTags(added.getTags(), added.getFullyQualifiedName());
      }

      // Carry forward the user generated metadata from existing fields to new fields
      for (Field updated : updatedFields) {
        // Find stored field matching name, data type and ordinal position
        Field stored = origFields.stream().filter(c -> fieldMatch.test(c, updated)).findAny().orElse(null);
        if (stored == null) { // New field added
          continue;
        }

        updateFieldDescription(stored, updated);
        updateFieldDisplayName(stored, updated);
        updateTags(
            stored.getFullyQualifiedName(),
            EntityUtil.getFieldName(fieldName, updated.getName(), FIELD_TAGS),
            stored.getTags(),
            updated.getTags());

        if (updated.getChildren() != null && stored.getChildren() != null) {
          String childrenFieldName = EntityUtil.getFieldName(fieldName, updated.getName());
          updateSchemaFields(childrenFieldName, stored.getChildren(), updated.getChildren(), fieldMatch);
        }
      }

      majorVersionChange = majorVersionChange || !deletedFields.isEmpty();
    }

    private void updateFieldDescription(Field origField, Field updatedField) throws JsonProcessingException {
      if (operation.isPut() && !nullOrEmpty(origField.getDescription()) && updatedByBot()) {
        // Revert the non-empty field description if being updated by a bot
        updatedField.setDescription(origField.getDescription());
        return;
      }
      String field = getSchemaField(original, origField, FIELD_DISPLAY_NAME);
      recordChange(field, origField.getDescription(), updatedField.getDescription());
    }

    private void updateFieldDisplayName(Field origField, Field updatedField) throws JsonProcessingException {
      if (operation.isPut() && !nullOrEmpty(origField.getDescription()) && updatedByBot()) {
        // Revert the non-empty field description if being updated by a bot
        updatedField.setDisplayName(origField.getDisplayName());
        return;
      }
      String field = getSchemaField(original, origField, FIELD_DISPLAY_NAME);
      recordChange(field, origField.getDisplayName(), updatedField.getDisplayName());
    }
  }
}
