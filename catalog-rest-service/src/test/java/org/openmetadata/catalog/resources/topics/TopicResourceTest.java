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

import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateTopic;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.TopicRepository.TopicEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.topics.TopicResource.TopicList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

import javax.ws.rs.client.WebTarget;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.TestUtils.LONG_ENTITY_NAME;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class TopicResourceTest extends EntityResourceTest<Topic> {

  public TopicResourceTest() {
    super(Topic.class, TopicList.class, "topics", TopicResource.FIELDS, true, true, true);
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
      Map<String, String> queryParams = new HashMap<>(){{put("service", service.getName());}};
      ResultList<Topic> list = listEntities(queryParams, adminAuthHeaders());
      for (Topic topic : list.getData()) {
        assertEquals(service.getName(), topic.getService().getName());
      }
    }
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
  public void delete_emptyTopic_200_ok(TestInfo test) throws HttpResponseException {
    Topic topic = createTopic(create(test), adminAuthHeaders());
    deleteTopic(topic.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonEmptyTopic_4xx() {
    // TODO
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

  @Override
  public CreateTopic createRequest(TestInfo test, int index, String description, String displayName,
                                   EntityReference owner) {
    return create(test, index).withDescription(description).withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(Topic topic, Object request, Map<String, String> authHeaders) throws HttpResponseException {
    CreateTopic createRequest = (CreateTopic) request;
    validateCommonEntityFields(getEntityInterface(topic), createRequest.getDescription(),
            TestUtils.getPrincipal(authHeaders), createRequest.getOwner());
    assertService(createRequest.getService(), topic.getService());
    TestUtils.assertTags(topic.getFullyQualifiedName(), createRequest.getTags(), topic.getTags());
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
    TestUtils.assertTags(expected.getFullyQualifiedName(), expected.getTags(), updated.getTags());
  }

  @Override
  public EntityInterface<Topic> getEntityInterface(Topic entity) {
    return new TopicEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
