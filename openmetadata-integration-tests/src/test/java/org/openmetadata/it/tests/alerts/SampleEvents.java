package org.openmetadata.it.tests.alerts;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.LatestResult;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * A fixed set of change events for tests that drive a tick. Their entities are not stored, so a
 * condition that reads the store falls back to what the event carries; the one real thing is the
 * admin user, who owns them.
 */
final class SampleEvents {

  static final String TABLE_FQN = "parity_service.parity_db.parity_schema.orders";
  static final String TOPIC_FQN = "parity_messaging.orders_topic";
  static final String DOMAIN = "parity_domain";
  static final String SUITE_FQN = TABLE_FQN + ".testSuite";
  private static final String ADMIN = "admin";
  private static final String BOT = "ingestion-bot";
  private static final UUID TABLE_ID = UUID.nameUUIDFromBytes("parity table".getBytes());

  private SampleEvents() {}

  /** Label to event, in a fixed order. */
  static Map<String, ChangeEvent> events() {
    EntityReference admin = adminReference();
    Map<String, ChangeEvent> events = new LinkedHashMap<>();
    events.put("table created", event(Entity.TABLE, EventType.ENTITY_CREATED, table(admin), null));
    events.put(
        "table described by a bot",
        event(Entity.TABLE, EventType.ENTITY_UPDATED, table(admin), updated("description", "new"))
            .withUserName(BOT));
    events.put(
        "table columns changed",
        event(Entity.TABLE, EventType.ENTITY_UPDATED, table(admin), updated("columns", "[]")));
    events.put(
        "topic schema changed",
        event(Entity.TOPIC, EventType.ENTITY_UPDATED, topic(), updated("messageSchema", "{}")));
    events.put(
        "pipeline run failed",
        event(
            Entity.PIPELINE,
            EventType.ENTITY_UPDATED,
            new Pipeline()
                .withId(idOf("pipeline"))
                .withName("nightly")
                .withFullyQualifiedName("parity_airflow.nightly"),
            updated(
                "pipelineStatus", new PipelineStatus().withExecutionStatus(StatusType.Failed))));
    events.put(
        "test case failed",
        event(
            Entity.TEST_CASE,
            EventType.ENTITY_UPDATED,
            new TestCase()
                .withId(idOf("test case"))
                .withName("not_null")
                .withFullyQualifiedName(TABLE_FQN + ".not_null")
                .withEntityLink("<#E::table::" + TABLE_FQN + ">"),
            updated(
                "testCaseResult", new TestCaseResult().withTestCaseStatus(TestCaseStatus.Failed))));
    events.put(
        "test suite updated",
        event(
            Entity.TEST_SUITE,
            EventType.ENTITY_UPDATED,
            new TestSuite()
                .withId(idOf("test suite"))
                .withName("suite")
                .withFullyQualifiedName(SUITE_FQN),
            updated("description", "new")));
    events.put(
        "data contract failed",
        event(
            Entity.DATA_CONTRACT,
            EventType.ENTITY_UPDATED,
            failedContract(),
            updated("latestResult", "{}")));
    events.put(
        "user created",
        event(
            Entity.USER,
            EventType.ENTITY_CREATED,
            new User().withId(idOf("user")).withName("newcomer").withFullyQualifiedName("newcomer"),
            null));
    events.put(
        "conversation about the table", conversationAbout(Entity.TABLE, TABLE_ID, TABLE_FQN));
    events.put(
        "conversation about the topic", conversationAbout(Entity.TOPIC, idOf("topic"), TOPIC_FQN));
    return events;
  }

  private static Table table(EntityReference owner) {
    return new Table()
        .withId(TABLE_ID)
        .withName("orders")
        .withFullyQualifiedName(TABLE_FQN)
        .withOwners(List.of(owner))
        .withDomains(
            List.of(
                new EntityReference()
                    .withId(idOf("domain"))
                    .withType(Entity.DOMAIN)
                    .withName(DOMAIN)
                    .withFullyQualifiedName(DOMAIN)));
  }

  private static Topic topic() {
    return new Topic()
        .withId(idOf("topic"))
        .withName("orders_topic")
        .withFullyQualifiedName(TOPIC_FQN);
  }

  private static DataContract failedContract() {
    return new DataContract()
        .withId(idOf("contract"))
        .withName("orders_contract")
        .withFullyQualifiedName(TABLE_FQN + ".orders_contract")
        .withEntity(
            new EntityReference()
                .withId(TABLE_ID)
                .withType(Entity.TABLE)
                .withFullyQualifiedName(TABLE_FQN))
        .withLatestResult(new LatestResult().withStatus(ContractExecutionStatus.Failed));
  }

  private static ChangeEvent conversationAbout(String entityType, UUID entityId, String fqn) {
    Conversation conversation =
        new Conversation()
            .withId(idOf("conversation about " + entityType))
            .withAbout("<#E::" + entityType + "::" + fqn + ">")
            .withEntityRef(
                new EntityReference()
                    .withId(entityId)
                    .withType(entityType)
                    .withFullyQualifiedName(fqn))
            .withMessage("Have a look <#E::user::" + ADMIN + "|@" + ADMIN + ">");
    return event("conversation", EventType.ENTITY_CREATED, conversation, null);
  }

  private static ChangeEvent event(
      String entityType, EventType eventType, Object entity, ChangeDescription change) {
    return new ChangeEvent()
        .withId(idOf(entityType + eventType + JsonUtils.pojoToJson(change)))
        .withEntityType(entityType)
        .withEventType(eventType)
        .withEntityId(
            JsonUtils.valueToTree(entity).has("id")
                ? UUID.fromString(JsonUtils.valueToTree(entity).get("id").asText())
                : null)
        .withEntityFullyQualifiedName(
            JsonUtils.valueToTree(entity).path("fullyQualifiedName").asText(null))
        .withUserName(ADMIN)
        .withTimestamp(1767225600000L)
        .withChangeDescription(change)
        .withEntity(JsonUtils.pojoToJson(entity));
  }

  private static ChangeDescription updated(String field, Object newValue) {
    return new ChangeDescription()
        .withPreviousVersion(0.1)
        .withFieldsUpdated(List.of(new FieldChange().withName(field).withNewValue(newValue)));
  }

  private static EntityReference adminReference() {
    User admin = Entity.getEntityByName(Entity.USER, ADMIN, "", Include.NON_DELETED);
    return new EntityReference().withId(admin.getId()).withType(Entity.USER).withName(ADMIN);
  }

  private static UUID idOf(String what) {
    return UUID.nameUUIDFromBytes(("parity " + what).getBytes());
  }
}
