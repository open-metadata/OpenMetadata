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

package org.openmetadata.service.events.subscription.ledger;

import org.openmetadata.schema.entity.events.SubscriptionStatus;

/**
 * What one tick came to for one destination. The status an API reads has no "not attempted", so a
 * destination that was not attempted reads Failed, with a reason that says so, written here and
 * nowhere else. What the tick came to, not how it reads, decides the failure streak: only a failure
 * starts or extends one.
 *
 * @param cause why it was not attempted, or {@link Cause#NONE}
 */
public record DestinationOutcome(Kind kind, Cause cause, SubscriptionStatus status) {

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
    FILE_MISSING
  }

  private static final String NOT_ATTEMPTED = "Not attempted: ";

  public static DestinationOutcome delivered(SubscriptionStatus status) {
    return new DestinationOutcome(Kind.DELIVERED, Cause.NONE, status);
  }

  public static DestinationOutcome failed(SubscriptionStatus status) {
    return new DestinationOutcome(Kind.FAILED, Cause.NONE, status);
  }

  public static DestinationOutcome notAttempted(Cause cause, String why, long at) {
    SubscriptionStatus status =
        new SubscriptionStatus()
            .withStatus(SubscriptionStatus.Status.FAILED)
            .withLastFailedAt(at)
            .withLastFailedReason(NOT_ATTEMPTED + why)
            .withTimestamp(at);
    return new DestinationOutcome(Kind.NOT_ATTEMPTED, cause, status);
  }
}
