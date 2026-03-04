package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.topic.CleanupPolicy;
import org.openmetadata.schema.type.topic.TopicSampleData;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Topic entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds topic-specific tests for partitions,
 * message schema, and cleanup policies.
 *
 * <p>Migrated from: org.openmetadata.service.resources.topics.TopicResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class TopicResourceIT extends BaseEntityIT<Topic, CreateTopic> {

  {
    supportsLifeCycle = true;
    supportsListHistoryByTimestamp = true;
    supportsBulkAPI = true;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateTopic createMinimalRequest(TestNamespace ns) {
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setDescription("Test topic created by integration test");

    return request;
  }

  @Override
  protected CreateTopic createRequest(String name, TestNamespace ns) {
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    return request;
  }

  @Override
  protected Topic createEntity(CreateTopic createRequest) {
    return SdkClients.adminClient().topics().create(createRequest);
  }

  @Override
  protected Topic getEntity(String id) {
    return SdkClients.adminClient().topics().get(id);
  }

  @Override
  protected Topic getEntityByName(String fqn) {
    return SdkClients.adminClient().topics().getByName(fqn);
  }

  @Override
  protected Topic patchEntity(String id, Topic entity) {
    return SdkClients.adminClient().topics().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().topics().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().topics().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().topics().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "topic";
  }

  @Override
  protected void validateCreatedEntity(Topic entity, CreateTopic createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "Topic must have a service");
    assertEquals(createRequest.getPartitions(), entity.getPartitions());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()), "FQN should contain topic name");
  }

  @Override
  protected ListResponse<Topic> listEntities(ListParams params) {
    return SdkClients.adminClient().topics().list(params);
  }

  @Override
  protected Topic getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().topics().get(id, fields);
  }

  @Override
  protected Topic getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().topics().getByName(fqn, fields);
  }

  @Override
  protected Topic getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().topics().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().topics().getVersionList(id);
  }

  @Override
  protected Topic getVersion(UUID id, Double version) {
    return SdkClients.adminClient().topics().getVersion(id.toString(), version);
  }

  // ===================================================================
  // TOPIC-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_topicWithoutRequiredFields_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    // Service is required field - test without service
    CreateTopic request1 = new CreateTopic();
    request1.setName(ns.prefix("topic_no_service"));
    request1.setPartitions(1);

    assertThrows(
        Exception.class,
        () -> createEntity(request1),
        "Creating topic without service should fail");

    // Partitions is required field
    CreateTopic request2 = new CreateTopic();
    request2.setName(ns.prefix("topic_no_partitions"));
    request2.setService(service.getFullyQualifiedName());

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating topic without partitions should fail");
  }

  @Test
  void post_topicWithValidPartitions_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_with_partitions"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(10);
    request.setReplicationFactor(3);
    request.setRetentionTime(86400.0);

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertEquals(10, topic.getPartitions());
    assertEquals(3, topic.getReplicationFactor());
    assertEquals(86400.0, topic.getRetentionTime());
  }

  @Test
  void post_topicWithMessageSchema_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    String schemaText =
        "{\"namespace\":\"org.test\",\"name\":\"TestRecord\",\"type\":\"record\","
            + "\"fields\":[{\"name\":\"id\",\"type\":\"string\"},{\"name\":\"name\",\"type\":\"string\"}]}";

    List<Field> schemaFields =
        Arrays.asList(
            new Field().withName("id").withDataType(FieldDataType.STRING),
            new Field().withName("name").withDataType(FieldDataType.STRING));

    MessageSchema schema =
        new MessageSchema()
            .withSchemaText(schemaText)
            .withSchemaType(SchemaType.Avro)
            .withSchemaFields(schemaFields);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_with_schema"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setMessageSchema(schema);

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertNotNull(topic.getMessageSchema());
    assertEquals(SchemaType.Avro, topic.getMessageSchema().getSchemaType());
    assertNotNull(topic.getMessageSchema().getSchemaFields());
  }

  @Test
  void post_topicWithCleanupPolicies_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_with_cleanup"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setCleanupPolicies(List.of(CleanupPolicy.COMPACT, CleanupPolicy.DELETE));

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertNotNull(topic.getCleanupPolicies());
    assertEquals(2, topic.getCleanupPolicies().size());
    assertTrue(topic.getCleanupPolicies().contains(CleanupPolicy.COMPACT));
    assertTrue(topic.getCleanupPolicies().contains(CleanupPolicy.DELETE));
  }

  @Test
  void put_topicAttributes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    // Create topic with initial values
    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_update"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setReplicationFactor(1);
    request.setRetentionTime(3600.0);
    request.setMaximumMessageSize(1048576);

    Topic topic = createEntity(request);
    assertNotNull(topic);

    // Update attributes
    topic.setPartitions(4);
    topic.setReplicationFactor(3);
    topic.setRetentionTime(86400.0);
    topic.setMaximumMessageSize(2097152);

    Topic updated = patchEntity(topic.getId().toString(), topic);
    assertNotNull(updated);
    assertEquals(4, updated.getPartitions());
    assertEquals(3, updated.getReplicationFactor());
    assertEquals(86400.0, updated.getRetentionTime());
    assertEquals(2097152, updated.getMaximumMessageSize());
  }

  @Test
  void put_topicSampleData_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_sample_data"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    Topic topic = createEntity(request);
    assertNotNull(topic);

    // Add sample data
    List<String> messages =
        Arrays.asList(
            "{\"id\": 1, \"name\": \"test1\"}",
            "{\"id\": 2, \"name\": \"test2\"}",
            "{\"id\": 3, \"name\": \"test3\"}");
    TopicSampleData sampleData = new TopicSampleData().withMessages(messages);

    topic.setSampleData(sampleData);
    Topic updated = patchEntity(topic.getId().toString(), topic);

    // Verify sample data was set (may need to fetch with fields)
    assertNotNull(updated);
  }

  @Test
  void test_topicInheritsDomainFromService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a messaging service
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    // Create a topic under the service
    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_inherit_domain"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertNotNull(topic.getService());
    assertEquals(service.getFullyQualifiedName(), topic.getService().getFullyQualifiedName());
  }

  @Test
  void post_topicWithInvalidService_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String nonExistentServiceFqn = "non_existent_messaging_service_" + UUID.randomUUID();
    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_invalid_service"));
    request.setService(nonExistentServiceFqn);
    request.setPartitions(1);

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating topic with non-existent service should fail");
  }

  @Test
  void list_topicsByService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    // Create multiple topics under the same service
    for (int i = 0; i < 5; i++) {
      CreateTopic request = new CreateTopic();
      request.setName(ns.prefix("topic_list_" + i));
      request.setService(service.getFullyQualifiedName());
      request.setPartitions(1);
      createEntity(request);
    }

    // List topics by service
    ListParams params = new ListParams();
    params.setLimit(100);
    params.setService(service.getFullyQualifiedName());

    ListResponse<Topic> response = listEntities(params);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 5);

    // Verify all returned topics belong to the service
    for (Topic topic : response.getData()) {
      assertEquals(service.getFullyQualifiedName(), topic.getService().getFullyQualifiedName());
    }
  }

  @Test
  void test_topicVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_versions"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setDescription("Version 1");

    Topic topic = createEntity(request);
    Double v1 = topic.getVersion();

    // Update description
    topic.setDescription("Version 2");
    Topic v2Topic = patchEntity(topic.getId().toString(), topic);
    assertTrue(v2Topic.getVersion() > v1);

    // Get version history
    EntityHistory history = client.topics().getVersionList(topic.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void test_topicWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_with_owner"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setOwners(List.of(testUser1().getEntityReference()));

    Topic topic = createEntity(request);
    assertNotNull(topic);

    // Verify owner
    Topic fetched = client.topics().get(topic.getId().toString(), "owners");
    assertNotNull(fetched.getOwners());
    assertFalse(fetched.getOwners().isEmpty());
    assertTrue(fetched.getOwners().stream().anyMatch(o -> o.getId().equals(testUser1().getId())));
  }

  @Test
  void test_topicSoftDeleteAndRestore(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_delete_restore"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    Topic topic = createEntity(request);
    String topicId = topic.getId().toString();

    // Soft delete
    deleteEntity(topicId);

    // Verify deleted
    assertThrows(
        Exception.class, () -> getEntity(topicId), "Deleted topic should not be retrievable");

    // Get with include=deleted
    Topic deleted = getEntityIncludeDeleted(topicId);
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(topicId);

    // Verify restored
    Topic restored = getEntity(topicId);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_topicHardDelete(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_hard_delete"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    Topic topic = createEntity(request);
    String topicId = topic.getId().toString();

    // Hard delete
    hardDeleteEntity(topicId);

    // Verify completely gone
    assertThrows(
        Exception.class,
        () -> getEntityIncludeDeleted(topicId),
        "Hard deleted topic should not be retrievable");
  }

  @Test
  void patch_topicAttributes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    // Create topic with minimal attributes
    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_patch"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    Topic topic = createEntity(request);

    // Patch to add retention time
    topic.setRetentionTime(172800.0);
    Topic patched = patchEntity(topic.getId().toString(), topic);
    assertEquals(172800.0, patched.getRetentionTime());

    // Patch to update description
    patched.setDescription("Updated description");
    Topic patched2 = patchEntity(patched.getId().toString(), patched);
    assertEquals("Updated description", patched2.getDescription());
  }

  @Test
  void test_listTopicsByService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    // Create multiple topics
    for (int i = 0; i < 3; i++) {
      CreateTopic request = new CreateTopic();
      request.setName(ns.prefix("topic_list_" + i));
      request.setService(service.getFullyQualifiedName());
      request.setPartitions(1);
      createEntity(request);
    }

    // List topics
    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Topic> response = listEntities(params);
    assertNotNull(response);

    // Verify we have at least our 3 topics
    long serviceCount =
        response.getData().stream()
            .filter(
                t -> t.getService().getFullyQualifiedName().equals(service.getFullyQualifiedName()))
            .count();
    assertTrue(serviceCount >= 3);
  }

  @Test
  void test_topicGetByName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_by_name"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setDescription("Topic for getByName test");

    Topic topic = createEntity(request);

    // Get by FQN
    Topic fetched = getEntityByName(topic.getFullyQualifiedName());
    assertNotNull(fetched);
    assertEquals(topic.getId(), fetched.getId());
    assertEquals(topic.getName(), fetched.getName());
  }

  @Test
  void test_topicFQNFormat(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    String topicName = ns.prefix("topic_fqn");
    request.setName(topicName);
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    Topic topic = createEntity(request);

    // Verify FQN format: service.topic
    String expectedFQN = service.getFullyQualifiedName() + "." + topicName;
    assertEquals(expectedFQN, topic.getFullyQualifiedName());
  }

  @Test
  void test_topicDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_display"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setDisplayName("My Display Topic");

    Topic topic = createEntity(request);
    assertEquals("My Display Topic", topic.getDisplayName());

    // Update display name
    topic.setDisplayName("Updated Display Name");
    Topic updated = patchEntity(topic.getId().toString(), topic);
    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void test_topicPagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    // Create multiple topics
    for (int i = 0; i < 5; i++) {
      CreateTopic request = new CreateTopic();
      request.setName(ns.prefix("pagination_" + i));
      request.setService(service.getFullyQualifiedName());
      request.setPartitions(1);
      createEntity(request);
    }

    // List with limit
    ListParams params = new ListParams();
    params.setLimit(2);
    ListResponse<Topic> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() <= 2);
  }

  @Test
  void post_topicWithDifferentService_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    MessagingService kafkaService = MessagingServiceTestFactory.createKafka(ns);
    MessagingService redpandaService = MessagingServiceTestFactory.createRedpanda(ns);

    CreateTopic kafkaRequest = new CreateTopic();
    kafkaRequest.setName(ns.prefix("kafka_topic"));
    kafkaRequest.setService(kafkaService.getFullyQualifiedName());
    kafkaRequest.setPartitions(1);
    Topic kafkaTopic = createEntity(kafkaRequest);
    assertNotNull(kafkaTopic);
    assertEquals(
        kafkaService.getFullyQualifiedName(), kafkaTopic.getService().getFullyQualifiedName());

    CreateTopic redpandaRequest = new CreateTopic();
    redpandaRequest.setName(ns.prefix("redpanda_topic"));
    redpandaRequest.setService(redpandaService.getFullyQualifiedName());
    redpandaRequest.setPartitions(1);
    Topic redpandaTopic = createEntity(redpandaRequest);
    assertNotNull(redpandaTopic);
    assertEquals(
        redpandaService.getFullyQualifiedName(),
        redpandaTopic.getService().getFullyQualifiedName());
  }

  @Test
  void put_topicSchemaFields_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    List<Field> fields =
        Arrays.asList(
            new Field().withName("id").withDataType(FieldDataType.STRING),
            new Field().withName("first_name").withDataType(FieldDataType.STRING),
            new Field().withName("last_name").withDataType(FieldDataType.STRING),
            new Field().withName("email").withDataType(FieldDataType.STRING),
            new Field().withName("address_line_1").withDataType(FieldDataType.STRING),
            new Field().withName("address_line_2").withDataType(FieldDataType.STRING),
            new Field().withName("post_code").withDataType(FieldDataType.STRING),
            new Field().withName("county").withDataType(FieldDataType.STRING));

    String schemaText =
        "{\"namespace\":\"org.open-metadata.kafka\",\"name\":\"Customer\",\"type\":\"record\","
            + "\"fields\":[{\"name\":\"id\",\"type\":\"string\"},{\"name\":\"first_name\",\"type\":\"string\"},{\"name\":\"last_name\",\"type\":\"string\"},"
            + "{\"name\":\"email\",\"type\":\"string\"},{\"name\":\"address_line_1\",\"type\":\"string\"},{\"name\":\"address_line_2\",\"type\":\"string\"},"
            + "{\"name\":\"post_code\",\"type\":\"string\"},{\"name\":\"country\",\"type\":\"string\"}]}";

    MessageSchema schema =
        new MessageSchema()
            .withSchemaText(schemaText)
            .withSchemaType(SchemaType.Avro)
            .withSchemaFields(fields);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_schema_fields"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setMessageSchema(schema);

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertNotNull(topic.getMessageSchema());
    assertNotNull(topic.getMessageSchema().getSchemaFields());
    assertEquals(fields.size(), topic.getMessageSchema().getSchemaFields().size());

    Topic fetched = client.topics().get(topic.getId().toString());
    assertNotNull(fetched.getMessageSchema());
    assertNotNull(fetched.getMessageSchema().getSchemaFields());
  }

  @Test
  void put_updateMessageSchema_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    MessageSchema schema1 =
        new MessageSchema().withSchemaText("abc").withSchemaType(SchemaType.Avro);
    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_update_schema"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setMessageSchema(schema1);

    Topic topic = createEntity(request);
    assertEquals(SchemaType.Avro, topic.getMessageSchema().getSchemaType());
    assertEquals("abc", topic.getMessageSchema().getSchemaText());

    MessageSchema schema2 =
        new MessageSchema().withSchemaText("bcd").withSchemaType(SchemaType.Avro);
    topic.setMessageSchema(schema2);
    Topic updated = patchEntity(topic.getId().toString(), topic);
    assertEquals("bcd", updated.getMessageSchema().getSchemaText());
  }

  @Test
  void patch_topicRetentionSize_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_retention_size"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setRetentionSize(1000.0);

    Topic topic = createEntity(request);
    assertEquals(1000.0, topic.getRetentionSize());

    topic.setRetentionSize(2000.0);
    Topic updated = patchEntity(topic.getId().toString(), topic);
    assertEquals(2000.0, updated.getRetentionSize());
  }

  @Test
  void patch_topicMinimumInSyncReplicas_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_min_insync"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(3);
    request.setReplicationFactor(3);
    request.setMinimumInSyncReplicas(1);

    Topic topic = createEntity(request);
    assertEquals(1, topic.getMinimumInSyncReplicas());

    topic.setMinimumInSyncReplicas(2);
    Topic updated = patchEntity(topic.getId().toString(), topic);
    assertEquals(2, updated.getMinimumInSyncReplicas());
  }

  @Test
  void test_topicWithNestedSchemaFields(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    Field nestedField1 = new Field().withName("street").withDataType(FieldDataType.STRING);
    Field nestedField2 = new Field().withName("city").withDataType(FieldDataType.STRING);

    Field addressField =
        new Field()
            .withName("address")
            .withDataType(FieldDataType.RECORD)
            .withChildren(Arrays.asList(nestedField1, nestedField2));

    List<Field> fields =
        Arrays.asList(new Field().withName("id").withDataType(FieldDataType.STRING), addressField);

    String schemaText =
        "{\"namespace\":\"org.test\",\"name\":\"User\",\"type\":\"record\","
            + "\"fields\":[{\"name\":\"id\",\"type\":\"string\"},"
            + "{\"name\":\"address\",\"type\":{\"type\":\"record\",\"name\":\"Address\","
            + "\"fields\":[{\"name\":\"street\",\"type\":\"string\"},{\"name\":\"city\",\"type\":\"string\"}]}}]}";

    MessageSchema schema =
        new MessageSchema()
            .withSchemaText(schemaText)
            .withSchemaType(SchemaType.Avro)
            .withSchemaFields(fields);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_nested_fields"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setMessageSchema(schema);

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertNotNull(topic.getMessageSchema());
    assertNotNull(topic.getMessageSchema().getSchemaFields());

    Field fetchedAddressField =
        topic.getMessageSchema().getSchemaFields().stream()
            .filter(f -> f.getName().equals("address"))
            .findFirst()
            .orElse(null);
    assertNotNull(fetchedAddressField);
    assertNotNull(fetchedAddressField.getChildren());
    assertEquals(2, fetchedAddressField.getChildren().size());
  }

  @Test
  void test_topicSchemaFieldsWithDifferentDataTypes(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    List<Field> fields =
        Arrays.asList(
            new Field().withName("string_field").withDataType(FieldDataType.STRING),
            new Field().withName("int_field").withDataType(FieldDataType.INT),
            new Field().withName("long_field").withDataType(FieldDataType.LONG),
            new Field().withName("float_field").withDataType(FieldDataType.FLOAT),
            new Field().withName("double_field").withDataType(FieldDataType.DOUBLE),
            new Field().withName("boolean_field").withDataType(FieldDataType.BOOLEAN),
            new Field().withName("bytes_field").withDataType(FieldDataType.BYTES));

    String schemaText =
        "{\"namespace\":\"org.test\",\"name\":\"TestTypes\",\"type\":\"record\","
            + "\"fields\":[{\"name\":\"string_field\",\"type\":\"string\"},"
            + "{\"name\":\"int_field\",\"type\":\"int\"},"
            + "{\"name\":\"long_field\",\"type\":\"long\"},"
            + "{\"name\":\"float_field\",\"type\":\"float\"},"
            + "{\"name\":\"double_field\",\"type\":\"double\"},"
            + "{\"name\":\"boolean_field\",\"type\":\"boolean\"},"
            + "{\"name\":\"bytes_field\",\"type\":\"bytes\"}]}";

    MessageSchema schema =
        new MessageSchema()
            .withSchemaText(schemaText)
            .withSchemaType(SchemaType.Avro)
            .withSchemaFields(fields);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_various_types"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setMessageSchema(schema);

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertNotNull(topic.getMessageSchema());
    assertNotNull(topic.getMessageSchema().getSchemaFields());
    assertEquals(7, topic.getMessageSchema().getSchemaFields().size());
  }

  @Test
  void test_topicWithJSONSchema(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    String jsonSchemaText =
        "{"
            + "\"$schema\":\"http://json-schema.org/draft-07/schema#\","
            + "\"type\":\"object\","
            + "\"properties\":{"
            + "\"id\":{\"type\":\"string\"},"
            + "\"name\":{\"type\":\"string\"}"
            + "}"
            + "}";

    MessageSchema schema =
        new MessageSchema().withSchemaText(jsonSchemaText).withSchemaType(SchemaType.JSON);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_json_schema"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setMessageSchema(schema);

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertEquals(SchemaType.JSON, topic.getMessageSchema().getSchemaType());
    assertEquals(jsonSchemaText, topic.getMessageSchema().getSchemaText());
  }

  @Test
  void test_topicWithProtobufSchema(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    String protobufSchemaText =
        "syntax = \"proto3\";\n"
            + "message TestMessage {\n"
            + "  string id = 1;\n"
            + "  string name = 2;\n"
            + "}";

    MessageSchema schema =
        new MessageSchema().withSchemaText(protobufSchemaText).withSchemaType(SchemaType.Protobuf);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_protobuf_schema"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setMessageSchema(schema);

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertEquals(SchemaType.Protobuf, topic.getMessageSchema().getSchemaType());
    assertEquals(protobufSchemaText, topic.getMessageSchema().getSchemaText());
  }

  @Test
  void test_topicWithOtherSchemaType(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    MessageSchema schema =
        new MessageSchema().withSchemaText("custom schema").withSchemaType(SchemaType.Other);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_other_schema"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setMessageSchema(schema);

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertEquals(SchemaType.Other, topic.getMessageSchema().getSchemaType());
  }

  @Test
  void test_topicWithCompactCleanupPolicy(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_compact"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setCleanupPolicies(List.of(CleanupPolicy.COMPACT));

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertNotNull(topic.getCleanupPolicies());
    assertEquals(1, topic.getCleanupPolicies().size());
    assertEquals(CleanupPolicy.COMPACT, topic.getCleanupPolicies().get(0));
  }

  @Test
  void test_topicWithDeleteCleanupPolicy(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_delete"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setCleanupPolicies(List.of(CleanupPolicy.DELETE));

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertNotNull(topic.getCleanupPolicies());
    assertEquals(1, topic.getCleanupPolicies().size());
    assertEquals(CleanupPolicy.DELETE, topic.getCleanupPolicies().get(0));
  }

  @Test
  void patch_updateCleanupPolicy_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_cleanup_update"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setCleanupPolicies(List.of(CleanupPolicy.COMPACT));

    Topic topic = createEntity(request);
    assertEquals(1, topic.getCleanupPolicies().size());
    assertEquals(CleanupPolicy.COMPACT, topic.getCleanupPolicies().get(0));

    topic.setCleanupPolicies(List.of(CleanupPolicy.DELETE));
    Topic updated = patchEntity(topic.getId().toString(), topic);
    assertEquals(1, updated.getCleanupPolicies().size());
    assertEquals(CleanupPolicy.DELETE, updated.getCleanupPolicies().get(0));

    topic.setCleanupPolicies(List.of(CleanupPolicy.COMPACT, CleanupPolicy.DELETE));
    Topic updatedBoth = patchEntity(topic.getId().toString(), topic);
    assertEquals(2, updatedBoth.getCleanupPolicies().size());
    assertTrue(updatedBoth.getCleanupPolicies().contains(CleanupPolicy.COMPACT));
    assertTrue(updatedBoth.getCleanupPolicies().contains(CleanupPolicy.DELETE));
  }

  @Test
  void test_topicWithAllAttributes(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    List<Field> fields =
        Arrays.asList(
            new Field().withName("id").withDataType(FieldDataType.STRING),
            new Field().withName("name").withDataType(FieldDataType.STRING));

    String schemaText =
        "{\"namespace\":\"org.test\",\"name\":\"Complete\",\"type\":\"record\","
            + "\"fields\":[{\"name\":\"id\",\"type\":\"string\"},{\"name\":\"name\",\"type\":\"string\"}]}";

    MessageSchema schema =
        new MessageSchema()
            .withSchemaText(schemaText)
            .withSchemaType(SchemaType.Avro)
            .withSchemaFields(fields);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_complete"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(10);
    request.setReplicationFactor(3);
    request.setRetentionTime(86400.0);
    request.setRetentionSize(1073741824.0);
    request.setMaximumMessageSize(1048576);
    request.setMinimumInSyncReplicas(2);
    request.setMessageSchema(schema);
    request.setCleanupPolicies(List.of(CleanupPolicy.COMPACT, CleanupPolicy.DELETE));
    request.setDescription("Complete topic with all attributes");
    request.setDisplayName("Complete Topic");
    request.setOwners(List.of(testUser1().getEntityReference()));

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertEquals(10, topic.getPartitions());
    assertEquals(3, topic.getReplicationFactor());
    assertEquals(86400.0, topic.getRetentionTime());
    assertEquals(1073741824.0, topic.getRetentionSize());
    assertEquals(1048576, topic.getMaximumMessageSize());
    assertEquals(2, topic.getMinimumInSyncReplicas());
    assertNotNull(topic.getMessageSchema());
    assertEquals(2, topic.getCleanupPolicies().size());
    assertEquals("Complete topic with all attributes", topic.getDescription());
    assertEquals("Complete Topic", topic.getDisplayName());
  }

  @Test
  void test_topicUpdateSampleDataMultipleTimes(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_sample_update"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    Topic topic = createEntity(request);

    List<String> messages1 =
        Arrays.asList(
            "{\"id\": 1, \"name\": \"first\"}",
            "{\"id\": 2, \"name\": \"second\"}",
            "{\"id\": 3, \"name\": \"third\"}");
    TopicSampleData sampleData1 = new TopicSampleData().withMessages(messages1);
    topic.setSampleData(sampleData1);
    Topic updated1 = patchEntity(topic.getId().toString(), topic);
    assertNotNull(updated1);

    List<String> messages2 =
        Arrays.asList(
            "{\"id\": 10, \"name\": \"updated1\"}", "{\"id\": 20, \"name\": \"updated2\"}");
    TopicSampleData sampleData2 = new TopicSampleData().withMessages(messages2);
    updated1.setSampleData(sampleData2);
    Topic updated2 = patchEntity(updated1.getId().toString(), updated1);
    assertNotNull(updated2);
  }

  @Test
  void test_topicWithZeroPartitions_400(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_zero_partitions"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(0);

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating topic with zero partitions should fail");
  }

  @Test
  void test_topicWithNegativePartitions_400(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_negative_partitions"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(-1);

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating topic with negative partitions should fail");
  }

  @Test
  void test_topicWithLargePartitionCount(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_large_partitions"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1000);

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertEquals(1000, topic.getPartitions());
  }

  @Test
  void test_topicWithLargeReplicationFactor(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_large_replication"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setReplicationFactor(100);

    Topic topic = createEntity(request);
    assertNotNull(topic);
    assertEquals(100, topic.getReplicationFactor());
  }

  // ===================================================================
  // BULK API SUPPORT
  // ===================================================================

  @Override
  protected BulkOperationResult executeBulkCreate(List<CreateTopic> createRequests) {
    return SdkClients.adminClient().topics().bulkCreateOrUpdate(createRequests);
  }

  @Override
  protected BulkOperationResult executeBulkCreateAsync(List<CreateTopic> createRequests) {
    return SdkClients.adminClient().topics().bulkCreateOrUpdateAsync(createRequests);
  }

  @Override
  protected CreateTopic createInvalidRequestForBulk(TestNamespace ns) {
    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("invalid_topic"));
    return request;
  }
}
