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

package org.openmetadata.catalog.resources.topics;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateTopic;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.jdbi3.TopicRepository.TopicEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.topics.TopicResource.TopicList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

public class TopicResourceTest extends EntityResourceTest<Topic> {

  public TopicResourceTest() {
    super(Entity.TOPIC, Topic.class, TopicList.class, "topics", TopicResource.FIELDS, true, true, true);
  }

  @Test
  public void post_validTopics_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateTopic create = create(test);
    createAndCheckEntity(create, adminAuthHeaders());

    create.withName(getEntityName(test, 1)).withDescription("description");
    Topic topic = createAndCheckEntity(create, adminAuthHeaders());
    String expectedFQN = KAFKA_REFERENCE.getName() + "." + topic.getName();
    assertEquals(expectedFQN, topic.getFullyQualifiedName());
  }

  @Test
  public void post_topicWithUserOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_topicWithTeamOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_topic_as_non_admin_401(TestInfo test) {
    CreateTopic create = create(test);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createTopic(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_topicWithoutRequiredFields_4xx(TestInfo test) {
    // Service is required field
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class, () -> createTopic(create(test).withService(null), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[service must not be null]");

    // Partitions is required field
    exception =
        assertThrows(
            HttpResponseException.class, () -> createTopic(create(test).withPartitions(null), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[partitions must not be null]");

    // Partitions must be >= 1
    exception =
        assertThrows(
            HttpResponseException.class, () -> createTopic(create(test).withPartitions(0), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[partitions must be greater than or equal to 1]");
  }

  @Test
  public void post_topicWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {PULSAR_REFERENCE, KAFKA_REFERENCE};

    // Create topic for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(create(test).withService(service), adminAuthHeaders());

      // List topics by filtering on service name and ensure right topics in the response
      Map<String, String> queryParams =
          new HashMap<>() {
            {
              put("service", service.getName());
            }
          };
      ResultList<Topic> list = listEntities(queryParams, adminAuthHeaders());
      for (Topic topic : list.getData()) {
        assertEquals(service.getName(), topic.getService().getName());
      }
    }
  }

  @Test
  public void delete_emptyTopic_200_ok(TestInfo test) throws HttpResponseException {
    Topic topic = createTopic(create(test), adminAuthHeaders());
    deleteEntity(topic.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonEmptyTopic_4xx() {
    // TODO
  }

  public static Topic createTopic(CreateTopic create, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("topics"), create, Topic.class, authHeaders);
  }

  /** Validate returned fields GET .../topics/{id}?fields="..." or GET .../topics/name/{fqn}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Topic topic, boolean byName) throws HttpResponseException {
    // .../topics?fields=owner
    String fields = "owner";
    topic =
        byName
            ? getTopicByName(topic.getFullyQualifiedName(), fields, adminAuthHeaders())
            : getTopic(topic.getId(), fields, adminAuthHeaders());
    assertListNotNull(topic.getOwner(), topic.getService(), topic.getServiceType());
  }

  public static Topic getTopic(UUID id, String fields, Map<String, String> authHeaders) throws HttpResponseException {
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

  private CreateTopic create(TestInfo test) {
    return create(getEntityName(test));
  }

  private CreateTopic create(String entityName) {
    return new CreateTopic().withName(entityName).withService(KAFKA_REFERENCE).withPartitions(1);
  }

  @Override
  public CreateTopic createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name).withDescription(description).withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(Topic topic, Object request, Map<String, String> authHeaders)
      throws HttpResponseException {
    CreateTopic createRequest = (CreateTopic) request;
    validateCommonEntityFields(
        getEntityInterface(topic),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    assertService(createRequest.getService(), topic.getService());
    TestUtils.validateTags(createRequest.getTags(), topic.getTags());
  }

  @Override
  public void validateUpdatedEntity(Topic topic, Object request, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCreatedEntity(topic, request, authHeaders);
  }

  @Override
  public void compareEntities(Topic expected, Topic updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(updated),
        expected.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        expected.getOwner());
    assertService(expected.getService(), expected.getService());
    TestUtils.validateTags(expected.getTags(), updated.getTags());
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
