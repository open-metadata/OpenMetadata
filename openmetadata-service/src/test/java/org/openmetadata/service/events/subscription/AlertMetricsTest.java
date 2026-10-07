package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.events.subscription.ledger.LedgerKeys;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;

class AlertMetricsTest {

  private static final String OPENED_AT =
      "{\"currentOffset\":7,\"startingOffset\":7,\"timestamp\":1}";
  private static final String MOVED_BY_A_SKIP =
      "{\"currentOffset\":90,\"startingOffset\":90,\"timestamp\":2}";

  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

  @BeforeEach
  void listen() {
    Metrics.addRegistry(registry);
  }

  @AfterEach
  void stopListening() {
    Metrics.removeRegistry(registry);
  }

  @Test
  void everyAbsorbedFailureIsCounted() {
    EventSubscriptionDAO subscriptionDao = mock(EventSubscriptionDAO.class);
    when(subscriptionDao.compareAndSetSubscriberExtension(
            anyString(), eq(LedgerKeys.POSITION), anyString(), anyString()))
        .thenReturn(0);
    when(subscriptionDao.getSubscriberExtension(anyString(), eq(LedgerKeys.POSITION)))
        .thenReturn(MOVED_BY_A_SKIP);
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.eventSubscriptionDAO()).thenReturn(subscriptionDao);
    AlertLedger ledger =
        new AlertLedger(
            new EventSubscription().withId(UUID.randomUUID()),
            Map.of(LedgerKeys.POSITION, OPENED_AT));
    ledger.readUpTo(12L, 0L);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      ledger.commit();
    }

    assertEquals(1.0, absorbed(AlertTelemetry.POSITION_MOVED_BY_SOMEONE_ELSE));
  }

  private double absorbed(String what) {
    return registry.get("alert_absorbed").tag("what", what).counter().count();
  }
}
