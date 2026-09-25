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

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.DestinationHealth;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.service.events.subscription.ledger.HealthStreak;

class HealthAttributionTest {
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
    health.notAttempted(owners, "the mail server is not enabled");

    SubscriptionStatus status = reported(health).get(owners);

    assertEquals(SubscriptionStatus.Status.FAILED, status.getStatus());
    assertEquals("Not attempted: the mail server is not enabled", status.getLastFailedReason());
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

    DestinationHealth after = HealthStreak.after(before, thisTick);

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
        "Connection refused", HealthStreak.after(null, thisTick).getStatus().getLastFailedReason());
  }

  private static Map<UUID, SubscriptionStatus> reported(TickHealth health) {
    Map<UUID, SubscriptionStatus> reported = new HashMap<>();
    health.reportTo(reported::put);
    return reported;
  }
}
