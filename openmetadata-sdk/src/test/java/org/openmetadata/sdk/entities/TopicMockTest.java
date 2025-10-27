package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.dataassets.TopicService;

/**
 * Mock tests for Topic entity operations.
 */
public class TopicMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private TopicService mockTopicService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.topics()).thenReturn(mockTopicService);
    org.openmetadata.sdk.entities.Topic.setDefaultClient(mockClient);
  }

  @Test
  void testCreateTopic() {
    // Arrange
    CreateTopic createRequest = new CreateTopic();
    createRequest.setName("user_events");
    createRequest.setService("kafka");
    createRequest.setPartitions(10);
    createRequest.setReplicationFactor(3);

    Topic expectedTopic = new Topic();
    expectedTopic.setId(UUID.randomUUID());
    expectedTopic.setName("user_events");
    expectedTopic.setFullyQualifiedName("kafka.user_events");
    expectedTopic.setPartitions(10);
    expectedTopic.setReplicationFactor(3);

    when(mockTopicService.create(any(CreateTopic.class))).thenReturn(expectedTopic);

    // Act
    Topic result = org.openmetadata.sdk.entities.Topic.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("user_events", result.getName());
    assertEquals(10, result.getPartitions());
    assertEquals(3, result.getReplicationFactor());
    verify(mockTopicService).create(any(CreateTopic.class));
  }

  @Test
  void testRetrieveTopic() {
    // Arrange
    String topicId = UUID.randomUUID().toString();
    Topic expectedTopic = new Topic();
    expectedTopic.setId(UUID.fromString(topicId));
    expectedTopic.setName("order_events");
    expectedTopic.setMaximumMessageSize(1048576);

    when(mockTopicService.get(topicId)).thenReturn(expectedTopic);

    // Act
    Topic result = org.openmetadata.sdk.entities.Topic.retrieve(topicId);

    // Assert
    assertNotNull(result);
    assertEquals(topicId, result.getId().toString());
    assertEquals("order_events", result.getName());
    assertEquals(1048576, result.getMaximumMessageSize());
    verify(mockTopicService).get(topicId);
  }

  @Test
  void testRetrieveTopicWithSchema() {
    // Arrange
    String topicId = UUID.randomUUID().toString();
    String fields = "messageSchema,sampleData,tags";
    Topic expectedTopic = new Topic();
    expectedTopic.setId(UUID.fromString(topicId));
    expectedTopic.setName("payment_events");

    // Mock schema field
    org.openmetadata.schema.type.MessageSchema schema =
        new org.openmetadata.schema.type.MessageSchema();
    expectedTopic.setMessageSchema(schema);

    when(mockTopicService.get(topicId, fields)).thenReturn(expectedTopic);

    // Act
    Topic result = org.openmetadata.sdk.entities.Topic.retrieve(topicId, fields);

    // Assert
    assertNotNull(result);
    assertNotNull(result.getMessageSchema());
    verify(mockTopicService).get(topicId, fields);
  }

  @Test
  void testRetrieveTopicByName() {
    // Arrange
    String fqn = "kinesis.streams.clickstream_events";
    Topic expectedTopic = new Topic();
    expectedTopic.setName("clickstream_events");
    expectedTopic.setFullyQualifiedName(fqn);
    expectedTopic.setRetentionTime(604800000.0); // 7 days in ms

    when(mockTopicService.getByName(fqn)).thenReturn(expectedTopic);

    // Act
    Topic result = org.openmetadata.sdk.entities.Topic.retrieveByName(fqn);

    // Assert
    assertNotNull(result);
    assertEquals(fqn, result.getFullyQualifiedName());
    assertEquals(604800000.0, result.getRetentionTime());
    verify(mockTopicService).getByName(fqn);
  }

  @Test
  void testUpdateTopic() {
    // Arrange
    Topic topicToUpdate = new Topic();
    topicToUpdate.setId(UUID.randomUUID());
    topicToUpdate.setName("analytics_events");
    topicToUpdate.setDescription("Updated analytics event stream");
    topicToUpdate.setRetentionTime(1209600000.0); // 14 days

    // Add tags
    TagLabel tag = new TagLabel();
    tag.setTagFQN("DataClassification.Confidential");
    topicToUpdate.setTags(List.of(tag));

    Topic expectedTopic = new Topic();
    expectedTopic.setId(topicToUpdate.getId());
    expectedTopic.setName(topicToUpdate.getName());
    expectedTopic.setDescription(topicToUpdate.getDescription());
    expectedTopic.setRetentionTime(topicToUpdate.getRetentionTime());
    expectedTopic.setTags(topicToUpdate.getTags());

    when(mockTopicService.update(topicToUpdate.getId().toString(), topicToUpdate))
        .thenReturn(expectedTopic);

    // Act
    Topic result =
        org.openmetadata.sdk.entities.Topic.update(topicToUpdate.getId().toString(), topicToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated analytics event stream", result.getDescription());
    assertEquals(1209600000.0, result.getRetentionTime());
    assertNotNull(result.getTags());
    assertEquals("DataClassification.Confidential", result.getTags().get(0).getTagFQN());
    verify(mockTopicService).update(topicToUpdate.getId().toString(), topicToUpdate);
  }

  @Test
  void testDeleteTopic() {
    // Arrange
    String topicId = UUID.randomUUID().toString();
    doNothing().when(mockTopicService).delete(eq(topicId), any());

    // Act
    org.openmetadata.sdk.entities.Topic.delete(topicId);

    // Assert
    verify(mockTopicService).delete(eq(topicId), any());
  }

  @Test
  void testDeleteTopicWithOptions() {
    // Arrange
    String topicId = UUID.randomUUID().toString();
    doNothing().when(mockTopicService).delete(eq(topicId), any());

    // Act
    org.openmetadata.sdk.entities.Topic.delete(topicId, true, true);

    // Assert
    verify(mockTopicService)
        .delete(
            eq(topicId),
            argThat(
                params ->
                    "true".equals(params.get("recursive"))
                        && "true".equals(params.get("hardDelete"))));
  }

  @Test
  void testAsyncOperations() throws Exception {
    // Arrange
    String topicId = UUID.randomUUID().toString();
    Topic expectedTopic = new Topic();
    expectedTopic.setId(UUID.fromString(topicId));
    expectedTopic.setName("async_topic");

    when(mockTopicService.get(topicId)).thenReturn(expectedTopic);

    // Act
    var future = org.openmetadata.sdk.entities.Topic.retrieveAsync(topicId);
    Topic result = future.get();

    // Assert
    assertNotNull(result);
    assertEquals("async_topic", result.getName());
    verify(mockTopicService).get(topicId);
  }
}
