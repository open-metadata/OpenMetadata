package org.openmetadata.service.events.subscription;

import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.RequestEntityCache;

/** Reads of the stored alert, which is the authority for everything that schedules or runs it. */
@Slf4j
public final class AlertRows {

  // Status comes from the record plane when someone asks for it; a tick never needs it.
  private static final String STATUS_FIELD = "statusDetails";

  private AlertRows() {}

  /**
   * Through the repository with the cache bypassed, so every node sees an edit at once and what
   * the row does not hold itself, such as the notification template, is resolved. Null when the
   * alert is gone.
   */
  @SuppressWarnings("unchecked")
  public static EventSubscription readOrNull(UUID alertId) {
    EntityRepository<EventSubscription> repository =
        (EntityRepository<EventSubscription>) Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);
    EventSubscription alert = null;
    // A thread keeps what it read earlier, and a tick reads its alert again before it ends.
    RequestEntityCache.invalidate(Entity.EVENT_SUBSCRIPTION, alertId, null);
    try {
      alert =
          repository.get(
              null,
              alertId,
              repository.getFields(everyFieldButStatus(repository)),
              Include.NON_DELETED,
              false);
    } catch (EntityNotFoundException e) {
      LOG.debug("Alert {} no longer exists", alertId);
    }
    return alert;
  }

  private static String everyFieldButStatus(EntityRepository<EventSubscription> repository) {
    return repository.getAllowedFields().stream()
        .filter(field -> !STATUS_FIELD.equals(field))
        .collect(Collectors.joining(","));
  }
}
