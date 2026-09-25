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

package org.openmetadata.service.events.subscription.channels.builtin;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.subscription.channels.AddressDirectory;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.context.WebhookRecipient;

/**
 * Webhook addresses of one channel: the webhook a user or a team keeps on their profile for it,
 * and the endpoint or receivers a destination is configured with.
 */
@Slf4j
final class WebhookAddresses implements AddressDirectory {
  private final Function<SubscriptionConfig, Webhook> onProfile;

  WebhookAddresses(Function<SubscriptionConfig, Webhook> onProfile) {
    this.onProfile = onProfile;
  }

  @Override
  public Recipient ofUser(User user) {
    return WebhookRecipient.ofProfile(user.getName(), user.getProfile(), onProfile);
  }

  @Override
  public Recipient ofTeam(Team team) {
    return WebhookRecipient.ofProfile(team.getName(), team.getProfile(), onProfile);
  }

  @Override
  public Set<Recipient> configured(SubscriptionAction action, SubscriptionDestination destination) {
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
}
