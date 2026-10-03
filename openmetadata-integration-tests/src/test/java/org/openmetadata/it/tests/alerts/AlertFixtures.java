package org.openmetadata.it.tests.alerts;

import java.util.UUID;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.util.RequestEntityCache;

final class AlertFixtures {

  private AlertFixtures() {}

  // Never from a cache: a test thread keeps what it read before, as any thread does.
  static EventSubscription stored(UUID alertId) {
    RequestEntityCache.invalidate(Entity.EVENT_SUBSCRIPTION, alertId, null);
    return repository().get(null, alertId, repository().getFields("*"), Include.NON_DELETED, false);
  }

  /** Writes the row as an upgrade or another product would, behind the server's back. */
  static EventSubscription writeBehindTheServer(EventSubscription alert) {
    dao().update(alert);
    EntityRepository.invalidateCacheForEntity(
        Entity.EVENT_SUBSCRIPTION, alert.getId(), alert.getFullyQualifiedName());
    return stored(alert.getId());
  }

  static EventSubscriptionDAO dao() {
    return Entity.getCollectionDAO().eventSubscriptionDAO();
  }

  static EventSubscriptionRepository repository() {
    return (EventSubscriptionRepository) Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);
  }
}
