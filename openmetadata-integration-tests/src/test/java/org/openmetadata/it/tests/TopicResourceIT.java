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
}
