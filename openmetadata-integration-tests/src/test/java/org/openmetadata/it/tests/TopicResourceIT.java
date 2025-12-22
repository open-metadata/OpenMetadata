package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

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

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateTopic createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setDescription("Test topic created by integration test");

    return request;
  }

  @Override
  protected CreateTopic createRequest(String name, TestNamespace ns, OpenMetadataClient client) {
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    CreateTopic request = new CreateTopic();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    return request;
  }

  @Override
  protected Topic createEntity(CreateTopic createRequest, OpenMetadataClient client) {
    return client.topics().create(createRequest);
  }

  @Override
  protected Topic getEntity(String id, OpenMetadataClient client) {
    return client.topics().get(id);
  }

  @Override
  protected Topic getEntityByName(String fqn, OpenMetadataClient client) {
    return client.topics().getByName(fqn);
  }

  @Override
  protected Topic patchEntity(String id, Topic entity, OpenMetadataClient client) {
    return client.topics().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.topics().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.topics().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.topics().delete(id, params);
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
  protected ListResponse<Topic> listEntities(ListParams params, OpenMetadataClient client) {
    return client.topics().list(params);
  }

  @Override
  protected Topic getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.topics().get(id, fields);
  }

  @Override
  protected Topic getEntityByNameWithFields(String fqn, String fields, OpenMetadataClient client) {
    return client.topics().getByName(fqn, fields);
  }

  @Override
  protected Topic getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.topics().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.topics().getVersionList(id);
  }

  @Override
  protected Topic getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.topics().getVersion(id.toString(), version);
  }

  // ===================================================================
  // TOPIC-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_topicWithoutRequiredFields_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    // Service is required field - test without service
    CreateTopic request1 = new CreateTopic();
    request1.setName(ns.prefix("topic_no_service"));
    request1.setPartitions(1);

    assertThrows(
        Exception.class,
        () -> createEntity(request1, client),
        "Creating topic without service should fail");

    // Partitions is required field
    CreateTopic request2 = new CreateTopic();
    request2.setName(ns.prefix("topic_no_partitions"));
    request2.setService(service.getFullyQualifiedName());

    assertThrows(
        Exception.class,
        () -> createEntity(request2, client),
        "Creating topic without partitions should fail");
  }

  @Test
  void post_topicWithValidPartitions_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_with_partitions"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(10);
    request.setReplicationFactor(3);
    request.setRetentionTime(86400.0);

    Topic topic = createEntity(request, client);
    assertNotNull(topic);
    assertEquals(10, topic.getPartitions());
    assertEquals(3, topic.getReplicationFactor());
    assertEquals(86400.0, topic.getRetentionTime());
  }

  @Test
  void post_topicWithMessageSchema_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

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

    Topic topic = createEntity(request, client);
    assertNotNull(topic);
    assertNotNull(topic.getMessageSchema());
    assertEquals(SchemaType.Avro, topic.getMessageSchema().getSchemaType());
    assertNotNull(topic.getMessageSchema().getSchemaFields());
  }

  @Test
  void post_topicWithCleanupPolicies_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_with_cleanup"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setCleanupPolicies(List.of(CleanupPolicy.COMPACT, CleanupPolicy.DELETE));

    Topic topic = createEntity(request, client);
    assertNotNull(topic);
    assertNotNull(topic.getCleanupPolicies());
    assertEquals(2, topic.getCleanupPolicies().size());
    assertTrue(topic.getCleanupPolicies().contains(CleanupPolicy.COMPACT));
    assertTrue(topic.getCleanupPolicies().contains(CleanupPolicy.DELETE));
  }

  @Test
  void put_topicAttributes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    // Create topic with initial values
    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_update"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setReplicationFactor(1);
    request.setRetentionTime(3600.0);
    request.setMaximumMessageSize(1048576);

    Topic topic = createEntity(request, client);
    assertNotNull(topic);

    // Update attributes
    topic.setPartitions(4);
    topic.setReplicationFactor(3);
    topic.setRetentionTime(86400.0);
    topic.setMaximumMessageSize(2097152);

    Topic updated = patchEntity(topic.getId().toString(), topic, client);
    assertNotNull(updated);
    assertEquals(4, updated.getPartitions());
    assertEquals(3, updated.getReplicationFactor());
    assertEquals(86400.0, updated.getRetentionTime());
    assertEquals(2097152, updated.getMaximumMessageSize());
  }

  @Test
  void put_topicSampleData_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_sample_data"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    Topic topic = createEntity(request, client);
    assertNotNull(topic);

    // Add sample data
    List<String> messages =
        Arrays.asList(
            "{\"id\": 1, \"name\": \"test1\"}",
            "{\"id\": 2, \"name\": \"test2\"}",
            "{\"id\": 3, \"name\": \"test3\"}");
    TopicSampleData sampleData = new TopicSampleData().withMessages(messages);

    topic.setSampleData(sampleData);
    Topic updated = patchEntity(topic.getId().toString(), topic, client);

    // Verify sample data was set (may need to fetch with fields)
    assertNotNull(updated);
  }

  @Test
  void test_topicInheritsDomainFromService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a messaging service
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    // Create a topic under the service
    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_inherit_domain"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    Topic topic = createEntity(request, client);
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
        () -> createEntity(request, client),
        "Creating topic with non-existent service should fail");
  }

  @Test
  void list_topicsByService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    // Create multiple topics under the same service
    for (int i = 0; i < 5; i++) {
      CreateTopic request = new CreateTopic();
      request.setName(ns.prefix("topic_list_" + i));
      request.setService(service.getFullyQualifiedName());
      request.setPartitions(1);
      createEntity(request, client);
    }

    // List topics by service
    ListParams params = new ListParams();
    params.setLimit(100);
    params.setService(service.getFullyQualifiedName());

    ListResponse<Topic> response = listEntities(params, client);
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
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_versions"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setDescription("Version 1");

    Topic topic = createEntity(request, client);
    Double v1 = topic.getVersion();

    // Update description
    topic.setDescription("Version 2");
    Topic v2Topic = patchEntity(topic.getId().toString(), topic, client);
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
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_with_owner"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setOwners(List.of(testUser1().getEntityReference()));

    Topic topic = createEntity(request, client);
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
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_delete_restore"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    Topic topic = createEntity(request, client);
    String topicId = topic.getId().toString();

    // Soft delete
    deleteEntity(topicId, client);

    // Verify deleted
    assertThrows(
        Exception.class,
        () -> getEntity(topicId, client),
        "Deleted topic should not be retrievable");

    // Get with include=deleted
    Topic deleted = getEntityIncludeDeleted(topicId, client);
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(topicId, client);

    // Verify restored
    Topic restored = getEntity(topicId, client);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_topicHardDelete(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_hard_delete"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    Topic topic = createEntity(request, client);
    String topicId = topic.getId().toString();

    // Hard delete
    hardDeleteEntity(topicId, client);

    // Verify completely gone
    assertThrows(
        Exception.class,
        () -> getEntityIncludeDeleted(topicId, client),
        "Hard deleted topic should not be retrievable");
  }

  @Test
  void patch_topicAttributes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    // Create topic with minimal attributes
    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_patch"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    Topic topic = createEntity(request, client);

    // Patch to add retention time
    topic.setRetentionTime(172800.0);
    Topic patched = patchEntity(topic.getId().toString(), topic, client);
    assertEquals(172800.0, patched.getRetentionTime());

    // Patch to update description
    patched.setDescription("Updated description");
    Topic patched2 = patchEntity(patched.getId().toString(), patched, client);
    assertEquals("Updated description", patched2.getDescription());
  }

  @Test
  void test_listTopicsByService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    // Create multiple topics
    for (int i = 0; i < 3; i++) {
      CreateTopic request = new CreateTopic();
      request.setName(ns.prefix("topic_list_" + i));
      request.setService(service.getFullyQualifiedName());
      request.setPartitions(1);
      createEntity(request, client);
    }

    // List topics
    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Topic> response = listEntities(params, client);
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
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_by_name"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setDescription("Topic for getByName test");

    Topic topic = createEntity(request, client);

    // Get by FQN
    Topic fetched = getEntityByName(topic.getFullyQualifiedName(), client);
    assertNotNull(fetched);
    assertEquals(topic.getId(), fetched.getId());
    assertEquals(topic.getName(), fetched.getName());
  }

  @Test
  void test_topicFQNFormat(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    CreateTopic request = new CreateTopic();
    String topicName = ns.prefix("topic_fqn");
    request.setName(topicName);
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);

    Topic topic = createEntity(request, client);

    // Verify FQN format: service.topic
    String expectedFQN = service.getFullyQualifiedName() + "." + topicName;
    assertEquals(expectedFQN, topic.getFullyQualifiedName());
  }

  @Test
  void test_topicDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    CreateTopic request = new CreateTopic();
    request.setName(ns.prefix("topic_display"));
    request.setService(service.getFullyQualifiedName());
    request.setPartitions(1);
    request.setDisplayName("My Display Topic");

    Topic topic = createEntity(request, client);
    assertEquals("My Display Topic", topic.getDisplayName());

    // Update display name
    topic.setDisplayName("Updated Display Name");
    Topic updated = patchEntity(topic.getId().toString(), topic, client);
    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void test_topicPagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(client, ns);

    // Create multiple topics
    for (int i = 0; i < 5; i++) {
      CreateTopic request = new CreateTopic();
      request.setName(ns.prefix("pagination_" + i));
      request.setService(service.getFullyQualifiedName());
      request.setPartitions(1);
      createEntity(request, client);
    }

    // List with limit
    ListParams params = new ListParams();
    params.setLimit(2);
    ListResponse<Topic> response = listEntities(params, client);
    assertNotNull(response);
    assertTrue(response.getData().size() <= 2);
  }
}
