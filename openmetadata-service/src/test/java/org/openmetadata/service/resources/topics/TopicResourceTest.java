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

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static java.util.Collections.singletonList;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.topic.CleanupPolicy;
import org.openmetadata.schema.type.topic.TopicSampleData;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.MessagingServiceResourceTest;
import org.openmetadata.service.resources.topics.TopicResource.TopicList;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class TopicResourceTest extends EntityResourceTest<Topic, CreateTopic> {
  public static final String SCHEMA_TEXT =
      "{\"namespace\":\"org.open-metadata.kafka\",\"name\":\"Customer\",\"type\":\"record\","
          + "\"fields\":[{\"name\":\"id\",\"type\":\"string\"},{\"name\":\"first_name\",\"type\":\"string\"},{\"name\":\"last_name\",\"type\":\"string\"},"
          + "{\"name\":\"email\",\"type\":\"string\"},{\"name\":\"address_line_1\",\"type\":\"string\"},{\"name\":\"address_line_2\",\"type\":\"string\"},"
          + "{\"name\":\"post_code\",\"type\":\"string\"},{\"name\":\"country\",\"type\":\"string\"}]}";
  public static final List<Field> fields =
      Arrays.asList(
          getField("id", FieldDataType.STRING, null),
          getField("first_name", FieldDataType.STRING, null),
          getField("last_name", FieldDataType.STRING, null),
          getField("email", FieldDataType.STRING, null),
          getField("address_line_1", FieldDataType.STRING, null),
          getField("address_line_2", FieldDataType.STRING, null),
          getField("post_code", FieldDataType.STRING, null),
          getField("county", FieldDataType.STRING, PERSONAL_DATA_TAG_LABEL));
  public static final MessageSchema SCHEMA =
      new MessageSchema().withSchemaText(SCHEMA_TEXT).withSchemaType(SchemaType.Avro);

  public TopicResourceTest() {
    super(Entity.TOPIC, Topic.class, TopicList.class, "topics", TopicResource.FIELDS);
    supportsSearchIndex = true;
  }

  @Test
  void post_topicWithoutRequiredFields_4xx(TestInfo test) {
    // Service is required field
    assertResponse(
        () -> createEntity(createRequest(test).withService(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param service must not be null]");

    // Partitions is required field
    assertResponse(
        () -> createEntity(createRequest(test).withPartitions(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param partitions must not be null]");

    // Partitions must be >= 1
    assertResponse(
        () -> createEntity(createRequest(test).withPartitions(0), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param partitions must be greater than or equal to 1]");
  }

  @Test
  void post_topicWithDifferentService_200_ok(TestInfo test) throws IOException {
    String[] differentServices = {REDPANDA_REFERENCE.getName(), KAFKA_REFERENCE.getName()};

    // Create topic for each service and test APIs
    for (String service : differentServices) {
      createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);

      // List topics by filtering on service name and ensure right topics in the response
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("service", service);

      ResultList<Topic> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Topic topic : list.getData()) {
        assertEquals(service, topic.getService().getName());
      }
    }
  }

  @Test
  void put_topicAttributes_200_ok(TestInfo test) throws IOException {
    MessageSchema schema =
        new MessageSchema().withSchemaText("abc").withSchemaType(SchemaType.Avro);
    CreateTopic createTopic =
        createRequest(test)
            .withOwners(List.of(USER1_REF))
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
        .withOwners(List.of(TEAM11_REF))
        .withMinimumInSyncReplicas(2)
        .withMaximumMessageSize(2)
        .withPartitions(2)
        .withReplicationFactor(2)
        .withRetentionTime(2.0)
        .withRetentionSize(2.0)
        .withMessageSchema(
            new MessageSchema().withSchemaText("bcd").withSchemaType(SchemaType.Avro))
        .withCleanupPolicies(List.of(CleanupPolicy.DELETE));

    ChangeDescription change = getChangeDescription(topic, MINOR_UPDATE);
    fieldDeleted(change, FIELD_OWNERS, List.of(USER1_REF));
    fieldAdded(change, FIELD_OWNERS, List.of(TEAM11_REF));
    fieldUpdated(change, "maximumMessageSize", 1, 2);
    fieldUpdated(change, "minimumInSyncReplicas", 1, 2);
    fieldUpdated(change, "partitions", 1, 2);
    fieldUpdated(change, "replicationFactor", 1, 2);
    fieldUpdated(change, "retentionTime", 1.0, 2.0);
    fieldUpdated(change, "retentionSize", 1.0, 2.0);
    fieldUpdated(change, "messageSchema.schemaText", "abc", "bcd");
    fieldDeleted(change, "cleanupPolicies", List.of(CleanupPolicy.COMPACT));
    fieldAdded(change, "cleanupPolicies", List.of(CleanupPolicy.DELETE));

    updateAndCheckEntity(createTopic, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_topicSchemaFields_200_ok(TestInfo test) throws IOException {

    CreateTopic createTopic =
        createRequest(test)
            .withOwners(List.of(USER1_REF))
            .withMaximumMessageSize(1)
            .withMinimumInSyncReplicas(1)
            .withPartitions(1)
            .withReplicationFactor(1)
            .withRetentionTime(1.0)
            .withRetentionSize(1.0)
            .withMessageSchema(SCHEMA.withSchemaFields(fields))
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
            .withOwners(List.of(USER1_REF))
            .withMaximumMessageSize(1)
            .withMinimumInSyncReplicas(1)
            .withPartitions(1)
            .withReplicationFactor(1)
            .withRetentionTime(1.0)
            .withRetentionSize(1.0)
            .withMessageSchema(SCHEMA.withSchemaFields(fields))
            .withCleanupPolicies(List.of(CleanupPolicy.COMPACT));

    // Patch and update the topic
    Topic topic = createEntity(createTopic, ADMIN_AUTH_HEADERS);
    String origJson = JsonUtils.pojoToJson(topic);

    topic
        .withOwners(List.of(TEAM11_REF))
        .withMinimumInSyncReplicas(2)
        .withMaximumMessageSize(2)
        .withPartitions(2)
        .withReplicationFactor(2)
        .withRetentionTime(2.0)
        .withRetentionSize(2.0)
        .withMessageSchema(SCHEMA.withSchemaFields(fields))
        .withCleanupPolicies(List.of(CleanupPolicy.DELETE));

    ChangeDescription change = getChangeDescription(topic, MINOR_UPDATE);
    fieldUpdated(change, "maximumMessageSize", 1, 2);
    fieldUpdated(change, "minimumInSyncReplicas", 1, 2);
    fieldUpdated(change, "partitions", 1, 2);
    fieldUpdated(change, "replicationFactor", 1, 2);
    fieldUpdated(change, "retentionTime", 1.0, 2.0);
    fieldUpdated(change, "retentionSize", 1.0, 2.0);
    fieldDeleted(change, "cleanupPolicies", List.of(CleanupPolicy.COMPACT));
    fieldAdded(change, "cleanupPolicies", List.of(CleanupPolicy.DELETE));
    fieldDeleted(change, "owners", List.of(USER1_REF));
    fieldAdded(change, "owners", List.of(TEAM11_REF));
    patchEntityAndCheck(topic, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void test_mutuallyExclusiveTags(TestInfo testInfo) {
    // Apply mutually exclusive tags to a table
    CreateTopic create =
        createRequest(testInfo)
            .withTags(List.of(TIER1_TAG_LABEL, TIER2_TAG_LABEL))
            .withOwners(List.of(USER1_REF))
            .withMaximumMessageSize(1)
            .withMinimumInSyncReplicas(1)
            .withPartitions(1)
            .withReplicationFactor(1)
            .withRetentionTime(1.0)
            .withRetentionSize(1.0);
    // Apply mutually exclusive tags to a table
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));

    // Apply mutually exclusive tags to a topic field
    CreateTopic create1 =
        createRequest(testInfo, 1)
            .withOwners(List.of(USER1_REF))
            .withMaximumMessageSize(1)
            .withMinimumInSyncReplicas(1)
            .withPartitions(1)
            .withReplicationFactor(1)
            .withRetentionTime(1.0)
            .withRetentionSize(1.0);
    Field field =
        getField("first_name", FieldDataType.STRING, null)
            .withTags(listOf(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    create1.withMessageSchema(SCHEMA.withSchemaFields(List.of(field)));
    assertResponse(
        () -> createEntity(create1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));

    // Apply mutually exclusive tags to a topic's nested field
    CreateTopic create2 =
        createRequest(testInfo, 1)
            .withOwners(List.of(USER1_REF))
            .withMaximumMessageSize(1)
            .withMinimumInSyncReplicas(1)
            .withPartitions(1)
            .withReplicationFactor(1)
            .withRetentionTime(1.0)
            .withRetentionSize(1.0);
    Field nestedField =
        getField("testNested", FieldDataType.STRING, null)
            .withTags(listOf(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    Field field1 = getField("test", FieldDataType.RECORD, null).withChildren(List.of(nestedField));
    create2.setMessageSchema(SCHEMA.withSchemaFields(List.of(field1)));
    assertResponse(
        () -> createEntity(create2, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));
  }

  @Test
  void patch_usingFqn_topicAttributes_200_ok(TestInfo test) throws IOException {
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
            .withOwners(List.of(USER1_REF))
            .withMaximumMessageSize(1)
            .withMinimumInSyncReplicas(1)
            .withPartitions(1)
            .withReplicationFactor(1)
            .withRetentionTime(1.0)
            .withRetentionSize(1.0)
            .withMessageSchema(SCHEMA.withSchemaFields(fields))
            .withCleanupPolicies(List.of(CleanupPolicy.COMPACT));

    // Patch and update the topic
    Topic topic = createEntity(createTopic, ADMIN_AUTH_HEADERS);
    String origJson = JsonUtils.pojoToJson(topic);

    topic
        .withOwners(List.of(TEAM11_REF))
        .withMinimumInSyncReplicas(2)
        .withMaximumMessageSize(2)
        .withPartitions(2)
        .withReplicationFactor(2)
        .withRetentionTime(2.0)
        .withRetentionSize(2.0)
        .withMessageSchema(SCHEMA.withSchemaFields(fields))
        .withCleanupPolicies(List.of(CleanupPolicy.DELETE));

    ChangeDescription change = getChangeDescription(topic, MINOR_UPDATE);
    fieldDeleted(change, FIELD_OWNERS, List.of(USER1_REF));
    fieldAdded(change, FIELD_OWNERS, List.of(TEAM11_REF));
    fieldUpdated(change, "maximumMessageSize", 1, 2);
    fieldUpdated(change, "minimumInSyncReplicas", 1, 2);
    fieldUpdated(change, "partitions", 1, 2);
    fieldUpdated(change, "replicationFactor", 1, 2);
    fieldUpdated(change, "retentionTime", 1.0, 2.0);
    fieldUpdated(change, "retentionSize", 1.0, 2.0);
    fieldDeleted(change, "cleanupPolicies", List.of(CleanupPolicy.COMPACT));
    fieldAdded(change, "cleanupPolicies", List.of(CleanupPolicy.DELETE));
    patchEntityUsingFqnAndCheck(topic, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
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

    topic = getSampleData(topic.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(topicSampleData, topic.getSampleData());
    messages =
        Arrays.asList(
            "{\"email\": \"email1@email.com\", \"firstName\": \"Bob\", \"lastName\": \"Jones\"}",
            "{\"email\": \"email2@email.com\", \"firstName\": \"Test\", \"lastName\": \"Jones\"}");
    topicSampleData.withMessages(messages);
    putResponse = putSampleData(topic.getId(), topicSampleData, ADMIN_AUTH_HEADERS);
    assertEquals(topicSampleData, putResponse.getSampleData());
    topic = getSampleData(topic.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(topicSampleData, topic.getSampleData());
  }

  @Test
  void test_inheritDomain(TestInfo test) throws IOException {
    // When domain is not set for a topic, carry it forward from the messaging service
    MessagingServiceResourceTest serviceTest = new MessagingServiceResourceTest();
    CreateMessagingService createService =
        serviceTest.createRequest(test).withDomains(List.of(DOMAIN.getFullyQualifiedName()));
    MessagingService service = serviceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create a topic without domain and ensure it inherits domain from the parent
    CreateTopic create = createRequest("chart").withService(service.getFullyQualifiedName());
    assertSingleDomainInheritance(create, DOMAIN.getEntityReference());
  }

  @Test
  void testInheritedPermissionFromParent(TestInfo test) throws IOException {
    // Create a messaging service with owner data consumer
    MessagingServiceResourceTest serviceTest = new MessagingServiceResourceTest();
    CreateMessagingService createMessagingService =
        serviceTest
            .createRequest(getEntityName(test))
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()));
    MessagingService service = serviceTest.createEntity(createMessagingService, ADMIN_AUTH_HEADERS);

    // Data consumer as an owner of the service can create topic under it
    createEntity(
        createRequest("topic").withService(service.getFullyQualifiedName()),
        authHeaders(DATA_CONSUMER.getName()));
  }

  @Test
  void test_columnWithInvalidTag(TestInfo test) throws HttpResponseException {
    // Add an entity with invalid tag
    TagLabel invalidTag = new TagLabel().withTagFQN("invalidTag");
    Field invalidField = getField("field", FieldDataType.STRING, null).withTags(listOf(invalidTag));
    MessageSchema invalidSchema =
        new MessageSchema()
            .withSchemaText(SCHEMA_TEXT)
            .withSchemaType(SchemaType.Avro)
            .withSchemaFields(listOf(invalidField));
    CreateTopic create = createRequest(getEntityName(test)).withMessageSchema(invalidSchema);

    // Entity can't be created with PUT or POST
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    assertResponse(
        () -> updateEntity(create, Status.CREATED, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    // Create an entity and update the columns with PUT and PATCH with an invalid tag
    Field validField = getField("field", FieldDataType.STRING, null);
    MessageSchema validSchema =
        new MessageSchema()
            .withSchemaText(SCHEMA_TEXT)
            .withSchemaType(SchemaType.Avro)
            .withSchemaFields(listOf(validField));
    create.setMessageSchema(validSchema);
    Topic entity = createEntity(create, ADMIN_AUTH_HEADERS);
    String json = JsonUtils.pojoToJson(entity);

    create.setMessageSchema(invalidSchema);
    assertResponse(
        () -> updateEntity(create, Status.CREATED, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    entity.setTags(listOf(invalidTag));
    assertResponse(
        () -> patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    // No lingering relationships should cause error in listing the entity
    listEntities(null, ADMIN_AUTH_HEADERS);
  }

  @Override
  public Topic validateGetWithDifferentFields(Topic topic, boolean byName)
      throws HttpResponseException {
    // .../topics?fields=owner
    String fields = "";
    topic =
        byName
            ? getTopicByName(topic.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getTopic(topic.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(topic.getOwners(), topic.getFollowers(), topic.getFollowers());

    fields = "owners, followers, tags";
    topic =
        byName
            ? getTopicByName(topic.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getTopic(topic.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(topic.getService(), topic.getServiceType());
    // Checks for other owner, tags, and followers is done in the base class
    return topic;
  }

  public Topic getTopic(UUID id, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Topic.class, authHeaders);
  }

  public Topic getTopicByName(String fqn, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResourceByName(fqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Topic.class, authHeaders);
  }

  @Override
  public CreateTopic createRequest(String name) {
    return new CreateTopic()
        .withName(name)
        .withService(getContainer().getFullyQualifiedName())
        .withPartitions(1);
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
  public void validateCreatedEntity(
      Topic topic, CreateTopic createRequest, Map<String, String> authHeaders)
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
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("cleanupPolicies")) {
      @SuppressWarnings("unchecked")
      List<CleanupPolicy> expectedCleanupPolicies = (List<CleanupPolicy>) expected;
      List<CleanupPolicy> actualCleanupPolicies =
          JsonUtils.readObjects(actual.toString(), CleanupPolicy.class);
      assertEquals(expectedCleanupPolicies, actualCleanupPolicies);
    } else if (fieldName.equals("schemaType")) {
      SchemaType expectedSchemaType = (SchemaType) expected;
      SchemaType actualSchemaType = SchemaType.fromValue(actual.toString());
      assertEquals(expectedSchemaType, actualSchemaType);
    } else if (fieldName.endsWith("owners") && (expected != null && actual != null)) {
      @SuppressWarnings("unchecked")
      List<EntityReference> expectedOwners =
          expected instanceof List
              ? (List<EntityReference>) expected
              : JsonUtils.readObjects(expected.toString(), EntityReference.class);
      List<EntityReference> actualOwners =
          JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertOwners(expectedOwners, actualOwners);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  public Topic putSampleData(UUID topicId, TopicSampleData data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(topicId).path("/sampleData");
    return TestUtils.put(target, data, Topic.class, OK, authHeaders);
  }

  public Topic getSampleData(UUID topicId, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(topicId).path("/sampleData");
    return TestUtils.get(target, Topic.class, authHeaders);
  }

  public static Field getField(String name, FieldDataType fieldDataType, TagLabel tag) {
    List<TagLabel> tags = tag == null ? new ArrayList<>() : singletonList(tag);
    return new Field()
        .withName(name)
        .withDataType(fieldDataType)
        .withDescription(name)
        .withTags(tags);
  }

  private static void assertFields(List<Field> expectedFields, List<Field> actualFields)
      throws HttpResponseException {
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

  private static void assertField(Field expectedField, Field actualField)
      throws HttpResponseException {
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
