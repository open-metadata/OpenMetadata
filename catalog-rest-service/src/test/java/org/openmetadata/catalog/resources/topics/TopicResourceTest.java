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
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateTopic;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.jdbi3.TopicRepository.TopicEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.topics.TopicResource.TopicList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.topic.CleanupPolicy;
import org.openmetadata.catalog.type.topic.SchemaType;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

@Slf4j
public class TopicResourceTest extends EntityResourceTest<Topic, CreateTopic> {

  public TopicResourceTest() {
    super(Entity.TOPIC, Topic.class, TopicList.class, "topics", TopicResource.FIELDS, true, true, true, true);
  }

  @Test
  void post_validTopics_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateTopic create = createRequest(test);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create.withName(getEntityName(test, 1)).withDescription("description");
    Topic topic = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    String expectedFQN = KAFKA_REFERENCE.getName() + "." + topic.getName();
    assertEquals(expectedFQN, topic.getFullyQualifiedName());
  }

  @Test
  void post_topicWithoutRequiredFields_4xx(TestInfo test) {
    // Service is required field
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class, () -> createEntity(createRequest(test).withService(null), ADMIN_AUTH_HEADERS));
    assertResponse(exception, BAD_REQUEST, "[service must not be null]");

    // Partitions is required field
    exception =
        assertThrows(
            HttpResponseException.class,
            () -> createEntity(createRequest(test).withPartitions(null), ADMIN_AUTH_HEADERS));
    assertResponse(exception, BAD_REQUEST, "[partitions must not be null]");

    // Partitions must be >= 1
    exception =
        assertThrows(
            HttpResponseException.class, () -> createEntity(createRequest(test).withPartitions(0), ADMIN_AUTH_HEADERS));
    assertResponse(exception, BAD_REQUEST, "[partitions must be greater than or equal to 1]");
  }

  @Test
  void post_topicWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {PULSAR_REFERENCE, KAFKA_REFERENCE};

    // Create topic for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);

      // List topics by filtering on service name and ensure right topics in the response
      Map<String, String> queryParams =
          new HashMap<>() {
            {
              put("service", service.getName());
            }
          };
      ResultList<Topic> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Topic topic : list.getData()) {
        assertEquals(service.getName(), topic.getService().getName());
      }
    }
  }

  @Test
  void put_topicAttributes_200_ok(TestInfo test) throws IOException {
    CreateTopic createTopic =
        createRequest(test)
            .withOwner(USER_OWNER1)
            .withMaximumMessageSize(1)
            .withMinimumInSyncReplicas(1)
            .withPartitions(1)
            .withReplicationFactor(1)
            .withRetentionTime(1)
            .withRetentionSize(1)
            .withSchemaText("abc")
            .withSchemaType(SchemaType.Avro)
            .withCleanupPolicies(List.of(CleanupPolicy.COMPACT));

    // Patch and update the topic
    Topic topic = createEntity(createTopic, ADMIN_AUTH_HEADERS);
    createTopic
        .withOwner(TEAM_OWNER1)
        .withMinimumInSyncReplicas(2)
        .withMaximumMessageSize(2)
        .withPartitions(2)
        .withReplicationFactor(2)
        .withRetentionTime(2)
        .withRetentionSize(2)
        .withSchemaText("bcd")
        .withSchemaType(SchemaType.JSON)
        .withCleanupPolicies(List.of(CleanupPolicy.DELETE));

    ChangeDescription change = getChangeDescription(topic.getVersion());
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("owner").withOldValue(USER_OWNER1).withNewValue(TEAM_OWNER1));
    change.getFieldsUpdated().add(new FieldChange().withName("maximumMessageSize").withOldValue(1).withNewValue(2));
    change.getFieldsUpdated().add(new FieldChange().withName("minimumInSyncReplicas").withOldValue(1).withNewValue(2));
    change.getFieldsUpdated().add(new FieldChange().withName("partitions").withOldValue(1).withNewValue(2));
    change.getFieldsUpdated().add(new FieldChange().withName("replicationFactor").withOldValue(1).withNewValue(2));
    change.getFieldsUpdated().add(new FieldChange().withName("retentionTime").withOldValue(1).withNewValue(2));
    change.getFieldsUpdated().add(new FieldChange().withName("retentionSize").withOldValue(1).withNewValue(2));
    change.getFieldsUpdated().add(new FieldChange().withName("schemaText").withOldValue("abc").withNewValue("bcd"));
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("schemaType").withOldValue(SchemaType.Avro).withNewValue(SchemaType.JSON));
    change
        .getFieldsDeleted()
        .add(new FieldChange().withName("cleanupPolicies").withOldValue(List.of(CleanupPolicy.COMPACT)));
    change
        .getFieldsAdded()
        .add(new FieldChange().withName("cleanupPolicies").withNewValue(List.of(CleanupPolicy.DELETE)));

    updateAndCheckEntity(createTopic, Status.OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void patch_topicAttributes_200_ok(TestInfo test) throws IOException {
    CreateTopic createTopic =
        createRequest(test)
            .withOwner(USER_OWNER1)
            .withMaximumMessageSize(1)
            .withMinimumInSyncReplicas(1)
            .withPartitions(1)
            .withReplicationFactor(1)
            .withRetentionTime(1)
            .withRetentionSize(1)
            .withSchemaText("abc")
            .withSchemaType(SchemaType.Avro)
            .withCleanupPolicies(List.of(CleanupPolicy.COMPACT));

    // Patch and update the topic
    Topic topic = createEntity(createTopic, ADMIN_AUTH_HEADERS);
    String origJson = JsonUtils.pojoToJson(topic);

    topic
        .withOwner(TEAM_OWNER1)
        .withMinimumInSyncReplicas(2)
        .withMaximumMessageSize(2)
        .withPartitions(2)
        .withReplicationFactor(2)
        .withRetentionTime(2)
        .withRetentionSize(2)
        .withSchemaText("bcd")
        .withSchemaType(SchemaType.JSON)
        .withCleanupPolicies(List.of(CleanupPolicy.DELETE));

    ChangeDescription change = getChangeDescription(topic.getVersion());
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("owner").withOldValue(USER_OWNER1).withNewValue(TEAM_OWNER1));
    change.getFieldsUpdated().add(new FieldChange().withName("maximumMessageSize").withOldValue(1).withNewValue(2));
    change.getFieldsUpdated().add(new FieldChange().withName("minimumInSyncReplicas").withOldValue(1).withNewValue(2));
    change.getFieldsUpdated().add(new FieldChange().withName("partitions").withOldValue(1).withNewValue(2));
    change.getFieldsUpdated().add(new FieldChange().withName("replicationFactor").withOldValue(1).withNewValue(2));
    change.getFieldsUpdated().add(new FieldChange().withName("retentionTime").withOldValue(1).withNewValue(2));
    change.getFieldsUpdated().add(new FieldChange().withName("retentionSize").withOldValue(1).withNewValue(2));
    change.getFieldsUpdated().add(new FieldChange().withName("schemaText").withOldValue("abc").withNewValue("bcd"));
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("schemaType").withOldValue(SchemaType.Avro).withNewValue(SchemaType.JSON));
    change
        .getFieldsDeleted()
        .add(new FieldChange().withName("cleanupPolicies").withOldValue(List.of(CleanupPolicy.COMPACT)));
    change
        .getFieldsAdded()
        .add(new FieldChange().withName("cleanupPolicies").withNewValue(List.of(CleanupPolicy.DELETE)));
    patchEntityAndCheck(topic, origJson, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void delete_nonEmptyTopic_4xx() {
    // TODO
  }

  /** Validate returned fields GET .../topics/{id}?fields="..." or GET .../topics/name/{fqn}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Topic topic, boolean byName) throws HttpResponseException {
    // .../topics?fields=owner
    String fields = "owner";
    topic =
        byName
            ? getTopicByName(topic.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getTopic(topic.getId(), fields, ADMIN_AUTH_HEADERS);
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

  @Override
  public CreateTopic createRequest(String name, String description, String displayName, EntityReference owner) {
    return new CreateTopic()
        .withName(name)
        .withService(KAFKA_REFERENCE)
        .withPartitions(1)
        .withDescription(description)
        .withOwner(owner);
  }

  @Override
  public EntityReference getContainer(CreateTopic createRequest) {
    return createRequest.getService();
  }

  @Override
  public void validateCreatedEntity(Topic topic, CreateTopic createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(topic),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    assertService(createRequest.getService(), topic.getService());
    // TODO add other fields
    TestUtils.validateTags(createRequest.getTags(), topic.getTags());
  }

  @Override
  public void validateUpdatedEntity(Topic topic, CreateTopic request, Map<String, String> authHeaders)
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
    // TODO add other fields
    TestUtils.validateTags(expected.getTags(), updated.getTags());
  }

  @Override
  public EntityInterface<Topic> getEntityInterface(Topic entity) {
    return new TopicEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("cleanupPolicies")) {
      @SuppressWarnings("unchecked")
      List<CleanupPolicy> expectedCleanupPolicies = (List<CleanupPolicy>) expected;
      List<CleanupPolicy> actualCleanupPolicies = JsonUtils.readObjects(actual.toString(), CleanupPolicy.class);
      assertEquals(expectedCleanupPolicies, actualCleanupPolicies);
    } else if (fieldName.equals("schemaType")) {
      SchemaType expectedSchemaType = (SchemaType) expected;
      SchemaType actualSchemaType = SchemaType.fromValue(actual.toString());
      assertEquals(expectedSchemaType, actualSchemaType);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
