package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;

class EntityRepositoryBulkEventTest {
  @Test
  void updateEventUsesTheRequestDeltaInsteadOfTheStoredVersionDelta() {
    final var topic = topic();
    final var repository = mock(TopicRepository.class, CALLS_REAL_METHODS);
    final var event =
        JsonUtils.readValue(
            repository
                .buildChangeEventJsonForBulkOperation(topic, EventType.ENTITY_UPDATED, "admin")
                .orElseThrow(),
            ChangeEvent.class);

    assertEquals(topic.getIncrementalChangeDescription(), event.getChangeDescription());
    assertEquals(0.2, event.getPreviousVersion());
    assertEquals(0.3, topic.getChangeDescription().getPreviousVersion());
  }

  @Test
  void restoreEventRetainsTheStoredDeltaAndNoChangeProducesNoEvent() {
    final var topic = topic();
    final var repository = mock(TopicRepository.class, CALLS_REAL_METHODS);
    final var event =
        JsonUtils.readValue(
            repository
                .buildChangeEventJsonForBulkOperation(topic, EventType.ENTITY_RESTORED, "admin")
                .orElseThrow(),
            ChangeEvent.class);

    assertEquals(topic.getChangeDescription(), event.getChangeDescription());
    assertEquals(0.3, event.getPreviousVersion());
    assertTrue(
        repository
            .buildChangeEventJsonForBulkOperation(topic, EventType.ENTITY_NO_CHANGE, "admin")
            .isEmpty());
  }

  private static Topic topic() {
    return new Topic()
        .withId(UUID.randomUUID())
        .withName("orders")
        .withFullyQualifiedName("service.orders")
        .withUpdatedAt(1L)
        .withVersion(0.4)
        .withChangeDescription(new ChangeDescription().withPreviousVersion(0.3))
        .withIncrementalChangeDescription(
            new ChangeDescription()
                .withPreviousVersion(0.2)
                .withFieldsUpdated(
                    List.of(
                        new FieldChange()
                            .withName("deleted")
                            .withOldValue(true)
                            .withNewValue(false))));
  }
}
