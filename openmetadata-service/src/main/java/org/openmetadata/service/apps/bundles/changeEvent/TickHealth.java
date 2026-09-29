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

import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.ACTIVE;
import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.AWAITING_RETRY;
import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.FAILED;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.ledger.DestinationOutcome;
import org.openmetadata.service.events.subscription.ledger.DestinationOutcome.Cause;

/**
 * What a tick learned about each destination. A destination's outcome is the sum of what happened
 * to the targets it produced: every one delivered is delivered, and a failure is a failure, saying
 * how many of how many recipients failed and naming the first. A failure outranks a lookup that
 * failed, which outranks not being attempted, and nothing learned later in the tick erases a
 * failure. Finding nobody to send to is the weakest: a destination that reached anyone in the tick
 * reads delivered, and one that reached nobody at all reads not attempted, with why.
 */
final class TickHealth {

  private static final class Tally {
    private final Set<Object> attempted = new HashSet<>();
    private final Set<Object> failed = new HashSet<>();
    private SubscriptionStatus mostSerious;
    private String firstFailure;
    private String lookupFailure;
    private Cause notAttemptedCause;
    private String notAttemptedBecause;
    private String nobodyBecause;
    private long lastSuccess;
  }

  private final Map<UUID, Tally> byDestination = new LinkedHashMap<>();
  private final Map<String, String> notAttemptedChannels = new LinkedHashMap<>();

  void delivered(UUID destinationId, Object target) {
    Tally tally = tallyOf(destinationId);
    tally.attempted.add(target);
    tally.lastSuccess = System.currentTimeMillis();
  }

  /**
   * @param target what identifies the recipient, so one that fails for every event of a tick is
   *     one failed recipient
   * @param status what the send left behind, or null when it only threw
   */
  void failed(
      UUID destinationId,
      Object target,
      String recipientName,
      String reason,
      SubscriptionStatus status) {
    Tally tally = tallyOf(destinationId);
    tally.attempted.add(target);
    tally.failed.add(target);
    if (tally.firstFailure == null) {
      tally.firstFailure = recipientName + ": " + reason;
    }
    if (isMoreSerious(status, tally.mostSerious)) {
      tally.mostSerious = status == null ? failedNow(reason) : status;
    }
  }

  /** Nothing was resolved, rendered or sent, for a reason that is not the destination's fault. */
  void notAttempted(UUID destinationId, String channelId, Cause cause, String why) {
    Tally tally = tallyOf(destinationId);
    if (tally.notAttemptedBecause == null) {
      tally.notAttemptedCause = cause;
      tally.notAttemptedBecause = why;
    }
    notAttemptedChannels.putIfAbsent(channelId, why);
  }

  /** The destination had nobody to send an event to. A delivery in the same tick outranks it. */
  void nobodyToSendTo(UUID destinationId, String why) {
    Tally tally = tallyOf(destinationId);
    if (tally.nobodyBecause == null) {
      tally.nobodyBecause = why;
    }
  }

  void lookupFailed(UUID destinationId, String reason) {
    Tally tally = tallyOf(destinationId);
    if (tally.lookupFailure == null) {
      tally.lookupFailure = reason;
    }
  }

  void reportTo(BiConsumer<UUID, DestinationOutcome> ledger) {
    byDestination.forEach((destinationId, tally) -> ledger.accept(destinationId, sum(tally)));
  }

  /** Each channel that was not attempted in this tick, with the first reason it gave. */
  Map<String, String> notAttemptedChannels() {
    return Map.copyOf(notAttemptedChannels);
  }

  private static DestinationOutcome sum(Tally tally) {
    return tally.failed.isEmpty() ? withNoRecipientFailed(tally) : recipientsFailed(tally);
  }

  private static DestinationOutcome recipientsFailed(Tally tally) {
    return DestinationOutcome.failed(
        tally.mostSerious.withLastFailedReason(
            String.format(
                "%d of %d recipients failed. %s",
                tally.failed.size(), tally.attempted.size(), tally.firstFailure)));
  }

  private static DestinationOutcome withNoRecipientFailed(Tally tally) {
    return tally.lookupFailure == null
        ? notAttemptedOrDelivered(tally)
        : DestinationOutcome.failed(
            failedNow("Recipients could not be looked up: " + tally.lookupFailure));
  }

  private static DestinationOutcome notAttemptedOrDelivered(Tally tally) {
    boolean reachedNobody = tally.lastSuccess == 0 && tally.nobodyBecause != null;
    return tally.notAttemptedBecause == null && !reachedNobody
        ? DestinationOutcome.delivered(
            AlertUtil.buildSubscriptionStatus(
                ACTIVE, tally.lastSuccess, null, null, null, tally.lastSuccess, tally.lastSuccess))
        : notAttempted(tally);
  }

  private static DestinationOutcome notAttempted(Tally tally) {
    boolean channelLevel = tally.notAttemptedBecause != null;
    return DestinationOutcome.notAttempted(
        channelLevel ? tally.notAttemptedCause : Cause.NO_RECIPIENT,
        channelLevel ? tally.notAttemptedBecause : tally.nobodyBecause,
        System.currentTimeMillis());
  }

  // Failed before awaiting retry: an endpoint that answered with an error was at least reached.
  private static boolean isMoreSerious(SubscriptionStatus candidate, SubscriptionStatus known) {
    boolean knownIsOnlyAwaiting = known != null && known.getStatus() == AWAITING_RETRY;
    boolean candidateIsFailed = candidate == null || candidate.getStatus() == FAILED;
    return known == null || (knownIsOnlyAwaiting && candidateIsFailed);
  }

  private static SubscriptionStatus failedNow(String reason) {
    long now = System.currentTimeMillis();
    return new SubscriptionStatus()
        .withStatus(FAILED)
        .withLastFailedAt(now)
        .withLastFailedReason(reason)
        .withTimestamp(now);
  }

  private Tally tallyOf(UUID destinationId) {
    return byDestination.computeIfAbsent(destinationId, id -> new Tally());
  }
}
