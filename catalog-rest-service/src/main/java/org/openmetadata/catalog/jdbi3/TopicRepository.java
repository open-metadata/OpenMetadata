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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.MessagingServiceRepository.MessagingServiceDAO;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.resources.topics.TopicResource;
import org.openmetadata.catalog.resources.topics.TopicResource.TopicList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater;
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
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public abstract class TopicRepository {
  private static final Logger LOG = LoggerFactory.getLogger(TopicRepository.class);
  private static final Fields TOPIC_UPDATE_FIELDS = new Fields(TopicResource.FIELD_LIST, "owner,tags");
  private static final Fields TOPIC_PATCH_FIELDS = new Fields(TopicResource.FIELD_LIST, "owner,service,tags");

  public static String getFQN(Topic topic) {
    return (topic.getService().getName() + "." + topic.getName());
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
  public Topic create(Topic topic) throws IOException {
    validateRelationships(topic);
    return createInternal(topic);
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
  public PutResponse<Topic> createOrUpdate(Topic updated) throws IOException {
    validateRelationships(updated);
    Topic stored = JsonUtils.readValue(topicDAO().findByFQN(updated.getFullyQualifiedName()), Topic.class);
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
    return EntityUtil.populateOwner(userDAO(), teamDAO(), topic.getOwner());
  }

  public Topic createInternal(Topic topic) throws IOException {
    storeTopic(topic, false);
    addRelationships(topic);
    return topic;
  }

  private void validateRelationships(Topic topic) throws IOException {
    topic.setFullyQualifiedName(getFQN(topic));
    EntityUtil.populateOwner(userDAO(), teamDAO(), topic.getOwner()); // Validate owner
    getService(topic.getService());
    topic.setTags(EntityUtil.addDerivedTags(tagDAO(), topic.getTags()));
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
      topicDAO().update(topic.getId().toString(), JsonUtils.pojoToJson(topic));
    } else {
      topicDAO().insert(JsonUtils.pojoToJson(topic));
    }

    // Restore the relationships
    topic.withOwner(owner).withService(service).withTags(tags);
  }

  private void applyTags(Topic topic) throws IOException {
    // Add topic level tags by adding tag to topic relationship
    EntityUtil.applyTags(tagDAO(), topic.getTags(), topic.getFullyQualifiedName());
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
    return topic != null ? EntityUtil.populateOwner(topic.getId(), relationshipDAO(), userDAO(), teamDAO()) : null;
  }

  private void setOwner(Topic topic, EntityReference owner) {
    EntityUtil.setOwner(relationshipDAO(), topic.getId(), Entity.TOPIC, owner);
    topic.setOwner(owner);
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
  public class TopicUpdater extends EntityUpdater {
    final Topic orig;
    final Topic updated;

    public TopicUpdater(Topic orig, Topic updated, boolean patchOperation) {
      super(new TopicRepository.TopicEntityInterface(orig), new TopicRepository.TopicEntityInterface(updated), patchOperation, relationshipDAO(),
              tagDAO());
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
