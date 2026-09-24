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

/**
 * What a tick learned about each destination. A destination's health is the sum of the outcomes of
 * the targets it produced: every one delivered reads Active, and any failure reads as the most
 * serious one, saying how many of how many recipients failed and naming the first. A destination
 * that produced no target in this tick says nothing, so its health stays what it was.
 */
final class TickHealth {
  private static final String NOT_ATTEMPTED = "Not attempted: ";

  private static final class Tally {
    private final Set<Object> attempted = new HashSet<>();
    private final Set<Object> failed = new HashSet<>();
    private SubscriptionStatus mostSerious;
    private String firstFailure;
    private long lastSuccess;
  }

  private final Map<UUID, Tally> byDestination = new LinkedHashMap<>();

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
  void notAttempted(UUID destinationId, String why) {
    Tally tally = tallyOf(destinationId);
    tally.mostSerious = failedNow(NOT_ATTEMPTED + why);
    tally.firstFailure = null;
  }

  void lookupFailed(UUID destinationId, String reason) {
    Tally tally = tallyOf(destinationId);
    tally.mostSerious = failedNow("Recipients could not be looked up: " + reason);
    tally.firstFailure = null;
  }

  boolean covers(UUID destinationId) {
    return byDestination.containsKey(destinationId);
  }

  void reportTo(BiConsumer<UUID, SubscriptionStatus> ledger) {
    byDestination.forEach((destinationId, tally) -> ledger.accept(destinationId, sum(tally)));
  }

  private static SubscriptionStatus sum(Tally tally) {
    SubscriptionStatus summed;
    if (tally.mostSerious == null) {
      summed =
          AlertUtil.buildSubscriptionStatus(
              ACTIVE, tally.lastSuccess, null, null, null, tally.lastSuccess, tally.lastSuccess);
    } else if (tally.firstFailure == null) {
      summed = tally.mostSerious;
    } else {
      summed =
          tally.mostSerious.withLastFailedReason(
              String.format(
                  "%d of %d recipients failed. %s",
                  tally.failed.size(), tally.attempted.size(), tally.firstFailure));
    }
    return summed;
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
