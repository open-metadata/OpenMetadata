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

package org.openmetadata.catalog.resources.topics;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateTopic;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.TopicRepository.TopicEntityInterface;
import org.openmetadata.catalog.resources.EntityTestHelper;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.resources.topics.TopicResource.TopicList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;
import org.openmetadata.common.utils.JsonSchemaUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.TestUtils.LONG_ENTITY_NAME;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.checkUserFollowing;
import static org.openmetadata.catalog.util.TestUtils.userAuthHeaders;

public class TopicResourceTest extends EntityTestHelper<Topic> {
  private static final Logger LOG = LoggerFactory.getLogger(TopicResourceTest.class);

  public TopicResourceTest() {
    super(Topic.class, "topics");
  }

  @Test
  public void post_topicWithLongName_400_badRequest(TestInfo test) {
    // Create topic with mandatory name field empty
    CreateTopic create = create(test).withName(LONG_ENTITY_NAME);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTopic(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_topicAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreateTopic create = create(test);
    createTopic(create, adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTopic(create, adminAuthHeaders()));
    assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validTopics_as_admin_200_OK(TestInfo test) throws HttpResponseException {
    // Create team with different optional fields
    CreateTopic create = create(test);
    createAndCheckEntity(create, adminAuthHeaders());

    create.withName(getTopicName(test, 1)).withDescription("description");
    Topic topic = createAndCheckEntity(create, adminAuthHeaders());
    String expectedFQN = KAFKA_REFERENCE.getName() + "." + topic.getName();
    assertEquals(expectedFQN, topic.getFullyQualifiedName());
  }

  @Test
  public void post_topicWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_topicWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_topic_as_non_admin_401(TestInfo test) {
    CreateTopic create = create(test);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTopic(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_topicWithoutRequiredFields_4xx(TestInfo test) {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTopic(create(test).withName(null), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name must not be null]");

    exception = assertThrows(HttpResponseException.class, () ->
            createTopic(create(test).withName(LONG_ENTITY_NAME), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");

    // Service is required field
    exception = assertThrows(HttpResponseException.class, () ->
            createTopic(create(test).withService(null), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[service must not be null]");

    // Partitions is required field
    exception = assertThrows(HttpResponseException.class, () ->
            createTopic(create(test).withPartitions(null), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[partitions must not be null]");

    // Partitions must be >= 1
    exception = assertThrows(HttpResponseException.class, () ->
            createTopic(create(test).withPartitions(0), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[partitions must be greater than or equal to 1]");
  }

  @Test
  public void post_topicWithInvalidOwnerType_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */

    CreateTopic create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTopic(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  }

  @Test
  public void post_topicWithNonExistentOwner_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(NON_EXISTENT_ENTITY).withType("user");
    CreateTopic create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTopic(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound("User", NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_topicWithDifferentService_200_ok(TestInfo test) throws HttpResponseException {
    EntityReference[] differentServices = {PULSAR_REFERENCE, KAFKA_REFERENCE};

    // Create topic for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(create(test).withService(service), adminAuthHeaders());

      // List topics by filtering on service name and ensure right topics are returned in the response
      TopicList list = listTopics("service", service.getName(), adminAuthHeaders());
      for (Topic topic : list.getData()) {
        assertEquals(service.getName(), topic.getService().getName());
      }
    }
  }

  @Test
  public void get_topicListWithInvalidLimitOffset_4xx() {
    // Limit must be >= 1 and <= 1000,000
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listTopics(null, null, -1, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listTopics(null, null, 0, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listTopics(null, null, 1000001, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  public void get_topicListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listTopics(null, null, 1, "", "", adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Only one of before or after query parameter allowed");
  }

  @Test
  public void get_topicListWithValidLimitOffset_4xx(TestInfo test) throws HttpResponseException {
    // Create a large number of topics
    int maxTopics = 40;
    for (int i = 0; i < maxTopics; i++) {
      createTopic(create(test, i), adminAuthHeaders());
    }

    // List all topics
    TopicList allTopics = listTopics(null, null, 1000000, null,
            null, adminAuthHeaders());
    int totalRecords = allTopics.getData().size();
    printTopics(allTopics);

    // List limit number topics at a time at various offsets and ensure right results are returned
    for (int limit = 1; limit < maxTopics; limit++) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllTopics = 0;
      TopicList forwardPage;
      TopicList backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        LOG.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
        forwardPage = listTopics(null, null, limit, null, after, adminAuthHeaders());
        printTopics(forwardPage);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allTopics.getData(), forwardPage, limit, indexInAllTopics);

        if (pageCount == 0) {  // CASE 0 - First page is being returned. There is no before cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = listTopics(null, null, limit, before, null, adminAuthHeaders());
          assertEntityPagination(allTopics.getData(), backwardPage, limit, (indexInAllTopics - limit));
        }

        indexInAllTopics += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllTopics = totalRecords - limit - forwardPage.getData().size();
      do {
        LOG.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
        forwardPage = listTopics(null, null, limit, before, null, adminAuthHeaders());
        printTopics(forwardPage);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allTopics.getData(), forwardPage, limit, indexInAllTopics);
        pageCount++;
        indexInAllTopics -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  private void printTopics(TopicList list) {
    list.getData().forEach(topic -> LOG.info("Topic {}", topic.getFullyQualifiedName()));
    LOG.info("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }


  @Test
  public void get_nonExistentTopic_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getTopic(NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND,
            entityNotFound(Entity.TOPIC, NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_topicWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateTopic create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(KAFKA_REFERENCE);
    Topic topic = createAndCheckEntity(create, adminAuthHeaders());
    validateGetWithDifferentFields(topic, false);
  }

  @Test
  public void get_topicByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateTopic create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(KAFKA_REFERENCE);
    Topic topic = createAndCheckEntity(create, adminAuthHeaders());
    validateGetWithDifferentFields(topic, true);
  }

  @Test
  public void patch_topicAttributes_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create topic without description, owner
    Topic topic = createTopic(create(test), adminAuthHeaders());
    assertNull(topic.getDescription());
    assertNull(topic.getOwner());
    assertNotNull(topic.getService());
    List<TagLabel> topicTags = List.of(TIER1_TAG_LABEL);

    topic = getTopic(topic.getId(), "service,owner,tags", adminAuthHeaders());
    topic.getService().setHref(null); // href is readonly and not patchable

    // Add description, owner when previously they were null
    topic = patchTopicAttributesAndCheck(topic, "description", TEAM_OWNER1, topicTags,
            adminAuthHeaders(), MINOR_UPDATE);
    topic.setOwner(TEAM_OWNER1); // Get rid of href and name returned in the response for owner
    topic.setService(KAFKA_REFERENCE); // Get rid of href and name returned in the response for service
    topic.setTags(topicTags);
    topicTags = List.of(TIER2_TAG_LABEL);

    // Replace description, tier, owner
    topic = patchTopicAttributesAndCheck(topic, "description1", USER_OWNER1, topicTags,
            adminAuthHeaders(), MINOR_UPDATE);
    topic.setOwner(USER_OWNER1); // Get rid of href and name returned in the response for owner
    topic.setService(PULSAR_REFERENCE); // Get rid of href and name returned in the response for service

    // Remove description, tier, owner
    patchTopicAttributesAndCheck(topic, null, null, topicTags, adminAuthHeaders(), MINOR_UPDATE);
  }

  @Test
  public void delete_emptyTopic_200_ok(TestInfo test) throws HttpResponseException {
    Topic topic = createTopic(create(test), adminAuthHeaders());
    deleteTopic(topic.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonEmptyTopic_4xx() {
    // TODO
  }

  @Test
  public void put_addDeleteFollower_200(TestInfo test) throws HttpResponseException {
    Topic topic = createAndCheckEntity(create(test), adminAuthHeaders());

    // Add follower to the table
    User user1 = UserResourceTest.createUser(UserResourceTest.create(test, 1), userAuthHeaders());
    addAndCheckFollower(topic, user1.getId(), CREATED, 1, userAuthHeaders());

    // Add the same user as follower and make sure no errors are thrown and return response is OK (and not CREATED)
    addAndCheckFollower(topic, user1.getId(), OK, 1, userAuthHeaders());

    // Add a new follower to the table
    User user2 = UserResourceTest.createUser(UserResourceTest.create(test, 2), userAuthHeaders());
    addAndCheckFollower(topic, user2.getId(), CREATED, 2, userAuthHeaders());

    // Delete followers and make sure they are deleted
    deleteAndCheckFollower(topic, user1.getId(), 1, userAuthHeaders());
    deleteAndCheckFollower(topic, user2.getId(), 0, userAuthHeaders());
  }

  @Test
  public void put_addDeleteInvalidFollower_200(TestInfo test) throws HttpResponseException {
    Topic topic = createAndCheckEntity(create(test), adminAuthHeaders());

    // Add non existent user as follower to the table
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            addAndCheckFollower(topic, NON_EXISTENT_ENTITY, CREATED, 1, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", NON_EXISTENT_ENTITY));

    // Delete non existent user as follower to the table
    exception = assertThrows(HttpResponseException.class, () ->
            deleteAndCheckFollower(topic, NON_EXISTENT_ENTITY, 1, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", NON_EXISTENT_ENTITY));
  }


  @Test
  public void delete_nonExistentTopic_404() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteTopic(NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.TOPIC, NON_EXISTENT_ENTITY));
  }

  public static Topic createTopic(CreateTopic create,
                                  Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("topics"), create, Topic.class, authHeaders);
  }

  /**
   * Validate returned fields GET .../topics/{id}?fields="..." or GET .../topics/name/{fqn}?fields="..."
   */
  private void validateGetWithDifferentFields(Topic topic, boolean byName) throws HttpResponseException {
    // .../topics?fields=owner
    String fields = "owner";
    topic = byName ? getTopicByName(topic.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getTopic(topic.getId(), fields, adminAuthHeaders());
    assertNotNull(topic.getOwner());
    assertNotNull(topic.getService()); // We always return the service

    // .../topics?fields=owner,service
    fields = "owner,service";
    topic = byName ? getTopicByName(topic.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getTopic(topic.getId(), fields, adminAuthHeaders());
    assertNotNull(topic.getOwner());
    assertNotNull(topic.getService());

    // .../topics?fields=owner,service
    fields = "owner,service";
    topic = byName ? getTopicByName(topic.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getTopic(topic.getId(), fields, adminAuthHeaders());
    assertNotNull(topic.getOwner());
    assertNotNull(topic.getService());
  }

  private static Topic validateTopic(Topic topic, String expectedDescription, EntityReference expectedOwner,
                                     EntityReference expectedService, List<TagLabel> expectedTags,
                                     String expectedUpdatedBy)
          throws HttpResponseException {
    assertNotNull(topic.getId());
    assertNotNull(topic.getHref());
    assertEquals(expectedDescription, topic.getDescription());
    assertEquals(expectedUpdatedBy, topic.getUpdatedBy());

    // Validate owner
    if (expectedOwner != null) {
      TestUtils.validateEntityReference(topic.getOwner());
      assertEquals(expectedOwner.getId(), topic.getOwner().getId());
      assertEquals(expectedOwner.getType(), topic.getOwner().getType());
      assertNotNull(topic.getOwner().getHref());
    }

    // Validate service
    if (expectedService != null) {
      TestUtils.validateEntityReference(topic.getService());
      assertEquals(expectedService.getId(), topic.getService().getId());
      assertEquals(expectedService.getType(), topic.getService().getType());
    }
    TestUtils.validateTags(topic.getFullyQualifiedName(), expectedTags, topic.getTags());
    return topic;
  }

  private Topic patchTopicAttributesAndCheck(Topic before, String newDescription,
                                             EntityReference newOwner,
                                             List<TagLabel> tags,
                                             Map<String, String> authHeaders,
                                             UpdateType updateType)
          throws JsonProcessingException, HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    String topicJson = JsonUtils.pojoToJson(before);

    // Update the topic attributes
    before.setDescription(newDescription);
    before.setOwner(newOwner);
    before.setTags(tags);

    // Validate information returned in patch response has the updates
    Topic updateTopic = patchTopic(topicJson, before, authHeaders);
    validateTopic(updateTopic, before.getDescription(), newOwner, null, tags, updatedBy);
    TestUtils.validateUpdate(before.getVersion(), updateTopic.getVersion(), updateType);

    // GET the topic and Validate information returned
    Topic getTopic = getTopic(before.getId(), "service,owner,tags", authHeaders);
    validateTopic(getTopic, before.getDescription(), newOwner, null, tags, updatedBy);
    return updateTopic;
  }

  private Topic patchTopic(UUID topicId, String originalJson, Topic updatedTopic,
                           Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String updateTopicJson = JsonUtils.pojoToJson(updatedTopic);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updateTopicJson);
    return TestUtils.patch(getResource("topics/" + topicId), patch, Topic.class, authHeaders);
  }

  private Topic patchTopic(String originalJson,
                           Topic updatedTopic,
                           Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    return patchTopic(updatedTopic.getId(), originalJson, updatedTopic, authHeaders);
  }

  public static void getTopic(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    getTopic(id, null, authHeaders);
  }

  public static Topic getTopic(UUID id, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("topics/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Topic.class, authHeaders);
  }

  public static Topic getTopicByName(String fqn, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("topics/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Topic.class, authHeaders);
  }

  public static TopicList listTopics(String fields, String serviceParam, Map<String, String> authHeaders)
          throws HttpResponseException {
    return listTopics(fields, serviceParam, null, null, null, authHeaders);
  }

  public static TopicList listTopics(String fields, String serviceParam, Integer limitParam,
                                     String before, String after, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("topics");
    target = fields != null ? target.queryParam("fields", fields) : target;
    target = serviceParam != null ? target.queryParam("service", serviceParam) : target;
    target = limitParam != null ? target.queryParam("limit", limitParam) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, TopicList.class, authHeaders);
  }

  private void deleteTopic(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(getResource("topics/" + id), authHeaders);

    // Ensure deleted topic does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getTopic(id, authHeaders));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.TOPIC, id));
  }

  public static String getTopicName(TestInfo test) {
    return String.format("topic_%s", test.getDisplayName());
  }

  public static String getTopicName(TestInfo test, int index) {
    return String.format("topic%d_%s", index, test.getDisplayName());
  }

  public static CreateTopic create(TestInfo test) {
    return new CreateTopic().withName(getTopicName(test)).withService(KAFKA_REFERENCE).
            withPartitions(1);
  }

  public static CreateTopic create(TestInfo test, int index) {
    return new CreateTopic().withName(getTopicName(test, index)).withService(KAFKA_REFERENCE).withPartitions(1);
  }

  public static void addAndCheckFollower(Topic topic, UUID userId, Status status, int totalFollowerCount,
                                         Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource(String.format("topics/%s/followers", topic.getId()));
    TestUtils.put(target, userId.toString(), status, authHeaders);

    // GET .../topics/{topicId} returns newly added follower
    Topic getTopic = getTopic(topic.getId(), "followers", authHeaders);
    assertEquals(totalFollowerCount, getTopic.getFollowers().size());
    TestUtils.validateEntityReference(getTopic.getFollowers());
    boolean followerFound = false;
    for (EntityReference followers : getTopic.getFollowers()) {
      if (followers.getId().equals(userId)) {
        followerFound = true;
        break;
      }
    }
    assertTrue(followerFound, "Follower added was not found in topic get response");

    // GET .../users/{userId} shows user as following table
    checkUserFollowing(userId, topic.getId(), true, authHeaders);
  }

  private void deleteAndCheckFollower(Topic topic, UUID userId, int totalFollowerCount,
                                      Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource(String.format("topics/%s/followers/%s",
            topic.getId(), userId));
    TestUtils.delete(target, authHeaders);

    Topic getTopic = checkFollowerDeleted(topic.getId(), userId, authHeaders);
    assertEquals(totalFollowerCount, getTopic.getFollowers().size());
  }

  public static Topic checkFollowerDeleted(UUID topicId, UUID userId, Map<String, String> authHeaders)
          throws HttpResponseException {
    Topic getTopic = getTopic(topicId, "followers", authHeaders);
    TestUtils.validateEntityReference(getTopic.getFollowers());
    boolean followerFound = false;
    for (EntityReference followers : getTopic.getFollowers()) {
      if (followers.getId().equals(userId)) {
        followerFound = true;
        break;
      }
    }
    assertFalse(followerFound, "Follower deleted is still found in table get response");

    // GET .../users/{userId} shows user as following table
    checkUserFollowing(userId, topicId, false, authHeaders);
    return getTopic;
  }

  @Override
  public CreateTopic createRequest(TestInfo test, String description, String displayName, EntityReference owner) {
    return create(test).withDescription(description).withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(Topic topic, Object request, Map<String, String> authHeaders) throws HttpResponseException {
    CreateTopic createRequest = (CreateTopic) request;
    validateCommonEntityFields(getEntityInterface(topic), createRequest.getDescription(),
            TestUtils.getPrincipal(authHeaders), createRequest.getOwner());
    assertService(createRequest.getService(), topic.getService());
    TestUtils.validateTags(topic.getFullyQualifiedName(), createRequest.getTags(), topic.getTags());
  }

  @Override
  public void validateUpdatedEntity(Topic topic, Object request, Map<String, String> authHeaders) throws HttpResponseException {
    validateCreatedEntity(topic, request, authHeaders);
  }

  @Override
  public void validatePatchedEntity(Topic expected, Topic updated, Map<String, String> authHeaders) throws HttpResponseException {
    validateCommonEntityFields(getEntityInterface(updated), expected.getDescription(),
            TestUtils.getPrincipal(authHeaders), expected.getOwner());
    assertService(expected.getService(), expected.getService());
    TestUtils.validateTags(expected.getFullyQualifiedName(), expected.getTags(), expected.getTags());
  }

  @Override
  public Topic getEntity(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(id);
    target = target.queryParam("fields", TopicResource.FIELDS);
    return TestUtils.get(target, Topic.class, authHeaders);
  }

  @Override
  public EntityInterface<Topic> getEntityInterface(Topic entity) {
    return new TopicEntityInterface(entity);
  }
}
