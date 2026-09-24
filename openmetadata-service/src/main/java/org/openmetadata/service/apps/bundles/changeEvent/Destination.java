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

package org.openmetadata.service.apps.bundles.changeEvent;

import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.ACTIVE;
import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.AWAITING_RETRY;
import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.FAILED;

import java.util.Optional;
import java.util.Set;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.StatusContext;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.entity.events.TestDestinationStatus;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.notifications.EventContent;
import org.openmetadata.service.notifications.recipients.context.Recipient;

public interface Destination<T> {
  void sendMessage(T event, Set<Recipient> recipients) throws EventPublisherException;

  /**
   * What this destination sends for an event, made once however many targets receive it. A
   * destination that does not say otherwise is handed the event itself.
   */
  default Object prepare(T event) throws EventPublisherException {
    return event;
  }

  /**
   * As {@link #prepare(Object)}, with the content the alert's channels share for this event, so a
   * destination that renders a template formats what was rendered once and never renders again.
   */
  default Object prepare(T event, EventContent content) throws EventPublisherException {
    return prepare(event);
  }

  /**
   * Sends what {@link #prepare} answered to one recipient, or to the destination itself when it
   * is its own target and the recipient is null. The outcome is left in the status details.
   */
  @SuppressWarnings("unchecked")
  default void sendTo(Object prepared, Recipient recipient) throws EventPublisherException {
    sendMessage((T) prepared, recipient == null ? Set.of() : Set.of(recipient));
  }

  /**
   * Why nothing can be sent through this destination right now, such as a mail server that is
   * switched off. Nothing is resolved or rendered for it, and that is not a delivery failure.
   */
  default Optional<String> notAttemptedBecause() {
    return Optional.empty();
  }

  /**
   * True for a destination whose message is its file, such as a report. When the file could not
   * be produced, nothing is sent, which is not a delivery failure.
   */
  default boolean requiresAFile() {
    return false;
  }

  void sendTestMessage() throws EventPublisherException;

  /**
   * Indicates whether this destination requires resolved recipients to send notifications.
   * Most destinations (Email, Slack, Teams, etc.) require recipients.
   * Some destinations (ActivityFeed, GovernanceWorkflow) handle their own delivery mechanism
   * and don't use recipient resolution.
   *
   * @return true if recipients must be resolved before sending, false otherwise
   */
  default boolean requiresRecipients() {
    return true;
  }

  SubscriptionDestination getSubscriptionDestination();

  EventSubscription getEventSubscriptionForDestination();

  void close();

  boolean getEnabled();

  default void setErrorStatus(Long attemptTime, Integer statusCode, String reason) {
    setStatus(FAILED, attemptTime, statusCode, reason, null);
  }

  default void setAwaitingRetry(Long attemptTime, int statusCode, String reason) {
    setStatus(AWAITING_RETRY, attemptTime, statusCode, reason, attemptTime + 10);
  }

  default void setSuccessStatus(Long updateTime) {
    SubscriptionStatus subStatus =
        AlertUtil.buildSubscriptionStatus(
            ACTIVE, updateTime, null, null, null, updateTime, updateTime);
    getSubscriptionDestination().setStatusDetails(subStatus);
    SendStatus.left(subStatus);
  }

  default void setStatus(
      SubscriptionStatus.Status status,
      Long attemptTime,
      Integer statusCode,
      String reason,
      Long timestamp) {
    SubscriptionStatus subStatus =
        AlertUtil.buildSubscriptionStatus(
            status, null, attemptTime, statusCode, reason, timestamp, attemptTime);
    getSubscriptionDestination().setStatusDetails(subStatus);
    SendStatus.left(subStatus);
  }

  default void setStatusForTestDestination(
      TestDestinationStatus.Status status, StatusContext statusContext) {
    TestDestinationStatus subStatus = AlertUtil.buildTestDestinationStatus(status, statusContext);
    getSubscriptionDestination().setStatusDetails(subStatus);
  }

  default void setStatusForTestDestination(
      TestDestinationStatus.Status status, Integer statusCode, Long timestamp) {
    TestDestinationStatus subStatus =
        AlertUtil.buildTestDestinationStatus(status, statusCode, timestamp);
    getSubscriptionDestination().setStatusDetails(subStatus);
  }

  default String getDisplayNameOrFqn(EventSubscription eventSubscription) {
    String displayName = eventSubscription.getDisplayName();
    return (CommonUtil.nullOrEmpty(displayName))
        ? eventSubscription.getFullyQualifiedName()
        : displayName;
  }
}
