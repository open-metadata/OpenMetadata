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
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;

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

public class TopicRepository extends EntityRepository<Topic> {
  private static final Fields TOPIC_UPDATE_FIELDS = new Fields(TopicResource.FIELD_LIST, "owner,tags");
  private static final Fields TOPIC_PATCH_FIELDS = new Fields(TopicResource.FIELD_LIST, "owner,service,tags");
  private final CollectionDAO dao;

  public static String getFQN(Topic topic) {
    return (topic.getService().getName() + "." + topic.getName());
  }

  public TopicRepository(CollectionDAO dao) {
    super(Topic.class, dao.topicDAO(), dao, TOPIC_PATCH_FIELDS, TOPIC_UPDATE_FIELDS);
    this.dao = dao;
  }

  @Transaction
  public void delete(UUID id) {
    if (dao.relationshipDAO().findToCount(id.toString(), Relationship.CONTAINS.ordinal(), Entity.TOPIC) > 0) {
      throw new IllegalArgumentException("Topic is not empty");
    }
    if (dao.topicDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.TOPIC, id));
    }
    dao.relationshipDAO().deleteAll(id.toString());
  }

  @Transaction
  public EntityReference getOwnerReference(Topic topic) throws IOException {
    return EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), topic.getOwner());
  }

  @Override
  public void validate(Topic topic) throws IOException {
    topic.setFullyQualifiedName(getFQN(topic));
    EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), topic.getOwner()); // Validate owner
    getService(topic.getService());
    topic.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), topic.getTags()));
  }

  @Override
  public void store(Topic topic, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = topic.getOwner();
    List<TagLabel> tags = topic.getTags();
    EntityReference service = topic.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    topic.withOwner(null).withService(null).withHref(null).withTags(null);

    if (update) {
      dao.topicDAO().update(topic.getId(), JsonUtils.pojoToJson(topic));
    } else {
      dao.topicDAO().insert(topic);
    }

    // Restore the relationships
    topic.withOwner(owner).withService(service).withTags(tags);
  }

  @Override
  public void storeRelationships(Topic topic) throws IOException {
    setService(topic, topic.getService());
    setOwner(topic, topic.getOwner());
    applyTags(topic);
  }

  private void applyTags(Topic topic) throws IOException {
    // Add topic level tags by adding tag to topic relationship
    EntityUtil.applyTags(dao.tagDAO(), topic.getTags(), topic.getFullyQualifiedName());
    topic.setTags(getTags(topic.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  public EntityReference getOwner(Topic topic) throws IOException {
    return topic != null ? EntityUtil.populateOwner(topic.getId(), dao.relationshipDAO(), dao.userDAO(),
            dao.teamDAO()) : null;
  }

  private void setOwner(Topic topic, EntityReference owner) {
    EntityUtil.setOwner(dao.relationshipDAO(), topic.getId(), Entity.TOPIC, owner);
    topic.setOwner(owner);
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
  public void restorePatchAttributes(Topic original, Topic updated) throws IOException, ParseException {

  }

  @Override
  public ResultList<Topic> getResultList(List<Topic> entities, String beforeCursor, String afterCursor, int total) throws GeneralSecurityException, UnsupportedEncodingException {
    return new TopicList(entities, beforeCursor, afterCursor, total);
  }

  @Override
  public EntityInterface<Topic> getEntityInterface(Topic entity) {
    return new TopicEntityInterface(entity);
  }

  private List<EntityReference> getFollowers(Topic topic) throws IOException {
    return topic == null ? null : EntityUtil.getFollowers(topic.getId(), dao.relationshipDAO(), dao.userDAO());
  }

  private List<TagLabel> getTags(String fqn) {
    return dao.tagDAO().getTags(fqn);
  }

  private EntityReference getService(Topic topic) throws IOException {
    return topic == null ? null : getService(Objects.requireNonNull(EntityUtil.getService(dao.relationshipDAO(),
            topic.getId())));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    if (service.getType().equalsIgnoreCase(Entity.MESSAGING_SERVICE)) {
      MessagingService serviceInstance = dao.messagingServiceDAO().findEntityById(service.getId());
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
      dao.relationshipDAO().insert(service.getId().toString(), topic.getId().toString(), service.getType(),
              Entity.TOPIC, Relationship.CONTAINS.ordinal());
      topic.setService(service);
    }
  }

  @Transaction
  public Status addFollower(UUID topicId, UUID userId) throws IOException {
    dao.topicDAO().findEntityById(topicId);
    return EntityUtil.addFollower(dao.relationshipDAO(), dao.userDAO(), topicId, Entity.TOPIC, userId, Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void deleteFollower(UUID topicId, UUID userId) {
    EntityUtil.validateUser(dao.userDAO(), userId);
    EntityUtil.removeFollower(dao.relationshipDAO(), topicId, userId);
  }

  static class TopicEntityInterface implements EntityInterface<Topic> {
    private final Topic entity;

    TopicEntityInterface(Topic entity) {
      this.entity = entity;
    }

    @Override
    public UUID getId() {
      return entity.getId();
    }

    @Override
    public String getDescription() {
      return entity.getDescription();
    }

    @Override
    public String getDisplayName() {
      return entity.getDisplayName();
    }

    @Override
    public EntityReference getOwner() {
      return entity.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return entity.getTags();
    }

    @Override
    public Double getVersion() { return entity.getVersion(); }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.TOPIC);
    }

    @Override
    public Topic getEntity() { return entity; }

    @Override
    public void setId(UUID id) { entity.setId(id);
    }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setVersion(Double version) { entity.setVersion(version); }

    @Override
    public void setUpdatedBy(String user) { entity.setUpdatedBy(user); }

    @Override
    public void setUpdatedAt(Date date) { entity.setUpdatedAt(date); }

    @Override
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }
}
