package org.openmetadata.service.events.subscription;

import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;

/**
 * Reads of the stored alert, which is the authority for everything that schedules, runs, retires or
 * reports it. Every such read goes through here.
 */
@Slf4j
public final class AlertRows {

  private AlertRows() {}

  /**
   * The alert as its own row holds it, with its notification template, which lives in a
   * relationship, resolved. The read bypasses the caches, so every node sees an edit at once and a
   * not-found marker cannot call a live alert gone; callers read again to learn whether the alert
   * changed in the meantime. Relations no decision uses, such as owners and domains, are not read.
   *
   * @throws EntityNotFoundException when the alert is gone
   */
  public static EventSubscription read(UUID alertId) {
    EventSubscription alert = readOrNull(alertId);
    if (alert == null) {
      throw new EntityNotFoundException(entityNotFound(Entity.EVENT_SUBSCRIPTION, alertId));
    }
    return alert;
  }

  /**
   * {@link #read(UUID)}, or null when the alert is gone. Only the alert's own row decides that: the
   * template is resolved once the row is known to exist, so no related row can make it look gone.
   */
  public static EventSubscription readOrNull(UUID alertId) {
    EventSubscriptionRepository repository =
        (EventSubscriptionRepository) Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);
    EventSubscription alert = ownRowOrNull(repository, alertId);
    return alert == null ? null : alert.withNotificationTemplate(repository.templateOf(alertId));
  }

  private static EventSubscription ownRowOrNull(
      EventSubscriptionRepository repository, UUID alertId) {
    EventSubscription alert = null;
    try {
      alert = repository.find(alertId, Include.NON_DELETED, false);
    } catch (EntityNotFoundException e) {
      LOG.debug("Alert {} no longer exists", alertId);
    }
    return alert;
  }
}
