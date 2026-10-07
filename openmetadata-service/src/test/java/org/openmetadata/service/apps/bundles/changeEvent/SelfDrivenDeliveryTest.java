/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.apps.bundles.changeEvent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.SLACK;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatcher;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.DIContainer;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.Scheduler;

/**
 * A consumer that makes its own work sends it through the alert's channels, as an event alert's
 * changes are sent: the same isolation, and the same health, written when the tick ends.
 */
class SelfDrivenDeliveryTest {
  private static final ChangeEvent WORK = new ChangeEvent().withId(UUID.randomUUID());

  @Test
  void itDeliversThroughTheAlertsChannelsAndTheTickWritesTheirHealth() throws Exception {
    EventSubscription alert = alertWith(WEBHOOK, SLACK);
    Destination<ChangeEvent> webhook = publisherOf(alert.getDestinations().get(0));
    Destination<ChangeEvent> slack = publisherOf(alert.getDestinations().get(1));
    doThrow(new IllegalStateException("channel archived")).when(slack).sendTo(any(), any());
    MakesItsOwnWork consumer = new MakesItsOwnWork();
    AlertLedger ledger = spy(TestLedgers.fresh(alert.getId()));

    tick(consumer, alert, ledger, List.of(webhook, slack));

    verify(webhook).sendTo(any(), any());
    verify(slack).sendTo(any(), any());
    assertEquals(1, consumer.delivery.delivered());
    assertEquals(1, consumer.delivery.failures().size());
    assertEquals(1, ledger.pending().successEvents());
    assertEquals(1, ledger.pending().failedEvents());
    Map<UUID, SubscriptionStatus> health = healthReportedTo(ledger, alert);
    assertEquals(SubscriptionStatus.Status.ACTIVE, health.get(idOf(webhook)).getStatus());
    assertEquals(SubscriptionStatus.Status.FAILED, health.get(idOf(slack)).getStatus());
  }

  @Test
  void itsChannelsExistOnlyWhileItsTickRuns() {
    MakesItsOwnWork consumer = new MakesItsOwnWork();

    assertThrows(IllegalStateException.class, consumer::channels);
  }

  /** Sends one piece of work through the alert's channels and counts what they did with it. */
  static final class MakesItsOwnWork extends AbstractEventConsumer implements SelfDrivenConsumer {
    private Delivery delivery;

    MakesItsOwnWork() {
      super(mock(DIContainer.class));
    }

    @Override
    protected void doInit(JobExecutionContext context) {
      delivery = channels().deliver(WORK);
      recordDelivery(delivery.delivered(), delivery.failures().size());
    }

    @Override
    public void commit(JobExecutionContext jobExecutionContext) {}

    @Override
    public boolean sendAlert(UUID receiverId, ChangeEvent event) {
      return false;
    }

    @Override
    public boolean getEnabled() {
      return true;
    }
  }

  private static void tick(
      MakesItsOwnWork consumer,
      EventSubscription alert,
      AlertLedger ledger,
      List<Destination<ChangeEvent>> publishers) {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<AlertFactory> factory = mockStatic(AlertFactory.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(mock(CollectionDAO.class));
      for (Destination<ChangeEvent> publisher : publishers) {
        UUID id = idOf(publisher);
        factory.when(() -> AlertFactory.getAlert(any(), argThat(isThe(id)))).thenReturn(publisher);
      }
      consumer.tick(alert, ledger, contextOfAnUnscheduledJob());
    }
  }

  private static Map<UUID, SubscriptionStatus> healthReportedTo(
      AlertLedger ledger, EventSubscription alert) {
    Map<UUID, SubscriptionStatus> reported = new HashMap<>();
    for (SubscriptionDestination destination : alert.getDestinations()) {
      verify(ledger)
          .destinationOutcome(
              argThat(destination.getId()::equals),
              argThat(
                  outcome -> {
                    reported.put(destination.getId(), outcome.status());
                    return true;
                  }));
    }
    return reported;
  }

  private static EventSubscription alertWith(SubscriptionDestination.SubscriptionType... types) {
    List<SubscriptionDestination> destinations =
        Arrays.stream(types)
            .map(
                type ->
                    new SubscriptionDestination()
                        .withId(UUID.randomUUID())
                        .withType(type)
                        .withEnabled(true))
            .toList();
    return new EventSubscription()
        .withId(UUID.randomUUID())
        .withName("credits")
        .withDestinations(destinations);
  }

  // Its own target, so nobody is looked up.
  @SuppressWarnings("unchecked")
  private static Destination<ChangeEvent> publisherOf(SubscriptionDestination destination)
      throws Exception {
    Destination<ChangeEvent> publisher = mock(Destination.class);
    when(publisher.getSubscriptionDestination()).thenReturn(destination);
    when(publisher.getEnabled()).thenReturn(true);
    when(publisher.requiresRecipients()).thenReturn(false);
    when(publisher.prepare(any(), any())).thenReturn(WORK);
    return publisher;
  }

  private static ArgumentMatcher<SubscriptionDestination> isThe(UUID id) {
    return destination -> destination != null && id.equals(destination.getId());
  }

  private static UUID idOf(Destination<ChangeEvent> publisher) {
    return publisher.getSubscriptionDestination().getId();
  }

  private static JobExecutionContext contextOfAnUnscheduledJob() {
    JobExecutionContext context = mock(JobExecutionContext.class);
    when(context.getJobDetail()).thenReturn(mock(JobDetail.class));
    when(context.getScheduler()).thenReturn(mock(Scheduler.class));
    return context;
  }
}
