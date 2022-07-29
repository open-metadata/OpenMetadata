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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.FIELD_EXTENSION;
import static org.openmetadata.catalog.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.Entity.FIELD_TAGS;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.resources.topics.TopicResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.topic.CleanupPolicy;
import org.openmetadata.catalog.type.topic.TopicSampleData;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.FullyQualifiedName;
import org.openmetadata.catalog.util.JsonUtils;

public class TopicRepository extends EntityRepository<Topic> {
  private static final String TOPIC_UPDATE_FIELDS = "owner,tags,extension";
  private static final String TOPIC_PATCH_FIELDS = "owner,tags,extension";

  @Override
  public void setFullyQualifiedName(Topic topic) {
    topic.setFullyQualifiedName(FullyQualifiedName.add(topic.getService().getName(), topic.getName()));
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
    setFullyQualifiedName(topic);
    topic.setOwner(Entity.getEntityReference(topic.getOwner()));
    topic.setTags(addDerivedTags(topic.getTags()));
  }

  @Override
  public void storeEntity(Topic topic, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = topic.getOwner();
    List<TagLabel> tags = topic.getTags();
    EntityReference service = topic.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    topic.withOwner(null).withService(null).withHref(null).withTags(null);

    store(topic.getId(), topic, update);

    // Restore the relationships
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
    topic.setOwner(fields.contains(FIELD_OWNER) ? getOwner(topic) : null);
    topic.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(topic) : null);
    topic.setTags(fields.contains(FIELD_TAGS) ? getTags(topic.getFullyQualifiedName()) : null);
    topic.setSampleData(fields.contains("sampleData") ? getSampleData(topic) : null);
    topic.setExtension(fields.contains(FIELD_EXTENSION) ? getExtension(topic) : null);
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
    setFields(topic, Fields.EMPTY_FIELDS);
    return topic.withSampleData(sampleData);
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
      recordChange("schemaText", original.getSchemaText(), updated.getSchemaText());
      recordChange("schemaType", original.getSchemaType(), updated.getSchemaType());
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
  }
}
