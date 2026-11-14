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

package org.openmetadata.service.events.consumer.ledger;

import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.service.alerting.channel.DestinationStatuses;

/**
 * What one tick came to for one destination. The status an API reads has no "not attempted", so a
 * destination that was not attempted reads Failed, with a reason that says so, written here and
 * nowhere else. What the tick came to, not how it reads, decides the failure streak: only a failure
 * starts or extends one.
 *
 * @param cause why it was not attempted, or {@link Cause#NONE}
 * @param configurationFingerprint which stored settings were found unusable, with {@link
 *     Cause#CONFIGURATION_UNUSABLE} only; null otherwise
 */
public record DestinationOutcome(
    Kind kind, Cause cause, SubscriptionStatus status, String configurationFingerprint) {

  public enum Kind {
    DELIVERED,
    FAILED,
    NOT_ATTEMPTED
  }

  /** Why a destination was not attempted: few enough to label a metric. */
  public enum Cause {
    NONE,
    CHANNEL_UNAVAILABLE,
    CHANNEL_NOT_REGISTERED,
    CONFIGURATION_UNUSABLE,
    FILE_MISSING,
    NO_RECIPIENT
  }

  private static final String NOT_ATTEMPTED = "Not attempted: ";

  /** How a reason reads wherever it was not attempted: on the destination and on the event. */
  public static String notAttemptedReason(String why) {
    return NOT_ATTEMPTED + why;
  }

  public static DestinationOutcome delivered(SubscriptionStatus status) {
    return new DestinationOutcome(Kind.DELIVERED, Cause.NONE, status, null);
  }

  public static DestinationOutcome failed(SubscriptionStatus status) {
    return new DestinationOutcome(Kind.FAILED, Cause.NONE, status, null);
  }

  public static DestinationOutcome notAttempted(Cause cause, String why, long at) {
    return notAttempted(cause, why, at, null);
  }

  /**
   * A stored configuration that cannot be used reads as one, so the alert shows what to change, and
   * keeps the fingerprint of the settings found unusable, so a change to them ends it.
   */
  public static DestinationOutcome notAttempted(
      Cause cause, String why, long at, String configurationFingerprint) {
    boolean unusable = cause == Cause.CONFIGURATION_UNUSABLE;
    SubscriptionStatus status =
        unusable
            ? DestinationStatuses.configurationUnusable(notAttemptedReason(why), at)
            : new SubscriptionStatus()
                .withStatus(SubscriptionStatus.Status.FAILED)
                .withLastFailedAt(at)
                .withLastFailedReason(notAttemptedReason(why))
                .withTimestamp(at);
    return new DestinationOutcome(
        Kind.NOT_ATTEMPTED, cause, status, unusable ? configurationFingerprint : null);
  }
}
