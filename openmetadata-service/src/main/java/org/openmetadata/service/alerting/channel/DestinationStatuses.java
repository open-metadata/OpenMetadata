/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.alerting.channel;

import java.net.URI;
import org.openmetadata.schema.entity.events.StatusContext;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.entity.events.TestDestinationStatus;

/** The statuses a destination reports, after a delivery or a test send. */
public final class DestinationStatuses {

  public static SubscriptionStatus buildSubscriptionStatus(
      SubscriptionStatus.Status status,
      Long lastSuccessful,
      Long lastFailure,
      Integer statusCode,
      String reason,
      Long nextAttempt,
      Long timeStamp) {
    return new SubscriptionStatus()
        .withStatus(status)
        .withLastSuccessfulAt(lastSuccessful)
        .withLastFailedAt(lastFailure)
        .withLastFailedStatusCode(statusCode)
        .withLastFailedReason(reason)
        .withNextAttempt(nextAttempt)
        .withTimestamp(timeStamp);
  }

  /**
   * A destination whose stored configuration a send found it cannot use, such as a secret to enter
   * again: it does not send until the configuration is changed. It failed when the send found it.
   */
  public static SubscriptionStatus configurationUnusable(String reason, long failedAt) {
    return unusable(reason, failedAt, failedAt);
  }

  /**
   * The same status, found by reading the stored configuration rather than by a send: nothing
   * failed then, so it carries no failure time.
   */
  public static SubscriptionStatus configurationUnusableAsRead(String reason, long readAt) {
    return unusable(reason, null, readAt);
  }

  // The one place this status is built.
  private static SubscriptionStatus unusable(String reason, Long failedAt, long at) {
    return buildSubscriptionStatus(
            SubscriptionStatus.Status.FAILED, null, failedAt, null, reason, null, at)
        .withConfigurationUnusable(true);
  }

  public static TestDestinationStatus buildTestDestinationStatus(
      TestDestinationStatus.Status status, Integer statusCode, Long timestamp) {
    return new TestDestinationStatus()
        .withStatus(status)
        .withStatusCode(statusCode)
        .withTimestamp(timestamp);
  }

  public static TestDestinationStatus buildTestDestinationStatus(
      TestDestinationStatus.Status status, String reason, Long timestamp) {
    return new TestDestinationStatus()
        .withStatus(status)
        .withReason(reason)
        .withTimestamp(timestamp);
  }

  public static TestDestinationStatus buildTestDestinationStatus(
      TestDestinationStatus.Status status, StatusContext statusContext) {
    return new TestDestinationStatus()
        .withStatus(status)
        .withReason(statusContext.getStatusInfo())
        .withStatusCode(statusContext.getStatusCode())
        .withStatusInfo(statusContext.getStatusInfo())
        .withHeaders(statusContext.getHeaders())
        .withEntity(statusContext.getEntity())
        .withMediaType(statusContext.getMediaType())
        .withLocation(URI.create(statusContext.getLocation()))
        .withTimestamp(statusContext.getTimestamp());
  }

  private DestinationStatuses() {}
}
