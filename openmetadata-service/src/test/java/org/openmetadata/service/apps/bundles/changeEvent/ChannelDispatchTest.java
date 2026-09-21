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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.AlertingSettings;
import org.openmetadata.service.events.subscription.AlertingSettings.Sending;
import org.openmetadata.service.events.subscription.channels.builtin.BuiltInChannels;
import org.openmetadata.service.events.subscription.targets.TargetResolver;
import org.openmetadata.service.notifications.EventContent;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;

class ChannelDispatchTest {
  private static final ChangeEvent EVENT = new ChangeEvent().withId(UUID.randomUUID());
  private static final EventContent CONTENT = new EventContent(EVENT, new EventSubscription());
  private final TickHealth health = new TickHealth();

  // A destination that is its own target has an outcome, so it has a health of its own.
  @Test
  void activityFeedDestinationHasHealth() throws Exception {
    Destination<ChangeEvent> feed = publisher(false);

    Optional<EventPublisherException> failure = dispatch(Set.of(), feed).send(EVENT, CONTENT);

    assertTrue(failure.isEmpty());
    verify(feed).sendTo(any(), any());
    assertEquals(SubscriptionStatus.Status.ACTIVE, statusOf(feed).getStatus());
  }

  @Test
  void smtpOffResolvesNothingAndIsNotAttempted() throws Exception {
    Destination<ChangeEvent> email = publisher(true);
    when(email.notAttemptedBecause()).thenReturn(Optional.of("the mail server is not enabled"));
    List<SubscriptionDestination> asked = new ArrayList<>();
    TargetResolver resolver =
        new TargetResolver(
            (event, destination) -> {
              asked.add(destination);
              return Set.of();
            });

    Optional<EventPublisherException> failure =
        new ChannelDispatch(List.of(email), resolver, health).send(EVENT, CONTENT);

    assertTrue(
        failure.isEmpty(), "it counts as delivered, as a mail server that is off does today");
    assertTrue(asked.isEmpty());
    verify(email, never()).prepare(any(), any());
    verify(email, never()).sendTo(any(), any());
    assertEquals(
        "Not attempted: the mail server is not enabled", statusOf(email).getLastFailedReason());
  }

  @Test
  void unregisteredDeclaredChannelIsNotAttempted() throws Exception {
    SubscriptionDestination destination =
        BuiltInChannels.previewDestination().withId(UUID.randomUUID()).withEnabled(true);
    Destination<ChangeEvent> unserved =
        AlertFactory.getAlert(
            new EventSubscription(),
            destination,
            Map.of(destination.getType().value(), "not.registered.here"));

    Optional<EventPublisherException> failure = dispatch(Set.of(), unserved).send(EVENT, CONTENT);

    assertTrue(failure.isEmpty());
    SubscriptionStatus status = statusOf(unserved);
    assertEquals(SubscriptionStatus.Status.FAILED, status.getStatus());
    assertTrue(status.getLastFailedReason().startsWith("Not attempted: "));
  }

  // A report whose file could not be produced sends nothing, as the report senders do today.
  @Test
  void requiredAttachmentMissingIsNotAttempted() throws Exception {
    Destination<ChangeEvent> report = publisher(true);
    when(report.requiresAFile()).thenReturn(true);

    Optional<EventPublisherException> failure =
        dispatch(Set.of(new EmailRecipient("alice@corp.com", "alice")), report)
            .send(EVENT, CONTENT);

    assertTrue(failure.isEmpty());
    verify(report, never()).sendTo(any(), any());
    assertEquals(
        "Not attempted: the file it carries could not be produced",
        statusOf(report).getLastFailedReason());
  }

  @Test
  void oneFailingTargetCostsOnlyItself() throws Exception {
    Destination<ChangeEvent> owners = publisher(true);
    Recipient alice = new EmailRecipient("alice@corp.com", "alice");
    Recipient bob = new EmailRecipient("bob@corp.com", "bob");
    doThrow(new IllegalStateException("mailbox full")).when(owners).sendTo(any(), eq(bob));

    Optional<EventPublisherException> failure =
        dispatch(Set.of(alice, bob), owners).send(EVENT, CONTENT);

    verify(owners).sendTo(any(), eq(alice));
    assertTrue(failure.orElseThrow().getMessage().contains("1 of 2 recipients failed"));
    assertEquals(
        "1 of 2 recipients failed. bob: mailbox full", statusOf(owners).getLastFailedReason());
  }

  @Test
  void targetsOfOneEventAreSentTogetherOnlyWhenSet() throws Exception {
    assertEquals(1, mostSendsAtOnce(1), "one after another, as the server has always sent");
    assertTrue(mostSendsAtOnce(3) > 1, "together when the setting says so");
  }

  @Test
  void nextEventStartsAfterEveryTargetOfThePreviousOne() throws Exception {
    AlertingSettings.use(AlertingSettings.current().withSending(new Sending(false, false, 4)));
    try {
      AtomicInteger done = new AtomicInteger();
      Destination<ChangeEvent> owners = publisher(true);
      doAnswer(
              send -> {
                TimeUnit.MILLISECONDS.sleep(30);
                return done.incrementAndGet();
              })
          .when(owners)
          .sendTo(any(), any());

      dispatch(people(6), owners).send(EVENT, CONTENT);

      assertEquals(6, done.get(), "every target is done by the time the event is");
    } finally {
      AlertingSettings.use(AlertingSettings.current().withSending(Sending.AS_BEFORE));
    }
  }

  private int mostSendsAtOnce(int targetSendConcurrency) throws Exception {
    AlertingSettings.use(
        AlertingSettings.current().withSending(new Sending(false, false, targetSendConcurrency)));
    try {
      AtomicInteger inFlight = new AtomicInteger();
      AtomicInteger most = new AtomicInteger();
      Destination<ChangeEvent> owners = publisher(true);
      doAnswer(
              send -> {
                most.accumulateAndGet(inFlight.incrementAndGet(), Math::max);
                TimeUnit.MILLISECONDS.sleep(40);
                return inFlight.decrementAndGet();
              })
          .when(owners)
          .sendTo(any(), any());

      dispatch(people(6), owners).send(EVENT, CONTENT);

      return most.get();
    } finally {
      AlertingSettings.use(AlertingSettings.current().withSending(Sending.AS_BEFORE));
    }
  }

  private static Set<Recipient> people(int howMany) {
    Set<Recipient> people = new HashSet<>();
    for (int person = 0; person < howMany; person++) {
      people.add(new EmailRecipient("person" + person + "@corp.com", "person" + person));
    }
    return people;
  }

  private ChannelDispatch dispatch(Set<Recipient> found, Destination<ChangeEvent> publisher) {
    return new ChannelDispatch(
        List.of(publisher), new TargetResolver((event, destination) -> found), health);
  }

  private SubscriptionStatus statusOf(Destination<ChangeEvent> publisher) {
    Map<UUID, SubscriptionStatus> reported = new HashMap<>();
    health.reportTo(reported::put);
    return reported.get(publisher.getSubscriptionDestination().getId());
  }

  @SuppressWarnings("unchecked")
  private static Destination<ChangeEvent> publisher(boolean requiresRecipients) throws Exception {
    Destination<ChangeEvent> publisher = mock(Destination.class);
    SubscriptionDestination destination =
        BuiltInChannels.previewDestination().withId(UUID.randomUUID()).withEnabled(true);
    when(publisher.getSubscriptionDestination()).thenReturn(destination);
    when(publisher.requiresRecipients()).thenReturn(requiresRecipients);
    when(publisher.notAttemptedBecause()).thenReturn(Optional.empty());
    return publisher;
  }
}
