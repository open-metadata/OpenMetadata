package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.formatter.util.FormatterUtil;

class EntityEventServiceTest {
  @Test
  void masksThePayloadWithoutChangingTheSourceEventOrEntity() {
    final DatabaseService entity = entity();
    final ChangeEvent source =
        FormatterUtil.createChangeEventForEntity("ingestion", EventType.ENTITY_UPDATED, entity);
    final var events =
        new EntityEventService<DatabaseService>(
            (actor, type, value) -> source, value -> {}, values -> {});
    final ChangeEvent recorded =
        JsonUtils.readValue(
            events.json(entity, EventType.ENTITY_UPDATED, "ingestion").orElseThrow(),
            ChangeEvent.class);
    assertEquals(source.getId(), recorded.getId());
    assertEquals(source.getEntityId(), recorded.getEntityId());
    assertEquals(source.getEntityType(), recorded.getEntityType());
    assertEquals(source.getEntityFullyQualifiedName(), recorded.getEntityFullyQualifiedName());
    assertEquals(source.getEventType(), recorded.getEventType());
    assertEquals(source.getUserName(), recorded.getUserName());
    assertEquals(source.getImpersonatedBy(), recorded.getImpersonatedBy());
    assertEquals(source.getTimestamp(), recorded.getTimestamp());
    assertEquals(source.getChangeDescription(), recorded.getChangeDescription());
    assertEquals(source.getCurrentVersion(), recorded.getCurrentVersion());
    assertEquals(source.getPreviousVersion(), recorded.getPreviousVersion());
    assertTrue(recorded.getEntity() instanceof String);
    assertFalse(recorded.getEntity().toString().contains("private-password"));
    assertEquals(0, JsonUtils.readTree(recorded.getEntity().toString()).get("connection").size());
    assertSame(entity, source.getEntity());
    assertTrue(JsonUtils.pojoToJson(entity).contains("private-password"));
  }

  @Test
  void recordsRecursiveAsyncEventsWithTheExistingStringPayload() {
    final List<String> stored = new ArrayList<>();
    final var events =
        new EntityEventService<>(
            FormatterUtil::createChangeEventForEntity, stored::add, stored::addAll);
    events.recordAsync(entity(), EventType.ENTITY_DELETED, true, "admin");
    final ChangeEvent event = JsonUtils.readValue(stored.getFirst(), ChangeEvent.class);
    assertTrue(event.getRecursive());
    assertEquals(EventType.ENTITY_DELETED, event.getEventType());
    assertEquals("admin", event.getUserName());
    assertTrue(event.getEntity() instanceof String);
  }

  @Test
  void skipsNoChangeAndAbsentAsyncInputs() {
    final List<String> stored = new ArrayList<>();
    final var events =
        new EntityEventService<>(
            FormatterUtil::createChangeEventForEntity, stored::add, stored::addAll);
    events.recordAsync(null, EventType.ENTITY_DELETED, true, "admin");
    events.recordAsync(entity(), null, true, "admin");
    events.recordAsync(entity(), EventType.ENTITY_NO_CHANGE, false, "admin");
    assertTrue(events.json(entity(), EventType.ENTITY_NO_CHANGE, "admin").isEmpty());
    assertTrue(events.json(entity(), null, "admin").isEmpty());
    assertTrue(stored.isEmpty());
  }

  @Test
  void supportsAnEventWithoutAnEntityPayload() {
    final var events =
        new EntityEventService<DatabaseService>(
            (actor, type, value) -> new ChangeEvent().withId(value.getId()).withEventType(type),
            value -> {},
            values -> {});
    final ChangeEvent recorded =
        JsonUtils.readValue(
            events.json(entity(), EventType.ENTITY_UPDATED, "admin").orElseThrow(),
            ChangeEvent.class);
    assertEquals(EventType.ENTITY_UPDATED, recorded.getEventType());
    assertNull(recorded.getEntity());
  }

  @Test
  void aFailedFormatterDoesNotPublishAnEvent() {
    final List<String> stored = new ArrayList<>();
    final var events =
        new EntityEventService<DatabaseService>(
            (actor, type, value) -> {
              throw new IllegalArgumentException("Invalid event payload");
            },
            stored::add,
            stored::addAll);
    assertDoesNotThrow(
        () -> events.recordAsync(entity(), EventType.ENTITY_DELETED, false, "admin"));
    assertTrue(stored.isEmpty());
  }

  @Test
  void retainsBatchOrderAndSkipsAbsentBatches() {
    final List<String> stored = new ArrayList<>();
    final var events =
        new EntityEventService<>(
            FormatterUtil::createChangeEventForEntity, stored::add, stored::addAll);
    events.insert("first");
    events.insertBatch(List.of("second", "third"));
    events.insertBatch(List.of());
    events.insertBatch(null);
    assertEquals(List.of("first", "second", "third"), stored);
  }

  @Test
  void persistenceFailuresRemainBestEffort() {
    final var events =
        new EntityEventService<>(
            FormatterUtil::createChangeEventForEntity,
            value -> {
              throw new IllegalStateException("Unavailable event store");
            },
            values -> {
              throw new IllegalStateException("Unavailable event store");
            });
    assertDoesNotThrow(() -> events.insert("event"));
    assertDoesNotThrow(() -> events.insertBatch(List.of("event")));
  }

  private DatabaseService entity() {
    return new DatabaseService()
        .withId(UUID.randomUUID())
        .withName("service")
        .withFullyQualifiedName("service")
        .withVersion(0.2)
        .withUpdatedAt(123L)
        .withUpdatedBy("ingestion")
        .withImpersonatedBy("admin")
        .withChangeDescription(
            new ChangeDescription()
                .withPreviousVersion(0.1)
                .withFieldsUpdated(
                    List.of(
                        new FieldChange()
                            .withName("description")
                            .withOldValue("before")
                            .withNewValue("after"))))
        .withConnection(
            new DatabaseConnection()
                .withConfig(
                    new MysqlConnection()
                        .withAuthType(new basicAuth().withPassword("private-password"))));
  }
}
