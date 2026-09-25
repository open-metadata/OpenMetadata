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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.AlertingSettings;
import org.openmetadata.service.events.subscription.targets.Target;
import org.openmetadata.service.events.subscription.targets.TargetResolver;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.notifications.EventContent;

/**
 * Sends one event through one channel. The channel's destinations become targets, what is sent
 * is made once, and each target is sent to once, through the destination that produced it first.
 * Every outcome is shared by all the destinations that produced that target, which is what lets
 * each destination report its own health.
 */
@Slf4j
final class ChannelDispatch {
  private static final String NO_FILE = "the file it carries could not be produced";

  private final Map<UUID, Destination<ChangeEvent>> publishers = new LinkedHashMap<>();
  private final TargetResolver resolver;
  private final TickHealth health;

  ChannelDispatch(
      List<Destination<ChangeEvent>> ofOneChannel, TargetResolver resolver, TickHealth health) {
    ofOneChannel.forEach(
        publisher -> publishers.put(publisher.getSubscriptionDestination().getId(), publisher));
    this.resolver = resolver;
    this.health = health;
  }

  /** Empty when the channel delivered the event, otherwise the one failure recorded for it. */
  Optional<EventPublisherException> send(ChangeEvent event, EventContent content)
      throws EventPublisherException {
    Destination<ChangeEvent> first = publishers.values().iterator().next();
    Optional<String> cannotSend = first.notAttemptedBecause();
    if (cannotSend.isPresent()) {
      publishers.keySet().forEach(id -> health.notAttempted(id, cannotSend.get()));
      return Optional.empty();
    }
    if (first.requiresAFile() && content.attachment().isEmpty()) {
      publishers.keySet().forEach(id -> health.notAttempted(id, NO_FILE));
      return Optional.empty();
    }
    TargetResolver.Resolved resolved = resolve(event, first);
    resolved.failedLookups().forEach(health::lookupFailed);
    Failures failures = new Failures();
    resolved
        .failedLookups()
        .forEach((destinationId, reason) -> failures.add(destinationId, reason));
    if (!resolved.targets().isEmpty()) {
      Object prepared = first.prepare(event, content);
      sendToEach(resolved.targets(), prepared).forEach(outcome -> record(outcome, failures));
    }
    return failures.asOneFailure(event, first, resolved.targets().size());
  }

  private TargetResolver.Resolved resolve(ChangeEvent event, Destination<ChangeEvent> first) {
    List<SubscriptionDestination> destinations =
        publishers.values().stream().map(Destination::getSubscriptionDestination).toList();
    return first.requiresRecipients()
        ? resolver.resolve(event, destinations)
        : TargetResolver.themselves(destinations);
  }

  private record Outcome(Target target, Exception failure, SubscriptionStatus left) {}

  // One after another unless the setting says otherwise. Either way every target of this event
  // is done before this returns, so the next event never starts early, and what each send
  // learned is recorded here, on the tick's own thread, in the order of the targets.
  private List<Outcome> sendToEach(List<Target> targets, Object prepared) {
    int atOnce = AlertingSettings.current().sending().targetSendConcurrency();
    return atOnce > 1 && targets.size() > 1
        ? sendTogether(targets, prepared, atOnce)
        : targets.stream().map(target -> sendTo(target, prepared)).toList();
  }

  private List<Outcome> sendTogether(List<Target> targets, Object prepared, int atOnce) {
    TickMemory ofTheTick = TickMemory.current();
    Semaphore slots = new Semaphore(atOnce);
    try (ExecutorService threads = Executors.newVirtualThreadPerTaskExecutor()) {
      List<Future<Outcome>> sends =
          targets.stream()
              .map(target -> threads.submit(() -> inASlot(slots, ofTheTick, target, prepared)))
              .toList();
      return sends.stream().map(ChannelDispatch::outcomeOf).toList();
    }
  }

  private Outcome inASlot(Semaphore slots, TickMemory ofTheTick, Target target, Object prepared)
      throws InterruptedException {
    slots.acquire();
    TickMemory.adopt(ofTheTick);
    try {
      return sendTo(target, prepared);
    } finally {
      TickMemory.end();
      slots.release();
    }
  }

  private static Outcome outcomeOf(Future<Outcome> send) {
    try {
      return send.get();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while an event's targets were being sent", e);
    } catch (ExecutionException e) {
      throw new IllegalStateException(e.getCause());
    }
  }

  private Outcome sendTo(Target target, Object prepared) {
    Destination<ChangeEvent> publisher = publishers.get(target.sentThrough());
    SendStatus.take();
    Optional<Exception> failure =
        IsolatedSends.attemptOne(
            target.recipient() == null ? target.identity() : target.recipient(),
            ignored -> publisher.sendTo(prepared, target.recipient()));
    return new Outcome(target, failure.orElse(null), SendStatus.take());
  }

  private void record(Outcome outcome, Failures failures) {
    Target target = outcome.target();
    if (outcome.failure() == null) {
      target.origins().forEach(origin -> health.delivered(origin, target.identity()));
    } else {
      String reason = String.valueOf(outcome.failure().getMessage());
      LOG.warn("Send to one recipient failed: {}", reason);
      target
          .origins()
          .forEach(
              origin ->
                  health.failed(origin, target.identity(), target.name(), reason, outcome.left()));
      failures.add(target.sentThrough(), reason);
    }
  }

  private static final class Failures {
    private int count;
    private UUID firstDestination;
    private String firstReason;

    private void add(UUID destinationId, String reason) {
      count++;
      if (firstReason == null) {
        firstDestination = destinationId;
        firstReason = reason;
      }
    }

    private Optional<EventPublisherException> asOneFailure(
        ChangeEvent event, Destination<ChangeEvent> first, int attempted) {
      EventPublisherException failure = null;
      if (firstReason != null) {
        String reason =
            String.format("%d of %d recipients failed: %s", count, attempted, firstReason);
        failure =
            new EventPublisherException(
                CatalogExceptionMessage.eventPublisherFailedToPublish(
                    first.getSubscriptionDestination().getType(), reason),
                Pair.of(firstDestination, event));
      }
      return Optional.ofNullable(failure);
    }
  }
}
