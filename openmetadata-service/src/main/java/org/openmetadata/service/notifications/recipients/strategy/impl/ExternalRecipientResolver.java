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

package org.openmetadata.service.notifications.recipients.strategy.impl;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.context.WebhookRecipient;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;

/**
 * Resolves static recipients configured directly in the subscription destination.
 *
 * For EXTERNAL destinations, recipients are explicitly configured and do not depend
 * on entity relationships. The receivers are already the final contact information
 * (email addresses or webhook URLs) and require no further resolution.
 */
@Slf4j
public class ExternalRecipientResolver implements RecipientResolutionStrategy {

  @Override
  public Set<Recipient> resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination) {
    return resolveExternalRecipients(action, destination);
  }

  @Override
  public Set<Recipient> resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination) {
    return resolveExternalRecipients(action, destination);
  }

  private Set<Recipient> resolveExternalRecipients(
      SubscriptionAction action, SubscriptionDestination destination) {
    Set<Recipient> recipients;
    try {
      recipients =
          destination.getType() == SubscriptionDestination.SubscriptionType.EMAIL
              ? resolveEmailRecipients(action)
              : resolveWebhookRecipients(action, destination);
    } catch (IllegalArgumentException e) {
      LOG.error("Failed to resolve external recipients", e);
      recipients = Set.of();
    }
    return recipients;
  }

  private Set<Recipient> resolveEmailRecipients(SubscriptionAction action) {
    Set<Recipient> recipients = Set.of();
    if (action != null && !nullOrEmpty(action.getReceivers())) {
      recipients =
          action.getReceivers().stream()
              .map(EmailRecipient::new)
              .collect(Collectors.toUnmodifiableSet());
    }
    return recipients;
  }

  private Set<Recipient> resolveWebhookRecipients(
      SubscriptionAction action, SubscriptionDestination destination) {
    Webhook webhook = JsonUtils.convertValue(destination.getConfig(), Webhook.class);
    Set<Recipient> recipients = configuredEndpoint(webhook);
    if (action != null && !nullOrEmpty(action.getReceivers())) {
      recipients =
          action.getReceivers().stream()
              .map(receiver -> webhookForReceiver(webhook, receiver))
              .flatMap(Optional::stream)
              .map(WebhookRecipient::new)
              .collect(Collectors.toUnmodifiableSet());
    }
    return recipients;
  }

  private Set<Recipient> configuredEndpoint(Webhook webhook) {
    return webhook == null || webhook.getEndpoint() == null
        ? Set.of()
        : Set.of(new WebhookRecipient(webhook));
  }

  /**
   * Empty for a receiver that is not a usable endpoint. Receivers are admin-typed strings, so one
   * unsubstituted template or stray space must not discard the valid receivers alongside it.
   */
  private Optional<Webhook> webhookForReceiver(Webhook webhook, String receiver) {
    Optional<Webhook> configured = Optional.empty();
    try {
      if (nullOrEmpty(receiver) || receiver.isBlank()) {
        LOG.warn("Skipping blank webhook receiver");
      } else {
        configured = Optional.of(copyOf(webhook).withEndpoint(new URI(receiver)));
      }
    } catch (URISyntaxException exception) {
      LOG.warn("Skipping webhook receiver '{}': {}", receiver, exception.getMessage());
    }
    return configured;
  }

  private Webhook copyOf(Webhook webhook) {
    return webhook == null ? new Webhook() : JsonUtils.convertValue(webhook, Webhook.class);
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.EXTERNAL;
  }
}
