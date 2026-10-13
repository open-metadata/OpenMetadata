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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.DestinationHealth;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.service.events.subscription.ledger.DestinationOutcome;
import org.openmetadata.service.events.subscription.ledger.DestinationOutcome.Cause;
import org.openmetadata.service.events.subscription.ledger.HealthStreak;

class HealthAttributionTest {
  private static final String MAIL_SERVER_OFF = "the mail server is not enabled";
  private static final String NO_OWNERS = "no Owners with a Slack address";
  private final UUID owners = UUID.randomUUID();

  @Test
  void fanOutDestinationReportsHowManyFailed() {
    TickHealth health = new TickHealth();
    for (int person = 0; person < 8; person++) {
      health.delivered(owners, "person-" + person);
    }
    health.failed(owners, "bob", "bob", "Connection refused", null);
    health.failed(owners, "bob", "bob", "Connection refused", null);

    SubscriptionStatus status = reported(health).get(owners);

    assertEquals(SubscriptionStatus.Status.FAILED, status.getStatus());
    assertEquals("1 of 9 recipients failed. bob: Connection refused", status.getLastFailedReason());
  }

  @Test
  void everyTargetDeliveredReadsActive() {
    TickHealth health = new TickHealth();
    health.delivered(owners, "alice");

    SubscriptionStatus status = reported(health).get(owners);

    assertEquals(SubscriptionStatus.Status.ACTIVE, status.getStatus());
    assertTrue(status.getLastSuccessfulAt() > 0);
  }

  // An endpoint that answered with an error was at least reached.
  @Test
  void failedIsMoreSeriousThanAwaitingRetry() {
    TickHealth health = new TickHealth();
    SubscriptionStatus answeredWithAnError =
        new SubscriptionStatus().withStatus(SubscriptionStatus.Status.AWAITING_RETRY);
    health.failed(owners, "carol", "carol", "HTTP 500", answeredWithAnError);
    health.failed(owners, "bob", "bob", "Connection refused", null);

    SubscriptionStatus status = reported(health).get(owners);

    assertEquals(SubscriptionStatus.Status.FAILED, status.getStatus());
    assertEquals("2 of 2 recipients failed. carol: HTTP 500", status.getLastFailedReason());
  }

  @Test
  void lookupFailureIsChargedToItsDestinationOnly() {
    UUID followers = UUID.randomUUID();
    TickHealth health = new TickHealth();
    health.lookupFailed(owners, "team A: no answer");
    health.delivered(owners, "alice");
    health.delivered(followers, "bob");

    Map<UUID, SubscriptionStatus> status = reported(health);

    assertEquals(SubscriptionStatus.Status.FAILED, status.get(owners).getStatus());
    assertEquals(
        "Recipients could not be looked up: team A: no answer",
        status.get(owners).getLastFailedReason());
    assertEquals(SubscriptionStatus.Status.ACTIVE, status.get(followers).getStatus());
  }

  @Test
  void destinationWithNoTargetSaysNothing() {
    assertTrue(reported(new TickHealth()).isEmpty());
  }

  @Test
  void notAttemptedReadsFailedWithItsReason() {
    TickHealth health = new TickHealth();
    health.notAttempted(owners, "email", Cause.CHANNEL_UNAVAILABLE, MAIL_SERVER_OFF);

    SubscriptionStatus status = reported(health).get(owners);

    assertEquals(SubscriptionStatus.Status.FAILED, status.getStatus());
    assertEquals("Not attempted: the mail server is not enabled", status.getLastFailedReason());
  }

  // Nobody to send to in the whole tick reads not attempted, with why, and starts no streak.
  @Test
  void aTickThatReachedNobodyReadsNotAttempted() {
    TickHealth health = new TickHealth();
    health.nobodyToSendTo(owners, NO_OWNERS);
    health.nobodyToSendTo(owners, NO_OWNERS);

    Map<UUID, DestinationOutcome> outcomes = new HashMap<>();
    health.reportTo(outcomes::put);
    DestinationOutcome outcome = outcomes.get(owners);

    assertEquals(DestinationOutcome.Kind.NOT_ATTEMPTED, outcome.kind());
    assertEquals(Cause.NO_RECIPIENT, outcome.cause());
    assertEquals("Not attempted: " + NO_OWNERS, outcome.status().getLastFailedReason());
    assertEquals(0, HealthStreak.after(null, outcome).getConsecutiveFailedTicks());
  }

  // It is the weakest outcome: one event that reached someone is enough to read delivered.
  @Test
  void aTickThatReachedSomeoneReadsActiveWhateverElseFoundNobody() {
    TickHealth health = new TickHealth();
    health.nobodyToSendTo(owners, NO_OWNERS);
    health.delivered(owners, "alice");
    health.nobodyToSendTo(owners, NO_OWNERS);

    assertEquals(SubscriptionStatus.Status.ACTIVE, reported(health).get(owners).getStatus());
  }

  @Test
  void reasonCarriesTheFailureStreak() {
    long since = 1_789_983_600_000L;
    DestinationHealth before =
        new DestinationHealth().withConsecutiveFailedTicks(11).withFailingSince(since);
    SubscriptionStatus thisTick =
        new SubscriptionStatus()
            .withStatus(SubscriptionStatus.Status.FAILED)
            .withLastFailedReason("1 of 9 recipients failed. bob: Connection refused")
            .withTimestamp(since + 1);

    DestinationHealth after = HealthStreak.after(before, DestinationOutcome.failed(thisTick));

    assertEquals(12, after.getConsecutiveFailedTicks());
    assertEquals(
        "1 of 9 recipients failed. bob: Connection refused, failing for 12 ticks since "
            + Instant.ofEpochMilli(since).truncatedTo(ChronoUnit.MINUTES),
        after.getStatus().getLastFailedReason());
  }

  @Test
  void firstFailingTickSaysNoStreak() {
    SubscriptionStatus thisTick =
        new SubscriptionStatus()
            .withStatus(SubscriptionStatus.Status.FAILED)
            .withLastFailedReason("Connection refused")
            .withTimestamp(1L);

    assertEquals(
        "Connection refused",
        HealthStreak.after(null, DestinationOutcome.failed(thisTick))
            .getStatus()
            .getLastFailedReason());
  }

  // A mail server that is off is not the destination failing, however many ticks it lasts.
  @Test
  void threeNotAttemptedTicksCarryNoStreak() {
    DestinationHealth health = null;
    for (int tick = 0; tick < 3; tick++) {
      health = HealthStreak.after(health, notAttempted());
    }

    assertEquals(0, health.getConsecutiveFailedTicks());
    assertEquals("Not attempted: " + MAIL_SERVER_OFF, health.getStatus().getLastFailedReason());
  }

  @Test
  void aFailureAfterNotAttemptedTicksStartsItsOwnStreak() {
    DestinationHealth health = HealthStreak.after(null, notAttempted());
    health = HealthStreak.after(health, notAttempted());

    health = HealthStreak.after(health, DestinationOutcome.failed(refused()));

    assertEquals(1, health.getConsecutiveFailedTicks());
    assertEquals("Connection refused", health.getStatus().getLastFailedReason());
  }

  @Test
  void notAttemptedEndsARunOfFailures() {
    DestinationHealth failing =
        new DestinationHealth().withConsecutiveFailedTicks(5).withFailingSince(1L);

    DestinationHealth after = HealthStreak.after(failing, notAttempted());

    assertEquals(0, after.getConsecutiveFailedTicks());
    assertNull(after.getFailingSince());
  }

  // What a tick learns later, that the channel stopped or that a team could not be read, never
  // hides a recipient that failed earlier in it.
  @Test
  void aFailureIsNotHiddenByALaterNotAttemptedOrLookupFailure() {
    TickHealth health = new TickHealth();
    health.failed(owners, "bob", "bob", "Connection refused", null);
    health.notAttempted(owners, "email", Cause.CHANNEL_UNAVAILABLE, MAIL_SERVER_OFF);
    health.lookupFailed(owners, "team A: no answer");

    DestinationOutcome outcome = outcomes(health).get(owners);

    assertEquals(DestinationOutcome.Kind.FAILED, outcome.kind());
    assertEquals(
        "1 of 1 recipients failed. bob: Connection refused",
        outcome.status().getLastFailedReason());
  }

  // A channel that failed as a whole reached nobody, whatever else the tick delivered.
  @Test
  void aChannelFailureReadsFailedAndStartsAStreak() {
    TickHealth health = new TickHealth();
    health.delivered(owners, "alice");
    health.channelFailed(owners, "template helper blew up");

    DestinationOutcome outcome = outcomes(health).get(owners);

    assertEquals(DestinationOutcome.Kind.FAILED, outcome.kind());
    assertEquals("Could not send: template helper blew up", outcome.status().getLastFailedReason());
    assertEquals(1, HealthStreak.after(null, outcome).getConsecutiveFailedTicks());
  }

  @Test
  void aChannelFailureIsNotHiddenByALaterDeliveryOrLookupFailure() {
    TickHealth health = new TickHealth();
    health.channelFailed(owners, "template helper blew up");
    health.lookupFailed(owners, "team A: no answer");
    health.delivered(owners, "alice");

    assertEquals(DestinationOutcome.Kind.FAILED, outcomes(health).get(owners).kind());
    assertEquals(
        "Could not send: template helper blew up",
        outcomes(health).get(owners).status().getLastFailedReason());
  }

  // Its reason starts like one, but a target that could not be reached earlier in the tick failed.
  @Test
  void unreachableEarlierInThisTickStillCountsAsAFailure() {
    TickHealth health = new TickHealth();
    health.failed(owners, "bob", "bob", "Not attempted: unreachable earlier in this tick", null);

    DestinationOutcome outcome = outcomes(health).get(owners);

    assertEquals(DestinationOutcome.Kind.FAILED, outcome.kind());
    assertEquals(1, HealthStreak.after(null, outcome).getConsecutiveFailedTicks());
  }

  @Test
  void aChannelThatWasNotAttemptedIsNamedOnce() {
    TickHealth health = new TickHealth();
    health.notAttempted(owners, "email", Cause.CHANNEL_UNAVAILABLE, MAIL_SERVER_OFF);
    health.notAttempted(UUID.randomUUID(), "email", Cause.CHANNEL_UNAVAILABLE, MAIL_SERVER_OFF);

    assertEquals(Map.of("email", MAIL_SERVER_OFF), health.notAttemptedChannels());
  }

  private static DestinationOutcome notAttempted() {
    return DestinationOutcome.notAttempted(Cause.CHANNEL_UNAVAILABLE, MAIL_SERVER_OFF, 1L);
  }

  private static SubscriptionStatus refused() {
    return new SubscriptionStatus()
        .withStatus(SubscriptionStatus.Status.FAILED)
        .withLastFailedReason("Connection refused")
        .withTimestamp(2L);
  }

  private static Map<UUID, DestinationOutcome> outcomes(TickHealth health) {
    Map<UUID, DestinationOutcome> reported = new HashMap<>();
    health.reportTo(reported::put);
    return reported;
  }

  private static Map<UUID, SubscriptionStatus> reported(TickHealth health) {
    Map<UUID, SubscriptionStatus> reported = new HashMap<>();
    health.reportTo((destinationId, outcome) -> reported.put(destinationId, outcome.status()));
    return reported;
  }
}
