package org.openmetadata.service.events.subscription;

import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.FreshReadScope;

/**
 * Reads of the stored alert, which is the authority for everything that schedules, runs, retires or
 * reports it. Every such read goes through here.
 */
@Slf4j
public final class AlertRows {

  // Status comes from the record plane when someone asks for it; a tick never needs it.
  private static final String STATUS_FIELD = "statusDetails";

  private AlertRows() {}

  /**
   * The alert's row as the database holds it. The read runs in a {@link FreshReadScope}, so no
   * cache answers for the row: not this node's, not what this thread read earlier, and not a
   * not-found marker, which can call an alert missing that still exists and would cost it its job
   * and its records. What the row does not hold itself, such as the notification template, is
   * resolved.
   *
   * @throws EntityNotFoundException when the alert is gone
   */
  @SuppressWarnings("unchecked")
  public static EventSubscription read(UUID alertId) {
    EntityRepository<EventSubscription> repository =
        (EntityRepository<EventSubscription>) Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);
    try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
      return repository.get(
          null,
          alertId,
          repository.getFields(everyFieldButStatus(repository)),
          Include.NON_DELETED,
          false);
    }
  }

  /** {@link #read(UUID)}, or null when the alert is gone. */
  public static EventSubscription readOrNull(UUID alertId) {
    EventSubscription alert = null;
    try {
      alert = read(alertId);
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
