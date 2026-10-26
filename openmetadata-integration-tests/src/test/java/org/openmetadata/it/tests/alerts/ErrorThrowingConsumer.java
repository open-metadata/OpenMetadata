package org.openmetadata.it.tests.alerts;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.alerting.AlertPublisher;
import org.openmetadata.service.util.DIContainer;

/** An alert consumer whose tick dies with an Error on one chosen event, as an out-of-memory would. */
public class ErrorThrowingConsumer extends AlertPublisher {
  static final String ID = "test.errorThrowing";

  private static final Map<UUID, UUID> POISONED = new ConcurrentHashMap<>();

  public ErrorThrowingConsumer(DIContainer dependencies) {
    super(dependencies);
  }

  static void poison(UUID alertId, UUID eventId) {
    POISONED.put(alertId, eventId);
  }

  static void cure(UUID alertId) {
    POISONED.remove(alertId);
  }

  @Override
  protected void handle(List<ChangeEvent> events) {
    UUID poisoned = POISONED.get(getEventSubscription().getId());
    if (events.stream().anyMatch(event -> event.getId().equals(poisoned))) {
      throw new OutOfMemoryError("Simulated: rendering this event filled the heap");
    }
    super.handle(events);
  }
}
