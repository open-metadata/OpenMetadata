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

package org.openmetadata.service.resources.topics;

import static java.util.Collections.singletonList;
import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.Entity.FIELD_OWNER;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
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
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.topic.CleanupPolicy;
import org.openmetadata.schema.type.topic.TopicSampleData;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.topics.TopicResource.TopicList;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ParallelizeTest;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.service.util.TestUtils.UpdateType;

@Slf4j
@ParallelizeTest
public class TopicResourceTest extends EntityResourceTest<Topic, CreateTopic> {
  private static final String SCHEMA_TEXT =
      "{\"namespace\":\"org.open-metadata.kafka\",\"name\":\"Customer\",\"type\":\"record\","
          + "\"fields\":[{\"name\":\"id\",\"type\":\"string\"},{\"name\":\"first_name\",\"type\":\"string\"},{\"name\":\"last_name\",\"type\":\"string\"},"
          + "{\"name\":\"email\",\"type\":\"string\"},{\"name\":\"address_line_1\",\"type\":\"string\"},{\"name\":\"address_line_2\",\"type\":\"string\"},"
          + "{\"name\":\"post_code\",\"type\":\"string\"},{\"name\":\"country\",\"type\":\"string\"}]}";
  private static final MessageSchema schema =
      new MessageSchema().withSchemaText(SCHEMA_TEXT).withSchemaType(SchemaType.Avro);

  public TopicResourceTest() {
    super(Entity.TOPIC, Topic.class, TopicList.class, "topics", TopicResource.FIELDS);
  }

  @Test
  void post_topicWithoutRequiredFields_4xx(TestInfo test) {
    // Service is required field
    assertResponse(
        () -> createEntity(createRequest(test).withService(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[service must not be null]");

    // Partitions is required field
    assertResponse(
        () -> createEntity(createRequest(test).withPartitions(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[partitions must not be null]");

    // Partitions must be >= 1
    assertResponse(
        () -> createEntity(createRequest(test).withPartitions(0), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[partitions must be greater than or equal to 1]");
  }

  @Test
  void post_topicWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {PULSAR_REFERENCE, KAFKA_REFERENCE};

    // Create topic for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);

      // List topics by filtering on service name and ensure right topics in the response
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("service", service.getName());

      ResultList<Topic> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Topic topic : list.getData()) {
        assertEquals(service.getName(), topic.getService().getName());
      }
    }
  }

  @Test
  void put_topicAttributes_200_ok(TestInfo test) throws IOException {
    MessageSchema schema = new MessageSchema().withSchemaText("abc").withSchemaType(SchemaType.Avro);
    CreateTopic createTopic =
        createRequest(test)
            .withOwner(USER1_REF)
            .withMaximumMessageSize(1)
            .withMinimumInSyncReplicas(1)
            .withPartitions(1)
            .withReplicationFactor(1)
            .withRetentionTime(1.0)
            .withRetentionSize(1.0)
            .withMessageSchema(schema)
            .withCleanupPolicies(List.of(CleanupPolicy.COMPACT));

    // Patch and update the topic
    Topic topic = createEntity(createTopic, ADMIN_AUTH_HEADERS);
    createTopic
        .withOwner(TEAM11_REF)
        .withMinimumInSyncReplicas(2)
        .withMaximumMessageSize(2)
        .withPartitions(2)
        .withReplicationFactor(2)
        .withRetentionTime(2.0)
        .withRetentionSize(2.0)
        .withMessageSchema(new MessageSchema().withSchemaText("bcd").withSchemaType(SchemaType.Avro))
        .withCleanupPolicies(List.of(CleanupPolicy.DELETE));

    ChangeDescription change = getChangeDescription(topic.getVersion());
    fieldUpdated(change, FIELD_OWNER, USER1_REF, TEAM11_REF);
    fieldUpdated(change, "maximumMessageSize", 1, 2);
    fieldUpdated(change, "minimumInSyncReplicas", 1, 2);
    fieldUpdated(change, "partitions", 1, 2);
    fieldUpdated(change, "replicationFactor", 1, 2);
    fieldUpdated(change, "retentionTime", 1.0, 2.0);
    fieldUpdated(change, "retentionSize", 1.0, 2.0);
    fieldUpdated(change, "messageSchema.schemaText", "abc", "bcd");
    fieldDeleted(change, "cleanupPolicies", List.of(CleanupPolicy.COMPACT));
    fieldAdded(change, "cleanupPolicies", List.of(CleanupPolicy.DELETE));

    updateAndCheckEntity(createTopic, Status.OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void put_topicSchemaFields_200_ok(TestInfo test) throws IOException {
    List<Field> fields =
        Arrays.asList(
            getField("id", FieldDataType.STRING, null),
            getField("first_name", FieldDataType.STRING, null),
            getField("last_name", FieldDataType.STRING, null),
            getField("email", FieldDataType.STRING, null),
            getField("address_line_1", FieldDataType.STRING, null),
            getField("address_line_2", FieldDataType.STRING, null),
            getField("post_code", FieldDataType.STRING, null),
            getField("county", FieldDataType.STRING, PERSONAL_DATA_TAG_LABEL));

    CreateTopic createTopic =
        createRequest(test)
            .withOwner(USER1_REF)
            .withMaximumMessageSize(1)
            .withMinimumInSyncReplicas(1)
            .withPartitions(1)
            .withReplicationFactor(1)
            .withRetentionTime(1.0)
            .withRetentionSize(1.0)
            .withMessageSchema(schema.withSchemaFields(fields))
            .withCleanupPolicies(List.of(CleanupPolicy.COMPACT));

    // Patch and update the topic
    Topic topic = createEntity(createTopic, ADMIN_AUTH_HEADERS);
    topic = getEntity(topic.getId(), ADMIN_AUTH_HEADERS);
    assertFields(fields, topic.getMessageSchema().getSchemaFields());
  }

  @Test
  void patch_topicAttributes_200_ok(TestInfo test) throws IOException {
    List<Field> fields =
        Arrays.asList(
            getField("id", FieldDataType.STRING, null),
            getField("first_name", FieldDataType.STRING, null),
            getField("last_name", FieldDataType.STRING, null),
            getField("email", FieldDataType.STRING, null),
            getField("address_line_1", FieldDataType.STRING, null),
            getField("address_line_2", FieldDataType.STRING, null),
            getField("post_code", FieldDataType.STRING, null),
            getField("county", FieldDataType.STRING, PERSONAL_DATA_TAG_LABEL));
    CreateTopic createTopic =
        createRequest(test)
            .withOwner(USER1_REF)
            .withMaximumMessageSize(1)
            .withMinimumInSyncReplicas(1)
            .withPartitions(1)
            .withReplicationFactor(1)
            .withRetentionTime(1.0)
            .withRetentionSize(1.0)
            .withMessageSchema(schema.withSchemaFields(fields))
            .withCleanupPolicies(List.of(CleanupPolicy.COMPACT));

    // Patch and update the topic
    Topic topic = createEntity(createTopic, ADMIN_AUTH_HEADERS);
    String origJson = JsonUtils.pojoToJson(topic);

    topic
        .withOwner(TEAM11_REF)
        .withMinimumInSyncReplicas(2)
        .withMaximumMessageSize(2)
        .withPartitions(2)
        .withReplicationFactor(2)
        .withRetentionTime(2.0)
        .withRetentionSize(2.0)
        .withMessageSchema(schema.withSchemaFields(fields))
        .withCleanupPolicies(List.of(CleanupPolicy.DELETE));

    ChangeDescription change = getChangeDescription(topic.getVersion());
    fieldUpdated(change, FIELD_OWNER, USER1_REF, TEAM11_REF);
    fieldUpdated(change, "maximumMessageSize", 1, 2);
    fieldUpdated(change, "minimumInSyncReplicas", 1, 2);
    fieldUpdated(change, "partitions", 1, 2);
    fieldUpdated(change, "replicationFactor", 1, 2);
    fieldUpdated(change, "retentionTime", 1.0, 2.0);
    fieldUpdated(change, "retentionSize", 1.0, 2.0);
    fieldDeleted(change, "cleanupPolicies", List.of(CleanupPolicy.COMPACT));
    fieldAdded(change, "cleanupPolicies", List.of(CleanupPolicy.DELETE));
    patchEntityAndCheck(topic, origJson, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void put_topicSampleData_200(TestInfo test) throws IOException {
    Topic topic = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    List<String> messages =
        Arrays.asList(
            "{\"email\": \"email1@email.com\", \"firstName\": \"Bob\", \"lastName\": \"Jones\"}",
            "{\"email\": \"email2@email.com\", \"firstName\": \"Test\", \"lastName\": \"Jones\"}",
            "{\"email\": \"email3@email.com\", \"firstName\": \"Bob\", \"lastName\": \"Jones\"}");
    TopicSampleData topicSampleData = new TopicSampleData().withMessages(messages);
    Topic putResponse = putSampleData(topic.getId(), topicSampleData, ADMIN_AUTH_HEADERS);
    assertEquals(topicSampleData, putResponse.getSampleData());

    topic = getEntity(topic.getId(), "sampleData", ADMIN_AUTH_HEADERS);
    assertEquals(topicSampleData, topic.getSampleData());
    messages =
        Arrays.asList(
            "{\"email\": \"email1@email.com\", \"firstName\": \"Bob\", \"lastName\": \"Jones\"}",
            "{\"email\": \"email2@email.com\", \"firstName\": \"Test\", \"lastName\": \"Jones\"}");
    topicSampleData.withMessages(messages);
    putResponse = putSampleData(topic.getId(), topicSampleData, ADMIN_AUTH_HEADERS);
    assertEquals(topicSampleData, putResponse.getSampleData());
    topic = getEntity(topic.getId(), "sampleData", ADMIN_AUTH_HEADERS);
    assertEquals(topicSampleData, topic.getSampleData());
  }

  @Override
  public Topic validateGetWithDifferentFields(Topic topic, boolean byName) throws HttpResponseException {
    // .../topics?fields=owner
    String fields = "";
    topic =
        byName
            ? getTopicByName(topic.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getTopic(topic.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(topic.getOwner(), topic.getFollowers(), topic.getFollowers());

    fields = "owner, followers, tags";
    topic =
        byName
            ? getTopicByName(topic.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getTopic(topic.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(topic.getService(), topic.getServiceType());
    // Checks for other owner, tags, and followers is done in the base class
    return topic;
  }

  public Topic getTopic(UUID id, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Topic.class, authHeaders);
  }

  public Topic getTopicByName(String fqn, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResourceByName(fqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Topic.class, authHeaders);
  }

  @Override
  public CreateTopic createRequest(String name) {
    return new CreateTopic().withName(name).withService(getContainer()).withPartitions(1);
  }

  @Override
  public EntityReference getContainer() {
    return KAFKA_REFERENCE;
  }

  @Override
  public EntityReference getContainer(Topic entity) {
    return entity.getService();
  }

  @Override
  public void validateCreatedEntity(Topic topic, CreateTopic createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertReference(createRequest.getService(), topic.getService());
    // TODO add other fields
    TestUtils.validateTags(createRequest.getTags(), topic.getTags());
  }

  @Override
  public void compareEntities(Topic expected, Topic updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertReference(expected.getService(), expected.getService());
    // TODO add other fields
    TestUtils.validateTags(expected.getTags(), updated.getTags());
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

  public Topic putSampleData(UUID topicId, TopicSampleData data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(topicId).path("/sampleData");
    return TestUtils.put(target, data, Topic.class, OK, authHeaders);
  }

  private static Field getField(String name, FieldDataType fieldDataType, TagLabel tag) {
    List<TagLabel> tags = tag == null ? new ArrayList<>() : singletonList(tag);
    return new Field().withName(name).withDataType(fieldDataType).withDescription(name).withTags(tags);
  }

  private static void assertFields(List<Field> expectedFields, List<Field> actualFields) throws HttpResponseException {
    if (expectedFields == actualFields) {
      return;
    }
    // Sort columns by name
    assertEquals(expectedFields.size(), actualFields.size());

    // Make a copy before sorting in case the lists are immutable
    List<Field> expected = new ArrayList<>(expectedFields);
    List<Field> actual = new ArrayList<>(actualFields);
    expected.sort(Comparator.comparing(Field::getName));
    actual.sort(Comparator.comparing(Field::getName));
    for (int i = 0; i < expected.size(); i++) {
      assertField(expected.get(i), actual.get(i));
    }
  }

  private static void assertField(Field expectedField, Field actualField) throws HttpResponseException {
    assertNotNull(actualField.getFullyQualifiedName());
    assertTrue(
        expectedField.getName().equals(actualField.getName())
            || expectedField.getName().equals(actualField.getDisplayName()));
    assertEquals(expectedField.getDescription(), actualField.getDescription());
    assertEquals(expectedField.getDataType(), actualField.getDataType());
    TestUtils.validateTags(expectedField.getTags(), actualField.getTags());

    // Check the nested columns
    assertFields(expectedField.getChildren(), actualField.getChildren());
  }
}
