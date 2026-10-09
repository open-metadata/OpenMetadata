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
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
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
import java.util.function.BiFunction;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.subscription.AlertingSettings;
import org.openmetadata.service.events.subscription.AlertingSettings.Sending;
import org.openmetadata.service.events.subscription.channels.Channel;
import org.openmetadata.service.notifications.EventContent;
import org.openmetadata.service.notifications.recipients.RecipientResolver;
import org.openmetadata.service.notifications.recipients.Recipients;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;

class ChannelDispatchTest {
  private static final ChangeEvent EVENT = new ChangeEvent().withId(UUID.randomUUID());
  private static final EventContent CONTENT = new EventContent(EVENT, new EventSubscription());
  private final TickHealth health = new TickHealth();
  private final Channel channel = mock(Channel.class);

  // A destination that is its own target has an outcome, so it has a health of its own.
  @Test
  void activityFeedDestinationHasHealth() throws Exception {
    Destination<ChangeEvent> feed = publisher(false);

    ChannelResult result = dispatch(Set.of(), feed).send(EVENT, CONTENT);

    assertEquals(ChannelResult.DELIVERED, result);
    verify(feed).sendTo(any(), any());
    assertEquals(SubscriptionStatus.Status.ACTIVE, statusOf(feed).getStatus());
  }

  // Asked of the channel once, before anyone is looked up or anything is rendered.
  @Test
  void unavailableChannelResolvesNothing() throws Exception {
    Destination<ChangeEvent> email = publisher(true);
    when(channel.unavailableBecause()).thenReturn(Optional.of("the mail server is not enabled"));
    List<SubscriptionDestination> asked = new ArrayList<>();
    RecipientResolver resolver =
        recipients(
            (event, destination) -> {
              asked.add(destination);
              return Recipients.none();
            });

    ChannelResult result =
        new ChannelDispatch(channel, List.of(email), resolver, health).send(EVENT, CONTENT);

    assertNotAttempted("the mail server is not enabled", email, result);
    assertTrue(asked.isEmpty());
    verify(email, never()).prepare(any(), any());
    verify(email, never()).sendTo(any(), any());
    assertEquals(
        "Not attempted: the mail server is not enabled", statusOf(email).getLastFailedReason());
  }

  // A report whose file could not be produced sends nothing through a channel that carries
  // files. A channel that never carries files sends its message, as it always has.
  @Test
  void requiredFileMissingIsNotAttemptedOnlyWhereFilesAreAccepted() throws Exception {
    EventContent fileNotProduced = mock(EventContent.class);
    when(fileNotProduced.requiredFileMissing()).thenReturn(true);
    Channel reportChannel = mock(Channel.class);
    when(reportChannel.acceptsFiles()).thenReturn(true);
    Destination<ChangeEvent> report = publisher(true);
    Destination<ChangeEvent> email = publisher(true);
    RecipientResolver alice =
        recipients(
            (event, destination) -> Recipients.of(new EmailRecipient("alice@corp.com", "alice")));

    ChannelResult reportResult =
        new ChannelDispatch(reportChannel, List.of(report), alice, health)
            .send(EVENT, fileNotProduced);
    new ChannelDispatch(channel, List.of(email), alice, health).send(EVENT, fileNotProduced);

    assertNotAttempted("the file it carries could not be produced", report, reportResult);
    verify(report, never()).sendTo(any(), any());
    assertEquals(
        "Not attempted: the file it carries could not be produced",
        statusOf(report).getLastFailedReason());
    verify(email).sendTo(any(), any());
  }

  // An audience the channel reaches nobody in sends nothing: the event failed, and the destination
  // reads why.
  @Test
  void nobodyToSendToFailsTheEvent() throws Exception {
    Destination<ChangeEvent> owners = publisher(true, SubscriptionCategory.OWNERS);

    ChannelResult result = dispatch(Set.of(), owners).send(EVENT, CONTENT);

    assertNotAttempted("no Owners with an Email address", owners, result);
    verify(owners, never()).prepare(any(), any());
    verify(owners, never()).sendTo(any(), any());
    assertEquals(
        "Not attempted: no Owners with an Email address", statusOf(owners).getLastFailedReason());
  }

  // Reaching someone for one event of the tick is enough to read delivered; the event that had
  // nobody still failed.
  @Test
  void aDestinationThatReachedSomeoneInTheTickReadsActive() throws Exception {
    Destination<ChangeEvent> owners = publisher(true, SubscriptionCategory.OWNERS);
    Recipient alice = new EmailRecipient("alice@corp.com", "alice");

    ChannelResult reached = dispatch(Set.of(alice), owners).send(EVENT, CONTENT);
    ChannelResult nobody = dispatch(Set.of(), owners).send(EVENT, CONTENT);

    assertEquals(ChannelResult.DELIVERED, reached);
    assertInstanceOf(ChannelResult.Failed.class, nobody);
    assertEquals(SubscriptionStatus.Status.ACTIVE, statusOf(owners).getStatus());
  }

  @Test
  void oneFailingTargetCostsOnlyItself() throws Exception {
    Destination<ChangeEvent> owners = publisher(true);
    Recipient alice = new EmailRecipient("alice@corp.com", "alice");
    Recipient bob = new EmailRecipient("bob@corp.com", "bob");
    doThrow(new IllegalStateException("mailbox full")).when(owners).sendTo(any(), eq(bob));

    ChannelResult result = dispatch(Set.of(alice, bob), owners).send(EVENT, CONTENT);

    verify(owners).sendTo(any(), eq(alice));
    assertTrue(
        assertInstanceOf(ChannelResult.Failed.class, result)
            .failure()
            .reason()
            .contains("1 of 2 recipients failed"));
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

  // A team that could not be read fails its destination; the people who were found still receive.
  @Test
  void lookupFailureFailsTheDestinationAndFoundRecipientsStillReceive() throws Exception {
    Destination<ChangeEvent> owners = publisher(true);
    Recipient alice = new EmailRecipient("alice@corp.com", "alice");
    ChannelDispatch dispatch =
        new ChannelDispatch(
            channel,
            List.of(owners),
            recipients(
                (event, destination) ->
                    Recipients.of(alice).and(Recipients.failed("team A: no answer"))),
            health);

    ChannelResult result = dispatch.send(EVENT, CONTENT);

    verify(owners).sendTo(any(), eq(alice));
    assertInstanceOf(ChannelResult.Failed.class, result);
    assertEquals(SubscriptionStatus.Status.FAILED, statusOf(owners).getStatus());
    assertTrue(statusOf(owners).getLastFailedReason().contains("team A: no answer"));
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
        channel,
        List.of(publisher),
        recipients((event, destination) -> Recipients.of(found)),
        health);
  }

  private static void assertNotAttempted(
      String why, Destination<ChangeEvent> publisher, ChannelResult result) {
    ChannelResult.Failed failed =
        assertInstanceOf(ChannelResult.Failed.class, result, "nothing went out, so it failed");
    assertEquals(publisher.getSubscriptionDestination().getId(), failed.failure().destinationId());
    assertTrue(
        failed.failure().reason().contains("Not attempted: " + why), failed.failure().reason());
  }

  private SubscriptionStatus statusOf(Destination<ChangeEvent> publisher) {
    Map<UUID, SubscriptionStatus> reported = new HashMap<>();
    health.reportTo((destinationId, outcome) -> reported.put(destinationId, outcome.status()));
    return reported.get(publisher.getSubscriptionDestination().getId());
  }

  private static Destination<ChangeEvent> publisher(boolean requiresRecipients) throws Exception {
    return publisher(requiresRecipients, null);
  }

  @SuppressWarnings("unchecked")
  private static Destination<ChangeEvent> publisher(
      boolean requiresRecipients, SubscriptionCategory category) throws Exception {
    Destination<ChangeEvent> publisher = mock(Destination.class);
    SubscriptionDestination destination =
        new SubscriptionDestination()
            .withType(SubscriptionDestination.SubscriptionType.EMAIL)
            .withId(UUID.randomUUID())
            .withEnabled(true)
            .withCategory(category);
    when(publisher.getSubscriptionDestination()).thenReturn(destination);
    when(publisher.requiresRecipients()).thenReturn(requiresRecipients);
    return publisher;
  }

  // Answers every lookup the way the test says, whatever the channel's directory and receivers.
  private static RecipientResolver recipients(
      BiFunction<ChangeEvent, SubscriptionDestination, Recipients> answer) {
    RecipientResolver resolver = mock(RecipientResolver.class);
    when(resolver.recipientsOf(any(), any(), any(), any()))
        .thenAnswer(lookup -> answer.apply(lookup.getArgument(0), lookup.getArgument(1)));
    return resolver;
  }
}
