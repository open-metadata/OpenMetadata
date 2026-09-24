package org.openmetadata.service.events.scheduled;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;

/** A scheduled round can fail in any way without the reconciler going quiet. */
class AlertReconcilerTest {
  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

  @BeforeEach
  void listen() {
    Metrics.addRegistry(registry);
  }

  @AfterEach
  void stopListening() {
    Metrics.removeRegistry(registry);
  }

  // An executor never runs a periodic task again once it throws.
  @Test
  void anErrorNeitherEscapesNorStopsTheLoop() {
    AlertReconciler reconciler = new AlertReconciler(mock(AlertJobView.class), 0);
    CollectionDAO dao = daoFailingWith(new StackOverflowError());

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      reconciler.runScheduledRound();
      reconciler.runScheduledRound();
    }

    assertEquals(2.0, failedRounds());
  }

  @Test
  void aRoundCutShortByStopIsNotAFailure() {
    AlertReconciler reconciler = new AlertReconciler(mock(AlertJobView.class), 0);
    reconciler.stop();
    CollectionDAO dao = daoFailingWith(new IllegalStateException());

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      reconciler.runScheduledRound();
    }

    assertEquals(0.0, failedRounds());
  }

  private static CollectionDAO daoFailingWith(Throwable failure) {
    EventSubscriptionDAO subscriptions = mock(EventSubscriptionDAO.class);
    when(subscriptions.databaseTimeMillis()).thenThrow(failure);
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.eventSubscriptionDAO()).thenReturn(subscriptions);
    return dao;
  }

  private double failedRounds() {
    Counter failed =
        registry.find(ReconcilerMetrics.ROUNDS).tag("outcome", ReconcilerMetrics.FAILED).counter();
    return Optional.ofNullable(failed).map(Counter::count).orElse(0.0);
  }
}
