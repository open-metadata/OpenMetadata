package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

class VectorDocBuilderTopicFieldsTest {

  private static final EmbeddingClient MOCK_CLIENT =
      new EmbeddingClientTest.MockEmbeddingClient(384);

  static {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("topic", "topic");
  }

  @Test
  void topicChunk_carriesTopLevelAndNestedFieldsInEmbedAndLlmContext() {
    Topic topic = corporateActionsTopic();

    Map<String, Object> chunk = VectorDocBuilder.fromEntity(topic, MOCK_CLIENT).getFirst();

    String expectedFields =
        "event_id (Unique event identifier), payload, payload.ratio (Ratio of the stock split,"
            + " e.g. 2:1), payload.effective_date";
    assertEquals(
        "topic Corporate Actions (corporate_actions). Corporate action events. Schema fields"
            + " include "
            + expectedFields,
        chunk.get("textToEmbed"));
    String llmContext = (String) chunk.get("textToLLMContext");
    assertTrue(
        llmContext.endsWith(
            "| description: Corporate action events; columns: " + expectedFields + " | chunk 1/1"),
        llmContext);
  }

  @Test
  void topicWithoutSchemaFields_keepsTheDescriptionOnlyBody() {
    Topic noSchema = topic("Corporate action events.", null);
    Topic emptySchema = topic("Corporate action events.", new MessageSchema());

    for (Topic topic : List.of(noSchema, emptySchema)) {
      assertEquals(
          "description: Corporate action events.", VectorDocBuilder.buildBodyText(topic, "topic"));
      assertEquals(
          "Corporate action events.", VectorDocBuilder.buildSemanticBodyText(topic, "topic"));
    }
  }

  @Test
  void fingerprint_changesWhenANestedFieldDescriptionChanges() {
    Topic topic = corporateActionsTopic();
    String before = VectorDocBuilder.computeFingerprintForEntity(topic);

    topic
        .getMessageSchema()
        .getSchemaFields()
        .get(1)
        .getChildren()
        .get(1)
        .setDescription("Date the stock split takes effect");

    assertNotEquals(before, VectorDocBuilder.computeFingerprintForEntity(topic));
  }

  @Test
  void wideSchema_splitsIntoChunksAndEveryFieldReachesAChunk() {
    List<Field> fields = new ArrayList<>();
    for (int i = 0; i < 300; i++) {
      fields.add(field("field_" + i, "Description of field number " + i));
    }
    Topic topic = topic("Wide topic.", new MessageSchema().withSchemaFields(fields));

    List<Map<String, Object>> chunks = VectorDocBuilder.fromEntity(topic, MOCK_CLIENT);

    assertTrue(chunks.size() > 1, "a schema with 300 described fields must be chunked");
    String allEmbedded =
        String.join(" ", chunks.stream().map(c -> (String) c.get("textToEmbed")).toList());
    String allContext =
        String.join(" ", chunks.stream().map(c -> (String) c.get("textToLLMContext")).toList());
    assertTrue(allEmbedded.contains("field_0 (Description of field number 0)"));
    assertTrue(allEmbedded.contains("field_299 (Description of field number 299)"));
    assertTrue(allContext.contains("field_299 (Description of field number 299)"));
    for (Map<String, Object> chunk : chunks) {
      assertEquals(chunks.size(), chunk.get("chunkCount"));
    }
  }

  @Test
  void schemaFieldsText_isEmptyForEntitiesThatAreNotTopics() {
    assertFalse(VectorDocBuilder.schemaFieldsText(corporateActionsTopic()).isEmpty());
    assertEquals("", VectorDocBuilder.schemaFieldsText(new Table()));
  }

  private static Topic corporateActionsTopic() {
    Field payload =
        field("payload", null)
            .withChildren(
                new ArrayList<>(
                    List.of(
                        field("ratio", "Ratio of the stock split, e.g. 2:1"),
                        field("effective_date", "  "))));
    MessageSchema schema =
        new MessageSchema()
            .withSchemaFields(
                new ArrayList<>(List.of(field("event_id", "Unique event identifier"), payload)));
    return topic("Corporate action events", schema).withDisplayName("Corporate Actions");
  }

  private static Topic topic(String description, MessageSchema schema) {
    return new Topic()
        .withId(UUID.randomUUID())
        .withName("corporate_actions")
        .withFullyQualifiedName("kafka.corporate_actions")
        .withDescription(description)
        .withMessageSchema(schema);
  }

  private static Field field(String name, String description) {
    return new Field()
        .withName(name)
        .withDataType(FieldDataType.STRING)
        .withDescription(description);
  }
}
