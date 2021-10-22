/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.jdbi3;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.topics.TopicResource;
import org.openmetadata.catalog.resources.topics.TopicResource.TopicList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater3;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class TopicRepositoryHelper extends EntityRepository<Topic> {
  private static final Logger LOG = LoggerFactory.getLogger(TopicRepositoryHelper.class);
  private static final Fields TOPIC_UPDATE_FIELDS = new Fields(TopicResource.FIELD_LIST, "owner,tags");
  private static final Fields TOPIC_PATCH_FIELDS = new Fields(TopicResource.FIELD_LIST, "owner,service,tags");

  public static String getFQN(Topic topic) {
    return (topic.getService().getName() + "." + topic.getName());
  }

  public TopicRepositoryHelper(TopicRepository3 repo3) {
    super(repo3.topicDAO());
    this.repo3 = repo3;
  }

  private final TopicRepository3 repo3;

  @Transaction
  public ResultList<Topic> listAfter(Fields fields, String serviceName, int limitParam, String after) throws IOException,
          GeneralSecurityException, ParseException {
    return EntityUtil.listAfter(this, Topic.class, fields, serviceName, limitParam, after);
  }

  @Transaction
  public ResultList<Topic> listBefore(Fields fields, String serviceName, int limitParam, String before) throws IOException,
          GeneralSecurityException, ParseException {
    return EntityUtil.listBefore(this, Topic.class, fields, serviceName, limitParam, before);
  }

  @Transaction
  public Topic create(Topic topic) throws IOException {
    validateRelationships(topic);
    return createInternal(topic);
  }

  @Transaction
  public void delete(String id) {
    if (repo3.relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.TOPIC) > 0) {
      throw new IllegalArgumentException("Topic is not empty");
    }
    if (repo3.topicDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.TOPIC, id));
    }
    repo3.relationshipDAO().deleteAll(id);
  }

  @Transaction
  public PutResponse<Topic> createOrUpdate(Topic updated) throws IOException {
    validateRelationships(updated);
    Topic stored = JsonUtils.readValue(repo3.topicDAO().findJsonByFqn(updated.getFullyQualifiedName()), Topic.class);
    if (stored == null) {  // Topic does not exist. Create a new one
      return new PutResponse<>(Status.CREATED, createInternal(updated));
    }
    setFields(stored, TOPIC_UPDATE_FIELDS);
    updated.setId(stored.getId());

    TopicUpdater topicUpdater = new TopicUpdater(stored, updated, false);
    topicUpdater.updateAll();
    topicUpdater.store();
    return new PutResponse<>(Status.OK, updated);
  }

  @Transaction
  public Topic patch(String id, String user, JsonPatch patch) throws IOException {
    Topic original = setFields(validateTopic(id), TOPIC_PATCH_FIELDS);
    Topic updated = JsonUtils.applyPatch(original, patch, Topic.class);
    updated.withUpdatedBy(user).withUpdatedAt(new Date());
    patch(original, updated);
    return updated;
  }

  @Transaction
  public EntityReference getOwnerReference(Topic topic) throws IOException {
    return EntityUtil.populateOwner(repo3.userDAO(), repo3.teamDAO(), topic.getOwner());
  }

  public Topic createInternal(Topic topic) throws IOException {
    storeTopic(topic, false);
    addRelationships(topic);
    return topic;
  }

  private void validateRelationships(Topic topic) throws IOException {
    topic.setFullyQualifiedName(getFQN(topic));
    EntityUtil.populateOwner(repo3.userDAO(), repo3.teamDAO(), topic.getOwner()); // Validate owner
    getService(topic.getService());
    topic.setTags(EntityUtil.addDerivedTags(repo3.tagDAO(), topic.getTags()));
  }

  private void addRelationships(Topic topic) throws IOException {
    setService(topic, topic.getService());
    setOwner(topic, topic.getOwner());
    applyTags(topic);
  }

  private void storeTopic(Topic topic, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = topic.getOwner();
    List<TagLabel> tags = topic.getTags();
    EntityReference service = topic.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    topic.withOwner(null).withService(null).withHref(null).withTags(null);

    if (update) {
      repo3.topicDAO().update(topic.getId().toString(), JsonUtils.pojoToJson(topic));
    } else {
      repo3.topicDAO().insert(JsonUtils.pojoToJson(topic));
    }

    // Restore the relationships
    topic.withOwner(owner).withService(service).withTags(tags);
  }

  private void applyTags(Topic topic) throws IOException {
    // Add topic level tags by adding tag to topic relationship
    EntityUtil.applyTags(repo3.tagDAO(), topic.getTags(), topic.getFullyQualifiedName());
    topic.setTags(getTags(topic.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private void patch(Topic original, Topic updated) throws IOException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
            .withService(original.getService()).withId(original.getId());
    validateRelationships(updated);
    TopicUpdater topicUpdater = new TopicUpdater(original, updated, true);
    topicUpdater.updateAll();
    topicUpdater.store();
  }

  public EntityReference getOwner(Topic topic) throws IOException {
    return topic != null ? EntityUtil.populateOwner(topic.getId(), repo3.relationshipDAO(), repo3.userDAO(), repo3.teamDAO()) : null;
  }

  private void setOwner(Topic topic, EntityReference owner) {
    EntityUtil.setOwner(repo3.relationshipDAO(), topic.getId(), Entity.TOPIC, owner);
    topic.setOwner(owner);
  }

  private Topic validateTopic(String id) throws IOException {
    return repo3.topicDAO().findEntityById(id);
  }

  @Override
  public String getFullyQualifiedName(Topic entity) {
    return entity.getFullyQualifiedName();
  }

  @Override
  public Topic setFields(Topic topic, Fields fields) throws IOException {
    topic.setOwner(fields.contains("owner") ? getOwner(topic) : null);
    topic.setService(fields.contains("service") ? getService(topic) : null);
    topic.setFollowers(fields.contains("followers") ? getFollowers(topic) : null);
    topic.setTags(fields.contains("tags") ? getTags(topic.getFullyQualifiedName()) : null);
    return topic;
  }

  @Override
  public ResultList<Topic> getResultList(List<Topic> entities, String beforeCursor, String afterCursor, int total) throws GeneralSecurityException, UnsupportedEncodingException {
    return new TopicList(entities, beforeCursor, afterCursor, total);
  }

  private List<EntityReference> getFollowers(Topic topic) throws IOException {
    return topic == null ? null : EntityUtil.getFollowers(topic.getId(), repo3.relationshipDAO(), repo3.userDAO());
  }

  private List<TagLabel> getTags(String fqn) {
    return repo3.tagDAO().getTags(fqn);
  }

  private EntityReference getService(Topic topic) throws IOException {
    return topic == null ? null : getService(Objects.requireNonNull(EntityUtil.getService(repo3.relationshipDAO(),
            topic.getId())));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    String id = service.getId().toString();
    if (service.getType().equalsIgnoreCase(Entity.MESSAGING_SERVICE)) {
      MessagingService serviceInstance = repo3.messageServiceDAO().findEntityById(id);
      service.setDescription(serviceInstance.getDescription());
      service.setName(serviceInstance.getName());
    } else {
      throw new IllegalArgumentException(String.format("Invalid service type %s for the topic", service.getType()));
    }
    return service;
  }

  public void setService(Topic topic, EntityReference service) throws IOException {
    if (service != null && topic != null) {
      getService(service); // Populate service details
      repo3.relationshipDAO().insert(service.getId().toString(), topic.getId().toString(), service.getType(),
              Entity.TOPIC, Relationship.CONTAINS.ordinal());
      topic.setService(service);
    }
  }

  @Transaction
  public Status addFollower(String topicId, String userId) throws IOException {
    repo3.topicDAO().findEntityById(topicId);
    return EntityUtil.addFollower(repo3.relationshipDAO(), repo3.userDAO(), topicId, Entity.TOPIC, userId, Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void deleteFollower(String topicId, String userId) {
    EntityUtil.validateUser(repo3.userDAO(), userId);
    EntityUtil.removeFollower(repo3.relationshipDAO(), topicId, userId);
  }

  static class TopicEntityInterface implements EntityInterface {
    private final Topic topic;

    TopicEntityInterface(Topic Topic) {
      this.topic = Topic;
    }

    @Override
    public UUID getId() {
      return topic.getId();
    }

    @Override
    public String getDescription() {
      return topic.getDescription();
    }

    @Override
    public String getDisplayName() {
      return topic.getDisplayName();
    }

    @Override
    public EntityReference getOwner() {
      return topic.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return topic.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return topic.getTags();
    }

    @Override
    public void setDescription(String description) {
      topic.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      topic.setDisplayName(displayName);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      topic.setTags(tags);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class TopicUpdater extends EntityUpdater3 {
    final Topic orig;
    final Topic updated;

    public TopicUpdater(Topic orig, Topic updated, boolean patchOperation) {
      super(new TopicEntityInterface(orig), new TopicEntityInterface(updated), patchOperation, repo3.relationshipDAO(),
              repo3.tagDAO());
      this.orig = orig;
      this.updated = updated;
    }

    public void updateAll() throws IOException {
      super.updateAll();
    }

    public void store() throws IOException {
      updated.setVersion(getNewVersion(orig.getVersion()));
      storeTopic(updated, true);
    }
  }
}
