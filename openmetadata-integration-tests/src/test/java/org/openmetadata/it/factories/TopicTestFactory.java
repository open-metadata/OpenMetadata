package org.openmetadata.it.factories;

import java.util.List;
import java.util.UUID;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.SchemaType;

/**
 * Factory for creating Topic entities under a Kafka MessagingService.
 *
 * <p>The default topic ships with the schema shape consumed by UI scenarios: two top-level
 * Record fields, the first containing nested children (a nested Record with first/last
 * name, plus int and string fields) and the second empty. This mirrors {@code TopicClass}
 * in the TS Playwright suite so UI assertions about field counts and nested expansion
 * port over unchanged.
 */
public class TopicTestFactory {

  private static final int DEFAULT_PARTITIONS = 128;

  /** Creates a fresh Kafka service in the namespace and a topic under it with default schema. */
  public static Topic createSimple(TestNamespace ns) {
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);
    return createSimple(ns, service.getFullyQualifiedName());
  }

  /** Creates a topic under an existing messaging service with default schema. */
  public static Topic createSimple(TestNamespace ns, String messagingServiceFqn) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("topic_" + uniqueId);

    CreateTopic request =
        new CreateTopic()
            .withName(name)
            .withService(messagingServiceFqn)
            .withPartitions(DEFAULT_PARTITIONS)
            .withMessageSchema(defaultSchema());

    return SdkClients.adminClient().topics().create(request);
  }

  private static MessageSchema defaultSchema() {
    Field firstName =
        new Field()
            .withName("first_name")
            .withDataType(FieldDataType.STRING)
            .withDescription("Description for schema field first_name");
    Field lastName = new Field().withName("last_name").withDataType(FieldDataType.STRING);
    Field nestedName =
        new Field()
            .withName("name")
            .withDataType(FieldDataType.RECORD)
            .withChildren(List.of(firstName, lastName));
    Field age = new Field().withName("age").withDataType(FieldDataType.INT);
    Field clubName = new Field().withName("club_name").withDataType(FieldDataType.STRING);

    Field defaultRecord =
        new Field()
            .withName("default")
            .withDataType(FieldDataType.RECORD)
            .withChildren(List.of(nestedName, age, clubName));
    Field secondaryRecord =
        new Field()
            .withName("secondary")
            .withDataType(FieldDataType.RECORD)
            .withChildren(List.of());

    return new MessageSchema()
        .withSchemaType(SchemaType.JSON)
        .withSchemaFields(List.of(defaultRecord, secondaryRecord));
  }
}
