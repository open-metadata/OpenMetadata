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

import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.MessagingServiceRepository.MessagingServiceDAO;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.resources.topics.TopicResource;
import org.openmetadata.catalog.resources.topics.TopicResource.TopicList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.common.utils.CipherText;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Objects;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public abstract class TopicRepository {
  private static final Logger LOG = LoggerFactory.getLogger(TopicRepository.class);
  private static final Fields TOPIC_UPDATE_FIELDS = new Fields(TopicResource.FIELD_LIST, "owner,tags");
  private static final Fields TOPIC_PATCH_FIELDS = new Fields(TopicResource.FIELD_LIST, "owner,service,tags");

  public static String getFQN(EntityReference service, Topic topic) {
    return (service.getName() + "." + topic.getName());
  }

  @CreateSqlObject
  abstract TopicDAO topicDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract MessagingServiceDAO messageServiceDAO();

  @CreateSqlObject
  abstract TagRepository.TagDAO tagDAO();

  @Transaction
  public TopicList listAfter(Fields fields, String serviceName, int limitParam, String after) throws IOException,
          GeneralSecurityException {
    // forward scrolling, if after == null then first page is being asked being asked
    List<String> jsons = topicDAO().listAfter(serviceName, limitParam + 1, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<Topic> topics = new ArrayList<>();
    for (String json : jsons) {
      topics.add(setFields(JsonUtils.readValue(json, Topic.class), fields));
    }
    int total = topicDAO().listCount(serviceName);

    String beforeCursor, afterCursor = null;
    beforeCursor = after == null ? null : topics.get(0).getFullyQualifiedName();
    if (topics.size() > limitParam) { // If extra result exists, then next page exists - return after cursor
      topics.remove(limitParam);
      afterCursor = topics.get(limitParam - 1).getFullyQualifiedName();
    }
    return new TopicList(topics, beforeCursor, afterCursor, total);
  }

  @Transaction
  public TopicList listBefore(Fields fields, String serviceName, int limitParam, String before) throws IOException,
          GeneralSecurityException {
    // Reverse scrolling - Get one extra result used for computing before cursor
    List<String> jsons = topicDAO().listBefore(serviceName, limitParam + 1, CipherText.instance().decrypt(before));
    List<Topic> topics = new ArrayList<>();
    for (String json : jsons) {
      topics.add(setFields(JsonUtils.readValue(json, Topic.class), fields));
    }
    int total = topicDAO().listCount(serviceName);

    String beforeCursor = null, afterCursor;
    if (topics.size() > limitParam) { // If extra result exists, then previous page exists - return before cursor
      topics.remove(0);
      beforeCursor = topics.get(0).getFullyQualifiedName();
    }
    afterCursor = topics.get(topics.size() - 1).getFullyQualifiedName();
    return new TopicList(topics, beforeCursor, afterCursor, total);
  }

  @Transaction
  public Topic get(String id, Fields fields) throws IOException {
    return setFields(validateTopic(id), fields);
  }

  @Transaction
  public Topic getByName(String fqn, Fields fields) throws IOException {
    Topic topic = EntityUtil.validate(fqn, topicDAO().findByFQN(fqn), Topic.class);
    return setFields(topic, fields);
  }

  @Transaction
  public Topic create(Topic topic, EntityReference service, EntityReference owner) throws IOException {
    getService(service); // Validate service
    return createInternal(topic, service, owner);
  }

  @Transaction
  public void delete(String id) {
    if (relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.TOPIC) > 0) {
      throw new IllegalArgumentException("Topic is not empty");
    }
    if (topicDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.TOPIC, id));
    }
    relationshipDAO().deleteAll(id);
  }

  @Transaction
  public PutResponse<Topic> createOrUpdate(Topic updatedTopic, EntityReference service, EntityReference newOwner)
          throws IOException {
    getService(service); // Validate service

    String fqn = getFQN(service, updatedTopic);
    Topic storedDB = JsonUtils.readValue(topicDAO().findByFQN(fqn), Topic.class);
    if (storedDB == null) {  // Topic does not exist. Create a new one
      return new PutResponse<>(Status.CREATED, createInternal(updatedTopic, service, newOwner));
    }
    // Update the existing topic
    EntityUtil.populateOwner(userDAO(), teamDAO(), newOwner); // Validate new owner
    if (storedDB.getDescription() == null || storedDB.getDescription().isEmpty()) {
      storedDB.withDescription(updatedTopic.getDescription());
    }
    topicDAO().update(storedDB.getId().toString(), JsonUtils.pojoToJson(storedDB));

    // Update owner relationship
    setFields(storedDB, TOPIC_UPDATE_FIELDS); // First get the ownership information
    updateOwner(storedDB, storedDB.getOwner(), newOwner);

    // Service can't be changed in update since service name is part of FQN and
    // change to a different service will result in a different FQN and creation of a new topic under the new service
    storedDB.setService(service);
    applyTags(updatedTopic);

    return new PutResponse<>(Status.OK, storedDB);
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
    return EntityUtil.populateOwner(userDAO(), teamDAO(), topic.getOwner());
  }

  public Topic createInternal(Topic topic, EntityReference service, EntityReference owner) throws IOException {
    topic.setFullyQualifiedName(getFQN(service, topic));
    EntityUtil.populateOwner(userDAO(), teamDAO(), owner); // Validate owner

    // Query 1 - insert topic into topic_entity table
    topicDAO().insert(JsonUtils.pojoToJson(topic));
    setService(topic, service);
    setOwner(topic, owner);
    applyTags(topic);
    return topic;
  }

  private void applyTags(Topic topic) throws IOException {
    // Add topic level tags by adding tag to topic relationship
    EntityUtil.applyTags(tagDAO(), topic.getTags(), topic.getFullyQualifiedName());
    topic.setTags(getTags(topic.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private void patch(Topic original, Topic updated) throws IOException {
    String topicId = original.getId().toString();
    if (!original.getId().equals(updated.getId())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.TOPIC, "id"));
    }
    if (!original.getName().equals(updated.getName())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.TOPIC, "name"));
    }
    if (updated.getService() == null || !original.getService().getId().equals(updated.getService().getId())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.TOPIC, "service"));
    }
    // Validate new owner
    EntityReference newOwner = EntityUtil.populateOwner(userDAO(), teamDAO(), updated.getOwner());

    EntityReference newService = updated.getService();

    updated.setHref(null);
    updated.setOwner(null);
    updated.setService(null);
    // Remove previous tags.
    EntityUtil.removeTags(tagDAO(), original.getFullyQualifiedName());

    topicDAO().update(topicId, JsonUtils.pojoToJson(updated));
    updateOwner(updated, original.getOwner(), newOwner);
    updated.setService(newService);
    applyTags(updated);
  }

  public EntityReference getOwner(Topic topic) throws IOException {
    return topic != null ? EntityUtil.populateOwner(topic.getId(), relationshipDAO(), userDAO(), teamDAO()) : null;
  }

  private void setOwner(Topic topic, EntityReference owner) {
    EntityUtil.setOwner(relationshipDAO(), topic.getId(), Entity.TOPIC, owner);
    topic.setOwner(owner);
  }

  private void updateOwner(Topic topic, EntityReference origOwner, EntityReference newOwner) {
    EntityUtil.updateOwner(relationshipDAO(), origOwner, newOwner, topic.getId(), Entity.TOPIC);
    topic.setOwner(newOwner);
  }

  private Topic validateTopic(String id) throws IOException {
    return EntityUtil.validate(id, topicDAO().findById(id), Topic.class);
  }

  private Topic setFields(Topic topic, Fields fields) throws IOException {
    topic.setOwner(fields.contains("owner") ? getOwner(topic) : null);
    topic.setService(fields.contains("service") ? getService(topic) : null);
    topic.setFollowers(fields.contains("followers") ? getFollowers(topic) : null);
    topic.setTags(fields.contains("tags") ? getTags(topic.getFullyQualifiedName()) : null);
    return topic;
  }

  private List<EntityReference> getFollowers(Topic topic) throws IOException {
    return topic == null ? null : EntityUtil.getFollowers(topic.getId(), relationshipDAO(), userDAO());
  }

  private List<TagLabel> getTags(String fqn) {
    return tagDAO().getTags(fqn);
  }

  private EntityReference getService(Topic topic) throws IOException {
    return topic == null ? null : getService(Objects.requireNonNull(EntityUtil.getService(relationshipDAO(),
            topic.getId())));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    String id = service.getId().toString();
    if (service.getType().equalsIgnoreCase(Entity.MESSAGING_SERVICE)) {
      MessagingService serviceInstance = EntityUtil.validate(id, messageServiceDAO().findById(id),
              MessagingService.class);
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
      relationshipDAO().insert(service.getId().toString(), topic.getId().toString(), service.getType(),
              Entity.TOPIC, Relationship.CONTAINS.ordinal());
      topic.setService(service);
    }
  }

  @Transaction
  public Status addFollower(String topicId, String userId) throws IOException {
    EntityUtil.validate(topicId, topicDAO().findById(topicId), Topic.class);
    return EntityUtil.addFollower(relationshipDAO(), userDAO(), topicId, Entity.TOPIC, userId, Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void deleteFollower(String topicId, String userId) {
    EntityUtil.validateUser(userDAO(), userId);
    EntityUtil.removeFollower(relationshipDAO(), topicId, userId);
  }

  public interface TopicDAO {
    @SqlUpdate("INSERT INTO topic_entity (json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE topic_entity SET  json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM topic_entity WHERE fullyQualifiedName = :name")
    String findByFQN(@Bind("name") String name);

    @SqlQuery("SELECT json FROM topic_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT count(*) FROM topic_entity WHERE " +
              "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL)") // Filter by service name
    int listCount(@Bind("fqnPrefix") String fqnPrefix);

    @SqlQuery(
            "SELECT json FROM (" +
                    "SELECT fullyQualifiedName, json FROM topic_entity WHERE " +
                    "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +// Filter by
                    // service name
                    "fullyQualifiedName < :before " + // Pagination by topic fullyQualifiedName
                    "ORDER BY fullyQualifiedName DESC " + // Pagination ordering by topic fullyQualifiedName
                    "LIMIT :limit" +
                    ") last_rows_subquery ORDER BY fullyQualifiedName")
    List<String> listBefore(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                            @Bind("before") String before);

    @SqlQuery("SELECT json FROM topic_entity WHERE " +
            "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +
            "fullyQualifiedName > :after " +
            "ORDER BY fullyQualifiedName " +
            "LIMIT :limit")
    List<String> listAfter(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                           @Bind("after") String after);

    @SqlQuery("SELECT EXISTS (SELECT * FROM topic_entity WHERE id = :id)")
    boolean exists(@Bind("id") String id);

    @SqlUpdate("DELETE FROM topic_entity WHERE id = :id")
    int delete(@Bind("id") String id);
  }
}
